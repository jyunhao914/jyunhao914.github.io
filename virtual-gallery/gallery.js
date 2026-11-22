import {roomSize} from "./room-size.js";
import * as T from "./vendor/three.module.js";
import { architecture } from "./architecture.js?v=space12";
export function gallery(host, works, onPick, onMove, onRead = () => {}) {
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(
      64,
      1,
      0.06,
      80,
    ),
    renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  renderer.shadowMap.type = T.PCFShadowMap;
  const {theme,width:halfWidth,depth:halfDepth}=roomSize(works);
  const dark = theme === "calligraphy";
  const hasBench = theme === "ink" || !theme;
  cam.far = Math.max(80,4*(halfWidth+halfDepth));
  cam.rotation.order = "YXZ";
  const station=new T.Vector3(0,1.65,2), entranceLook=new T.Vector3(0,1.65,-5);
  const building = architecture(scene, box, renderer, theme, halfWidth, halfDepth);
  let reflection,
    disposed = false;
  building.ready
    .then(() => {
      if (disposed) return;
      const cube = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
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
    let ang = walls[a.wall || 0];
    g.rotation.set(0, ang, 0);
    g.rotateZ(((a.rotate || 0) * Math.PI) / 180);
    let depth = ((a.wall % 2 ? halfWidth : halfDepth) - .13) - (a.z || 0);
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
  works.forEach((a) => {
    let g = new T.Group();
    scene.add(g);
    groups.push(g);
    layout(g, a);
    let w = a.width,
      h = a.height,
      f = a.frame === "無框" ? 0 : a.frameWidth,
      m = a.mat,
      d = a.depth;
    if (a.mount === "掛軸") {
      const contactCanvas = document.createElement("canvas");
      contactCanvas.width = 256;
      contactCanvas.height = 192;
      const ink = contactCanvas.getContext("2d");
      ink.filter = "blur(4px)";
      ink.fillStyle = "rgba(26,19,13,.42)";
      ink.fillRect(9, 8, 238, 175);
      const shadowMap = new T.CanvasTexture(contactCanvas);
      textures.push(shadowMap);
      const shadow = new T.Mesh(
        new T.PlaneGeometry((w + 2 * (f + m)) * 1.08, (h + 2 * (f + m)) * 1.12),
        new T.MeshBasicMaterial({
          map: shadowMap,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.position.set(0.018, -0.027, -0.055);
      g.add(shadow);
    }
    if (a.mount === "掛軸") {
      const silkWidth = w + 2 * m;
      const silkHeight = h + .48;
      const brocadeMap = (channel) => {
        const map = new T.TextureLoader().load(new URL("./materials/brocade-" + channel + ".webp", import.meta.url).href);
        textures.push(map);
        map.wrapS = map.wrapT = T.RepeatWrapping;
        map.repeat.set(silkWidth / .28, silkHeight / .284);
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (channel === "color") map.colorSpace = T.SRGBColorSpace;
        return map;
      };
      box(g, silkWidth, silkHeight, .012, dark ? 0xd4cdb7 : 0xd1c6aa, 0, .05, d / 2 - .006,
        {map: brocadeMap("color"), normalMap: brocadeMap("normal"), roughnessMap: brocadeMap("rough"),
          normalScale: new T.Vector2(.25,.25), roughness: .85});
      box(g, silkWidth, .014, .018, 0x504639, 0, silkHeight / 2 + .05, d / 2);
      {
        const height = -silkHeight / 2 + .05;
        const roller = new T.Mesh(
          new T.CylinderGeometry(.027, .027, silkWidth + .10, 16),
          new T.MeshStandardMaterial({...building.wood, color: 0x624636, roughness: .62})
        );
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, height, d / 2);
        roller.castShadow = true;
        g.add(roller);
      }
    }
    if (f)
      box(
        g,
        w + 2 * (f + m),
        h + 2 * (f + m),
        d,
        a.frame === "木框" ? 0x805638 : 0x66717c,
        0,
        0,
        0,
        {
          metalness: a.frame === "金屬框" ? 0.7 : 0.08,
          roughness: a.finish === "亮面" ? 0.16 : 0.82,
          envMapIntensity: 1,
          ...(a.frame === "木框" ? building.wood : {}),
        },
      );
    if (m && a.mount !== "掛軸") box(g, w + 2 * m, h + 2 * m, 0.012, 0xf7f2e5, 0, 0, d / 2);
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
      if(disposed || a.tiles?.length || w < 4*h || image.width<=4096) return;
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
    face.position.z = d / 2 + 0.012;
    face.userData.a = a;
    face.userData.picture = true;
    g.add(face);
    targets.push(face);
    function addSection(tile,index,count) {
      tile.colorSpace=T.SRGBColorSpace;
      tile.anisotropy=tex.anisotropy;
      textures.push(tile);
      const section=new T.Mesh(new T.PlaneGeometry(w/count,h),face.material.clone());
      section.material.map=section.material.emissiveMap=tile;
      section.position.set(w*((index+.5)/count-.5),0,face.position.z+.001);
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
    plaque.position.set(w / 2 + m + f + 0.28, -h / 2 + 0.08, 0.015);
    g.add(plaque);
    plaque.userData.a = a;
    targets.push(plaque);
    let k = a.kelvin,
      t = (k - 2500) / 4500;
    let light = new T.SpotLight(
      new T.Color().setRGB(1, 0.72 + 0.26 * t, 0.46 + 0.54 * t),
      a.power,
      12,
      (a.angle * Math.PI) / 180,
      0.72,
    );
    light.position.set(a.lx, a.ly, a.lz);
    g.add(light);
    light.target = face;
  });
  function setEntrance() {
    if (!groups.length) return;
    const a=works[0], g=groups[0], aspect=host.clientWidth/Math.max(1,host.clientHeight);
    entranceLook.copy(g.position);
    const retreat=Math.max(3.3,(a.width+2*(a.mat+a.frameWidth))*.61/(Math.tan(T.MathUtils.degToRad(cam.fov/2))*aspect));
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
  canvas.onpointerdown = (e) => {
    if (drag) return;
    canvas.setPointerCapture(e.pointerId);
    if (guide < 0 || onMove) travel = null;
    canvas.focus({ preventScroll: true });
    let obj = hit(e);
    const index = obj ? works.indexOf(obj.userData.a) : -1;
    let gesture = "look";
    if (!onMove && obj?.userData.picture) {
      if (reading && index === guide) gesture = "pan";
      else if (works[index].width < 4*works[index].height) gesture = "switch";
    }
    drag = {
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      gesture, index,
      u: obj?.userData.picture ? ray.intersectObject(obj)[0]?.uv.x : undefined,
      x: e.clientX,
      y: e.clientY,
      dist: 0,
      obj: onMove && obj,
      click: obj,
    };
    if (onMove && obj) {
      let center = obj.getWorldPosition(new T.Vector3()),
        normal = new T.Vector3(0, 0, 1).applyQuaternion(obj.parent.quaternion);
      drag.plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, center);
      drag.grab = ray.ray.intersectPlane(drag.plane, new T.Vector3());
      drag.origin = { x: obj.userData.a.x, y: obj.userData.a.y };
    }
  };
  canvas.onpointermove = (e) => {
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
      if (travel && drag.dist > 3) {
        // A drag takes over from the approach at the current wall distance.
        const relative=cam.position.clone().sub(reading.faceCenter);
        const distance=Math.max(cam.near*2,relative.dot(reading.normal));
        reading.origin.copy(reading.faceCenter).addScaledVector(reading.normal,distance);
        reading.fieldWidth=2*distance*Math.tan(T.MathUtils.degToRad(cam.fov/2))*cam.aspect;
        reading.limit=Math.max(0,(works[guide].width-reading.fieldWidth)/2);
        reading.x=T.MathUtils.clamp(relative.dot(reading.axis),-reading.limit,reading.limit);
        travel=null;
      }
      // Move 35% of the drag distance on screen. During an interrupted
      // approach, use the close-reading scale to avoid a large sideways jump.
      const panWidth = Math.min(reading.fieldWidth, reading.closeFieldWidth);
      panTo(reading.x - 0.35 * dx * panWidth / canvas.clientWidth);
    } else if (drag.gesture === "look") {
      if (drag.dist > 5) { travel=null; stopInspection(); }
      cam.rotation.y -= dx * 0.005;
      cam.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, cam.rotation.x - dy * 0.005),
      );
    }
  };
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "展廳視角，可拖曳環視或點地板前往");
  canvas.onpointerup = (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
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
      if (onMove) onPick(work);
      else if (drag.gesture !== "pan") changeWork(works.indexOf(work), drag.u);
    } else if (drag.obj) onMove(drag.obj.userData.a);
    else if (drag.dist < 9 && !onMove) {
      hit(e);
      const floorHit = ray.intersectObject(building.floor)[0];
      if (floorHit) {
        stopInspection();
        navigate(floorHit.point);
      }
    }
    drag = null;
  };
  canvas.onpointercancel = () => (drag = null);
  const pad = document.createElement("div");
  pad.className = "pad walk-pad camera-keys";
  pad.setAttribute("role","group");
  pad.setAttribute("aria-label","三維空間操作鍵");
  host.append(pad);
  let held = null, travel = null;
  function operate(action,dt) {
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
      const step=dt*1.65;
      move(cam.position.x+step*(side*Math.cos(yaw)-forward*Math.sin(yaw)),
           cam.position.z-step*(side*Math.sin(yaw)+forward*Math.cos(yaw)));
    } else {
      cam.rotation.y+=(Number(action==="左轉")-Number(action==="右轉"))*dt*.85;
      cam.rotation.x=T.MathUtils.clamp(cam.rotation.x+(Number(action==="抬頭")-Number(action==="低頭"))*dt*.65,-1.2,1.2);
    }
  }
  const keyButtons=new Map();
  function neutral() {
    if (held) held.button.classList.remove("pressed");
    held=null;
  }
  let spaceHeld=false;
  const shortcuts={KeyW:"前進",KeyS:"後退",KeyA:"左移",KeyD:"右移",
    ArrowUp:"前進",ArrowDown:"後退",ArrowLeft:"左移",ArrowRight:"右移"};
  const turning={ArrowUp:"抬頭",ArrowDown:"低頭",ArrowLeft:"左轉",ArrowRight:"右轉"};
  const arrows={ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→"};
  const actionFor=code=>(spaceHeld && turning[code]) || shortcuts[code];
  function showKeys(){
    const active=new Set(Array.from(keys.keys(),actionFor));
    keyButtons.forEach((button,action)=>button.classList.toggle("key-down",active.has(action)));
  }
  for (const action of ["前進","後退","左移","右移","抬頭","低頭","左轉","右轉"]) {
    const button=document.createElement("button");
    button.type="button";
    const turnKey=Object.keys(turning).find(code=>turning[code]===action);
    const moveKeys=Object.keys(shortcuts).filter(code=>shortcuts[code]===action);
    const label=turnKey ? "空白+"+arrows[turnKey] : moveKeys.map(code=>arrows[code] || code.slice(-1)).join(" / ");
    button.textContent=action;
    button.setAttribute("aria-label",action);
    const hint=document.createElement("kbd");
    hint.textContent=label;
    hint.setAttribute("aria-hidden","true");
    button.append(hint);
    keyButtons.set(action,button);
    if (!turnKey) button.setAttribute("aria-keyshortcuts",moveKeys.map(code=>code.replace("Key","")).join(" "));
    button.title=action+"（"+label+"）";
    button.onpointerdown=e=>{
      if(held || e.button!==0) return;
      canvas.focus({preventScroll:true});
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      held={action,button,id:e.pointerId,repeatAt:performance.now()+240};
      button.classList.add("pressed");
      operate(action,.14);
    };
    button.onpointerup=button.onpointercancel=button.onlostpointercapture=e=>{
      if(held?.id===e.pointerId) neutral();
    };
    button.onclick=e=>{ if(e.detail===0) operate(action,.14); };
    pad.append(button);
  }
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
      duration: Math.min(2100, Math.max(550, (curve.getLength() || 0) * 180)),
      rotation: cam.quaternion.clone(),
    };
  }
  function resetView() {
    blur();
    drag=null;
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
  function key(e) {
    const code=e.code || (e.key.length===1 ? "Key"+e.key.toUpperCase() : e.key);
    if(!shortcuts[code] && code!=="KeyR" && code!=="Space") return;
    if(e.type==="keyup") {
      if(code==="Space") spaceHeld=false;
      keys.delete(code);
      showKeys();
      return;
    }
    if(e.altKey || e.metaKey || e.ctrlKey || document.querySelector("dialog[open]")) return;
    const field=e.target.closest?.("input,textarea,select,[contenteditable=true]");
    if(field && field.getClientRects().length &&
       !(field.type==="range" && code.startsWith("Key"))) return;
    if(host.getBoundingClientRect().bottom<40 || host.getBoundingClientRect().top>innerHeight) return;
    if(code==="Space" && e.target.closest?.("button,a,summary")) return;
    e.preventDefault();
    if(code==="Space") { spaceHeld=true; showKeys(); return; }
    if(keys.has(code) || e.repeat) return;
    if(code==="KeyR"){resetView();return;}
    keys.set(code,performance.now()+200);
    showKeys();
    operate(actionFor(code),.14);
  }
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", key);
  let blur = () => {
    keys.clear();
    spaceHeld=false;
    keyButtons.forEach(button=>button.classList.remove("key-down"));
    neutral();
  };
  window.addEventListener("blur", blur);
  let ro = new ResizeObserver(() => {
    let w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    if (reading) startReading(reading.x, false);
    else if (guide >= 0 && !onMove) focus(guide, false);
  });
  ro.observe(host);
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    let dt = Math.min(0.085, Math.max(0, (now - last) / 1000));
    last = now;
    if (held && now >= held.repeatAt) operate(held.action,dt);
    for(const [code,repeatAt] of keys)
      if(now>=repeatAt) operate(actionFor(code),dt);
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
    if (!travel) marker.visible = false;
    renderer.render(scene, cam);
  });
  function focus(i, animate = false) {
    const g = groups[i];
    if (!g) return;
    const halfFov = T.MathUtils.degToRad(cam.fov / 2);
    const distance = Math.min(
      cam.far*.8,
      Math.max(
        0.85,
        ((works[i].width + 2 * (works[i].mat + works[i].frameWidth)) * 0.57) /
          (Math.tan(halfFov) * Math.max(0.1, cam.aspect)),
        ((works[i].height + 2 * (works[i].mat + works[i].frameWidth)) * 0.6) /
          Math.tan(halfFov),
      ),
    );
    const dest = g.position
      .clone()
      .addScaledVector(
        new T.Vector3(0, 0, 1).applyQuaternion(g.quaternion),
        distance,
      );
    dest.y = g.position.y;
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      navigate(dest, g.position);
    else {
      travel = null;
      cam.position.copy(dest);
      cam.lookAt(g.position);
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
    const g=groups[guide], a=works[guide];
    const angle=walls[a.wall || 0];
    const normal=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
    const axis=new T.Vector3(Math.cos(angle),0,-Math.sin(angle));
    const faceCenter=g.position.clone().addScaledVector(normal,a.depth/2+.012);
    const halfAngle=T.MathUtils.degToRad(cam.fov/2);
    const distance=a.height/(2*Math.tan(halfAngle));
    const fieldWidth=a.height*cam.aspect;
    const limit=Math.max(0,(a.width-fieldWidth)/2);
    x=T.MathUtils.clamp(x,-limit,limit);
    const origin=faceCenter.clone().addScaledVector(normal,distance);
    const at=faceCenter.clone().addScaledVector(axis,x);
    const dest=origin.clone().addScaledVector(axis,x);
    const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(dest,at,cam.up));
    reading={x,axis,normal,faceCenter,origin,orientation,fieldWidth,closeFieldWidth:fieldWidth,limit};
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
  function placeOnTrack() {
    cam.position.copy(reading.origin).addScaledVector(reading.axis,reading.x);
    cam.quaternion.copy(reading.orientation);
  }
  function panTo(value) {
    if (!reading) return;
    const {limit}=reading;
    reading.x=T.MathUtils.clamp(value,-limit,limit);
    if (!travel) placeOnTrack();
    onRead(limit ? (reading.x+limit)/(2*limit) : .5);
  }
  function changeWork(i,u) {
    if (!works.length) return;
    reading=null;
    guide = (i + works.length) % works.length;
    const a=works[guide];
    if (!onMove) onPick(a);
    if (!onMove && a.width >= 4*a.height) startReading(((u ?? 1)-.5)*a.width,true);
    else focus(guide,true);
    return a;
  }
  return {
    seek(fraction) { if (reading) panTo((fraction*2-1)*reading.limit); },
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
    home:resetView,
    focus,
    dispose() {
      building.dispose?.();
      building.textures.forEach((t) => t.dispose());
      scene.traverse((o) => o.shadow?.dispose());
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
