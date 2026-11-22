import * as T from "./vendor/three.module.js";

// The atlas contains diffuse interreflection from the garden window and roof apertures.
// UV sets are independent: scanned textures tile in metres, irradiance spans the whole room.
export function architecture(scene, box, renderer, theme = "") {
  // Front, rear, window and opposite wall share a plaster finish.
  const palettes = {
    calligraphy: [0x253441, 0x343039, 0x303e39, 0x38404a],
    ink: [0x34433f, 0x383746, 0x2c3b49, 0x464443],
  };
  const colors = palettes[theme];
  const dark = Boolean(colors);
  const study = theme === "calligraphy";
  const textures = [],
    loads = [];
  const loader = new T.TextureLoader();
  function texture(file, color = false, x = 1, y = 1) {
    let tex;
    loads.push(
      new Promise((resolve) => {
        tex = loader.load(
          new URL("./materials/" + file, import.meta.url).href,
          resolve,
          undefined,
          resolve,
        );
      }),
    );
    if (color) tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(x, y);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(tex);
    return tex;
  }
  function surface(type, x, y) {
    const props = {
      map: texture(type + "-color.webp", true, x, y),
      normalMap: texture(type + "-normal.webp", false, x, y),
    };
    if (type !== "plaster")
      props.roughnessMap = texture(type + "-rough.webp", false, x, y);
    return props;
  }
  const illumination = texture("daylight.webp");
  illumination.channel = 1;
  illumination.flipY = false;
  illumination.wrapS = illumination.wrapT = T.ClampToEdgeWrapping;
  function bake(mesh, face) {
    if (face !== 0) {
      mesh.material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(.84,.83,.80),.63);",
        );
      };
    }
    mesh.material.lightMap = illumination;
    mesh.material.lightMapIntensity = 15;
    mesh.updateMatrixWorld(true);
    const pos = mesh.geometry.attributes.position,
      uv = [],
      pt = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      pt.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      let u, v;
      if (face === 0) {
        u = (pt.x + 6) / 12;
        v = (pt.z + 7) / 14;
      } else if (face < 3) {
        u = (pt.x + 6) / 12;
        v = pt.y / 5.25;
      } else if (face < 5) {
        u = (pt.z + 7) / 14;
        v = pt.y / 5.25;
      } else {
        u = (pt.x + (face === 5 ? 6 : 0)) / 6;
        v = (pt.z + 7) / 14;
      }
      uv.push(
        ((face % 4) + (T.MathUtils.clamp(u, 0, 1) * 255 + 0.5) / 256) / 4,
        (Math.floor(face / 4) +
          (T.MathUtils.clamp(v, 0, 1) * 255 + 0.5) / 256) /
          2,
      );
    }
    mesh.geometry.setAttribute("uv1", new T.Float32BufferAttribute(uv, 2));
    return mesh;
  }
  const stone = surface("stone", 5, 6),
    wood = surface("wood", 2.4, 0.65);
  const floor = new T.Mesh(
    new T.PlaneGeometry(12, 14),
    new T.MeshStandardMaterial({
      ...(study ? wood : stone),
      color: dark ? 0x696963 : 0xc4c3b9,
      roughness: 0.63,
      normalScale: new T.Vector2(0.14, 0.14),
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  bake(floor, 0);
  const cream = {
    ...surface("plaster", 9, 3.8),
    normalScale: new T.Vector2(0.16, 0.16),
    roughness: 0.95,
  };
  function wall(x, y, z, w, h, d, face) {
    return bake(box(scene, w, h, d, colors?.[face - 1] ?? 0xfffcf0, x, y, z, cream), face);
  }
  wall(0, 2.63, -7, 12, 5.26, 0.12, 1);
  wall(0, 2.63, 7, 12, 5.26, 0.12, 2);
  wall(6, 2.63, 0, 0.12, 5.26, 14, 4);
  // A real wall opening with a deep reveal and exterior parapet.
  const start = -6.55,
    end = -2.45,
    mid = (start + end) / 2;
  wall(-6, 2.63, (start - 7) / 2, 0.12, 5.26, start + 7, 3);
  wall(-6, 2.63, (7 + end) / 2, 0.12, 5.26, 7 - end, 3);
  wall(-6, 0.21, mid, 0.44, 0.42, end - start, 3);
  wall(-6, (5.26 + 3.54) / 2, mid, 0.44, 5.26 - 3.54, end - start, 3);
  for (const z of [start, -5.18, -3.82, end])
    box(scene, 0.15, 3.14, 0.042, 0x463e35, -6.13, 1.98, z, {
      metalness: 0.6,
      roughness: 0.37,
    });
  for (const y of [0.42, 3.54])
    box(scene, 0.23, 0.045, 4.13, 0x514c42, -6.09, y, mid);
  box(scene, 0.62, 0.065, 4.24, 0xad9e89, -6.02, 0.41, mid);
  const garden = texture("woodland.webp", true);
  const exterior = new T.Mesh(
    new T.SphereGeometry(58, 64, 32),
    new T.MeshBasicMaterial({
      map: garden,
      side: T.BackSide,
      color: 0xfff9e8,
      toneMapped: false,
    }),
  );
  exterior.geometry.scale(-1, 1, 1);
  exterior.material.side = T.FrontSide;
  exterior.rotation.y = Math.PI;
  scene.add(exterior);
  box(scene, 5, 0.16, 9, 0xafa38b, -8.6, -0.11, mid);
  box(scene, 0.4, 0.62, 9, 0x827c69, -10.4, 0.21, mid);
  box(scene, 0.52, 0.08, 9.08, 0xb3aa96, -10.4, 0.56, mid);
  // Offset stone fins beyond the reveal give the garden opening parallax when walking past.
  for (const z of [-6.48, -2.53]) {
    const pier = box(scene, 0.45, 3.18, 0.18, 0xb1a490, -7.35, 1.59, z, {
      roughness: 0.92,
    });
    pier.receiveShadow = true;
  }
  if (study) {
    const timber = { ...wood, roughness: .78 };
    box(scene, 12, .12, 14, 0x7d7567, 0, 3.96, 0, { roughness: .96 });
    for (const z of [-6.8, -4.5, -2.2, .1, 2.4, 4.7, 6.8])
      box(scene, 12, .19, .13, 0x594536, 0, 3.82, z, timber);
    for (const x of [-5.75, -3, 0, 3, 5.75])
      box(scene, .095, .10, 14, 0x635040, x, 3.86, 0, timber);
    // Timber battens frame the hanging wall and filter light at the garden window.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++)
        box(scene, .035, 3.65, .06, 0x664b36, side * (3.4 + .13 * i), 1.83, -6.89, timber);
    }
    for (let z = start + .20; z < end; z += .34)
      box(scene, .07, 3.1, .023, 0x644c38, -5.94, 1.98, z, timber);
    for (const y of [1.05, 1.98, 2.91])
      box(scene, .07, .03, end - start, 0x644c38, -5.94, y, mid, timber);
    box(scene, 11.8, .04, .06, 0xf1cc91, 0, 3.62, -6.88,
      { emissive: 0xffce88, emissiveIntensity: .55 });
  } else {
    // Two continuously curved, limewashed vaults are separated from the walls by a shadow reveal.
    const vaultFinish = {
      ...surface("plaster", 4, 10),
      color: dark ? 0x7b8281 : 0xf2e7d7,
      roughness: 0.96,
      normalScale: new T.Vector2(0.12, 0.12),
      side: T.DoubleSide,
    };
    for (const [center, face] of [
      [-3, 5],
      [3, 6],
    ]) {
      for (const [low, high] of [
        [-3, -0.29],
        [0.29, 3],
      ]) {
        const geom = new T.PlaneGeometry(high - low, 14, 40, 1),
          pos = geom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) + (low + high) / 2,
            z = pos.getY(i);
          pos.setXYZ(i, center + x, 5.18 - 1.33 * (x / 3) ** 2, z);
        }
        geom.computeVertexNormals();
        const roof = new T.Mesh(geom, new T.MeshStandardMaterial(vaultFinish));
        scene.add(roof);
        bake(roof, face);
      }
      box(scene, 0.65, 0.025, 14, 0xf7f7ef, center, 5.29, 0, {
        emissive: 0xfff5dc,
        emissiveIntensity: 1.1,
      });
      for (const delta of [-0.29, 0.29])
        box(scene, 0.045, 0.16, 14, 0x897f70, center + delta, 5.22, 0);
      for (const z of [-5, -1.5, 2, 5.5])
        box(scene, 0.58, 0.05, 0.035, 0x969184, center, 5.22, z);
    }
    // Thin suspended picture-light rails follow the line of the vault, with recessed lamp lenses.
    for (const x of [-4.65, 4.65]) {
      const h = 3.77;
      box(scene, 0.042, 0.045, 13.3, 0x323330, x, h, 0);
      for (const z of [-5.5, -1.85, 1.85, 5.5]) {
        const hanger = 5.18 - 1.33 * ((Math.abs(x) - 3) / 3) ** 2 - h;
        box(scene, 0.016, hanger, 0.016, 0x817d73, x, h + hanger / 2, z);
        const lamp = new T.Mesh(
          new T.CylinderGeometry(0.069, 0.064, 0.2, 24),
          new T.MeshStandardMaterial({
            color: 0x343432,
            metalness: 0.52,
            roughness: 0.32,
          }),
        );
        lamp.position.set(x, h - 0.12, z);
        lamp.rotation.z = x > 0 ? 0.52 : -0.52;
        scene.add(lamp);
        const lens = new T.Mesh(
          new T.CircleGeometry(0.056, 24),
          new T.MeshBasicMaterial({ color: 0xffe2b6 }),
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.y = -0.101;
        lamp.add(lens);
      }
    }
  }
  for (const side of [-1, 1]) {
    box(scene, 11.93, 0.026, 0.028, 0x6d6b60, 0, 0.045, side * 6.923);
    box(scene, 0.028, 0.026, 13.94, 0x6d6b60, side * 5.923, 0.045, 0);
  }
  const seat = new T.Shape();
  seat.moveTo(-1.33, -0.31);
  seat.lineTo(1.33, -0.31);
  seat.quadraticCurveTo(1.41, -0.31, 1.41, -0.23);
  seat.lineTo(1.41, 0.23);
  seat.quadraticCurveTo(1.41, 0.31, 1.33, 0.31);
  seat.lineTo(-1.33, 0.31);
  seat.quadraticCurveTo(-1.41, 0.31, -1.41, 0.23);
  seat.lineTo(-1.41, -0.23);
  seat.quadraticCurveTo(-1.41, -0.31, -1.33, -0.31);
  const top = new T.Mesh(
    new T.ExtrudeGeometry(seat, {
      depth: 0.073,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    }),
    new T.MeshStandardMaterial({ ...wood, color: 0xd5b995, roughness: 0.48 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 0.405, -1.2);
  top.castShadow = top.receiveShadow = true;
  scene.add(top);
  bake(top, 0);
  top.material.lightMapIntensity = 10;
  for (const x of [-0.98, 0.98]) {
    box(scene, 0.084, 0.395, 0.44, 0x393632, x, 0.2, -1.2, {
      metalness: 0.52,
      roughness: 0.43,
    }).castShadow = true;
  }
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(28,22,14,.54)");
  grad.addColorStop(0.54, "rgba(28,22,14,.28)");
  grad.addColorStop(1, "rgba(28,22,14,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const ao = new T.CanvasTexture(c);
  textures.push(ao);
  for (const [x, w, d] of [
    [0, 3.8, 1.45],
    [-0.98, 0.49, 0.74],
    [0.98, 0.49, 0.74],
  ]) {
    const contact = new T.Mesh(
      new T.PlaneGeometry(w, d),
      new T.MeshBasicMaterial({
        map: ao,
        transparent: true,
        depthWrite: false,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(x, 0.006, -1.2);
    scene.add(contact);
  }
  const key = new T.DirectionalLight(0xffecd6, 0.46);
  key.position.set(-7, 5, -5);
  key.target.position.set(1, 0, -1);
  scene.add(key, key.target);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 32,
  });
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.012;
  return { floor, textures, wood, ready: Promise.all(loads) };
}
