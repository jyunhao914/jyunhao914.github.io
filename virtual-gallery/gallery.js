import * as T from "./vendor/three.module.js";
import { architecture } from "./architecture.js?v=vault1";
export function gallery(host, works, onPick, onMove) {
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(64, 1, 0.06, 80),
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
  const building = architecture(scene, box, renderer);
  let reflection,
    disposed = false;
  building.ready.then(() => {
    if (disposed) return;
    const cube = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
    const probe = new T.CubeCamera(0.08, 78, cube);
    probe.position.set(0, 1.7, 0);
    probe.update(renderer, scene);
    const pmrem = new T.PMREMGenerator(renderer);
    reflection = pmrem.fromCubemap(cube.texture);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.28;
    cube.dispose();
    pmrem.dispose();
  });
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
    let depth = (a.wall % 2 ? 5.87 : 6.87) - (a.z || 0);
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
    if (m) box(g, w + 2 * m, h + 2 * m, 0.012, 0xf7f2e5, 0, 0, d / 2);
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
    } else if (a.type === "圖片") tex = new T.TextureLoader().load(a.src);
    else tex = labelTexture(a);
    tex.colorSpace = T.SRGBColorSpace;
    textures.push(tex);
    let face = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.17,
      }),
    );
    face.position.z = d / 2 + 0.012;
    face.userData.a = a;
    g.add(face);
    targets.push(face);
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
  cam.position.set(3.8, 1.65, 3.25);
  cam.lookAt(-1.7, 1.46, -4.9);
  cam.rotation.order = "YXZ";
  let keys = new Set(),
    ray = new T.Raycaster(),
    drag,
    guide = -1;
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
    drag = {
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      inspecting: guide >= 0 && !onMove,
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
          half = (a.wall % 2 ? 7 : 6) - a.width / 2;
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
    } else if (!drag.inspecting) {
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
      drag.inspecting &&
      Math.abs(dx) > 42 &&
      Math.abs(dx) > Math.abs(dy) * 1.3
    )
      changeWork(guide + (dx < 0 ? 1 : -1));
    else if (drag.dist < 9 && drag.click) {
      const work = drag.click.userData.a;
      if (onMove) onPick(work);
      else changeWork(works.indexOf(work));
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
  const pad = document.createElement("div"),
    stick = document.createElement("button"),
    knob = document.createElement("span");
  pad.className = "pad walk-pad";
  stick.className = "walk-stick";
  stick.type = "button";
  stick.setAttribute("aria-label", "移動搖桿：拖曳前進、後退或側移");
  knob.className = "walk-knob";
  stick.append(knob);
  pad.append(stick);
  host.append(pad);
  let joyX = 0,
    joyY = 0,
    stickPointer = null,
    travel = null;
  const velocity = new T.Vector2(),
    wish = new T.Vector2();
  function steer(e) {
    stopInspection();
    const r = stick.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width * 0.34),
      y = (e.clientY - r.top - r.height / 2) / (r.height * 0.34),
      length = Math.max(1, Math.hypot(x, y));
    joyX = x / length;
    joyY = y / length;
    knob.style.transform = "translate(" + joyX * 20 + "px," + joyY * 20 + "px)";
    travel = null;
  }
  stick.onpointerdown = (e) => {
    if (stickPointer !== null) return;
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    steer(e);
  };
  stick.onpointermove = (e) => {
    if (e.pointerId === stickPointer) steer(e);
  };
  function neutral() {
    stickPointer = null;
    joyX = joyY = 0;
    knob.style.transform = "";
  }
  stick.onlostpointercapture = neutral;
  function blocked(x, z) {
    return Math.abs(x) < 1.67 && z > -1.78 && z < -0.62;
  }
  function move(x, z) {
    x = T.MathUtils.clamp(x, -5.6, 5.6);
    z = T.MathUtils.clamp(z, -6.6, 6.6);
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
      T.MathUtils.clamp(point.x, -5.6, 5.6),
      look ? point.y : 1.65,
      T.MathUtils.clamp(point.z, -6.6, 6.6),
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
    velocity.set(0, 0);
  }
  function key(e) {
    if (
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      document.querySelector("dialog[open]")
    )
      return;
    if (
      e.type === "keydown" &&
      (host.getBoundingClientRect().bottom < 40 ||
        host.getBoundingClientRect().top > innerHeight)
    )
      return;
    let k = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    ) {
      e.preventDefault();
      if (e.type === "keydown") {
        stopInspection();
        travel = null;
        keys.add(k);
      } else keys.delete(k);
    }
  }
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", key);
  let blur = () => {
    keys.clear();
    neutral();
    velocity.set(0, 0);
  };
  window.addEventListener("blur", blur);
  let ro = new ResizeObserver(() => {
    let w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    if (guide >= 0 && !onMove) focus(guide, false);
  });
  ro.observe(host);
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    let dt = Math.min(0.085, Math.max(0, (now - last) / 1000));
    last = now;
    let has = (a, b) => Number(keys.has(a) || keys.has(b));
    wish
      .set(
        has("d", "arrowright") - has("a", "arrowleft") + joyX,
        has("s", "arrowdown") - has("w", "arrowup") + joyY,
      )
      .clampLength(0, 1);
    velocity.lerp(wish, 1 - Math.exp(-14 * dt));
    if (travel) {
      const t = T.MathUtils.clamp(
          (now - travel.started) / travel.duration,
          0,
          1,
        ),
        ease = t * t * (3 - 2 * t);
      if (travel.curve.curves.length)
        cam.position.copy(travel.curve.getPoint(ease));
      else cam.position.copy(travel.end);
      if (travel.look) {
        const final = new T.Quaternion().setFromRotationMatrix(
          new T.Matrix4().lookAt(cam.position, travel.look, cam.up),
        );
        cam.quaternion.slerpQuaternions(travel.rotation, final, ease);
      }
      if (t === 1) travel = null;
    } else {
      const yaw = cam.rotation.y,
        dx = velocity.x * dt * 3.2,
        dz = velocity.y * dt * 3.2;
      move(
        cam.position.x + dx * Math.cos(yaw) + dz * Math.sin(yaw),
        cam.position.z - dx * Math.sin(yaw) + dz * Math.cos(yaw),
      );
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
      11,
      Math.max(
        0.85,
        ((works[i].width + 2 * (works[i].mat + works[i].frameWidth)) * 0.57) /
          (Math.tan(halfFov) * Math.max(0.38, cam.aspect)),
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
      guide = -1;
      onPick(null);
    }
  }
  function changeWork(i) {
    if (!works.length) return;
    guide = (i + works.length) % works.length;
    focus(guide, true);
    if (!onMove) onPick(works[guide]);
    return works[guide];
  }
  return {
    next(offset = 1) {
      return changeWork(
        guide < 0 ? (offset > 0 ? 0 : works.length - 1) : guide + offset,
      );
    },
    select(i) {
      return changeWork(i);
    },
    home() {
      stopInspection();
      navigate(new T.Vector3(3.8, 1.65, 3.25), new T.Vector3(-1.7, 1.46, -4.9));
    },
    focus,
    dispose() {
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
