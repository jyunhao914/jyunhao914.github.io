import {buildFacade} from "./museum-glazing.js?v=grounds37";

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
  const stone=texture("stone-color.webp",true), grain=texture("mount/oak-color.webp",true);
  const canopy=texture("canopy-light.webp"), surroundings=panorama || texture("garden-panorama.webp",true);
  const ashlar=material({color:0xe1dfcd,map:limestone,normalMap:limeNormal,normalScale:new T.Vector2(.21,.21)});
  const concrete=material({color:0xbabbb0,map:limestone,roughness:.88});
  const pale=material({color:0xb4b4a7,map:stone,roughness:.82});
  const timber=material({color:0xa3855e,map:grain,roughness:.67});
  const bronze=material({color:0x424642,metalness:.32,roughness:.53});
  const fascia=material({color:0x757873,metalness:.22,roughness:.57});
  const dark=material({color:0x55594d});
  const lawn=material({color:0xadae90,map:texture("garden-grass.webp",true)});
  const leaves=material({color:0xffffff,side:T.DoubleSide});
  const scratch=new T.Color();
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
      else if(m===ashlar||m===concrete)b.uv.push(horizontal/.91,vertical/.66);
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
        const albedo=m===pale?"vec3(.46,.47,.445)":m===ashlar?"vec3(.66,.625,.54)":"vec3(.47,.48,.455)";
        s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          float mineral=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=${albedo}*(.72+.45*smoothstep(.02,.43,mineral));`);
      }
      s.fragmentShader="varying vec3 groundPoint;uniform sampler2D leafLight;\n"+s.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        vec3 p=groundPoint-vec3(0.,0.,${d.toFixed(3)}); float roof=(1.-smoothstep(3.05,4.45,p.z+.17*p.x))*(1.-smoothstep(3.2,3.62,p.y));
        float gaps=texture2D(leafLight,vec2(p.x*.068+p.z*.029,p.z*.088-p.y*.073)).r;
        float garden=smoothstep(2.8,8.2,p.z+.35*p.x)*(1.-smoothstep(2.2,4.6,p.y));
        float sunlight=mix(1.,mix(.55,1.08,gaps),garden);
        vec2 shadowPoint=p.xz-vec2(1.9,1.33);
        float eave=(1.-smoothstep(6.54,6.89,abs(shadowPoint.x)))*(1.-smoothstep(3.26,3.64,shadowPoint.y))*smoothstep(-.55,-.1,shadowPoint.y);
        float floorMask=1.-smoothstep(.03,.38,p.y);
        sunlight*=1.-.50*eave*floorMask;
        reflectedLight.directDiffuse*=sunlight*(1.-roof*.72);
        reflectedLight.indirectDiffuse*=mix(vec3(1.),vec3(.65,.71,.75),roof)*mix(.93,1.03,sunlight);
      `);
    };
    m.customProgramCacheKey=()=>"garden-daylight-"+d+"-"+m.uuid;
  }
  [pale,ashlar,concrete,timber,dark,bronze,fascia,leaves,lawn].forEach(shade);
  block(lawn,0,-.22,18.8,58,.23,38.6);

  // A continuous accessible approach, with separate joints for the dry stone courses.
  block(dark,.55,-.095,10,6.6,.17,20);
  for(let row=0;row<21;row++) {
    const z=.50+row*.95, left=-2.75, right=3.85;
    for(let x=left-(row%2)*.79;x<right;x+=1.58) {
      const a=Math.max(left,x),b=Math.min(right,x+1.58);
      if(b-a>.014)block(pale,(a+b)/2,-.030,z,b-a-.008,.058,.944,.88+.13*rand());
    }
  }
  // The entrance extends as a thin cantilever in front of the three taller vaults.
  // Keep the opening at x=0 clear all the way into the original foyer.
  block(bronze,0,3.60,1.63,2*w+2,.16,3.60);
  block(fascia,0,3.70,1.61,2*w+1.97,.054,3.62);
  block(timber,0,3.49,1.62,2*w+1.86,.10,3.48);
  for(let x=-w-.82;x<w+.88;x+=.29)block(timber,x,3.417,1.63,.055,.065,3.4,.83+.12*rand());
  for(const x of [-w+.45,w-.45]) {
    block(bronze,x,1.71,2.94,.115,3.43,.17);
    block(concrete,x,.07,2.94,.25,.14,.26);
  }
  // Flanking wings step out into the landscape. A deep shadow joint separates
  // each course; the timber screen turns the corner of the east gallery.
  function wing(x,width,front,height) {
    block(dark,x,height/2,front-2.1,width,height,4.2);
    const nx=Math.ceil(width/1.62),rows=Math.ceil(height/.65);
    for(let i=0;i<nx;i++)for(let j=0;j<rows;j++) {
      const col=width/nx,rh=height/rows;
      block(ashlar,x-width/2+(i+.5)*col,(j+.5)*rh,front+.035,col-.012,rh-.009,.09,.93+.08*rand());
    }
    block(bronze,x,height+.04,front-1.99,width+.16,.088,4.40);
    block(concrete,x,.17,front+.07,width+.05,.33,.16);
  }
  wing(-w-3.65,7.15,1.05,3.88);
  wing(w+3.10,6,1.46,4.25);
  for(let x=w+.23;x<w+5.99;x+=.19)block(timber,x,2.12,1.62,.055,3.74,.25,.67+.22*rand(),true);
  buildFacade(T,root,{width:w,depth:d,panorama:surroundings,materials});

  // Museum name is mounted on the limestone pier, readable across the approach.
  block(ashlar,-3.57,1.04,2.59,1.45,2.08,.36);
  function lettering(label,x,y,z,width,height) {
    const cv=document.createElement("canvas");cv.width=896;cv.height=208;
    const ctx=cv.getContext("2d"),font=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim()||"sans-serif";
    ctx.fillStyle="#303b38";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="650 144px "+font;
    ctx.fillText(label,448,111,840);
    const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;textures.push(map);
    const mat=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false});materials.push(mat);
    const mesh=new T.Mesh(new T.PlaneGeometry(width,height),mat);mesh.position.set(x,y,z);root.add(mesh);
  }
  lettering("美 術 館",-3.57,1.58,2.776,1.26,.34);
  // Narrow rill and a seat set back from the accessible route.
  const poolX=-5.82,poolZ=8.66,poolW=5.80,poolD=10.6;
  block(dark,poolX,-.035,poolZ,poolW,.14,poolD);
  for(const x of [poolX-poolW/2,poolX+poolW/2])block(concrete,x,.065,poolZ,.16,.20,poolD+.12);
  for(const z of [poolZ-poolD/2,poolZ+poolD/2])block(concrete,poolX,.065,z,poolW,.20,.16);
  const waterMat=new T.ShaderMaterial({uniforms:{panorama:{value:surroundings},front:{value:d}},vertexShader:`
    varying vec3 p;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform sampler2D panorama;uniform float front;varying vec3 p;
    void main(){
      vec3 view=normalize(cameraPosition-p);
      vec3 n=normalize(vec3(.009*sin(p.z*13.+p.x*4.)+.004*sin(p.z*23.),1.,.011*sin(p.x*11.+p.z*3.)));
      vec3 ray=reflect(-view,n);
      vec2 local=mat2(.886995,-.461779,.461779,.886995)*ray.xz;
      vec2 uv=vec2(fract(atan(local.y,-local.x)/6.2831853),asin(clamp(ray.y,-1.,1.))/3.141593+.5);
      vec3 mirror=texture2D(panorama,uv).rgb;
      if(ray.z<-.005){float t=(front+.4-p.z)/ray.z;vec3 q=p+t*ray;
        if(t>0.&&abs(q.x)<12.8&&q.y<4.0)mirror=mix(vec3(.12,.13,.12),vec3(.52,.51,.43),smoothstep(.2,3.9,q.y));}
      float f=.20+.74*pow(1.-max(dot(n,view),0.),3.);
      gl_FragColor=vec4(mix(vec3(.047,.080,.072),mirror,f),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  materials.push(waterMat);
  const water=new T.Mesh(new T.PlaneGeometry(poolW-.13,poolD-.13),waterMat);
  water.name="garden-reflecting-pool";water.rotation.x=-Math.PI/2;water.position.set(poolX,.047,poolZ);root.add(water);
  block(concrete,5.46,.10,8.11,2.98,.20,.84);
  for(const x of [4.45,6.49])block(bronze,x,.27,8.11,.15,.30,.52);
  for(let i=0;i<6;i++)block(timber,5.46,.46,7.78+i*.134,2.99,.10,.118);
  // The planted edge stays below eye level. Individually bent leaves grow from
  // clumps of different ages; the distant canopy is the site's photographic panorama.
  function grass(x,z,size) {
    const b=batch(leaves);
    for(let i=0;i<17;i++) {
      const angle=rand()*Math.PI*2,length=size*(.42+rand()*.65),dx=Math.cos(angle),dz=Math.sin(angle);
      const baseX=x+(rand()-.5)*.20,baseZ=z+(rand()-.5)*.20,width=.016+rand()*.018;
      const green=.74+rand()*.50;scratch.setHex(i%4===0?0xb0ac7c:0x718763);
      const first=b.p.length/3;
      for(let j=0;j<4;j++) {
        const t=j/3,ax=baseX+dx*length*t*t*.68,az=baseZ+dz*length*t*t*.68;
        for(const side of [-1,1]){
          b.p.push(ax+side*width*(1-t)*dz,.055+length*(1.6*t-1.03*t*t),az-side*width*(1-t)*dx);
          b.n.push(-dx*.5,.75,-dz*.5);b.uv.push((side+1)/2,t);
          const lit=green*(.75+t*.40);b.color.push(scratch.r*lit,scratch.g*lit,scratch.b*lit);
        }
      }
      for(let j=0;j<3;j++){const a=first+2*j;b.idx.push(a,a+1,a+2,a+2,a+1,a+3);}
    }
  }
  for(const [x,z,width,depth] of [[5.93,4.72,3.90,5.3],[6.58,13.85,5.3,8.0],[-10.7,9,3.65,12.1]]) {
    block(dark,x,.026,z,width,.09,depth);
    const count=Math.round(width*depth*2.7);
    for(let i=0;i<count;i++)grass(x+(rand()-.5)*(width-.22),z+(rand()-.5)*(depth-.25),.40+.43*rand());
  }
  for(const [m,b] of batches) {
    const g=new T.BufferGeometry();
    for(const [name,data,size] of [["position",b.p,3],["normal",b.n,3],["uv",b.uv,2],["color",b.color,3]])
      g.setAttribute(name,new T.Float32BufferAttribute(data,size));
    g.setIndex(b.idx);g.computeBoundingSphere();root.add(new T.Mesh(g,m));
  }
  const hitMaterial=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});materials.push(hitMaterial);
  const hit=new T.Mesh(new T.PlaneGeometry(2.44,3.12),hitMaterial);
  hit.name="museum-entry-hit";hit.position.set(0,1.56,.40);root.add(hit);
  root.updateMatrixWorld(true);
  return {hits:[hit],dispose(){
    disposed=true;root.removeFromParent();root.traverse(object=>object.geometry?.dispose());
    for(const m of materials)m.dispose();for(const t of textures)t.dispose();
  }};
}
