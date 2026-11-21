import * as T from "./vendor/three.module.js";
export function gallery(host, works, onPick, onMove) {
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(64, 1, 0.06, 80),
    renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  host.replaceChildren(renderer.domElement);
  const canvas = renderer.domElement;
  scene.background = new T.Color(0xe5e8e8);
  scene.add(new T.HemisphereLight(0xffffff, 0xc7b9a7, 1.6));
  function box(parent, w, h, d, color, x, y, z, props = {}) {
    let m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, ...props }),
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  box(scene, 12, 0.12, 14, 0xb9afa0, 0, -0.06, 0);
  box(scene, 12, 0.12, 14, 0xf8f8f6, 0, 4.55, 0);
  for (let s of [-1, 1]) {
    box(scene, 0.12, 4.6, 14, 0xf2f1ed, s * 6, 2.25, 0);
    box(scene, 12, 4.6, 0.12, 0xf7f5ef, 0, 2.25, s * 7);
  }
  // Floor joints, track lights and a central bench give the room a visible scale.
  for(let x=-4;x<=4;x+=2)box(scene,.012,.004,14,0x988e82,x,0,0);
  for(let z=-6;z<=6;z+=2)box(scene,12,.004,.012,0x988e82,0,0,z);
  for(let x of [-3,3]){
    box(scene,.065,.06,13,0x3b4245,x,4.44,0);
    for(let z of [-5,-1,3])box(scene,.14,.21,.18,0x353b41,x,4.31,z);
  }
  const bench=box(scene,2.6,.13,.6,0x8e6747,0,.46,-1.2);
  for(let x of [-.9,.9])box(bench,.10,.40,.47,0x434748,x,-.24,0);
  const environment = new T.Scene();
  environment.background = new T.Color(0xa7b0ba);
  for (let x of [-4, 4]) {
    let panel = new T.Mesh(
      new T.PlaneGeometry(4, 3),
      new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }),
    );
    panel.position.set(x, 2, -3);
    environment.add(panel);
  }
  const pmrem = new T.PMREMGenerator(renderer),
    reflection = pmrem.fromScene(environment);
  scene.environment = reflection.texture;
  pmrem.dispose();
  environment.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
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
      new T.MeshStandardMaterial({ map: tex, roughness: 0.92 }),
    );
    face.position.z = d / 2 + 0.012;
    face.userData.a = a;
    g.add(face);
    targets.push(face);
    let k = a.kelvin,
      t = (k - 2500) / 4500;
    let light = new T.SpotLight(
      new T.Color().setRGB(1, 0.72 + 0.26 * t, 0.46 + 0.54 * t),
      a.power,
      12,
      (a.angle * Math.PI) / 180,
      0.45,
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
    canvas.setPointerCapture(e.pointerId);
    let obj = hit(e);
    drag = {
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
    if (!drag) return;
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
    } else {
      cam.rotation.y -= dx * 0.005;
      cam.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, cam.rotation.x - dy * 0.005),
      );
    }
  };
  canvas.onpointerup = () => {
    if (drag?.dist < 6 && drag.click) onPick(drag.click.userData.a);
    else if (drag?.obj) onMove(drag.obj.userData.a);
    drag = null;
  };
  canvas.onpointercancel = () => (drag = null);
  let pad = document.createElement("div");
  pad.className = "pad";
  for (let [k, n] of [
    ["a", "左移"],
    ["w", "前進"],
    ["s", "後退"],
    ["d", "右移"],
  ]) {
    let b = document.createElement("button");
    b.textContent = n;
    b.onpointerdown = (e) => {
      b.setPointerCapture(e.pointerId);
      keys.add(k);
    };
    b.onlostpointercapture = () => keys.delete(k);
    pad.append(b);
  }
  host.append(pad);
  function key(e) {
    if (
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      document.querySelector("dialog[open]")
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
      if (e.type === "keydown") keys.add(k);
      else keys.delete(k);
    }
  }
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", key);
  let blur = () => keys.clear();
  window.addEventListener("blur", blur);
  let ro = new ResizeObserver(() => {
    let w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  });
  ro.observe(host);
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    let dt = Math.min(0.05, (now - last) / 1000) * 3;
    last = now;
    let has = (a, b) => Number(keys.has(a) || keys.has(b));
    cam.translateX(dt * (has("d", "arrowright") - has("a", "arrowleft")));
    cam.translateZ(dt * (has("s", "arrowdown") - has("w", "arrowup")));
    cam.position.y = 1.65;
    cam.position.x = T.MathUtils.clamp(cam.position.x, -5.6, 5.6);
    cam.position.z = T.MathUtils.clamp(cam.position.z, -6.6, 6.6);
    for (let { img, ctx, tex } of animated) {
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, 512, 512);
        tex.needsUpdate = true;
      }
    }
    renderer.render(scene, cam);
  });
  function focus(i) {
    let g = groups[i];
    if (!g) return;
    let n = new T.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
    cam.position
      .copy(g.position)
      .addScaledVector(n, Math.min(5, Math.max(2.6, works[i].width * 1.4)));
    cam.lookAt(g.position);
  }
  return {
    next() {
      guide = (guide + 1) % groups.length;
      focus(guide);
      return works[guide];
    },
    focus,
    dispose() {
      reflection.dispose();
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
