import {waterMaterial} from "./museum-water.js?v=atrium40";
import {buildFacade,pavilionProfile} from "./museum-glazing.js?v=atrium40";

// Exterior and foyer share metres, the same sun and the same eye height.
// +z runs from the open south door out to the garden walk.
export function buildMuseumGrounds(T,scene,{halfWidth:w,halfDepth:d,invalidate,panorama}) {
  const root=new T.Group(), textures=[], materials=[], batches=new Map();
  root.name="museum-grounds";
  root.position.z=d;
  scene.add(root);
  let disposed=false, seed=1049;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function texture(file,color=false) {
    const t=new T.TextureLoader().load(new URL("./materials/"+file,import.meta.url).href,()=>{
      if(!disposed)invalidate();
    });
    t.wrapS=t.wrapT=T.RepeatWrapping;
    if(color)t.colorSpace=T.SRGBColorSpace;
    textures.push(t);
    return t;
  }
  function material(properties) {
    const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,...properties});
    materials.push(m);return m;
  }
  const limestone=texture("limestone-color.webp",true), limeNormal=texture("limestone-normal.webp");
  const grain=texture("mount/oak-color.webp",true);
  const canopy=texture("canopy-light.webp"), surroundings=panorama || texture("garden-canopy.webp",true);
  const exposed=material({color:0xd3d1c2,map:limestone,normalMap:limeNormal,normalScale:new T.Vector2(.075,.075),roughness:.83});
  const ashlar=material({color:0xe1dfcd,map:limestone,normalMap:limeNormal,normalScale:new T.Vector2(.21,.21)});
  const concrete=material({color:0xbabbb0,map:limestone,roughness:.88});
  const pale=material({color:0xc1c0ac,map:limestone,normalMap:limeNormal,normalScale:new T.Vector2(.14,.14),roughness:.88});
  const timber=material({color:0x665a4b,map:grain,roughness:.67});
  const bronze=material({color:0x424642,metalness:.32,roughness:.53});
  const fascia=material({color:0x757873,metalness:.22,roughness:.57});
  const dark=material({color:0x55594d});
  const lawn=material({color:0x94a36a,map:texture("garden-grass.webp",true)});
  function batch(m) {
    if(!batches.has(m))batches.set(m,{p:[],n:[],uv:[],color:[],idx:[]});
    return batches.get(m);
  }
  // Batch all static masonry and joinery by finish; use metre-scaled UVs across blocks.
  function block(m,x,y,z,width,height,depth,tone=1,grainVertical=false) {
    const b=batch(m),g=new T.BoxGeometry(width,height,depth),base=b.p.length/3;
    const p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++) {
      const X=x+p.getX(i),Y=y+p.getY(i),Z=z+p.getZ(i);
      const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);
      b.p.push(X,Y,Z);b.n.push(nx,ny,nz);b.color.push(tone,tone,tone);
      const horizontal=Math.abs(nx)>.5?Z:X,vertical=Math.abs(ny)>.5?Z:Y;
      if(m===timber)b.uv.push((grainVertical?Y:horizontal)/2.3,(grainVertical?horizontal:vertical)/.30);
      else if(m===ashlar||m===concrete||m===exposed)b.uv.push(horizontal/2.05,vertical/1.4);
      else b.uv.push(horizontal/2.1,vertical/2.1);
    }
    for(const i of g.index.array)b.idx.push(base+i);
    g.dispose();
  }
  // Fixed sunlight through the real tree crown and a much cooler pool of light under
  // the portico. World-space sampling keeps shadows anchored while walking.
  function shade(m) {
    m.onBeforeCompile=s=>{
      s.uniforms.leafLight={value:canopy};
      s.vertexShader="varying vec3 groundPoint;\n"+s.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\ngroundPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
      if(m===pale || m===ashlar || m===concrete) {
        const albedo=m===pale?"vec3(.34,.321,.274)":m===ashlar?"vec3(.66,.625,.54)":"vec3(.47,.48,.455)";
        s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          float mineral=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=${albedo}*(.74+.38*smoothstep(.18,.68,mineral));`);
      }
      if(m===exposed) {
        s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          float mineral=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec2 grainUV=vec2(groundPoint.x+.18*groundPoint.z,groundPoint.y);
          float castJoint=abs(fract((grainUV.y+.05)/1.54+.50)-.5)*1.54;
          vec2 pin=(fract(grainUV/vec2(1.34,.77)+vec2(.28,.15))-.5)*vec2(1.34,.77);
          float hole=1.-smoothstep(.007,.020,length(pin));
          float pour=.013*sin(floor(grainUV.y/1.54)*15.8+2.);
          diffuseColor.rgb=vec3(.59,.57,.50)*(.69+.38*smoothstep(.10,.66,mineral)+pour-.34*hole-.13*(1.-smoothstep(.002,.010,castJoint)));`);
      }
      if(m===lawn) {
        s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          float grassValue=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
          float moisture=smoothstep(.026,.37,grassValue);
          diffuseColor.rgb=mix(vec3(.052,.089,.025),vec3(.279,.337,.113),moisture);`);
      }
      s.fragmentShader="varying vec3 groundPoint;uniform sampler2D leafLight;\n"+s.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        vec3 p=groundPoint-vec3(0.,0.,${d.toFixed(3)});
        float crown=texture2D(leafLight,vec2(.067*p.x+.031*p.z+.39,.082*p.z-.021*p.x-.052*p.y+.17)).r;
        float shadeWeight=mix(.18,.88,smoothstep(-1.3,5.9,-p.x+.22*p.z))*(1.-smoothstep(5.3,8.1,p.y));
        float leafShade=mix(1.,mix(.30,1.09,crown),shadeWeight);
        vec2 shadowUV=p.xz+vec2(.8,-1.34);
        float barEdge=.34*shadowUV.x+.64;
        float roof=(1.-smoothstep(barEdge+.10,barEdge+.75,shadowUV.y))*smoothstep(barEdge-5.73,barEdge-5.11,shadowUV.y)
          *smoothstep(-${w.toFixed(3)}-8.52,-${w.toFixed(3)}-8.10,shadowUV.x)*(1.-smoothstep(${w.toFixed(3)}+2.10,${w.toFixed(3)}+2.55,shadowUV.x));
        float floorMask=1.-smoothstep(.07,.53,p.y);
        vec2 leftFoot=max(abs(p.xz-vec2(-${w.toFixed(3)}-5.06,(-${w.toFixed(3)}-5.06)*.34-1.76))-vec2(.68,1.91),vec2(0.));
        vec2 rightFoot=max(abs(p.xz-vec2(${w.toFixed(3)}+.70,(${w.toFixed(3)}+.70)*.34-1.76))-vec2(.87,1.91),vec2(0.));
        float contact=mix(.56,1.,smoothstep(0.,.57,min(length(leftFoot),length(rightFoot))));
        reflectedLight.directDiffuse*=leafShade*(1.-roof*.76*floorMask);
        reflectedLight.indirectDiffuse*=mix(.78,1.0,leafShade)*mix(1.,contact*(1.-.26*roof),floorMask);

      `);
    };
    m.customProgramCacheKey=()=>"garden-daylight-"+d+"-"+m.uuid;
  }
  [pale,ashlar,concrete,exposed,timber,dark,bronze,fascia,lawn].forEach(shade);
  // Two low banks slope away from the path. They meet the stone below its edge
  // and carry the same scanned turf through the tree shade into the clearing.
  const turf=new T.PlaneGeometry(62,53,78,64);
  turf.rotateX(-Math.PI/2);turf.translate(0,0,15.5);
  const turfPoints=turf.getAttribute("position"),turfUV=turf.getAttribute("uv");
  const tones=new Float32Array(turfPoints.count*3).fill(1);
  for(let i=0;i<turfPoints.count;i++){
    const x=turfPoints.getX(i),z=turfPoints.getZ(i);
    const edge=Math.max(x-3.86,-9.42-x);
    const rise=T.MathUtils.smoothstep(edge,0,4.2)*T.MathUtils.smoothstep(z,.8,4.8);
    const swell=.31+.17*Math.cos(z*.33+x*.22)+.14*Math.sin(x*.50-z*.19);
    turfPoints.setY(i,-.09+rise*swell);turfUV.setXY(i,x/1.67,z/1.67);
  }
  turf.setAttribute("color",new T.BufferAttribute(tones,3));turf.computeVertexNormals();
  root.add(new T.Mesh(turf,lawn));

  // The walk follows the lawn before broadening under the lifted gallery.
  const pathCenter=z=>.28-2.65*T.MathUtils.smoothstep(z,1,14);
  const pathWidth=z=>4.86-2.23*T.MathUtils.smoothstep(z,1,8);
  function flagstone(z0,z1,u0,u1,tone) {
    const data=batch(pale),first=data.p.length/3;
    for(const [z,u] of [[z0,u0],[z1,u0],[z1,u1],[z0,u1]]) {
      const x=pathCenter(z)+(u-.5)*pathWidth(z);
      data.p.push(x,-.001,z);data.n.push(0,1,0);data.uv.push((x+.09*tone)/1.88,z/1.88);
      data.color.push(tone,tone,tone);
    }
    data.idx.push(first,first+1,first+2,first,first+2,first+3);
  }
  for(let z=.008,row=0;z<32;row++){
    const depth=[1.34,1.76,1.47,1.56][row%4],split=[.62,.38,.74,.47][row%4];
    flagstone(z,z+depth-.004,0,split-.0007,.97+.035*rand());
    flagstone(z,z+depth-.004,split+.0007,1,.97+.035*rand());
    z+=depth;
  }
  const bar=pavilionProfile(w),barriers=[];
  function barrier(x,z,width,depth){barriers.push({x,z,width,depth});}
  for(const [x,width] of [[-w-5.06,1.36],[w+.70,1.74]]) {
    const z=bar.face(x)-2.40,h=bar.base(x)+.15;
    block(exposed,x,h/2,z,width,h,3.82);
    barrier(x,z,width+.02,3.845);
    block(concrete,x,.045,z,width+.02,.09,3.845,.85);
  }
  // Low mineral garden walls finish the lawn and leave the shadow line beneath the upper volume visible.
  block(exposed,-w-4.45,.485,3.12,8.20,.97,.34);
  block(concrete,-w-4.45,.987,3.12,8.22,.036,.36);
  block(exposed,-w-8.41,.485,.90,.27,.97,4.6);
  barrier(-w-4.45,3.12,8.22,.36);
  barrier(-w-8.41,.90,.27,4.60);
  barrier(w+2.47,-2.61,4.80,3.90);
  barrier(bar.right-1.40,bar.face(bar.right-1.40)-4.19,2.64,2.88);
  buildFacade(T,root,{width:w,depth:d,panorama:surroundings,timberTexture:grain,materials});
  const poolX=-7.27,poolZ=8.62,poolW=3.54,poolD=10.55;
  barrier(poolX,poolZ,poolW+.12,poolD+.12);
  block(dark,poolX,-.035,poolZ,poolW,.14,poolD);
  for(const x of [poolX-poolW/2,poolX+poolW/2])block(concrete,x,.026,poolZ,.125,.12,poolD+.12);
  for(const z of [poolZ-poolD/2,poolZ+poolD/2])block(concrete,poolX,.026,z,poolW,.12,.125);
  const waterMat=waterMaterial(T,surroundings,d,w);
  materials.push(waterMat);
  const water=new T.Mesh(new T.PlaneGeometry(poolW-.13,poolD-.13),waterMat);
  water.name="garden-reflecting-pool";water.rotation.x=-Math.PI/2;water.position.set(poolX,.047,poolZ);root.add(water);
  for(const [m,b] of batches) {
    const g=new T.BufferGeometry();
    for(const [name,data,size] of [["position",b.p,3],["normal",b.n,3],["uv",b.uv,2],["color",b.color,3]])
      g.setAttribute(name,new T.Float32BufferAttribute(data,size));
    g.setIndex(b.idx);g.computeBoundingSphere();root.add(new T.Mesh(g,m));
  }
  const hitMaterial=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});materials.push(hitMaterial);
  const hit=new T.Mesh(new T.PlaneGeometry(4.80,3.64),hitMaterial);
  hit.name="museum-entry-hit";hit.position.set(0,1.82,.24);root.add(hit);
  root.updateMatrixWorld(true);
  function canWalk(x,worldZ,radius) {
    const z=worldZ-d;
    return !barriers.some(box=>{
      const dx=Math.max(0,Math.abs(x-box.x)-box.width*.5);
      const dz=Math.max(0,Math.abs(z-box.z)-box.depth*.5);
      return dx*dx+dz*dz<radius*radius;
    });
  }
  return {hits:[hit],canWalk,dispose(){
    disposed=true;root.removeFromParent();root.traverse(object=>object.geometry?.dispose());
    for(const m of materials)m.dispose();for(const t of textures)t.dispose();
  }};
}
