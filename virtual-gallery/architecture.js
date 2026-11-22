import * as T from "./vendor/three.module.js";

// The atlas contains diffuse interreflection from the garden window and roof apertures.
// UV sets are independent: scanned textures tile in metres, irradiance spans the whole room.
export function architecture(scene, box, renderer, theme = "", halfWidth = 6, halfDepth = 7) {
  // Front, rear, window and opposite wall share a plaster finish.
  const palettes = {
    calligraphy: [0x253441, 0x343039, 0x303e39, 0x38404a],
    ink: [0x34433f, 0x383746, 0x2c3b49, 0x464443],
  };
  const colors = palettes[theme];
  const dark = Boolean(colors);

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
  if (["calligraphy", "projection", "main","panorama"].includes(theme)) {
    const study = theme === "calligraphy";
    const theater = theme === "projection";
    const height = study ? 3.65 : theater ? 3.35 : 5.8;
    const w = halfWidth, l = halfDepth;
    const tones = colors || (theater ? [0x20232f, 0x29212d, 0x233231, 0x313541] :
      [0x424a50, 0x47423f, 0x394641, 0x46404a]);
    const plaster = {...surface("plaster", 1, 1), roughness: .96, normalScale: new T.Vector2(.18,.18)};
    const wood = surface("wood", 1, 1);
    const timber = {...wood, roughness: .75};
    // Use metres for the scan coordinates on each face, including narrow returns.
    function facing(mesh, period) {
      const {position, normal, uv} = mesh.geometry.attributes;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i));
        uv.setXY(i, (nx > .5 ? position.getZ(i) : position.getX(i))/period,
          (ny > .5 ? position.getZ(i) : position.getY(i))/period);
      }
      return mesh;
    }
    const floor = facing(box(scene, w*2, .14, l*2, study ? 0xe1d8c9 : 0xb3b1ab, 0, -.07, 0,
      {...surface(study ? "boards" : "stone", 1, 1), roughness: study ? .83 : .76,
        normalScale: new T.Vector2(.26,.26)}), study ? 1.7 : 1.5);
    const walls = [
      box(scene, w*2, height, .12, tones[0], 0, height/2, -l, plaster),
      box(scene, w*2, height, .12, tones[1], 0, height/2, l, plaster),
      box(scene, .12, height, l*2, tones[2], -w, height/2, 0, plaster),
      box(scene, .12, height, l*2, tones[3], w, height/2, 0, plaster),
    ];
    walls.forEach(wall => facing(wall,1));
    const ceiling = facing(box(scene, w*2,.12,l*2, study ? 0x89816e : 0x626565, 0,height,0,plaster),1);
    // Broad reflected window light and occlusion at perpendicular surface joins.
    for (const mesh of [floor, ceiling, ...walls]) {
      mesh.material.onBeforeCompile = (shader) => {
        shader.vertexShader = "varying vec3 roomPoint;\n" + shader.vertexShader.replace(
          "#include <worldpos_vertex>", "#include <worldpos_vertex>\nroomPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
        shader.fragmentShader = "varying vec3 roomPoint;\n" + shader.fragmentShader.replace(
          "#include <lights_fragment_end>", `#include <lights_fragment_end>
          vec2 edge=max(vec2(0.),vec2(${w.toFixed(3)},${l.toFixed(3)})-abs(roomPoint.xz));
          float join=${mesh===floor||mesh===ceiling ? "min(edge.x,edge.y)" : "min(roomPoint.y,"+height.toFixed(3)+"-roomPoint.y)"};
          reflectedLight.indirectDiffuse *= .68 + .32*smoothstep(0.,.46,join);
          ${study ? `float bounce=0.;
            for(int bay=0;bay<6;bay++){
              vec3 ray=vec3(-${(w-.2).toFixed(2)},2.,-7.25+2.9*float(bay))-roomPoint;
              float r=max(length(ray),.18);
              bounce+=max(0.,dot(inverseTransformDirection(normal,viewMatrix),ray/r))*max(0.,-ray.x/r)/(1.+r*r*.38);
            }
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.89,.74)*bounce*1.4;` : ""}
          `);
      };
      mesh.material.customProgramCacheKey=()=>theme+"-"+mesh.id;
    }
    const diffuser = {emissive: 0xffe2ad, emissiveIntensity: .7, roughness: .95};
    if (study) {
      // A sequence of timber portals and luminous lattice bays defines the promenade.
      for (const z of [-8.7,-5.8,-2.9,0,2.9,5.8,8.7]) {
        box(scene, w*2, .21, .14, 0x735638, 0, height-.15, z, timber);
        for (const side of [-1,1])
          box(scene, .08, height-.25, .13, 0x694e39, side*(w-.10), (height-.25)/2, z, timber);
      }
      for (const z of [-7.25,-4.35,-1.45,1.45,4.35,7.25]) {
        box(scene,.055,1.77,1.85,0xffedcc,-w+.09,1.98,z,diffuser);
        for (const offset of [-.93,-.62,-.31,0,.31,.62,.93])
          box(scene,.06,1.82,.024,0x594935,-w+.14,1.98,z+offset,timber);
        for (const y of [1.09,1.68,2.27,2.87])
          box(scene,.06,.035,1.90,0x594935,-w+.14,y,z,timber);
      }
    } else if (theater) {
      for (const side of [-1,1])
        box(scene,.05,.035,l*2-.4,0xbcb9cf,side*(w-.09),.20,0,diffuser);
    } else {
      for (const x of [-w*.55,0,w*.55])
        box(scene,.36,.08,l*2-.4,0xf4e8d1,x,height-.12,0,diffuser);
    }
    scene.add(new T.HemisphereLight(0xfff0d9,0x939291,study ? 1.05 : .85));
    const key = new T.DirectionalLight(0xffedcf,study ? .72 : 1.05);
    key.position.set(-w+.22, height-.32, l*.45);
    key.castShadow = true;
    Object.assign(key.shadow.camera,{left:-l,right:l,top:height+3,bottom:-height-3,near:.1,far:l*4});
    key.shadow.mapSize.set(1024,1024);
    key.shadow.normalBias=.012;
    key.shadow.radius=3;
    for(const child of scene.children)
      if(child.isMesh && child!==floor && child!==ceiling && !walls.includes(child) && !child.material.emissive?.getHex()) child.castShadow=true;
    scene.add(key);
    return {floor, height, wood, textures, ready: Promise.all(loads)};
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
          "#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(.84,.83,.80),.30);",
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
      ...stone,
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
  return { floor, height:5.26, textures, wood, ready: Promise.all(loads) };
}
