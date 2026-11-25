import * as T from "./vendor/three.module.js";

// Small versions of the actual registered scans arrive together on a cold visit.
const scanNames=["plaster-color.webp", "plaster-normal.webp", "wood-color.webp", "wood-normal.webp", "wood-rough.webp", "boards-color.webp", "boards-normal.webp", "boards-rough.webp", "stone-color.webp", "stone-normal.webp", "stone-rough.webp", "daylight.webp", "woodland.webp"];
let previewSheet;
function loadScanPreview(){
  if(!previewSheet){
    const image=new Image();
    image.src=new URL("./materials/room-scan-preview.webp",import.meta.url).href;
    previewSheet=image.decode().then(()=>image).catch(()=>{previewSheet=null;return null;});
  }
  return previewSheet;
}

// The atlas contains diffuse interreflection from the garden window and roof apertures.
// UV sets are independent: scanned textures tile in metres, irradiance spans the whole room.
export function architecture(scene, box, renderer, theme = "", halfWidth = 6, halfDepth = 7, roomHeight) {
  // Front, rear, window and opposite wall share a plaster finish.
  const palettes = {
    calligraphy: [0x4b504b, 0x49453f, 0x474b45, 0x52594f],
    ink: [0x34433f, 0x383746, 0x2c3b49, 0x464443],
  };
  const colors = palettes[theme];
  const dark = Boolean(colors);

  const textures = [],
    loads = [];
  const previews=[];
  const sheet=loadScanPreview();
  const loader = new T.ImageLoader();
  function texture(file, color = false, x = 1, y = 1, previewFile) {
    const tex=new T.Texture();
    function upload(image){
      // WebGL storage already allocated for a preview cannot grow in place.
      if(tex.image && (tex.image.width!==image.width || tex.image.height!==image.height))tex.dispose();
      tex.image=image;
      tex.needsUpdate=true;
    }
    if(previewFile){
      const preview=new Image();
      preview.crossOrigin="anonymous";
      preview.fetchPriority="high";
      preview.onload=()=>{if(!tex.image)upload(preview);};
      preview.src=new URL("./materials/"+previewFile,import.meta.url).href;
    }
    loads.push(
      new Promise((resolve) => {
        loader.load(
          new URL("./materials/" + file, import.meta.url).href,
          image=>{
            upload(image);
            resolve();
          },
          undefined,
          resolve,
        );
      }),
    );
    const index=scanNames.indexOf(file);
    previews.push(sheet.then(image=>{
      if(!image || tex.image || index<0)return;
      const tile=document.createElement("canvas");
      tile.width=tile.height=256;
      tile.getContext("2d").drawImage(image,index%4*256,Math.floor(index/4)*256,256,256,0,0,256,256);
      tex.image=tile;
      tex.needsUpdate=true;
    }));
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
    const height = roomHeight ?? (study ? 3.65 : theater ? 3.35 : 5.8);
    const w = halfWidth, l = halfDepth;
    const tones = colors || (theater ? [0x3d414b, 0x3c343f, 0x34413e, 0x3d414a] :
      [0x424a50, 0x47423f, 0x394641, 0x46404a]);
    const gardenDetail=study ? texture("study-garden-detail.webp",true,1,1,"study-garden-preview.webp") : null;
    const plaster = {...surface("plaster", 1, 1), roughness: .91, normalScale: new T.Vector2(.13,.13)};
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
    const floor = facing(box(scene, w*2, .14, l*2, study ? 0xb4aca1 : theater ? 0x7e8083 : 0xb9b6b0, 0, -.07, 0,
      {...surface(study ? "boards" : "stone", 1, 1), roughness: study ? .54 : .56,
        normalScale: new T.Vector2(.15,.15)}), study ? 1.7 : 1.5);
    const lightBays=Math.max(1,Math.round(l*2/2.95));
    const bayPitch=l*2/lightBays;
    const openingWidth=Math.min(2.30,bayPitch-.32);
    const walls = [
      box(scene, w*2, height, .12, tones[0], 0, height/2, -l, plaster),
      box(scene, w*2, height, .12, tones[1], 0, height/2, l, plaster),
      ...(study ? [] : [box(scene, .12, height, l*2, tones[2], -w, height/2, 0, plaster)]),
      box(scene, .12, height, l*2, tones[3], w, height/2, 0, plaster),
    ];
    walls.forEach(wall => facing(wall,1.08));
    if (study) {
      walls.push(studyWindows(scene, texture, gardenDetail, plaster, wood, tones[2], w, l, height, lightBays, bayPitch, openingWidth));
    }
    const ceiling = facing(box(scene, w*2,.12,l*2, study ? 0xa19a8d : theater ? 0x494b50 : 0x87847d, 0,height,0,plaster),1.08);
    // A recessed dark skirting gives the floor a consistent junction with the
    // walls while leaving the artwork planes and circulation clear.
    const trimTone=study ? 0x38312a : theater ? 0x24252b : 0x3e3d39;
    const skirting={roughness:.68,metalness:.18};
    for(const side of [-1,1]){
      box(scene,.022,.074,l*2-.16,trimTone,side*(w-.071),.039,0,skirting);
      box(scene,w*2-.16,.074,.022,trimTone,0,.039,side*(l-.071),skirting);
      box(scene,.018,.020,l*2-.16,0x1d1c1a,side*(w-.069),.086,0);
      box(scene,w*2-.16,.020,.018,0x1d1c1a,0,.086,side*(l-.069));
    }
    const lampPitch=l*2/Math.max(1,Math.ceil(l*2/4.1));
    const leafMask=study ? texture("canopy-light.webp") : null;
    // Broad reflected window light and occlusion at perpendicular surface joins.
    for (const mesh of [floor, ceiling, ...walls]) {
      mesh.material.onBeforeCompile = (shader) => {
        if(study)shader.uniforms.studyLeafMask={value:leafMask};
        shader.vertexShader = "varying vec3 roomPoint;\n" + shader.vertexShader.replace(
          "#include <worldpos_vertex>", "#include <worldpos_vertex>\nroomPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
        shader.fragmentShader = (study ? "uniform sampler2D studyLeafMask;\n" : "")+"varying vec3 roomPoint;\n"+shader.fragmentShader.replace(
          "#include <lights_fragment_end>", `#include <lights_fragment_end>
          vec2 edge=max(vec2(0.),vec2(${w.toFixed(3)},${l.toFixed(3)})-abs(roomPoint.xz));
          vec3 worldNormal=inverseTransformDirection(normal,viewMatrix);
          float join=${mesh===floor||mesh===ceiling ? "min(edge.x,edge.y)" : "min(roomPoint.y,"+height.toFixed(3)+"-roomPoint.y)"};
          float corner=${mesh===floor||mesh===ceiling ? "max(edge.x,edge.y)" : "abs(worldNormal.x)>.5?edge.y:edge.x"};
          reflectedLight.indirectDiffuse *= (.60 + .40*smoothstep(0.,.49,join)) *
            (.79+.21*smoothstep(0.,.63,corner));
          reflectedLight.indirectSpecular*=.53+.47*smoothstep(0.,.60,join);
          ${study ? `float windowBounce=0.;
            for(int bay=0;bay<${lightBays};bay++){
              vec3 ray=vec3(-${(w+.06).toFixed(3)},2.04,${(-l+bayPitch/2).toFixed(4)}+${bayPitch.toFixed(4)}*float(bay))-roomPoint;
              float r=max(length(ray),.18);
              windowBounce+=max(0.,dot(worldNormal,ray/r))*max(0.,-ray.x/r)/(1.+r*r*.24);
            }
            // Project the west aperture onto receivers with a broad penumbra,
            // softened further by the trees between the sun and the gallery.
            vec3 toGarden=normalize(vec3(-1.,.86,-.41));
            float travel=max(0.,roomPoint.x+${(w+.206).toFixed(4)});
            vec2 atGlass=roomPoint.yz+vec2(.86,-.41)*travel;
            float bayZ=mod(atGlass.y+${l.toFixed(4)},${bayPitch.toFixed(4)})-${(bayPitch/2).toFixed(4)};
            float aperture=min(${(openingWidth/2-.075).toFixed(4)}-abs(bayZ),min(atGlass.x-1.274,2.904-atGlass.x));
            float penumbra=.035+.052*travel;
            float beam=smoothstep(-penumbra,penumbra,aperture);
            float meeting=abs(bayZ+${(openingWidth*.15).toFixed(4)});
            beam*=.46+.54*smoothstep(0.,.033+penumbra,meeting);
            float foliage=texture2D(studyLeafMask,atGlass.yx*vec2(.083,.16)+vec2(.23,.07)).r;
            vec3 daylight=vec3(1.,.95,.82)*max(0.,dot(worldNormal,toGarden))*beam*(.28+foliage*.99);
            float lampOffset=(${height.toFixed(3)}-roomPoint.y-.53)/1.22;
            float grazing=max(0.,-worldNormal.x)*exp(-lampOffset*lampOffset)*
              smoothstep(0.,1.2,edge.y);
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*(daylight+vec3(.90,.94,1.)*windowBounce*.96+
              vec3(1.,.85,.68)*grazing*.38);` : theater ? `
            float guidance=max(0.,worldNormal.y)*exp(-edge.x*2.7);
            float reflectedFill=max(0.,1.-abs(worldNormal.y))*smoothstep(.14,2.4,roomPoint.y);
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*(vec3(.88,.91,1.)*reflectedFill*.16+
              vec3(1.,.76,.48)*guidance*.12);
          ` : `
            float bayOffset=mod(roomPoint.z+${l.toFixed(3)},${lampPitch.toFixed(4)})-${(lampPitch*.5).toFixed(4)};
            float lampZ=roomPoint.z-bayOffset+clamp(bayOffset,-${((lampPitch-.54)*.5).toFixed(4)},${((lampPitch-.54)*.5).toFixed(4)});
            float wash=0.;
            for(int rail=-1;rail<=1;rail++){
              vec3 toLamp=vec3(float(rail)*${(w*.55).toFixed(3)},${(height-.119).toFixed(3)},lampZ)-roomPoint;
              float dist2=max(.12,dot(toLamp,toLamp));
              vec3 ray=toLamp*inversesqrt(dist2);
              wash+=max(0.,dot(worldNormal,ray))*max(0.,ray.y)/(1.+dist2*.27);
            }
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.93,.87)*wash*.44;
          `}
          `);
        if(mesh!==floor)
          shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
            "#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*.78,.39);");
      };
      mesh.material.customProgramCacheKey=()=>theme+"-"+mesh.id;
    }
    const diffuser = {emissive: 0xffe2ad, emissiveIntensity: .7, roughness: .95};
    if (study) {
      const timberTone=0x78644e;
      const frame={...timber,roughness:.66,normalScale:new T.Vector2(.21,.21)};
      for (let bay=0;bay<lightBays;bay++) {
        const z=-l+(bay+.5)*bayPitch;
        const beamZ=z+bayPitch/2;
        if(beamZ<l-.22)
          facing(box(scene,w*2-.12,.115,.167,timberTone,0,height-.119,beamZ,frame),1.8);
      }
      const railX=w-.63,trackHeight=height-.135;
      box(scene,.083,.046,l*2-.59,0x39332b,railX,trackHeight,0,skirting);
      box(scene,.026,.012,l*2-.72,0xe7cca0,railX+.010,trackHeight-.026,0,
        {emissive:0xffd7a1,emissiveIntensity:.45,roughness:.87});
    } else if (theater) {
      const aisleLight={emissive:0xc6a587,emissiveIntensity:.46,roughness:.88};
      for (const side of [-1,1]){
        box(scene,.047,.038,l*2-.4,0x242328,side*(w-.054),.154,0,skirting);
        box(scene,.023,.012,l*2-.46,0x947b63,side*(w-.071),.154,0,aisleLight);
      }
    } else {
      for (const x of [-w*.55,0,w*.55]){
        box(scene,.32,.048,l*2-.44,0x393632,x,height-.080,0,skirting);
        for(let z=-l+lampPitch/2;z<l;z+=lampPitch)
          box(scene,.18,.019,lampPitch-.54,0xe1d9ca,x,height-.109,z,diffuser);
      }
    }
    scene.add(new T.HemisphereLight(0xf0efe8,0xa1a1a2,theater ? 1.04 : study ? .92 : .85));
    const key = new T.DirectionalLight(0xffeed9,study ? .38 : .92);
    key.position.set(-w+.22, height-.32, l*.45);
    // The overhead fill represents reflected room light. A directional
    // shadow map here would project the ceiling tracks across the art walls.
    scene.add(key);
    return {floor, height, wood, textures, previewReady: Promise.all(previews).then(()=>sheet).then(image=>image || Promise.all(loads)), ready: Promise.all(loads)};
  }
  const illumination = texture("daylight.webp");
  illumination.channel = 1;
  illumination.flipY = false;
  illumination.wrapS = illumination.wrapT = T.ClampToEdgeWrapping;
  function bake(mesh, face) {
    mesh.material.onBeforeCompile = (shader) => {
      shader.vertexShader="varying vec3 galleryPoint;\n"+shader.vertexShader.replace(
        "#include <worldpos_vertex>", "#include <worldpos_vertex>\ngalleryPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
      shader.fragmentShader="varying vec3 galleryPoint;\n"+shader.fragmentShader.replace("#include <lights_fragment_end>",`
        #include <lights_fragment_end>
        vec2 edge=max(vec2(0.),vec2(6.,7.)-abs(galleryPoint.xz));
        float contact=${face === 0 || face > 4 ? "min(edge.x,edge.y)" : "min(galleryPoint.y,5.26-galleryPoint.y)"};
        reflectedLight.indirectDiffuse*=.67+.33*smoothstep(0.,.46,contact);
        `);
      if (face !== 0) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(.84,.83,.80),.44);",
        );
      }
    };
    mesh.material.customProgramCacheKey=()=>`vault-irradiance-${face}`;
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
      roughness: 0.54,
      normalScale: new T.Vector2(0.13, 0.13),
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  bake(floor, 0);
  const cream = {
    ...surface("plaster", 9, 3.8),
    normalScale: new T.Vector2(0.14, 0.14),
    roughness: 0.92,
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
  const skirting={roughness:.75,metalness:.18};
  for (const side of [-1, 1]) {
    box(scene, 11.84, .074, .024, 0x393934, 0, .038, side * 6.930,skirting);
    box(scene, .024, .074, 13.84, 0x393934, side * 5.930, .038, 0,skirting);
    box(scene,11.84,.013,.018,0x242421,0,.082,side*6.928);
    box(scene,.018,.013,13.84,0x242421,side*5.928,.082,0);
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
  return { floor, height:5.26, textures, wood, previewReady: Promise.all(previews).then(()=>sheet).then(image=>image || Promise.all(loads)), ready: Promise.all(loads) };
}

// The west wall of the calligraphy study overlooks one continuous planted court.
// Batch the solid profiles by finish so adding a bay doesn't add draw calls.
function studyWindows(scene, texture, detail, plaster, wood, wallTone, halfWidth, halfDepth, height, count, pitch, width) {
  const wallX=-halfWidth, sill=1.19, head=2.98, glassX=wallX-.206;
  const reveals=[], lining=[], bronze=[], seals=[], paleStone=[], courtStone=[], paving=[];
  const centres=Array.from({length:count},(_,i)=>-halfDepth+(i+.5)*pitch);
  function block(batch,x0,x1,y0,y1,z0,z1) {
    batch.push([x0,x1,y0,y1,z0,z1]);
  }
  const unit=new T.BoxGeometry(1,1,1);
  function mesh(batch,name,finish,period=1) {
    const pos=[],norm=[],uv=[],indices=[];
    const {position:p,normal:n}=unit.attributes;
    for(const [x0,x1,y0,y1,z0,z1] of batch) {
      const offset=pos.length/3;
      for(let i=0;i<p.count;i++) {
        const x=x0+(p.getX(i)+.5)*(x1-x0);
        const y=y0+(p.getY(i)+.5)*(y1-y0);
        const z=z0+(p.getZ(i)+.5)*(z1-z0);
        const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
        pos.push(x,y,z);norm.push(nx,ny,nz);
        const along=Math.abs(nx)>.5 ? z : x, across=Math.abs(ny)>.5 ? z : y;
        if(batch===lining && y1-y0>z1-z0)uv.push(across/period,along/period);
        else uv.push(along/period,across/period);
      }
      for(const id of unit.index.array)indices.push(offset+id);
    }
    const g=new T.BufferGeometry();
    g.setIndex(indices);
    for(const [key,data,size] of [["position",pos,3],["normal",norm,3],["uv",uv,2]])
      g.setAttribute(key,new T.Float32BufferAttribute(data,size));
    const object=new T.Mesh(g,new T.MeshStandardMaterial(finish));
    if(batch!==reveals && batch!==seals){
      // Sky entering from the court lifts the outside edge of the millwork.
      // The liner, sill and floor meet without a painted-on window surround.
      object.material.onBeforeCompile=shader=>{
        shader.vertexShader="varying vec3 studyDetail;\n"+shader.vertexShader.replace(
          "#include <worldpos_vertex>","#include <worldpos_vertex>\nstudyDetail=position;");
        if(batch===lining)shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
          `#include <map_fragment>
           float oak=dot(diffuseColor.rgb,vec3(.26,.62,.12));
           diffuseColor.rgb=mix(diffuseColor.rgb,oak*vec3(1.57,1.28,.99),.65)+vec3(.027,.022,.014);`);
        shader.fragmentShader="varying vec3 studyDetail;\n"+shader.fragmentShader.replace(
          "#include <lights_fragment_end>",`#include <lights_fragment_end>
          vec3 nStudy=inverseTransformDirection(normal,viewMatrix);
          float exposure=1.-smoothstep(${(wallX-.21).toFixed(4)},${(wallX+.127).toFixed(4)},studyDetail.x);
          float faceLight=.22+.72*max(0.,nStudy.y)+.27*abs(nStudy.z)+.22*max(0.,-nStudy.x);
          float local=abs(mod(studyDetail.z+${halfDepth.toFixed(4)},${pitch.toFixed(4)})-${(pitch/2).toFixed(4)});
          float corner=smoothstep(0.,.13,${(width/2).toFixed(4)}-local);
          float revealAO=.70+.30*corner;
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.92,.97,1.03)*faceLight*(.54+1.12*exposure)*revealAO;`);
      };
      object.material.customProgramCacheKey=()=>"study-facing-"+name;
    }
    object.name="calligraphy-window-"+name;
    object.receiveShadow=true;scene.add(object);
    return object;
  }
  // Same interior plane as the continuous walls. The 36 cm masonry section is
  // continuous around all four sides and remains visible from oblique views.
  const inner=wallX+.06, outer=wallX-.30;
  block(reveals,outer,inner,0,sill,-halfDepth,halfDepth);
  block(reveals,outer,inner,head,height,-halfDepth,halfDepth);
  let endsAt=-halfDepth;
  const panes=[];
  for(const z of centres){
    const left=z-width/2,right=z+width/2,meeting=left+width*.35;
    block(reveals,outer,inner,sill,head,endsAt,left);
    endsAt=right;
    // Oiled wood lining ends at the dark rebate. A honed sill extends 52 mm
    // into the room with its own thinner drip lip on the landscape side.
    for(const edge of [left,right-.033])
      block(lining,glassX+.018,inner-.006,sill,head,edge,edge+.033);
    block(lining,glassX+.018,inner-.006,head-.034,head,left+.033,right-.033);
    block(paleStone,outer-.065,inner+.052,sill,sill+.042,left-.018,right+.018);
    for(const edge of [left+.033,right-.075])
      block(bronze,glassX-.038,glassX+.040,sill+.042,head-.034,edge,edge+.042);
    for(const y of [sill+.042,head-.076])
      block(bronze,glassX-.038,glassX+.040,y,y+.042,left+.075,right-.075);
    block(bronze,glassX-.042,glassX+.038,sill+.084,head-.076,meeting-.022,meeting+.022);

    // The narrow ventilator has its own recessed top light; the wide fixed
    // pane gives the viewer an uninterrupted view across the court.
    const rail=head-.432;
    block(bronze,glassX-.026,glassX+.027,rail-.015,rail+.015,left+.075,meeting-.022);
    const bays=[
      [left+.075,meeting-.022,sill+.084,rail-.015],
      [left+.075,meeting-.022,rail+.015,head-.076],
      [meeting+.022,right-.075,sill+.084,head-.076],
    ];
    for(const [a,b,bottom,top] of bays){
      const bead=.009;
      for(const edge of [a,b-bead])block(seals,glassX-.009,glassX+.008,bottom,top,edge,edge+bead);
      for(const y of [bottom,top-bead])block(seals,glassX-.009,glassX+.008,y,y+bead,a+bead,b-bead);
      panes.push([a+bead,b-bead,bottom+bead,top-bead]);
    }
  }
  block(reveals,outer,inner,sill,head,endsAt,halfDepth);
  const wall=mesh(reveals,"reveals",{...plaster,color:wallTone},1.08);
  mesh(lining,"oak-liners",{...wood,color:0xb1906f,normalScale:new T.Vector2(.11,.11),roughness:.53},1.4);
  mesh(bronze,"bronze-sashes",{color:0x857763,metalness:.57,roughness:.37});
  mesh(seals,"glazing-beads",{color:0x302d29,roughness:.78});
  mesh(paleStone,"stone-sills",{...plaster,color:0xbcad94,roughness:.61},.65);

  const outerLength=halfDepth+11, gardenEdge=wallX-4.3;
  block(paving,gardenEdge,outer,-.22,-.06,-outerLength,outerLength);
  block(courtStone,gardenEdge-.23,gardenEdge,-.16,.39,-outerLength,outerLength);
  block(courtStone,gardenEdge-.27,gardenEdge+.035,.39,.441,-outerLength,outerLength);
  mesh(courtStone,"garden-coping",{...plaster,color:0xb9ad94,roughness:.84},1.18);
  mesh(paving,"terrace",{...plaster,color:0x968f7e,roughness:.92},1.1);
  unit.dispose();

  // The photographed trees are beyond the real sill and terraced garden wall.
  // A finite panorama shares the same horizon across bays and allows parallax.
  const garden=new T.Mesh(new T.SphereGeometry(1,64,32),new T.MeshBasicMaterial({
    map:texture("woodland.webp",true),color:0xf8f7eb,side:T.BackSide,toneMapped:false,
  }));
  detail.wrapS=detail.wrapT=T.ClampToEdgeWrapping;
  garden.material.onBeforeCompile=shader=>{
    shader.uniforms.studyGardenDetail={value:detail};
    shader.fragmentShader="uniform sampler2D studyGardenDetail;\n"+shader.fragmentShader.replace(
      "#include <map_fragment>",`#include <map_fragment>
        vec2 inside=(vMapUv-vec2(2688./8192.,1.-2816./4096.))/vec2(4736./8192.,1760./4096.);
        vec2 margin=min(inside,1.-inside);
        float detailWeight=smoothstep(0.,.028,min(margin.x,margin.y));
        if(detailWeight>0. && textureSize(studyGardenDetail,0).x>1)
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*texture2D(studyGardenDetail,inside).rgb,detailWeight);`);
  };
  const radius=Math.max(16,halfDepth+8);
  garden.scale.setScalar(radius);garden.rotation.y=2.38;
  garden.position.set(wallX-1.5,1.65,0);
  garden.name="calligraphy-window-garden";scene.add(garden);

  const glass=new T.MeshStandardMaterial({metalness:1,roughness:.095,color:0xffffff,transparent:true,depthWrite:false});
  // Box-project the room's captured environment onto the actual glass position.
  // Both the room and the photographic garden remain registered as the eye moves.
  glass.onBeforeCompile=shader=>{
    shader.vertexShader="varying vec3 windowPoint;\n"+shader.vertexShader.replace(
      "#include <project_vertex>","#include <project_vertex>\nwindowPoint=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;");
    shader.fragmentShader="varying vec3 windowPoint;\n"+shader.fragmentShader.replace(
      "#include <opaque_fragment>",`vec3 sight=normalize(windowPoint-cameraPosition);
        vec3 reflected=reflect(sight,vec3(1.,0.,0.));
        vec3 direction=sign(reflected+vec3(1e-7))*max(abs(reflected),vec3(.0001));
        vec3 farFace=mix(vec3(${wallX.toFixed(4)},0.,-${halfDepth.toFixed(4)}),
          vec3(${halfWidth.toFixed(4)},${height.toFixed(4)},${halfDepth.toFixed(4)}),step(vec3(0.),direction));
        vec3 dist=(farFace-windowPoint)/direction;
        vec3 hit=windowPoint+reflected*max(0.,min(dist.x,min(dist.y,dist.z)));
        vec3 roomReflection=vec3(.055,.064,.069);
        #ifdef ENVMAP_TYPE_PMREM
          vec3 corrected=normalize(hit-vec3(0.,1.7,0.));
          roomReflection=textureLod(envMap,envMapRotation*corrected,roughnessToMip(.095)).rgb;
        #endif
        float grazes=pow(1.-clamp(abs(sight.x),0.,1.),5.);
        diffuseColor.a=.095+.88*grazes;
        outgoingLight=roomReflection*vec3(.96,.99,1.)+vec3(.004,.012,.011);
        #include <opaque_fragment>`);
  };
  const glazing=new T.InstancedMesh(new T.PlaneGeometry(1,1),glass,panes.length);
  const transform=new T.Object3D();
  transform.rotation.y=Math.PI/2;
  for(const [i,[a,b,bottom,top]] of panes.entries()){
    transform.position.set(glassX,(bottom+top)/2,(a+b)/2);
    transform.scale.set(b-a,top-bottom,1);transform.updateMatrix();glazing.setMatrixAt(i,transform.matrix);
  }
  glazing.name="calligraphy-window-glass";glazing.computeBoundingSphere();scene.add(glazing);
  return wall;
}
