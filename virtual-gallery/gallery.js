import {mountFields} from "./mount-fields.js?v=desk33";
import {mobileControls} from "./mobile-controls.js?v=stickspace20";
import {roomSize} from "./room-size.js?v=desk33";
import * as T from "./vendor/three.module.js";
import {mountRenderer, disposeMount} from "./mount-render.js?v=desk33";
import { architecture } from "./architecture.js?v=mount32";
export function gallery(host, works, onPick, onMove, onRead = () => {}, tools) {
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(
      64,
      1,
      0.06,
      80,
    ),
    renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace;
  host.replaceChildren(renderer.domElement);
  const canvas = renderer.domElement;
  scene.background = new T.Color(0xe5e8e8);
  scene.add(new T.HemisphereLight(0xeef2fa, 0xc4ae91, 0.5));
  function box(parent, w, h, d, color, x, y, z, props = {}) {
    let m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, ...props }),
    );
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = parent !== scene;
    parent.add(m);
    return m;
  }
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const {theme,width:halfWidth,depth:halfDepth,height:roomHeight}=roomSize(works);
  const mounts=mountRenderer(renderer), mounted=new Map();
  const hasBench = theme === "ink" || !theme;
  cam.far = Math.max(80,4*(halfWidth+halfDepth));
  cam.rotation.order = "YXZ";
  const station=new T.Vector3(0,1.65,2), entranceLook=new T.Vector3(0,1.65,-5);
  const building = architecture(scene, box, renderer, theme, halfWidth, halfDepth, roomHeight);
  let reflection,
    disposed = false;
  building.ready
    .then(() => {
      if (disposed) return;
      const cube = new T.WebGLCubeRenderTarget(64, { type: T.HalfFloatType });
      const probe = new T.CubeCamera(0.08, 78, cube);
      probe.position.copy(new T.Vector3(0, 1.7, 0));
      probe.update(renderer, scene);
      const pmrem = new T.PMREMGenerator(renderer);
      reflection = pmrem.fromCubemap(cube.texture);
      scene.environment = reflection.texture;
      scene.environmentIntensity = 0.28;
      cube.dispose();
      pmrem.dispose();
    })
    .catch((error) => console.warn("展廳環境反射無法載入", error));
  let groups = [],
    targets = [],
    videos = [],
    textures = [],
    animated = [];
  const walls = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  function layout(g, a) {
    renderer.shadowMap.needsUpdate = true;
    let ang = walls[a.wall || 0];
    g.rotation.set(0, ang, 0);
    g.rotateZ(((a.rotate || 0) * Math.PI) / 180);
    let depth = ((a.wall % 2 ? halfWidth : halfDepth) - .13) - (a.z || 0);
    const shadow=g.getObjectByName("mount-contact");
    if(shadow){
      shadow.position.z=(shadow.userData.wallZ ?? -.067)-(a.z || 0);
      shadow.visible=Math.abs(a.z || 0)<.09;
    }
    g.position.set(
      Math.cos(ang) * a.x - Math.sin(ang) * depth,
      a.y,
      -Math.sin(ang) * a.x - Math.cos(ang) * depth,
    );
  }
  function labelTexture(a) {
    let c = document.createElement("canvas");
    c.width = 768;
    c.height = 512;
    let ctx = c.getContext("2d");
    ctx.fillStyle = "#eae8e0";
    ctx.fillRect(0, 0, 768, 512);
    ctx.fillStyle = "#16334b";
    ctx.font = "40px serif";
    ctx.fillText(a.title, 36, 150, 690);
    ctx.font = "25px sans-serif";
    Array.from(a.description || "")
      .join("")
      .match(/.{1,22}/gu)
      ?.slice(0, 7)
      .forEach((v, i) => ctx.fillText(v, 36, 210 + i * 38, 690));
    return new T.CanvasTexture(c);
  }
  function mountedSurfaceTarget(g,a,spec) {
    if(!spec.isHandscroll && !spec.isAlbum)return null;
    // Pick the blank frontispiece and colophon as parts of the roll, including beyond the image UVs.
    const strip=new T.Mesh(new T.PlaneGeometry(spec.width,spec.height),new T.MeshBasicMaterial());
    strip.name=spec.isHandscroll ? "handscroll-hit" : "album-hit"; strip.visible=false;
    strip.userData={a,mountSurface:true};
    strip.position.set((spec.left+spec.right)/2,(spec.top+spec.bottom)/2,spec.faceZ-.0024);
    g.add(strip); targets.push(strip);
    return strip;
  }
  works.forEach((a) => {
    let g = new T.Group();
    scene.add(g);
    groups.push(g);
    layout(g, a);
    const mount=mounts.build(a), spec=mount.userData.spec;
    g.add(mount);
    const {w,h}=spec;
    let tex;
    if (
      a.type === "影片" ||
      (a.type === "動態" &&
        !a.src.startsWith("data:image") &&
        !/\.gif$/i.test(a.src))
    ) {
      let v = document.createElement("video");
      v.src = a.src;
      v.loop = v.muted = v.playsInline = true;
      v.play().catch(() => {});
      videos.push(v);
      tex = new T.VideoTexture(v);
    } else if (a.type === "動態" || a.src.startsWith("data:image/gif")) {
      let img = new Image(),
        c = document.createElement("canvas");
      c.width = 512;
      c.height = 512;
      img.src = a.src;
      tex = new T.CanvasTexture(c);
      animated.push({ img, ctx: c.getContext("2d"), tex });
    } else if (a.type === "圖片") tex = new T.TextureLoader().load(a.src,(loaded)=>{
      const image=loaded.image;
      if(disposed || a.tiles?.length || (!spec.isHandscroll && w < 4*h) || image.width<=4096) return;
      const count=Math.ceil(image.width/2048);
      for(let i=0;i<count;i++){
        const left=Math.round(image.width*i/count), right=Math.round(image.width*(i+1)/count);
        const scale=Math.min(1,2048/image.height);
        const crop=document.createElement("canvas");
        crop.width=Math.max(1,Math.round((right-left)*scale));
        crop.height=Math.max(1,Math.round(image.height*scale));
        crop.getContext("2d").drawImage(image,left,0,right-left,image.height,0,0,crop.width,crop.height);
        addSection(new T.CanvasTexture(crop),i,count);
      }
    });
    else tex = labelTexture(a);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.colorSpace = T.SRGBColorSpace;
    textures.push(tex);
    let face = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.045,
      }),
    );
    face.name="artwork-face";
    face.position.z=spec.faceZ;
    face.userData.a = a;
    face.userData.picture = true;
    g.add(face);
    targets.push(face);
    function addSection(tile,index,count) {
      tile.colorSpace=T.SRGBColorSpace;
      tile.anisotropy=tex.anisotropy;
      textures.push(tile);
      const section=new T.Mesh(new T.PlaneGeometry(a.width/count,a.height),face.material.clone());
      section.name="artwork-tile";
      section.userData.tile={index,count};
      section.material.map=section.material.emissiveMap=tile;
      section.position.set(a.width*((index+.5)/count-.5),0,face.position.z+.001);
      g.add(section);
    }
    if (Array.isArray(a.tiles))
      a.tiles.forEach((url,index)=>addSection(new T.TextureLoader().load(url),index,a.tiles.length));
    const tag = document.createElement("canvas");
    tag.width = 512;
    tag.height = 190;
    const tc = tag.getContext("2d");
    tc.fillStyle = "#edeade";
    tc.fillRect(0, 0, 512, 190);
    tc.fillStyle = "#202b31";
    tc.font = "bold 44px sans-serif";
    tc.fillText(a.title, 22, 75, 465);
    tc.font = "26px sans-serif";
    tc.fillText(a.artist || a.type, 24, 133, 462);
    const tagTex = new T.CanvasTexture(tag);
    tagTex.colorSpace = T.SRGBColorSpace;
    textures.push(tagTex);
    const plaque = new T.Mesh(
      new T.PlaneGeometry(0.43, 0.16),
      new T.MeshStandardMaterial({ map: tagTex }),
    );
    plaque.position.set(spec.right+.28,-h/2+.08,-.064);
    const entry={mount,face,plaque,g,a,strip:mountedSurfaceTarget(g,a,spec)};
    mounted.set(a.id,entry);
    g.add(plaque);
    plaque.userData.a = a;
    targets.push(plaque);
    const light=new T.SpotLight(0xffffff, a.power, 12, a.angle*Math.PI/180, .72);
    entry.light=light;
    setLight(light,a);
    g.add(light);
    light.target = face;
  });
  function setLight(light,art) {
    const t=(art.kelvin-2500)/4500;
    light.color.setRGB(1,.72+.26*t,.46+.54*t);
    light.intensity=art.power;
    light.angle=art.angle*Math.PI/180;
    light.position.set(art.lx,art.ly,art.lz);
  }
  const rulers = onMove && tools?.makeRulers(T,host,works,groups,cam);
  function updatePlacement() {
    for (const art of drag.members) layout(groups[works.indexOf(art)],art);
    rulers?.dirty();
  }
  function framingCenter(g,spec) {
    return spec.isHandscroll || spec.isAlbum
      ? g.localToWorld(new T.Vector3((spec.left+spec.right)/2,(spec.top+spec.bottom)/2,spec.faceZ))
      : g.position.clone();
  }
  function followsWall(a) { return a.mount==="手卷" || (a.mount!=="冊頁" && a.width>=4*a.height); }
  function setEntrance() {
    if (!groups.length) return;
    const a=works[0], g=groups[0], aspect=host.clientWidth/Math.max(1,host.clientHeight);
    const spec=mounted.get(a.id).mount.userData.spec;
    entranceLook.copy(framingCenter(g,spec));
    const retreat=Math.max(3.3,spec.width*.61/(Math.tan(T.MathUtils.degToRad(cam.fov/2))*aspect));
    station.copy(entranceLook).addScaledVector(new T.Vector3(0,0,1).applyQuaternion(g.quaternion),retreat);
    station.x=T.MathUtils.clamp(station.x,-halfWidth+.4,halfWidth-.4);
    station.z=T.MathUtils.clamp(station.z,-halfDepth+.4,halfDepth-.4);
  }
  setEntrance();
  cam.position.copy(station);
  cam.lookAt(entranceLook);
  let keys = new Map(),
    ray = new T.Raycaster(),
    drag,
    guide = -1;
  let reading = null;
  function hit(e) {
    let r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2,
      ),
      cam,
    );
    return ray.intersectObjects(targets)[0]?.object;
  }
  const fingers=new Map();
  let pinch=null, wheelZoom=null, multiTouch=false, zoomed=false, editorSelection=0;
  const roomBounds=new T.Box3(new T.Vector3(-halfWidth,0,-halfDepth),new T.Vector3(halfWidth,building.height,halfDepth));
  const benchBounds=new T.Box3(new T.Vector3(-1.67,-1,-1.78),new T.Vector3(1.67,building.height,-.62));
  function cancelDrag() {
    if(drag?.move){drag.move(0,0);updatePlacement();rulers.select(editorSelection);}
    drag=null;
  }
  function fingerPair() {
    const [a,b]=fingers.values();
    return {span:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  }
  function screenRay(point,rect) {
    ray.setFromCamera(new T.Vector2(2*(point.x-rect.left)/rect.width-1,1-2*(point.y-rect.top)/rect.height),cam);
  }
  function zoomAnchor(point,rect) {
    if(reading && travel)takeOverApproach();
    travel=null;
    cam.updateMatrixWorld();
    screenRay(point,rect);
    const forward=cam.getWorldDirection(new T.Vector3());
    let anchor;
    if(reading) {
      const plane=new T.Plane().setFromNormalAndCoplanarPoint(reading.normal,reading.faceCenter);
      anchor=ray.ray.intersectPlane(plane,new T.Vector3());
    }
    anchor ??= ray.intersectObjects(targets,false)[0]?.point
      ?? ray.ray.intersectBox(roomBounds,new T.Vector3())
      ?? ray.ray.at(2,new T.Vector3());
    const depth=anchor.clone().sub(cam.position).dot(forward);
    return {rect,anchor,forward,depth:Math.max(.18,depth)};
  }
  function beginPinch() {
    cancelDrag();
    const pair=fingerPair(),rect=canvas.getBoundingClientRect();
    if(pair.span<4 || !rect.width || !rect.height){pinch=null;return;}
    pinch={...zoomAnchor(pair,rect),span:pair.span};
  }
  function updatePinch() {
    if(fingers.size!==2)return;
    if(!pinch){beginPinch();return;}
    const pair=fingerPair();
    if(pair.span>=4)placeZoom(pinch,pair,pinch.depth*pinch.span/pair.span);
  }
  function fractionInside(start,end,low,high) {
    if(end>high && end>start)return Math.max(0,(high-start)/(end-start));
    if(end<low && end<start)return Math.max(0,(low-start)/(end-start));
    return 1;
  }
  function placeZoom(view,point,distance) {
    screenRay(point,view.rect);
    // The anchor remains on the same screen ray while the eye moves in 3D.
    const depth=T.MathUtils.clamp(distance,.18,cam.far*.8);
    const destination=ray.ray.direction.clone().multiplyScalar(-depth/ray.ray.direction.dot(view.forward)).add(view.anchor);
    // Stop on the line of sight at a wall, floor or ceiling. Sliding sideways
    // along a boundary would shift the detail away from the cursor.
    const eye=cam.position;
    const fraction=Math.min(fractionInside(eye.x,destination.x,-halfWidth+.25,halfWidth-.25),
      fractionInside(eye.y,destination.y,.18,building.height-.18),
      fractionInside(eye.z,destination.z,-halfDepth+.25,halfDepth-.25));
    destination.lerpVectors(eye,destination,fraction);
    if(hasBench) {
      const delta=destination.clone().sub(cam.position);
      const length=delta.length();
      if(length>0 && !blocked(cam.position.x,cam.position.z)) {
        const path=new T.Ray(cam.position,delta.normalize());
        const edge=path.intersectBox(benchBounds,new T.Vector3());
        if(edge && edge.distanceTo(cam.position)<=length)path.at(Math.max(0,edge.distanceTo(cam.position)-.01),destination);
      }
    }
    zoomed=true;
    cam.position.copy(destination);
    if(reading)syncReadingTrack(destination);
    cam.updateMatrixWorld();
  }
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  function handleWheel(e) {
    if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || drag || fingers.size)return;
    const mode=e.deltaMode;
    if(!e.deltaY || Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width || !rect.height)return;
    e.preventDefault();
    const point={x:e.clientX,y:e.clientY};
    const view=zoomAnchor(point,rect);
    const unit=mode===1 ? 16 : mode===2 ? rect.height : 1;
    const step=T.MathUtils.clamp(e.deltaY*unit,-240,240)*.00135;
    // Carry unfinished notches forward only while aiming at the same detail.
    const previous=wheelZoom;
    const continueZoom=previous && previous.point.x===point.x && previous.point.y===point.y &&
      Math.sign(previous.end-previous.view.depth)===Math.sign(step);
    const base=continueZoom ? previous.end : view.depth;
    const end=T.MathUtils.clamp(base*Math.exp(step),.18,cam.far*.8);
    if(reducedMotion.matches) {
      wheelZoom=null;
      placeZoom(view,point,end);
    } else {
      wheelZoom={view,point,end,start:performance.now()};
    }
  }
  canvas.addEventListener("wheel",handleWheel,{passive:false});
  function advanceWheel(now) {
    const {view,point,end,start}=wheelZoom;
    const t=T.MathUtils.clamp((now-start)/96,0,1);
    const eased=1-(1-t)**3;
    placeZoom(view,point,view.depth*(end/view.depth)**eased);
    if(t===1)wheelZoom=null;
  }
  function endTouch(e) {
    if(!fingers.delete(e.pointerId) || !multiTouch)return false;
    pinch=null;
    if(fingers.size===2)beginPinch();
    // Never turn the finger left on the glass into a tap, swipe or hanging operation.
    if(!fingers.size)multiTouch=false;
    return true;
  }
  canvas.onpointerdown = (e) => {
    wheelZoom=null;
    if(e.pointerType==="touch") {
      if(drag && !fingers.has(drag.pointer))return;
      fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(fingers.size>1 || multiTouch) {
        canvas.setPointerCapture(e.pointerId);
        if(!multiTouch)host.dispatchEvent(new Event("gallerypinchstart"));
        multiTouch=true;
        if(fingers.size===2)beginPinch();
        return;
      }
    }
    if (drag || multiTouch) return;
    canvas.setPointerCapture(e.pointerId);
    if (guide < 0 || onMove) travel = null;
    canvas.focus({ preventScroll: true });
    let obj = hit(e);
    const index = obj ? works.indexOf(obj.userData.a) : -1;
    let gesture = "look";
    const onArt=obj?.userData.picture || obj?.userData.mountSurface;
    if (!onMove && onArt) {
      if (reading && index === guide) gesture = "pan";
      else if (guide>=0 && !followsWall(works[index])) gesture = "switch";
    }
    drag = {
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      gesture, index,
      u: onArt ? obj.parent.worldToLocal(ray.intersectObject(obj)[0].point.clone()).x/works[index].width+.5 : undefined,
      x: e.clientX,
      y: e.clientY,
      dist: 0,
      obj: onMove && tools?.canMove?.()!==false && obj,
      click: obj,
    };
    if (drag.obj) {
      let center = obj.getWorldPosition(new T.Vector3()),
        normal = new T.Vector3(0, 0, 1).applyQuaternion(obj.parent.quaternion);
      drag.plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, center);
      drag.grab = ray.ray.intersectPlane(drag.plane, new T.Vector3());
      if (tools) {
        const art=works[index];
        rulers.select(index);
        drag.members=tools.members(works,art);
        drag.move=tools.movement(drag.members,art.wall%2 ? halfDepth : halfWidth,roomHeight);
      }
      drag.origin = { x: obj.userData.a.x, y: obj.userData.a.y };
    }
  };
  canvas.onpointermove = (e) => {
    const finger=fingers.get(e.pointerId);
    if(finger) {
      finger.x=e.clientX;finger.y=e.clientY;
      if(multiTouch){updatePinch();return;}
    }
    if (!drag || e.pointerId !== drag.pointer) return;
    let dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.dist += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.obj) {
      let a = drag.obj.userData.a;
      hit(e);
      let point = ray.ray.intersectPlane(drag.plane, new T.Vector3());
      if (point && drag.grab) {
        let diff = point.sub(drag.grab),
          angle = walls[a.wall || 0],
          half = (a.wall % 2 ? halfDepth : halfWidth) - a.width / 2;
        if (drag.move) {
          drag.move(diff.x*Math.cos(angle)-diff.z*Math.sin(angle),diff.y);
          updatePlacement();
          return;
        }
        a.x = T.MathUtils.clamp(
          drag.origin.x + diff.x * Math.cos(angle) - diff.z * Math.sin(angle),
          -half,
          half,
        );
        a.y = T.MathUtils.clamp(
          drag.origin.y + diff.y,
          a.height / 2,
          4.5 - a.height / 2,
        );
        layout(drag.obj.parent, a);
      }
    } else if (drag.gesture === "pan" && reading) {
      if (drag.dist > 3) takeOverApproach();
      // Move 35% of the drag distance on screen. During an interrupted
      // approach, use the close-reading scale to avoid a large sideways jump.
      const panWidth = Math.min(reading.fieldWidth, reading.closeFieldWidth);
      panTo(reading.x - 0.35 * dx * panWidth / canvas.clientWidth);
    } else if (drag.gesture === "look") {
      if (drag.dist > 5) { travel=null; stopInspection(); }
      cam.rotation.y -= dx * 0.003;
      cam.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, cam.rotation.x - dy * 0.003),
      );
    }
  };
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "展廳視角，可拖曳環視、雙指縮放或點地板前往");
  canvas.onpointerup = (e) => {
    if(endTouch(e))return;
    if (e.defaultPrevented) { drag=null; return; }
    if (!drag || drag.pointer !== e.pointerId) return;
    if(drag.obj)editorSelection=drag.index;
    const dx = e.clientX - drag.startX,
      dy = e.clientY - drag.startY;
    if (
      drag.gesture === "switch" &&
      Math.abs(dx) > 42 &&
      Math.abs(dx) > Math.abs(dy) * 1.3
    )
      changeWork(drag.index + (dx < 0 ? 1 : -1));
    else if (drag.dist < 9 && drag.click) {
      const work = drag.click.userData.a;
      if (onMove) {
        editorSelection=drag.index;
        rulers?.select(drag.index);
        if(drag.move){ drag.move(0,0); updatePlacement(); }
        onPick(work);
      }
      else if (drag.gesture !== "pan") changeWork(works.indexOf(work), drag.u);
    } else if (drag.obj) onMove(drag.obj.userData.a,drag.members ?? [drag.obj.userData.a]);
    else if (drag.dist < 9 && !onMove) {
      if (!hit(e) && !host.dispatchEvent(new Event("galleryblanktap",{cancelable:true}))) {
        drag=null;
        return;
      }
      const floorHit = ray.intersectObject(building.floor)[0];
      if (floorHit) {
        stopInspection();
        navigate(floorHit.point);
      }
    }
    drag = null;
  };
  canvas.onpointercancel = canvas.onlostpointercapture = (e) => {
    if(!endTouch(e) && drag?.pointer===e.pointerId)cancelDrag();
  };
  let travel = null;
  function operate(action,dt) {
    wheelZoom=null;
    if (reading && (action==="左移" || action==="右移")) {
      if (travel) { travel=null; placeOnTrack(); }
      panTo(reading.x+(action==="左移"?-1:1)*reading.fieldWidth*.35*dt);
      return;
    }
    stopInspection();
    travel=null;
    const yaw=cam.rotation.y;
    const forward=Number(action==="前進")-Number(action==="後退");
    const side=Number(action==="右移")-Number(action==="左移");
    if (forward || side) {
      const step=dt*.9;
      move(cam.position.x+step*(side*Math.cos(yaw)-forward*Math.sin(yaw)),
           cam.position.z-step*(side*Math.sin(yaw)+forward*Math.cos(yaw)));
    } else {
      cam.rotation.y+=(Number(action==="左轉")-Number(action==="右轉"))*dt*.48;
      cam.rotation.x=T.MathUtils.clamp(cam.rotation.x+(Number(action==="抬頭")-Number(action==="低頭"))*dt*.40,-1.2,1.2);
    }
  }
  let spaceHeld=false;
  function turn(yaw,pitch) {
    cam.rotation.y+=yaw;
    cam.rotation.x=T.MathUtils.clamp(cam.rotation.x+pitch,-1.2,1.2);
  }
  const mobile = (!onMove || tools)
    ? mobileControls(host,turn,()=>Boolean(travel || guide>=0 || drag || multiTouch || wheelZoom)) : null;
  const shortcuts={KeyW:"前進",KeyS:"後退",KeyA:"左移",KeyD:"右移",
    ArrowUp:"前進",ArrowDown:"後退",ArrowLeft:"左移",ArrowRight:"右移"};
  const turning={ArrowUp:"抬頭",ArrowDown:"低頭",ArrowLeft:"左轉",ArrowRight:"右轉"};
  const actionFor=code=>(spaceHeld && turning[code]) || shortcuts[code];
  function blocked(x, z) {
    return hasBench && Math.abs(x) < 1.67 && z > -1.78 && z < -0.62;
  }
  function move(x, z) {
    x = T.MathUtils.clamp(x, -halfWidth + .4, halfWidth - .4);
    z = T.MathUtils.clamp(z, -halfDepth + .4, halfDepth - .4);
    if (!blocked(x, cam.position.z)) cam.position.x = x;
    if (!blocked(cam.position.x, z)) cam.position.z = z;
  }
  const marker = new T.Mesh(
    new T.RingGeometry(0.12, 0.17, 40),
    new T.MeshBasicMaterial({
      color: 0x244e62,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  function navigate(point, look = null) {
    const end = new T.Vector3(
      T.MathUtils.clamp(point.x, -halfWidth + .4, halfWidth - .4),
      look ? point.y : 1.65,
      T.MathUtils.clamp(point.z, -halfDepth + .4, halfDepth - .4),
    );
    if (blocked(end.x, end.z)) end.z = cam.position.z > -1.2 ? -0.54 : -1.86;
    marker.position.set(end.x, 0.014, end.z);
    marker.visible = !look;
    let start = cam.position.clone(),
      steps = [],
      crosses = false;
    for (let i = 1; i <= 40; i++) {
      let t = i / 40;
      if (
        blocked(
          T.MathUtils.lerp(start.x, end.x, t),
          T.MathUtils.lerp(start.z, end.z, t),
        )
      ) {
        crosses = true;
        break;
      }
    }
    if (crosses) {
      const side = (start.x + end.x >= 0 ? 1 : -1) * 1.83;
      steps.push(
        new T.Vector3(
          side,
          1.65,
          start.z >= -1.2 ? Math.max(start.z, -0.52) : Math.min(start.z, -1.88),
        ),
        new T.Vector3(
          side,
          1.65,
          end.z >= -1.2 ? Math.max(end.z, -0.52) : Math.min(end.z, -1.88),
        ),
      );
    }
    const path = [start, ...steps, end],
      curve = new T.CurvePath();
    for (let i = 1; i < path.length; i++)
      if (path[i].distanceTo(path[i - 1]) > 0.001)
        curve.add(new T.LineCurve3(path[i - 1], path[i]));
    travel = {
      curve,
      end,
      look,
      started: performance.now(),
      duration: look
        ? Math.min(2800, Math.max(750, curve.getLength()*250))
        : Math.max(450, curve.getLength()*1550),
      rotation: cam.quaternion.clone(),
    };
  }
  function resetView() {
    blur();
    zoomed=false;
    travel=null;
    marker.visible=false;
    stopInspection();
    setEntrance();
    cam.position.copy(station);
    cam.lookAt(entranceLook);
    cam.updateMatrixWorld();
    canvas.focus({preventScroll:true});
    host.dispatchEvent(new Event("viewreset"));
  }
  if (onMove) {
    const reset=document.createElement("button");
    reset.type="button";
    reset.textContent="回到預設";
    reset.setAttribute("aria-keyshortcuts","R");
    reset.style.cssText="position:absolute;right:8px;top:8px;z-index:2";
    reset.onclick=resetView;
    host.append(reset);
  }
  const arrowTapMs=180, arrowStep=.12/.9, arrowPrecision=.18/.9;
  let tapTravel = [];
  function key(e) {
    const code=e.code || (e.key.length===1 ? "Key"+e.key.toUpperCase() : e.key);
    if(!shortcuts[code] && code!=="KeyR" && code!=="Space") return;
    if(e.type==="keyup") {
      if(code==="Space") spaceHeld=false;
      const motion=keys.get(code);
      if (motion && code.startsWith("Arrow")) {
        if (performance.now()-motion.start < arrowTapMs && !motion.mixed)
          operate(motion.action, Math.max(0,arrowStep-motion.applied));
      } else if(motion && !motion.moved) {
        tapTravel.push({action:actionFor(code),remaining:.065});
      }
      keys.delete(code);
      return;
    }
    if(e.altKey || e.metaKey || e.ctrlKey || document.querySelector("dialog[open]")) return;
    const field=e.target.closest?.("input,textarea,select,[contenteditable=true]");
    if(field && field.getClientRects().length &&
       !(field.type==="range" && code.startsWith("Key"))) return;
    if(host.getBoundingClientRect().bottom<40 || host.getBoundingClientRect().top>innerHeight) return;
    if(code==="Space" && e.target.closest?.("button,a,summary") && !e.target.closest(".walk-stick")) return;
    e.preventDefault();
    if(code==="Space") { spaceHeld=true; return; }
    if(keys.has(code) || (code==="KeyR" && e.repeat)) return;
    if(code==="KeyR"){resetView();return;}
    keys.set(code,{start:performance.now(),moved:false,applied:0,action:actionFor(code),mixed:false});
  }
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", key);
  let blur = () => {
    cancelDrag();
    fingers.clear();multiTouch=false;pinch=null;wheelZoom=null;
    keys.clear();
    tapTravel=[];
    mobile?.release();
    spaceHeld=false;
  };
  window.addEventListener("blur", blur);
  let ro = new ResizeObserver(() => {
    wheelZoom=null;
    let w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    if(zoomed) {
      if(reading)syncReadingTrack(cam.position);
      if(fingers.size===2)beginPinch();
    } else if(reading)startReading(reading.x,false);
    else if(guide>=0 && !onMove)focus(guide,false);
  });
  ro.observe(host);
  const frameMeter=document.getElementById("frameMeter");
  let elapsed=0, frames=0, fastFrames=0, highRefresh=false;
  let last = performance.now();
  function renderFrame(now) {
    let dt = Math.min(0.040, Math.max(0, (now - last) / 1000));
    const ms=now-last;
    last = now;
    if (ms>0 && ms<300 && !document.hidden) {
      elapsed+=ms; frames++;
      if(ms<11)fastFrames++;
      if(elapsed>=1500) {
        if(fastFrames>frames*.35) highRefresh=true;
        const fps=1000*frames/elapsed;
        if(frameMeter)frameMeter.textContent=Math.round(fps)+" FPS";
        const goal=highRefresh?120:60;
        if(fps<goal*.84 && renderer.getPixelRatio()>.9)
          renderer.setPixelRatio(Math.max(.9,renderer.getPixelRatio()-.15));
        elapsed=frames=fastFrames=0;
      }
    } else {elapsed=frames=fastFrames=0;}
    if(mobile && mobile.vector.lengthSq()>0) {
      const {x,y}=mobile.vector;
      if (spaceHeld) {
        if(x) operate(x>0?"右轉":"左轉",dt*Math.abs(x));
        if(y) operate(y>0?"低頭":"抬頭",dt*Math.abs(y));
      } else if (reading) {
        const axis=mobile.readingAxis;
        if (axis) {
          takeOverApproach();
          panTo(reading.x + axis * Math.min(reading.fieldWidth,reading.closeFieldWidth) * .20 * dt);
        }
      }
      else {
        if(x) operate(x>0?"右移":"左移",dt*Math.abs(x));
        if(y) operate(y>0?"後退":"前進",dt*Math.abs(y));
      }
    }
    for(const [code,motion] of keys) {
      const ramp=Math.max(0,Math.min(1,(now-motion.start)/180));
      const arrow=code.startsWith("Arrow"), action=actionFor(code);
      const amount=dt*(.3+.7*ramp*ramp*(3-2*ramp))*(arrow ? arrowPrecision : 1);
      operate(action,amount);
      motion.applied+=amount;
      if(action!==motion.action) motion.mixed=true;
      if (dt>0) motion.moved=true;
    }
    for(const tap of tapTravel) {
      const step=Math.min(tap.remaining,dt);
      operate(tap.action,step);
      tap.remaining-=step;
    }
    if(tapTravel.length) tapTravel=tapTravel.filter(tap=>tap.remaining>0);
    if (travel) {
      const t = T.MathUtils.clamp(
          (now - travel.started) / travel.duration,
          0,
          1,
        ),
        ease = t * t * (3 - 2 * t);
      // Equal ratios of viewing distance feel like equal changes in magnification.
      const ratio = travel.readDistanceRatio ?? 1;
      const pathFraction = ratio > 1.02 ? (ratio - Math.pow(ratio,1-ease))/(ratio-1) : ease;
      if (travel.curve.curves.length)
        cam.position.copy(travel.curve.getPoint(pathFraction));
      else cam.position.copy(travel.end);
      if (travel.look) {
        const final = new T.Quaternion().setFromRotationMatrix(
          new T.Matrix4().lookAt(cam.position, travel.look, cam.up),
        );
        cam.quaternion.slerpQuaternions(travel.rotation, final, ease);
      }
      if (reading && travel.readStart !== undefined)
        cam.position.addScaledVector(reading.axis,(reading.x-travel.readStart)*ease);
      if (t === 1) {
        travel = null;
        if (reading) placeOnTrack();
      }
    }
    for (let { img, ctx, tex } of animated) {
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, 512, 512);
        tex.needsUpdate = true;
      }
    }
    if(wheelZoom)advanceWheel(now);
    if (!travel) marker.visible = false;
    renderer.render(scene, cam);
    rulers?.draw();
  }
  renderer.setAnimationLoop(renderFrame);
  function focus(i, animate = false) {
    const g = groups[i];
    if (!g) return;
    wheelZoom=null;zoomed=false;
    if(onMove)editorSelection=i;
    rulers?.select(i);
    if(tools && onMove) {
      const art=works[i], box=tools.envelope(tools.members(works,art));
      const angle=walls[art.wall], mid=(box.left+box.right)/2, center=g.position.clone();
      center.x+=(mid-art.x)*Math.cos(angle);
      center.z-=(mid-art.x)*Math.sin(angle);
      center.y=box.top/2;
      const tan=Math.tan(T.MathUtils.degToRad(cam.fov/2));
      const aspect=host.clientWidth/Math.max(1,host.clientHeight);
      const fit=Math.max((box.right-box.left+.85)/Math.max(.1,aspect),box.top+.65)/(2*tan);
      const available=2*(art.wall%2 ? halfWidth : halfDepth)-.55-(art.z || 0);
      cam.position.copy(center).addScaledVector(new T.Vector3(Math.sin(angle),0,Math.cos(angle)),Math.min(available,Math.max(2.4,fit)));
      cam.lookAt(center); travel=null;
      return;
    }
    const spec=mounted.get(works[i].id).mount.userData.spec;
    const halfFov = T.MathUtils.degToRad(cam.fov / 2);
    const distance = Math.min(
      cam.far*.8,
      Math.max(
        0.85,
        (spec.width*.57) /
          (Math.tan(halfFov) * Math.max(0.1, cam.aspect)),
        (spec.height*.6) /
          Math.tan(halfFov),
      ),
    );
    const center=framingCenter(g,spec);
    const dest = center.clone()
      .addScaledVector(
        new T.Vector3(0, 0, 1).applyQuaternion(g.quaternion),
        distance,
      );
    dest.y=center.y;
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      navigate(dest,center);
    else {
      travel = null;
      cam.position.copy(dest);
      cam.lookAt(center);
    }
  }
  function stopInspection() {
    if (guide >= 0 && !onMove) {
      reading = null;
      guide = -1;
      onPick(null);
    }
  }
  function startReading(x, animate) {
    wheelZoom=null;zoomed=false;
    const g=groups[guide], a=works[guide];
    const angle=walls[a.wall || 0];
    const normal=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
    const {mount,face}=mounted.get(a.id),spec=mount.userData.spec;
    const axis=new T.Vector3(1,0,0);
    if(spec.isHandscroll)axis.applyQuaternion(g.quaternion);
    else axis.set(Math.cos(angle),0,-Math.sin(angle));
    const centerOffset=spec.isHandscroll ? (spec.left+spec.right)/2 : 0;
    const rollWidth=spec.isHandscroll ? spec.width : a.width;
    const faceCenter=g.position.clone().addScaledVector(normal,face.position.z).addScaledVector(axis,centerOffset);
    const halfAngle=T.MathUtils.degToRad(cam.fov/2);
    const distance=a.height/(2*Math.tan(halfAngle));
    const fieldWidth=a.height*cam.aspect;
    const limit=Math.max(0,(rollWidth-fieldWidth)/2);
    x=T.MathUtils.clamp(x,-limit,limit);
    const origin=faceCenter.clone().addScaledVector(normal,distance);
    const at=faceCenter.clone().addScaledVector(axis,x);
    const dest=origin.clone().addScaledVector(axis,x);
    const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(dest,at,cam.up));
    reading={x,axis,normal,faceCenter,origin,orientation,fieldWidth,closeFieldWidth:fieldWidth,limit,rollWidth,centerOffset};
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(dest,at);
      travel.readStart=x;
      travel.readDistanceRatio=cam.position.distanceTo(at)/distance;
    } else {
      travel=null;
      cam.position.copy(dest);
      cam.lookAt(at);
    }
    onRead(limit ? (x+limit)/(2*limit) : .5);
  }
  function syncReadingTrack(position) {
    const relative=position.clone().sub(reading.faceCenter);
    const distance=Math.max(.18,relative.dot(reading.normal));
    reading.origin.copy(reading.faceCenter).addScaledVector(reading.normal,distance);
    reading.origin.y=position.y-relative.dot(reading.axis)*reading.axis.y;
    reading.fieldWidth=2*distance*Math.tan(T.MathUtils.degToRad(cam.fov/2))*cam.aspect;
    // At the roll ends, the cursor can be over the last character. Keep that
    // character anchored even when pulling back reveals a little bare wall.
    reading.x=relative.dot(reading.axis);
    reading.limit=Math.max(Math.abs(reading.x),(reading.rollWidth-reading.fieldWidth)/2);
    cam.position.copy(reading.origin).addScaledVector(reading.axis,reading.x);
    onRead(reading.limit ? (reading.x+reading.limit)/(2*reading.limit) : .5);
  }
  function placeOnTrack() {
    cam.position.copy(reading.origin).addScaledVector(reading.axis,reading.x);
    cam.quaternion.copy(reading.orientation);
  }
  function takeOverApproach() {
    if (!travel) return;
    const relative=cam.position.clone().sub(reading.faceCenter);
    const distance=Math.max(cam.near*2,relative.dot(reading.normal));
    reading.origin.copy(reading.faceCenter).addScaledVector(reading.normal,distance);
    reading.fieldWidth=2*distance*Math.tan(T.MathUtils.degToRad(cam.fov/2))*cam.aspect;
    reading.limit=Math.max(0,(reading.rollWidth-reading.fieldWidth)/2);
    reading.x=T.MathUtils.clamp(relative.dot(reading.axis),-reading.limit,reading.limit);
    travel=null;
  }
  function panTo(value) {
    if (!reading) return;
    const {limit}=reading;
    const art=works[guide], halfWall=art.wall%2 ? halfDepth : halfWidth;
    const angle=walls[art.wall || 0];
    const projection=reading.axis.x*Math.cos(angle)-reading.axis.z*Math.sin(angle);
    const center=art.x+reading.centerOffset*projection;
    let min=-limit,max=limit;
    if(Math.abs(projection)>1e-5) {
      const a=(-halfWall+.25-center)/projection,b=(halfWall-.25-center)/projection;
      min=Math.max(min,Math.min(a,b)); max=Math.min(max,Math.max(a,b));
    }
    reading.x=T.MathUtils.clamp(value,min,max);
    if (!travel) placeOnTrack();
    onRead(limit ? (reading.x+limit)/(2*limit) : .5);
  }
  function changeWork(i,u) {
    if (!works.length) return;
    reading=null;
    guide = (i + works.length) % works.length;
    const a=works[guide];
    if (!onMove) onPick(a);
    if (!onMove && followsWall(a)) {
      const spec=mounted.get(a.id).mount.userData.spec;
      const midpoint=spec.isHandscroll ? (spec.left+spec.right)/2 : 0;
      const start=u!=null ? (u-.5)*a.width-midpoint : (spec.isHandscroll ? spec.width : a.width)/2;
      startReading(start,true);
    }
    else focus(guide,true);
    return a;
  }
  const entryLook=e=>turn(-e.detail.dx*.003,-e.detail.dy*.003);
  host.addEventListener("entrylook",entryLook);
  host.dispatchEvent(new CustomEvent("viewerready",{detail: input =>
    input.type==="entrylook" ? turn(-input.dx*.003,-input.dy*.003) : key({ ...input, target:canvas, preventDefault() {} })
  }));
  return {
    seek(fraction) { wheelZoom=null; if (reading) panTo((fraction*2-1)*reading.limit); },
    overview() {
      const i=guide;
      if(i>=0){ stopInspection(); focus(i,true); }
    },
    next(offset = 1) {
      return changeWork(
        guide < 0 ? (offset > 0 ? 0 : works.length - 1) : guide + offset,
      );
    },
    select(i) {
      return changeWork(i);
    },
    inspectMountEdge(id) {
      const entry=mounted.get(id);
      if(!onMove || !entry)return;
      const {g,mount}=entry, spec=mount.userData.spec;
      wheelZoom=null;
      zoomed=false;
      g.updateWorldMatrix(true,false);
      // Inspect the physical edge from the side with the most space inside the room.
      const candidates=[-1,1].map(sign=>{
        const x=sign*spec.w/2;
        const at=g.localToWorld(new T.Vector3(x,0,spec.faceZ));
        const eye=g.localToWorld(new T.Vector3(x+sign*.42,0,spec.faceZ+.27));
        const space=Math.min(halfWidth-Math.abs(eye.x),halfDepth-Math.abs(eye.z),eye.y,roomHeight-eye.y);
        return {at,eye,space};
      });
      const {eye,at}=candidates[0].space>candidates[1].space ? candidates[0] : candidates[1];
      eye.x=T.MathUtils.clamp(eye.x,-halfWidth+.12,halfWidth-.12);
      eye.z=T.MathUtils.clamp(eye.z,-halfDepth+.12,halfDepth-.12);
      eye.y=T.MathUtils.clamp(eye.y,.15,roomHeight-.15);
      if(reducedMotion.matches || eye.distanceTo(cam.position)<.005) {
        travel=null;
        cam.position.copy(eye);
        cam.lookAt(at);
      } else {
        navigate(eye,at);
        travel.duration=Math.min(travel.duration,650);
      }
    },
    updateMount(id,next) {
      const entry=mounted.get(id);
      if(!onMove || disposed || !entry || !next)return;
      const {a,g,face,plaque}=entry;
      // The editor sends a merged artwork. Missing custom fields restore their original finish.
      for(const key of mountFields)a[key]=next[key];
      if(next.width!=null)a.width=next.width;
      if(next.height!=null)a.height=next.height;
      const replacement=mounts.build(a), spec=replacement.userData.spec;
      disposeMount(entry.mount);
      entry.mount=replacement;
      g.add(replacement);
      if(entry.strip) {
        targets.splice(targets.indexOf(entry.strip),1);
        entry.strip.removeFromParent();entry.strip.geometry.dispose();entry.strip.material.dispose();
      }
      entry.strip=mountedSurfaceTarget(g,a,spec);
      face.position.z=spec.faceZ;
      face.scale.set(spec.w/face.geometry.parameters.width,spec.h/face.geometry.parameters.height,1);
      for(const tile of g.children.filter(child=>child.name==="artwork-tile")) {
        const {index,count}=tile.userData.tile;
        tile.position.set(spec.w*((index+.5)/count-.5),0,spec.faceZ+.001);
        tile.scale.set(spec.w/count/tile.geometry.parameters.width,spec.h/tile.geometry.parameters.height,1);
      }
      plaque.position.set(spec.right+.28,-spec.h/2+.08,-.064);
      renderer.shadowMap.needsUpdate=true;
      rulers?.dirty();
    },
    updateLight(id,next) {
      const entry=mounted.get(id);
      if(!onMove || disposed || !entry)return;
      for(const key of ["lx","ly","lz","power","kelvin","angle"])entry.a[key]=next[key];
      setLight(entry.light,entry.a);
      renderer.shadowMap.needsUpdate=true;
    },
    updatePlacements(changes) {
      if(!onMove)return;
      const byId=new Map(changes.map(work=>[work.id,work]));
      works.forEach((work,index)=>{
        const next=byId.get(work.id);
        if(!next)return;
        Object.assign(work,{x:next.x,y:next.y,z:next.z,rotate:next.rotate,groupId:next.groupId});
        layout(groups[index],work);
      });
      rulers?.dirty();
    },
    setPaused(paused) {
      if(disposed)return;
      blur();
      last=performance.now();
      renderer.setAnimationLoop(paused ? null : renderFrame);
      for(const video of videos) {
        if(paused)video.pause();
        else video.play().catch(()=>{});
      }
    },
    home:resetView,
    focus,
    dispose() {
      mounts.dispose();
      building.dispose?.();
      building.textures.forEach((t) => t.dispose());
      scene.traverse((o) => o.shadow?.dispose());
      host.removeEventListener("entrylook",entryLook);
      mobile?.dispose();
      canvas.removeEventListener("wheel",handleWheel);
      disposed = true;
      reflection?.dispose();
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
      videos.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      textures.forEach((t) => t.dispose());
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      host.replaceChildren();
    },
  };
}
