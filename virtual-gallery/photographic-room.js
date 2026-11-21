import * as T from "./vendor/three.module.js";

// The scene shell carries a single calibrated exposure across all six surfaces.
// Independent artwork geometry remains raycastable and follows the published layout.
export function photographicRoom(scene, renderer, station) {
  renderer.domElement.style.opacity="0";
  const textures = [],
    loader = new T.TextureLoader();
  let active = true,
    quality = -1;
  const material = new T.MeshBasicMaterial({
    side: T.BackSide,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.station = { value: station };
    shader.vertexShader =
      "varying vec3 capturePosition;\n" +
      shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\n capturePosition=(modelMatrix*vec4(transformed,1.)).xyz;",
      );
    shader.fragmentShader =
      "varying vec3 capturePosition; uniform vec3 station;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
      vec3 ray=normalize(capturePosition-station);
      vec2 spherical=vec2(fract(.246+atan(ray.x,-ray.z)/6.28318530718),.5+asin(clamp(ray.y,-1.,1.))/3.14159265359);
      diffuseColor*=texture2D(map,spherical);
      #endif`,
      );
  };
  const shell = new T.Mesh(new T.BoxGeometry(12.08, 4.65, 14.08), material);
  shell.position.y = 2.315;
  scene.add(shell);
  let failCount = 0;
  function load(name, level) {
    return new Promise((resolve) => {
      loader.load(
        new URL("./media/photography/" + name + ".webp", import.meta.url).href,
        (tex) => {
          if (!active) {
            tex.dispose();
            resolve();
            return;
          }
          if (level > quality) {
            tex.colorSpace = T.SRGBColorSpace;
            tex.wrapS = T.RepeatWrapping;
            tex.anisotropy = Math.min(
              4,
              renderer.capabilities.getMaxAnisotropy(),
            );
            const old = material.map;
            material.map = tex;
            renderer.domElement.style.opacity="1";
            material.needsUpdate = true;
            quality = level;
            if (old) {
              old.dispose();
              textures.splice(textures.indexOf(old), 1);
            }
            textures.push(tex);
          } else tex.dispose();
          resolve();
        },
        undefined,
        () => {
          failCount++;
          resolve();
        },
      );
    });
  }
  const high =
    innerWidth >= 1000 && renderer.capabilities.maxTextureSize >= 6144
      ? "gallery-large"
      : "gallery";
  const ready = Promise.all([load("arrival", 0), load(high, 1)]).then(() => {
    if (active && failCount === 2) throw Error("展間攝影載入失敗");
  });
  const floor = new T.Mesh(
    new T.PlaneGeometry(12, 14),
    new T.MeshBasicMaterial({ visible: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const fill = new T.HemisphereLight(0xfff8e9, 0xcbba9e, 1.1);
  scene.add(fill);
  return {
    floor,
    wood: {},
    textures,
    ready,
    dispose() {
      active = false;
    },
  };
}
