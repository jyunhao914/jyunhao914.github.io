import * as T from "./vendor/three.module.js";

export function architecture(scene, box, renderer) {
  const textures = [];
  function surface(name, rx, ry) {
    const maps = {};
    for (const [property, kind] of [
      ["map", "color"],
      ["normalMap", "normal"],
      ["roughnessMap", "rough"],
    ]) {
      if (name === "plaster" && kind === "rough") continue;
      const tex = new T.TextureLoader().load(
        new URL("./materials/" + name + "-" + kind + ".webp", import.meta.url)
          .href,
      );
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.anisotropy = Math.min(6, renderer.capabilities.getMaxAnisotropy());
      if (kind === "color") tex.colorSpace = T.SRGBColorSpace;
      maps[property] = tex;
      textures.push(tex);
    }
    return maps;
  }
  // Approximate diffuse daylight from the two extended apertures in room coordinates.
  // Modulate the linear diffuse term only; brushed frames and glazing keep their own response.
  function daylight(material, finish) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 museumPosition;\n" +
        shader.vertexShader.replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nmuseumPosition=(modelMatrix*vec4(transformed,1.)).xyz;",
        );
      shader.fragmentShader =
        "varying vec3 museumPosition;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        vec3 p=museumPosition;
        float windowFalloff=exp(-.27*(p.x+6.))*(.68+.32*smoothstep(-7.,-4.,p.z)*smoothstep(-7.,-4.,-p.z));
        float roofFalloff=exp(-.095*(p.x+1.75)*(p.x+1.75));
        float edge=min(6.-abs(p.x),7.-abs(p.z));
        float corner=max(6.-abs(p.x),7.-abs(p.z));
        float shade=.72+.21*windowFalloff+.13*roofFalloff;
        shade*=1.-.14*exp(-2.4*max(corner,0.));
        ${finish === "floor" ? "shade*=1.-.21*exp(-3.*max(edge,0.));" : "shade*=1.-.13*exp(-4.*max(p.y,0.));"}
        ${finish === "plaster" ? "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.75,.72),.48);" : ""}
        diffuseColor.rgb*=shade*mix(vec3(1.02,.98,.93),vec3(.97,1.,1.035),windowFalloff);`,
        );
    };
    material.customProgramCacheKey = () => "museum-daylight-" + finish;
  }
  const floor = new T.Mesh(
    new T.PlaneGeometry(12, 14),
    new T.MeshStandardMaterial({
      ...surface("stone", 8, 9.33),
      color: 0xd8d5c9,
      roughness: 0.88,
      normalScale: new T.Vector2(0.24, 0.24),
    }),
  );
  daylight(floor.material, "floor");
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wood = surface("wood", 2.4, 0.6);
  // A baked plaster finish combines fine aggregate with indirect shading at the wall junctions.
  function plaster() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 384;
    const ctx = c.getContext("2d"),
      pixels = ctx.createImageData(c.width, c.height);
    let seed = 31;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const u = x / (c.width - 1),
          v = y / (c.height - 1),
          corner = Math.exp(-Math.min(u, 1 - u) * 22),
          base = Math.exp(-(1 - v) * 17),
          soffit = Math.exp(-v * 15);
        const shade =
          246 -
          27 * corner -
          31 * base -
          15 * soffit +
          (seed / 4294967296 - 0.5) * 7 +
          Math.sin(u * 28 + v * 8) * 0.9;
        const k = (y * c.width + x) * 4;
        pixels.data[k] = shade;
        pixels.data[k + 1] = shade - 1;
        pixels.data[k + 2] = shade - 3;
        pixels.data[k + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    textures.push(t);
    return t;
  }
  const ambient = plaster();
  ambient.colorSpace = T.NoColorSpace;
  const lime = surface("plaster", 12, 4.5);
  const wallFinish = {
      ...lime,
      normalScale: new T.Vector2(0.52, 0.52),
      aoMap: ambient,
      aoMapIntensity: 0.94,
      roughness: 0.92,
    },
    stoneColor = 0xf6f3ec;
  for (const side of [-1, 1]) {
    box(
      scene,
      0.12,
      4.6,
      14,
      stoneColor,
      side * 6,
      2.25,
      0,
      wallFinish,
    ).receiveShadow = true;
    box(
      scene,
      12,
      4.6,
      0.12,
      stoneColor,
      0,
      2.25,
      side * 7,
      wallFinish,
    ).receiveShadow = true;
    box(scene, 0.035, 0.075, 14, 0x918c81, side * 5.92, 0.038, 0);
    box(scene, 12, 0.075, 0.035, 0x918c81, 0, 0.038, side * 6.92);
  }
  // Recessed diffuse roof lanterns: broad plaster soffits and splayed reveals.
  const overhead = surface("plaster", 5, 12);
  const soffit = {
    ...overhead,
    roughness: 0.95,
    normalScale: new T.Vector2(0.28, 0.28),
  };
  box(scene, 12, 0.12, 14, 0xe9e4d7, 0, 4.99, 0, soffit);
  for (const [x, w] of [
    [-4.68, 2.64],
    [2.93, 6.14],
  ]) {
    box(scene, w, 0.3, 14, 0xf6f2e7, x, 4.52, 0, soffit);
  }
  for (const x of [-3.34, -0.15]) {
    const reveal = box(scene, 0.12, 0.48, 14, 0xe8e1d3, x, 4.69, 0, soffit);
    reveal.rotation.z = x < -1 ? -0.2 : 0.2;
  }
  for (let n = 0; n < 4; n++) {
    const z = -5.25 + n * 3.5;
    box(scene, 3.1, 0.05, 3.32, 0xe5e8e5, -1.75, 4.9, z, {
      emissive: 0xdde6e9,
      emissiveIntensity: 0.6,
      roughness: 0.95,
    });
    box(scene, 3.28, 0.22, 0.13, 0xd2c9b8, -1.75, 4.73, z + 1.68, soffit);
    for (let j of [-0.82, 0.82])
      box(scene, 0.024, 0.045, 3.28, 0xbbbdb6, -1.75 + j, 4.85, z);
  }
  // Shallow perimeter recess creates a continuous shadow line at the ceiling junction.
  for (const side of [-1, 1]) {
    box(scene, 11.9, 0.046, 0.07, 0xa19c90, 0, 4.31, side * 6.92);
    box(scene, 0.07, 0.046, 13.9, 0xa19c90, side * 5.92, 4.31, 0);
  }
  function repeat(count, geo, material, position) {
    const group = new T.InstancedMesh(geo, material, count),
      matrix = new T.Matrix4();
    for (let i = 0; i < count; i++)
      group.setMatrixAt(i, matrix.makeTranslation(...position(i)));
    group.receiveShadow = true;
    scene.add(group);
  }
  // High glazing has a deep sill and a dark reveal, leaving the entire hanging wall available below.
  box(scene, 0.09, 0.86, 12.2, 0x655f57, -5.9, 3.66, 0);
  box(scene, 0.065, 0.72, 12, 0xf4f8f8, -5.83, 3.66, 0, {
    emissive: 0xdfecff,
    emissiveIntensity: 0.9,
  });
  box(scene, 0.35, 0.09, 12.3, 0xb8a995, -5.77, 3.23, 0).castShadow = true;
  repeat(
    13,
    new T.BoxGeometry(0.2, 0.82, 0.048),
    new T.MeshStandardMaterial({ color: 0x6d665b }),
    (i) => [-5.72, 3.66, -6 + i],
  );
  for (const x of [-4.25, 3.45]) {
    box(scene, 0.052, 0.07, 13, 0x3b3c38, x, 4.3, 0);
    for (const z of [-5, -2, 1, 4]) {
      box(scene, 0.038, 0.15, 0.04, 0x383a39, x, 4.2, z);
      const lamp = new T.Mesh(
        new T.CylinderGeometry(0.09, 0.088, 0.23, 20),
        new T.MeshStandardMaterial({ color: 0x333737, roughness: 0.35 }),
      );
      lamp.position.set(x, 4.07, z);
      lamp.rotation.z = x > 0 ? -0.58 : 0.58;
      scene.add(lamp);
      const lens = new T.Mesh(
        new T.CircleGeometry(0.074, 20),
        new T.MeshBasicMaterial({ color: 0xffe8c4 }),
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.y = -0.116;
      lamp.add(lens);
    }
  }
  for (let board = 0; board < 4; board++) {
    const bench = box(
      scene,
      2.8,
      0.105,
      0.148,
      0xe1c6a4,
      0,
      0.47,
      -1.435 + board * 0.157,
      { ...wood, roughness: 0.58 },
    );
    bench.castShadow = true;
  }
  box(scene, 2.18, 0.075, 0.44, 0x423b33, 0, 0.388, -1.2);
  for (const x of [-0.95, 0.95]) {
    const leg = box(scene, 0.26, 0.41, 0.48, 0x777974, x, 0.205, -1.2);
    leg.castShadow = true;
  }
  // Soft contact under the bench remains visible at low mobile shadow resolutions.
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(36,27,20,.38)");
  grad.addColorStop(0.58, "rgba(36,27,20,.19)");
  grad.addColorStop(1, "rgba(36,27,20,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const contact = new T.CanvasTexture(c);
  textures.push(contact);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(4.1, 1.6),
    new T.MeshBasicMaterial({
      map: contact,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.005, -1.2);
  scene.add(shadow);
  const sun = new T.DirectionalLight(0xfff0d9, 1.1);
  sun.position.set(-7, 7, 2);
  sun.target.position.set(2, 0, -3);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.1,
    far: 30,
  });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 3.5;
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.00025;
  scene.traverse((object) => {
    if (
      object.isMesh &&
      (object.material.map === lime.map || object.material.map === overhead.map)
    )
      daylight(object.material, "plaster");
  });
  return { floor, textures, wood };
}
