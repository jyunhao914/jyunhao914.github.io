import * as T from "./vendor/three.module.js";
import { mobileControls } from "./mobile-controls.js?v=lobby35";
import { buildMuseumGrounds } from "./museum-grounds.js?v=grounds37";
import { buildLobby } from "./lobby-interior.js?v=portal36";

const eyeHeight = 1.60;
const doorWidth = 2.1;
const doorHeight = 2.65;
const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"]);
const clamp = T.MathUtils.clamp;
const portalDepth = .85;
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
  const halfWidth = 5.7;
  const sideRows = Math.ceil(Math.max(0, doors.length - 3) / 2);
  const rowSpacing = 4.5;
  const halfDepth = Math.max(5.9, (Math.max(0, sideRows - 1) * rowSpacing + 7.6) / 2);
  const placed = doors.map((door, index) => {
    let x, z, yaw;
    if (index < 3) {
      x = [0, -3.3, 3.3][index];
      z = -halfDepth;
      yaw = 0;
    } else {
      const west = (index - 3) % 2 === 0;
      x = west ? -halfWidth : halfWidth;
      z = -halfDepth + 3.8 + Math.floor((index - 3) / 2) * rowSpacing;
      yaw = west ? Math.PI / 2 : -Math.PI / 2;
    }
    return { ...door, index, x, z, yaw, width: doorWidth, height: doorHeight,
      nx: Math.sin(yaw), nz: Math.cos(yaw) };
  });
  return { doors: placed, halfWidth, halfDepth };
}

