import * as T from "./vendor/three.module.js";
import { mobileControls } from "./mobile-controls.js?v=lobby35";
import { buildMuseumGrounds } from "./museum-grounds.js?v=atrium40";
import {createFloorReflection} from "./lobby-floor-reflection.js?v=material45";
import { buildLobby } from "./lobby-interior.js?v=material45";

const eyeHeight = 1.60;
const walkInRadius = .90;
const arrivalPitch = .085;
const receptionX=1.05, receptionSetback=.68, receptionPitch=.021;
const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"]);
const clamp = T.MathUtils.clamp;
const shortestTurn = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

// Integrate short acceleration and braking ramps around a steady walking speed.
function walkingProgress(t) {
  const ramp = .18;
  if (t < ramp) return t*t / (2*ramp*(1-ramp));
  if (t > 1-ramp) return 1 - (1-t)*(1-t) / (2*ramp*(1-ramp));
  return (t-ramp/2)/(1-ramp);
}
function doorCoordinates(pos, door) {
  const x = pos.x - door.x, z = pos.z - door.z;
  return { depth:x*door.nx+z*door.nz, offset:x*door.nz-z*door.nx };
}
function atDoor(door, depth, offset=0) {
  return new T.Vector3(door.x+depth*door.nx+offset*door.nz,eyeHeight,door.z+depth*door.nz-offset*door.nx);
}


function placeDoors(doors) {
  return {doors:doors.map((door,index)=>({...door,index})),halfWidth:5.7,halfDepth:5.9};
}