export function createLobby(host, doors, onEnter, options = {}) {
  const plan = placeDoors(doors);
  const mainDoor = {x:0,z:plan.halfDepth,nx:0,nz:1,yaw:0,width:2.4};
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
  let interior, grounds, stick, observer, zone;
  let disposed = false, paused = false, entering = false, space = false;
  let drag = null, nearest, dirty = true, frame = 0, last = 0;
  let approach = null;
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
    if (next !== zone) { zone=next; options.onZone?.(zone); }
  }
  function fitView() {
    // A vertical phone can read the full entry façade from the forecourt.
    // On the walk inside, the wider architectural view eases into eye level.
    const wide=clamp(T.MathUtils.radToDeg(2*Math.atan(Math.tan(.45)/camera.aspect)),61,88);
    const blend=T.MathUtils.smoothstep(camera.position.z-plan.halfDepth,1.2,8);
    const fov=T.MathUtils.lerp(61,wide,blend);
    if(Math.abs(fov-camera.fov)>.005) { camera.fov=fov; camera.updateProjectionMatrix(); }
  }
  function notifyNearest() {
    const fx = -Math.sin(camera.rotation.y), fz = -Math.cos(camera.rotation.y);
    let choice = null, shortest = Infinity;
    for (const door of plan.doors) {
      if (approach || zone==="grounds") break;
      const dx = door.x - camera.position.x, dz = door.z - camera.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 2.35 && distance < shortest && fx * dx + fz * dz > .30 * distance) {
        choice = door.index;
        shortest = distance;
      }
    }
    if (choice !== nearest) {
      nearest = choice;
      options.onNearest?.(choice);
    }
  }
  function cancelApproach() {
    if (!approach) return;
    const previous = approach;
    approach = null;
    options.onTravel?.(false);
    if (previous.kind==="room") options.onApproachCancel?.(previous.door.index);
    invalidate();
  }
  function occupiedPortal() {
    return plan.doors.find(door => {
      const p = doorCoordinates(camera.position, door);
      return p.depth < .33 && p.depth >= -portalDepth-.001 && Math.abs(p.offset) <= door.width/2-.10;
    });
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
    const previous = occupiedPortal();
    if (previous && previous !== door) {
      const exit = atDoor(previous, .72, doorCoordinates(start,previous).offset);
      route.add(new T.LineCurve3(start,exit));
      start = exit;
    }
    const viaEntrance = kind==="room" && zone==="grounds";
    if(viaEntrance) start=routeThroughDoor(route,start,mainDoor,1.65);
    let finish=routeThroughDoor(route,start,door,kind==="museum" ? 1.65 : portalDepth);
    let look=atDoor(door,-2.4);
    if(kind==="grounds") {
      const end=new T.Vector3(2.15,eyeHeight,plan.halfDepth+9.5);
      route.add(new T.QuadraticBezierCurve3(finish,atDoor(mainExit,-4.8),end));
      finish=end;
    }
    const initialLook=viaEntrance ? atDoor(mainDoor,-2.4) : look;
    const targetYaw=Math.atan2(camera.position.x-initialLook.x,camera.position.z-initialLook.z);
    const turnAngle=Math.abs(shortestTurn(targetYaw-camera.rotation.y));
    approach = {
      kind,door,route,finish,look,viaEntrance,lead:Math.max(0,turnAngle-.55)*.47,elapsed:0,arrived:false,
      seconds:Math.max(.82,route.getLength()/2.6+.36),turnTime:Math.max(.48,turnAngle*.61),
      yaw:camera.rotation.y,targetYaw:camera.rotation.y,pitch:camera.rotation.x,reduced:reducedMotion.matches
    };
    options.onTravel?.(true);
    if(kind==="room")options.onApproach?.(door.index);
    invalidate();
    return true;
  }
  function enter(index) { return startApproach("room",plan.doors[index]); }
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
      if(step.arrived && step.kind!=="room") {
        camera.position.copy(step.finish);
        const yaw=step.kind==="museum" ? 0 : Math.atan2(step.finish.x,step.finish.z-plan.halfDepth);
        camera.rotation.set(0,yaw,0,"YXZ");
      }
    } else {
      const t = clamp((step.elapsed-step.lead)/step.seconds,0,1);
      step.route.getPoint(walkingProgress(t),camera.position);
      let aim = Math.atan2(camera.position.x-step.look.x,camera.position.z-step.look.z);
      if(step.viaEntrance) {
        const exteriorAim=Math.atan2(camera.position.x, Math.max(.15,camera.position.z-mainDoor.z+2.4));
        const turnInside=T.MathUtils.smoothstep(mainDoor.z-camera.position.z,.20,2.0);
        aim=exteriorAim+shortestTurn(aim-exteriorAim)*turnInside;
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
      camera.rotation.x = step.pitch*(1-turn);
      step.arrived = t >= 1 && turn >= 1;
    }
    dirty = true;
  }
  function finishApproach() {
    options.onTravel?.(false);
    const complete = approach;
    approach = null;
    if(complete.kind!=="room") { notifyNearest(); return; }
    const index = complete.door.index;
    entering = true;
    try {
      // Reuse the full-resolution image already decoded for this door. The new
      // renderer owns its own GPU texture and the lobby can still be disposed.
      const painting=scene.getObjectByName("lobby-room-art-"+index);
      const image=painting?.material.map?.image;
      Promise.resolve(onEnter(index,image?.naturalWidth ? image : null)).finally(() => { entering = false; });
    } catch (error) {
      entering = false;
      throw error;
    }
  }
  function enterNearest() {
    if (disposed || paused || entering) return false;
    if(zone==="grounds")return enterMuseum();
    notifyNearest();
    if(nearest!=null)return enter(nearest);
    const pos=camera.position;
    if(Math.abs(pos.x)<1.45 && plan.halfDepth-pos.z<2.35 && Math.cos(camera.rotation.y)<-.35)return exitMuseum();
    return false;
  }
  function faceDoorReturn(index, outdoors=false) {
    const door = plan.doors[index];
    if (!door && outdoors) {
      const phone=matchMedia("(max-width:700px), (pointer:coarse) and (max-height:550px)").matches;
      camera.position.set(3,eyeHeight,plan.halfDepth+(phone ? 16.2 : 12.75));
      camera.lookAt(phone ? -.28 : 0,phone ? 1.75 : 1.80,plan.halfDepth);
    } else if (!door) {
      camera.position.set(0, eyeHeight, plan.halfDepth - 1.35);
      camera.rotation.set(0, 0, 0, "YXZ");
    } else {
      camera.position.set(door.x + 1.65 * door.nx, eyeHeight, door.z + 1.65 * door.nz);
      camera.rotation.set(0, door.yaw + Math.PI, 0, "YXZ");
    }
    camera.updateMatrixWorld();
    syncZone();fitView();notifyNearest();
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
      pos.x=clamp(x,-2.35,3.55);
      pos.z=clamp(z,Math.abs(pos.x)<opening+.0001 ? entranceZ-.33 : entranceZ+.22,entranceZ+17);
      syncZone();invalidate();return;
    }
    if(z>entranceZ-.33 && Math.abs(x)<=opening) {
      pos.x=x;pos.z=z;syncZone();invalidate();return;
    }
    // A cancelled approach can leave the eye inside a recess. Keep the eye in
    // that opening until it walks back out, or continues into the exhibition.
    const inside = occupiedPortal();
    if (inside) {
      const next = doorCoordinates({x,z},inside), previous = doorCoordinates(pos,inside);
      if (next.depth < previous.depth-.00001 && enter(inside.index)) return;
      if (next.depth < .33) {
        pos.copy(atDoor(inside,next.depth,clamp(next.offset,-inside.width/2+.12,inside.width/2-.12)));
        invalidate();
        return;
      }
    }
    // Cross a portal only through the actual opening while walking out of the hall.
    for (const door of plan.doors) {
      const before = (pos.x - door.x) * door.nx + (pos.z - door.z) * door.nz;
      const after = (x - door.x) * door.nx + (z - door.z) * door.nz;
      if (before >= .32999 && after < .33) {
        const along = (x - door.x) * door.nz - (z - door.z) * door.nx;
        if (Math.abs(along) < door.width / 2 - .12 && enter(door.index)) return;
      }
    }
    pos.x = clamp(x, -plan.halfWidth + .33, plan.halfWidth - .33);
    pos.z = clamp(z, -plan.halfDepth + .33, plan.halfDepth - .33);
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
      // The final doorway pose was rendered on the previous animation frame.
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
    if (dirty) {
      dirty = false;
      camera.updateMatrixWorld();
      syncZone();fitView();notifyNearest();
      if (!disposed) renderer.render(scene, camera);
    }
    frame = !disposed && !paused && (approach || keys.size || joy?.lengthSq()) ? requestAnimationFrame(tick) : 0;
  }
  function keydown(e) {
    if (paused || disposed || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    const active = e.target.closest?.("input,select,textarea,button,a,summary,[contenteditable=true]");
    if (active && !active.closest(".walk-stick") && active.getClientRects().length) return;
    const rect=host.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom<=0 || rect.top>=innerHeight) return;
    if (approach && movementKeys.has(e.code)) {
      if (e.repeat) {e.preventDefault();return;}
      cancelApproach();
    }
    if (e.code === "Escape" && approach) {e.preventDefault();cancelApproach();return;}
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
  function pick(e) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    point.set(2 * (e.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (e.clientY - bounds.top) / bounds.height);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(point, camera);
    if(zone==="grounds")return raycaster.intersectObjects(grounds.hits,true).length ? "entrance" : null;
    const ray=raycaster.ray;
    if(ray.direction.z>.001) {
      const t=(mainDoor.z-ray.origin.z)/ray.direction.z;
      const y=ray.origin.y+t*ray.direction.y;
      if(t>=0 && Math.abs(ray.origin.x+t*ray.direction.x)<1.2 && y>=0 && y<=3.1)return "entrance";
    }
    const hit = raycaster.intersectObjects(interior.hits, true)[0];
    let object = hit?.object;
    while (object) {
      if (Number.isInteger(object.userData.doorIndex)) return object.userData.doorIndex;
      object = object.parent;
    }
    return null;
  }
  function pointerdown(e) {
    if (paused || disposed || e.button !== 0 || !e.isPrimary) {
      if (drag) drag.moved = true;
      return;
    }
    canvas.focus({preventScroll: true});
    canvas.setPointerCapture(e.pointerId);
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false};
  }
  function pointermove(e) {
    if (e.pointerId !== drag?.id || paused) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    cancelApproach();
    canvas.style.cursor = "grabbing";
    turn(-(e.clientX - drag.x) * .0034, -(e.clientY - drag.y) * .0034);
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function pointerend(e) {
    if (e.pointerId !== drag?.id) return;
    const tap = e.type === "pointerup" && !drag.moved && !paused;
    drag = null;
    canvas.style.cursor = "grab";
    if (!tap) return;
    const index = pick(e);
    if (index == null) host.dispatchEvent(new Event("lobbyblanktap"));
    else if(index==="entrance") { if(zone==="grounds")enterMuseum(); else exitMuseum(); }
    else enter(index);
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!(width && height)) return;
    renderer.setSize(width, height, false);
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
    interior?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  try {
    interior = buildLobby(T, scene, plan.doors, {...plan, invalidate});
    grounds = buildMuseumGrounds(T,scene,{halfWidth:plan.halfWidth,halfDepth:plan.halfDepth,panorama:interior.panorama,invalidate});
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
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(canvas, type, pointerend);
    listen(host, "pointerdown", e => {
      if (e.target.closest(".walk-stick")) cancelApproach();
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
  return { dispose, setPaused, enterNearest, enterDoor:enter, enterMuseum, exitMuseum, home };
}