export function createLobby(host, doors, onEnter, options = {}) {
  const plan = placeDoors(doors);
  const mainDoor = {x:0,z:plan.halfDepth,nx:0,nz:1,yaw:0,width:4.8};
  const mainExit = {...mainDoor,nz:-1,yaw:Math.PI};
  const clearRadius = .16, opening = mainDoor.width/2-clearRadius;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(61, 1, .06, Math.max(85, 4 * Math.hypot(plan.halfDepth, plan.halfWidth) + 35));
  camera.rotation.order = "YXZ";
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "展場大廳");
  canvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight W A S D Enter R");
  const listeners = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, {signal: listeners.signal});
  const keys = new Map();
  const raycaster = new T.Raycaster(), point = new T.Vector2();
  const opaqueMeshes=[],intersectionPoint=new T.Vector3(),obstructions=[];
  let floorReflection;
  let interior, grounds, stick, observer, zone;
  let disposed = false, paused = false, entering = false, space = false;
  let drag = null, nearest, dirty = true, frame = 0, last = 0;
  let approach = null, hoverPosition=null, hovered=null;
  let mouseHighlight=false,cardsAnimating=false,cardsExpanded=false;
  let receptionTargets=[],expandedTargets=[];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function invalidate() {
    dirty = true;
    if (!frame && !disposed && !paused && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function clearInput() {
    keys.clear();
    space = false;
    stick?.release();
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    setPointerHighlight(false,null);
    canvas.style.cursor = "grab";
  }
  function setPaused(value) {
    if (disposed) return;
    clearInput();
    if (value) cancelApproach();
    paused = Boolean(value);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!paused) invalidate();
  }
  function syncZone() {
    const next = camera.position.z > plan.halfDepth ? "grounds" : "lobby";
    if(next!==zone) {
      zone=next;
      if(zone==="grounds" && cardsExpanded) {
        cardsExpanded=false;
        options.onMenuOpen?.(false);
      }
      options.onZone?.(zone);
    }
  }
  function fitView() {
    // A vertical phone can read the full entry façade from the forecourt.
    // On the walk inside, the wider architectural view eases into eye level.
    const wide=clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(.449)/camera.aspect)),48,91);
    const blend=T.MathUtils.smoothstep(camera.position.z-plan.halfDepth,1.2,8);
    // A portrait frame takes in the left counter and the right-hand enfilade
    // together. Open the lens only once the visitor is within the foyer.
    const interiorWidth=clamp(T.MathUtils.radToDeg(2*Math.atan(.79/camera.aspect)),61,112);
    const inside=T.MathUtils.smoothstep(plan.halfDepth-camera.position.z,0,.92);
    const fov=T.MathUtils.lerp(T.MathUtils.lerp(61,wide,blend),interiorWidth,inside);
    if(Math.abs(fov-camera.fov)>.005) { camera.fov=fov; camera.updateProjectionMatrix(); }
  }
  function menuIndex() {
    const index=interior?.menuIndex?.();
    return Number.isInteger(index) && plan.doors[index] ? index : null;
  }
  function setMenuOpen(value) {
    if(disposed || paused || entering || approach || zone!=="lobby")return false;
    const open=Boolean(value);
    if(cardsExpanded!==open) {
      cardsExpanded=open;
      setPointerHighlight(false,null);
      options.onMenuOpen?.(open);
      invalidate();
    }
    return true;
  }
  function receptionYaw(position) {
    return Math.atan2(position.x+1.73,position.z+3.05);
  }
  function notifyNearest() {
    // The visible deck defines selection independently of old exhibition locations.
    const choice=zone==="lobby" ? menuIndex() : null;
    if(choice!==nearest) {
      nearest=choice;
      options.onNearest?.(choice);
    }
  }
  function cycleMenu(direction) {
    if(disposed || paused || entering || approach || !cardsExpanded || zone!=="lobby" || !direction)return null;
    const index=interior.shiftMenu?.(Math.sign(direction));
    if(!Number.isInteger(index))return null;
    setPointerHighlight(false,null);
    notifyNearest();
    invalidate();
    return index;
  }
  function selectMenu(index) {
    const from=menuIndex(),count=plan.doors.length;
    if(from==null || from===index || !count)return;
    const forward=(index-from+count)%count;
    const steps=forward<=count/2 ? forward : forward-count;
    for(let i=0;i<Math.abs(steps);i++)interior.shiftMenu(Math.sign(steps));
    notifyNearest();
  }
  function cancelApproach() {
    if (!approach) return;
    approach = null;
    options.onTravel?.(false);
    invalidate();
  }
  function routeThroughDoor(route,start,door,finishDepth) {
    const {depth,offset} = doorCoordinates(start,door);
    const finish = atDoor(door,-finishDepth);
    if (depth > .80 || Math.abs(offset) > door.width/2-.13) {
      // The approach curve and its tangent are inside the room. Its final line
      // passes through the open doorway along the actual wall normal.
      const landingDepth = Math.min(1.5, Math.max(.58,depth*.33));
      const landing = atDoor(door,landingDepth);
      const control = atDoor(door,landingDepth+Math.min(2.2,Math.max(.40,depth*.30)));
      route.add(new T.QuadraticBezierCurve3(start,control,landing));
      start = landing;
    }
    route.add(new T.LineCurve3(start,finish));
    return finish;
  }
  function startApproach(kind, door) {
    if (disposed || paused || entering || !door) return false;
    if (approach?.kind===kind && approach.door===door) return true;
    cancelApproach();
    clearInput();
    const route = new T.CurvePath();
    let start = camera.position.clone();
    if(zone==="grounds" && start.x>opening && start.z<mainDoor.z+3.6) {
      const clear=new T.Vector3(start.x,eyeHeight,mainDoor.z+3.6);
      route.add(new T.LineCurve3(start,clear));
      start=clear;
    }
    if(kind==="grounds" && interior.lobbyRoute) {
      for(const bend of interior.lobbyRoute(start,atDoor(mainExit,1.65))) {
        const next=new T.Vector3(bend.x,eyeHeight,bend.z);
        route.add(new T.LineCurve3(start,next));start=next;
      }
    }
    let finish=routeThroughDoor(route,start,door,kind==="museum" ? 1.65 : .85);
    const look=atDoor(door,-2.4);
    if(kind==="grounds") {
      const end=new T.Vector3(2.15,eyeHeight,plan.halfDepth+9.5);
      route.add(new T.QuadraticBezierCurve3(finish,atDoor(mainExit,-4.8),end));
      finish=end;
    }
    const targetYaw=Math.atan2(camera.position.x-look.x,camera.position.z-look.z);
    const turnAngle=Math.abs(shortestTurn(targetYaw-camera.rotation.y));
    approach = {
      kind,door,route,finish,look,lead:Math.max(0,turnAngle-.55)*.47,elapsed:0,arrived:false,
      seconds:Math.max(.82,route.getLength()/2.6+.36),turnTime:Math.max(.48,turnAngle*.61),
      yaw:camera.rotation.y,targetYaw:camera.rotation.y,pitch:camera.rotation.x,reduced:reducedMotion.matches
    };
    options.onTravel?.(true);
    invalidate();
    return true;
  }
  function enter(index) {
    if(!plan.doors[index] || disposed || paused || entering)return false;
    selectMenu(index);
    cancelApproach();
    clearInput();
    entering=true;
    try {
      onEnter(index);
    } finally {
      entering=false;
    }
    return true;
  }
  function enterMuseum() {
    if(zone!=="grounds")return false;
    return startApproach("museum",mainDoor);
  }
  function exitMuseum() {
    if(zone!=="lobby")return false;
    return startApproach("grounds",mainExit);
  }
  function advanceApproach(dt) {
    const step = approach;
    step.elapsed += dt;
    if (step.reduced) {
      // Keep the original, fully rendered view in place for the destination's
      // short scene dissolve. Reduced motion avoids both the pan and a blank frame.
      step.arrived = step.elapsed >= .09;
      if(step.arrived) {
        camera.position.copy(step.finish);
        if(step.kind==="museum"){camera.position.x=receptionX;camera.position.z+=receptionSetback;}
        const yaw=step.kind==="museum" ? receptionYaw(camera.position) : Math.atan2(step.finish.x,step.finish.z-plan.halfDepth);
        camera.rotation.set(step.kind==="museum" ? receptionPitch : 0,yaw,0,"YXZ");
      }
    } else {
      const t = clamp((step.elapsed-step.lead)/step.seconds,0,1);
      step.route.getPoint(walkingProgress(t),camera.position);
      const depth=mainDoor.z-camera.position.z;
      let aim = Math.atan2(camera.position.x-step.look.x,camera.position.z-step.look.z);
      if(step.kind==="museum" && camera.position.z<mainDoor.z) {
        // Visitors turn towards reception after they have crossed the garden elevation.
        const inside=T.MathUtils.smoothstep(mainDoor.z-camera.position.z,.02,1.65);
        camera.position.x+=receptionX*inside;
        camera.position.z+=receptionSetback*inside;
        aim+=shortestTurn(receptionYaw(camera.position)-aim)*inside;
      } else if(step.kind==="grounds") {
        const outside = camera.position.z-mainDoor.z;
        const facadeYaw = Math.atan2(camera.position.x,Math.max(1,outside));
        // Walk out looking along the path, then gradually look back at the façade.
        const turnBack=T.MathUtils.smoothstep(outside,1.4,9.1);
        if(outside>0) aim=Math.PI+(facadeYaw-Math.PI)*turnBack;
      }
      step.targetYaw += shortestTurn(aim-step.targetYaw);
      const turn = T.MathUtils.smoothstep(step.elapsed,0,step.turnTime);
      camera.rotation.y = T.MathUtils.lerp(step.yaw,step.targetYaw,turn);
      const pitch=step.kind==="museum" ? T.MathUtils.lerp(arrivalPitch,receptionPitch,T.MathUtils.smoothstep(depth,0,1.65))*T.MathUtils.smoothstep(depth,-.3,1.65) : 0;
      camera.rotation.x = T.MathUtils.lerp(step.pitch,pitch,turn);
      step.arrived = t >= 1 && turn >= 1;
    }
    dirty = true;
  }
  function finishApproach() {
    options.onTravel?.(false);
    approach=null;
    notifyNearest();
  }
  function enterNearest() {
    if (disposed || paused || entering) return false;
    if(zone==="grounds")return enterMuseum();
    if(!cardsExpanded)return setMenuOpen(true);
    const active=menuIndex();
    return active!=null && enter(active);
  }
  function faceDoorReturn(index, outdoors=false) {
    const door = plan.doors[index];
    if (!door && outdoors) {
      const phone=matchMedia("(max-width:700px), (pointer:coarse) and (max-height:550px)").matches;
      camera.position.set(phone ? 10.6 : 10.5,eyeHeight,plan.halfDepth+(phone ? 23.6 : 20.7));
      camera.lookAt(phone ? -2.30 : -2.15,phone ? 3.47 : 4.05,plan.halfDepth+.36);
    } else if (!door) {
      camera.position.set(receptionX,eyeHeight,plan.halfDepth-1.65+receptionSetback);
      camera.rotation.set(receptionPitch,receptionYaw(camera.position),0,"YXZ");
    } else {
      selectMenu(index);
      camera.position.set(receptionX,eyeHeight,plan.halfDepth-1.65+receptionSetback);
      const at=interior.menuPoint?.(index);
      camera.lookAt(at?.x ?? -1.56,at?.y ?? 1.30,at?.z ?? .49);
    }
    camera.updateMatrixWorld();
    syncZone();
    if(zone==="lobby")setMenuOpen(Boolean(door));
    fitView();notifyNearest();
    invalidate();
  }
  function home() {
    if (disposed) return;
    clearInput();
    cancelApproach();
    faceDoorReturn(undefined,zone==="grounds");
    canvas.focus({preventScroll: true});
  }
  function turn(yaw, pitch) {
    if (paused || disposed) return;
    camera.rotation.y += yaw;
    camera.rotation.x = clamp(camera.rotation.x + pitch, -1.13, 1.13);
    camera.updateMatrixWorld();
    invalidate();
  }
  function walk(side, forward) {
    const pos = camera.position, yaw = camera.rotation.y;
    const dx = Math.cos(yaw) * side - Math.sin(yaw) * forward;
    const dz = -Math.sin(yaw) * side - Math.cos(yaw) * forward;
    let x = pos.x + dx;
    const z = pos.z + dz, entranceZ=mainDoor.z;
    if(Math.abs(pos.z-entranceZ)<.33 && Math.abs(pos.x)<=opening+.0001)
      x=clamp(x,-opening,opening);
    if(zone==="grounds") {
      const nextX=clamp(x,-2.35,13);
      if(grounds.canWalk(nextX,pos.z,clearRadius))pos.x=nextX;
      const nextZ=clamp(z,Math.abs(pos.x)<opening+.0001 ? entranceZ-.33 : entranceZ+.22,entranceZ+27);
      if(grounds.canWalk(pos.x,nextZ,clearRadius))pos.z=nextZ;
      syncZone();invalidate();return;
    }
    if(z>entranceZ-.33 && Math.abs(x)<=opening) {
      pos.x=x;pos.z=z;syncZone();invalidate();return;
    }
    const nextX=clamp(x,-plan.halfWidth+.33,plan.halfWidth-.33);
    const nextZ=clamp(z,-plan.halfDepth-4+.27,plan.halfDepth-.33);
    const next=interior.constrainLobbyStep?.(pos.x,pos.z,nextX,nextZ) || {x:nextX,z:nextZ};
    const active=cardsExpanded ? menuIndex() : null,card=active==null ? null : interior.menuPoint?.(active);
    if(card && forward>0) {
      const vx=card.x-pos.x,vz=card.z-pos.z;
      const before=Math.hypot(vx,vz),after=Math.hypot(card.x-next.x,card.z-next.z);
      const dx=next.x-pos.x,dz=next.z-pos.z;
      const movement=Math.hypot(dx,dz),facing=-Math.sin(yaw)*vx-Math.cos(yaw)*vz;
      if(before>walkInRadius && after<=walkInRadius && facing>.979*before &&
        dx*vx+dz*vz>.979*movement*before &&
        interior.hits.some(hit=>hit.userData.doorIndex===active && hit.userData.pickable===true) &&
        Math.abs(card.clone().project(camera).y)<1) {
        pos.set(next.x,eyeHeight,next.z);
        if(enter(active))return;
      }
    }
    pos.x=next.x;pos.z=next.z;
    invalidate();
  }
  function direction(code) {
    if (code === "ArrowUp" || code === "KeyW") return [0, 1];
    if (code === "ArrowDown" || code === "KeyS") return [0, -1];
    return code === "ArrowLeft" || code === "KeyA" ? [-1, 0] : [1, 0];
  }
  function moveOrTurn(side, forward, amount, rotate) {
    if (rotate) turn(-side * amount, forward * amount);
    else walk(side * amount, forward * amount);
  }
  function tick(now) {
    // A nonzero frame ID suppresses duplicate requests from input applied in this tick.
    if (disposed || paused || document.hidden) { frame = 0; return; }
    const elapsed = Math.max(0, (now-last)/1000), dt = Math.min(.045,elapsed);
    last = now;
    if (approach?.arrived) {
      // Keep one complete frame at the destination before switching scenes.
      finishApproach();
      frame = 0;
      if (!disposed && !paused) invalidate();
      return;
    }
    if (approach) advanceApproach(Math.min(.12,elapsed));
    let side = 0, forward = 0;
    for (const [code, key] of keys) {
      const axis = direction(code);
      const speed = code.startsWith("Arrow") ? .47 : 1.45;
      const amount = dt * (space ? .78 : speed);
      side += axis[0] * amount;
      forward += axis[1] * amount;
      key.travel += amount;
      if (key.turn !== space) key.mixed = true;
    }
    const joy = stick?.vector;
    if (joy) {
      const amount = dt * (space ? .78 : 1.45);
      side += joy.x * amount;
      forward -= joy.y * amount;
    }
    const length = Math.hypot(side, forward);
    if (length && !approach) {
      const limit = Math.min(1, dt * (space ? .78 : 1.45) / length);
      moveOrTurn(side, forward, limit, space);
    }
    if (disposed || paused) { frame = 0; return; }
    if (dirty || cardsAnimating) {
      if(dirty) {
        dirty=false;
        camera.updateMatrixWorld();
        syncZone();fitView();notifyNearest();
        if(hoverPosition)updateHover(pick(hoverPosition));
      }
      const highlighted=mouseHighlight ? hovered : (cardsExpanded ? nearest : null);
      const easing=interior.updateWaypoints?.(camera,highlighted,Math.min(.12,elapsed),cardsExpanded,drag && !drag.moved ? drag.card : null);
      cardsAnimating=Boolean(easing) && !reducedMotion.matches && zone==="lobby";
      if (!disposed) {
        floorReflection?.render(camera,zone==="lobby",now);
        renderer.render(scene,camera);
      }
    }
    const needsFrame=dirty || cardsAnimating || approach || keys.size || joy?.lengthSq();
    frame = !disposed && !paused && !document.hidden && needsFrame ? requestAnimationFrame(tick) : 0;
  }
  function keydown(e) {
    if (paused || disposed || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    const active = e.target.closest?.("input,select,textarea,button,a,summary,[contenteditable=true]");
    if (active && !active.closest(".walk-stick") && active.getClientRects().length) return;
    const rect=host.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom<=0 || rect.top>=innerHeight) return;
    if(movementKeys.has(e.code) || e.code==="Space" || e.code==="Enter")setPointerHighlight(false,null);
    if (approach && movementKeys.has(e.code)) {
      if (e.repeat) {e.preventDefault();return;}
      cancelApproach();
    }
    if (e.code === "Escape" && approach) {e.preventDefault();cancelApproach();return;}
    if (e.code === "Escape" && cardsExpanded && setMenuOpen(false)) {e.preventDefault();return;}
    if (e.code === "Space") {
      e.preventDefault();
      space = true;
    } else if (movementKeys.has(e.code)) {
      e.preventDefault();
      if (!keys.has(e.code)) keys.set(e.code, {start: performance.now(), travel: 0, turn: space, mixed: false});
      invalidate();
    } else if (!e.repeat && e.code === "Enter" && enterNearest()) e.preventDefault();
    else if (!e.repeat && e.code === "KeyR") { e.preventDefault(); home(); }
  }
  function keyup(e) {
    if (e.code === "Space") { space = false; return; }
    const key = keys.get(e.code);
    if (!key) return;
    keys.delete(e.code);
    if (!key.mixed && key.turn === space && performance.now() - key.start < 175) {
      const [side, forward] = direction(e.code);
      moveOrTurn(side, forward, Math.max(0, (space ? .078 : .14) - key.travel), space);
    }
  }
  function blockedAt(distance) {
    // Only test architecture after a selectable surface was actually hit.
    // World-space bounds are static. Stop the ray just short of the card.
    raycaster.far=Math.max(0,distance-.008);
    const ray=raycaster.ray,limitSquared=raycaster.far*raycaster.far;
    let blocked=false;
    for(const {mesh,bounds} of opaqueMeshes) {
      if(!bounds.containsPoint(ray.origin) && (!ray.intersectBox(bounds,intersectionPoint) ||
        intersectionPoint.distanceToSquared(ray.origin)>limitSquared))continue;
      obstructions.length=0;
      mesh.raycast(raycaster,obstructions);
      if(obstructions.length){blocked=true;break;}
    }
    raycaster.far=Infinity;
    return blocked;
  }
  function pick(e) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    point.set(2 * (e.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (e.clientY - bounds.top) / bounds.height);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(point, camera);
    const targets=zone==="grounds" ? grounds.hits : (cardsExpanded ? expandedTargets : receptionTargets);
    for(const target of targets)target.updateWorldMatrix(true,false);
    const hit=raycaster.intersectObjects(targets,true).find(({object})=>object.userData.pickable!==false);
    if(!hit || blockedAt(hit.distance))return null;
    if(zone==="grounds")return "entrance";
    let object = hit.object;
    while (object) {
      if(object.userData.signAction)return object.userData.signAction;
      if(object.userData.receptionDesk)return "reception";
      if (Number.isInteger(object.userData.doorIndex)) return object.userData.doorIndex;
      object = object.parent;
    }
    return null;
  }
  function updateHover(hit) {
    if(hit===hovered)return;
    hovered=hit;
    interior?.highlightSign(hit);
    canvas.style.cursor=hit==null ? "grab" : "pointer";
    invalidate();
  }
  // Blank mouse hover stays blank. Keyboard and joystick navigation instead
  // highlight the nearest landmark in front of the moving camera.
  function setPointerHighlight(enabled,position) {
    if(mouseHighlight!==enabled) {
      mouseHighlight=enabled;
      invalidate();
    }
    hoverPosition=position;
    updateHover(position ? pick(position) : null);
  }
  function pointerdown(e) {
    if (paused || disposed || e.button !== 0 || !e.isPrimary) {
      if (drag) drag.moved = true;
      return;
    }
    canvas.focus({preventScroll: true});
    setPointerHighlight(e.pointerType==="mouse",null);
    canvas.setPointerCapture(e.pointerId);
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,
      moved:false,cycled:false,card:zone==="lobby" ? pick(e) : null};
    invalidate();
  }
  function pointermove(e) {
    if(paused || disposed)return;
    if(!drag) {
      if(e.pointerType==="mouse" && !approach && !keys.size)
        setPointerHighlight(true,{clientX:e.clientX,clientY:e.clientY});
      return;
    }
    if(e.pointerId!==drag.id)return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    invalidate();
    cancelApproach();
    if(Number.isInteger(drag.card)) {
      const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
      if(!drag.cycled && Math.abs(dx)>=30 && Math.abs(dx)>Math.abs(dy)*1.25) {
        cycleMenu(dx<0 ? 1 : -1);
        drag.cycled=true;
      }
      return;
    }
    canvas.style.cursor = "grabbing";
    turn(-(e.clientX - drag.x) * .0034, -(e.clientY - drag.y) * .0034);
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function pointerend(e) {
    if (e.pointerId !== drag?.id) return;
    const tap = e.type === "pointerup" && !drag.moved && !paused;
    const card=drag.card;
    invalidate();
    drag = null;
    canvas.style.cursor = "grab";
    if (!tap) return;
    const index=zone==="lobby" ? card : pick(e);
    if (index == null) host.dispatchEvent(new Event("lobbyblanktap"));
    else if(index==="entrance") { if(zone==="grounds")enterMuseum(); else exitMuseum(); }
    else if(index==="first-hall")enter(0);
    else if(index==="directory")options.onDirectory?.();
    else if(typeof index==="string" && index.startsWith("sign:"))enter(Number(index.slice(5)));
    else if(index==="reception")setMenuOpen(true);
    else if(cardsExpanded)enter(index);
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!(width && height)) return;
    renderer.setSize(width, height, false);
    scene.userData.viewportHeight=height;
    camera.aspect = width / height;
    fitView();camera.updateProjectionMatrix();
    invalidate();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelApproach();
    clearInput();
    listeners.abort();
    observer?.disconnect();
    cancelAnimationFrame(frame);
    stick?.dispose();
    grounds?.dispose();
    floorReflection?.dispose();
    interior?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  try {
    interior = buildLobby(T, scene, plan.doors, {...plan, invalidate});
    floorReflection=createFloorReflection(T,renderer,scene,interior.reflectionFloor,invalidate);
    grounds = buildMuseumGrounds(T,scene,{halfWidth:plan.halfWidth,halfDepth:plan.halfDepth,panorama:interior.panorama,invalidate});
    receptionTargets=[...interior.deskHits,...interior.signHits];
    expandedTargets=[...interior.hits,...interior.signHits];
    scene.updateMatrixWorld(true);
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh || !mesh.geometry || !camera.layers.test(mesh.layers))return;
      const materials=Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if(!materials.every(m=>m?.visible && !m.transparent && m.opacity>0))return;
      if(mesh.geometry.type==="SphereGeometry" && materials.every(m=>m.side===T.BackSide))return;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      opaqueMeshes.push({mesh,bounds});
    });
    host.append(canvas);
    stick = mobileControls(host, turn, () => paused || disposed || Boolean(approach), {
      toggle: document.getElementById("lobbyGyro"),
      status: document.getElementById("lobbyGyroStatus")
    });
    function earlyInput(input) {
      if (input.type === "entrylook") {
        if (Number.isFinite(input.dx) && Number.isFinite(input.dy)) turn(-input.dx * .0034, -input.dy * .0034);
      } else if (input.type === "keydown" || input.type === "keyup") {
        const event = {code:input.code, target:canvas, preventDefault(){}};
        if (input.type === "keydown") keydown(event);
        else keyup(event);
      }
    }
    listen(host, "entrylook", e => earlyInput(e.detail));
    listen(canvas, "pointerdown", pointerdown);
    listen(canvas, "pointermove", pointermove);
    listen(canvas, "pointerleave", () => {if(mouseHighlight)setPointerHighlight(true,null);});
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(canvas, type, pointerend);
    listen(host, "pointerdown", e => {
      if (e.target.closest(".walk-stick")) {
        setPointerHighlight(false,null);
        cancelApproach();
      }
      invalidate();
    });
    listen(host, "pointermove", e => { if (e.target.closest(".walk-stick") && e.buttons) invalidate(); });
    listen(window, "keydown", keydown);
    listen(window, "keyup", keyup);
    listen(window, "blur", () => { clearInput(); cancelApproach(); });
    listen(document, "visibilitychange", () => {
      clearInput();
      if (document.hidden) { cancelApproach(); cancelAnimationFrame(frame); frame = 0; }
      else invalidate();
    });
    listen(reducedMotion,"change",invalidate);
    listen(canvas, "webglcontextrestored", invalidate);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    faceDoorReturn(options.returnDoorIndex, options.startZone!=="lobby");
    host.dispatchEvent(new CustomEvent("viewerready", {detail:earlyInput}));
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose,setPaused,enterNearest,enterDoor:enter,menuIndex,cycleMenu,setMenuOpen,enterMuseum,exitMuseum,home };
}
