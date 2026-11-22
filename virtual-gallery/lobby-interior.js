import {buildReception,furnitureObstacles} from "./lobby-reception.js?v=reception41";
import {buildWaypoints} from "./lobby-waypoints.js?v=directory42";

// One sampled centreline is shared by the masonry, the contact shadow, and walking.
function partitionPlan(w,d,obstacles){
  const pts=[[-w-.22,-d-.77],[-4.91,-d-.74],[-4.25,-d-1.12],[-3.57,-d-1.71]],line=[];
  const blocks=obstacles.map(o=>{
    const c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0),radius=o.radius??0;
    return {...o,c,s,coreX:o.width/2-radius,coreZ:o.depth/2-radius,reach:Math.hypot(o.width,o.depth)/2+.20,safeRadius:radius+.18};
  });
  function clearance(b,x,z){
    const dx=x-b.x,dz=z-b.z,lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c;
    const qx=Math.abs(lx)-b.coreX,qz=Math.abs(lz)-b.coreZ,hx=Math.max(qx,0),hz=Math.max(qz,0),outside=Math.hypot(hx,hz);
    const gap=outside+Math.min(0,Math.max(qx,qz))-b.safeRadius;
    if(gap>=0)return null;
    const localX=Math.sign(lx||1)*(outside>.000001?hx/outside:Number(qx>=qz));
    const localZ=Math.sign(lz||1)*(outside>.000001?hz/outside:Number(qz>qx));
    return {gap,nx:b.c*localX+b.s*localZ,nz:-b.s*localX+b.c*localZ};
  }
  for(let i=0;i<=40;i++){
    const t=i/40,u=1-t;
    const [x,z]=[0,1].map(k=>u*u*u*pts[0][k]+3*u*u*t*pts[1][k]+3*u*t*t*pts[2][k]+t*t*t*pts[3][k]);
    const [dx,dz]=[0,1].map(k=>3*u*u*(pts[1][k]-pts[0][k])+6*u*t*(pts[2][k]-pts[1][k])+3*t*t*(pts[3][k]-pts[2][k]));
    const len=Math.hypot(dx,dz);line.push({x,z,tx:dx/len,tz:dz/len,nx:-dz/len,nz:dx/len,t});
  }
  const half=.19,clear=half+.18,tip=line.at(-1);
  function nearest(x,z){
    let best=Infinity,selected=null;
    for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z;
      const along=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      const px=a.x+along*dx,pz=a.z+along*dz,dist=(px-x)**2+(pz-z)**2;
      if(dist<best){best=dist;selected={x:px,z:pz,nx:a.nx,nz:a.nz,distance:Math.sqrt(dist)};}
    }
    return selected;
  }
  function withinBounds(x,z){return x<=tip.x+clear+.06 && z>=tip.z-clear-.06 && z<=line[0].z+clear+.06;}
  function constrainLobbyStep(fromX,fromZ,toX,toZ){
    const dx=toX-fromX,dz=toZ-fromZ;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.13));
    let x=fromX,z=fromZ;
    for(let n=0;n<steps;n++){
      let movedX=x+dx/steps,movedZ=z+dz/steps;
      if(withinBounds(movedX,movedZ)){
        const q=nearest(movedX,movedZ);
        if(q.distance<clear){
          let nx=movedX-q.x,nz=movedZ-q.z,norm=q.distance;
          if(norm<.00001){nx=x-q.x;nz=z-q.z;norm=Math.hypot(nx,nz);}
          if(norm<.00001){nx=q.nx;nz=q.nz;norm=1;}
          movedX=Math.max(-w+.16,q.x+nx/norm*(clear+.0002));movedZ=q.z+nz/norm*(clear+.0002);
        }
      }
      for(const ob of blocks){
        if(Math.abs(movedX-ob.x)>ob.reach||Math.abs(movedZ-ob.z)>ob.reach)continue;
        const contact=clearance(ob,movedX,movedZ);
        if(contact){movedX+=contact.nx*(-contact.gap+.0002);movedZ+=contact.nz*(-contact.gap+.0002);}
      }
      x=Math.max(-w+.16,Math.min(w-.16,movedX));z=movedZ;
    }
    return {x,z};
  }
  function clearPath(a,b){
    const dx=b.x-a.x,dz=b.z-a.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
    for(let i=0;i<=steps;i++){
      const x=a.x+i/steps*dx,z=a.z+i/steps*dz;
      if(withinBounds(x,z)&&nearest(x,z).distance<clear-.001)return false;
      for(const ob of blocks){
        if(Math.abs(x-ob.x)<=ob.reach&&Math.abs(z-ob.z)<=ob.reach&&clearance(ob,x,z)?.gap<-.001)return false;
      }
    }
    return true;
  }
  const guides=[];
  for(const i of [6,18,30,40]){
    const q=line[i];
    for(const sign of [-1,1])guides.push({x:q.x+sign*.68*q.nx,z:q.z+sign*.68*q.nz});
  }
  guides.push({x:tip.x+.80*tip.tx,z:tip.z+.80*tip.tz});
  for(const ob of blocks)for(const dx of [-1,1])for(const dz of [-1,1]){
    const lx=dx*(ob.width/2+.24),lz=dz*(ob.depth/2+.24),x=ob.x+lx*ob.c+lz*ob.s,z=ob.z-lx*ob.s+lz*ob.c;
    if(x>-w+.20 && x<w-.20 && z>-d-3.78 && z<d-.18 && clearPath({x,z},{x,z}))guides.push({x,z});
  }
  // Only automatic travel needs waypoints. Test each straight segment against the
  // same inflated masonry and choose the shortest clear route around its round end.
  function lobbyRoute(start,end){
    if(clearPath(start,end))return [];
    const nodes=[start,end,...guides],distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set();
    distance[0]=0;
    while(true){
      let i=-1,short=Infinity;
      for(let j=0;j<nodes.length;j++)if(!done.has(j)&&distance[j]<short){short=distance[j];i=j;}
      if(i<0||i===1)break;
      done.add(i);
      for(let j=1;j<nodes.length;j++){
        if(j===i||done.has(j))continue;
        const cost=short+Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);
        if(cost<distance[j]&&clearPath(nodes[i],nodes[j])){distance[j]=cost;prev[j]=i;}
      }
    }
    const route=[];
    for(let i=prev[1];i>0;i=prev[i])route.unshift(nodes[i]);
    return route;
  }
  return {line,half,constrainLobbyStep,lobbyRoute};
}

// Coordinates are metres. Exhibit destinations are placed by the navigation controller.
export function buildLobby(T, scene, doors, {halfWidth,halfDepth,invalidate}={}) {
  const w=halfWidth ?? 5.7, d=halfDepth ?? 5.9, H=4.10;
  const root=new T.Group(), hits=[], textures=[], materials=[], batches=new Map();
  root.name="lobby-interior";
  scene.add(root);
  let disposed=false;
  const loading=new T.TextureLoader();
  const world={x:0,z:0,yaw:0};
  const arcRadius=.62,wallNorth=-d-4.0,westStart=-d+1.00,westEnd=d-.34;
  const pitchStart=-5.39,northRoof=6.42;
  function roofHeight(z){
    return H+(northRoof-H)*Math.min(1,Math.max(0,(pitchStart-z)/(pitchStart-wallNorth)));
  }
  const mouth={x:2.70,north:-5.25,south:-.24};
  const rim={x:2.18,north:-4.90,south:-.72,y:5.20};
  function texture(file,color=true,repeat=true) {
    const tex=loading.load(new URL("./materials/"+file,import.meta.url).href,()=>{
      if(!disposed)invalidate?.();
    });
    if(color)tex.colorSpace=T.SRGBColorSpace;
    if(repeat)tex.wrapS=tex.wrapT=T.RepeatWrapping;
    textures.push(tex);
    return tex;
  }
  function material(type,properties) {
    const mat=new type(properties);
    materials.push(mat);
    return mat;
  }
  const standard=props=>material(T.MeshStandardMaterial,props);
  const plasterMap=texture("plaster-color.webp"),plasterNormal=texture("plaster-normal.webp",false);
  const stoneMap=texture("limestone-color.webp"),stoneNormal=texture("limestone-normal.webp",false);
  const canopy=texture("canopy-light.webp",false);
  const oakMap=texture("boards-color.webp"),oakNormal=texture("boards-normal.webp",false);
  const oak=standard({color:0xe3caab,map:oakMap,normalMap:oakNormal,normalScale:new T.Vector2(.16,.16),roughness:.65});
  const wallStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.12,.12),color:0x998f7c,roughness:.82,side:T.DoubleSide});
  // The registered black granite scan repeats every 1.20 m. Separate cut joints
  // describe full-size stones across both rooms, including below the reception counter.
  const slabMap=texture("reception-granite-color.webp"),slabNormals=texture("reception-granite-normal.webp",false);
  const stone=standard({map:slabMap,normalMap:slabNormals,roughnessMap:texture("reception-granite-rough.webp",false),
    normalScale:new T.Vector2(.13,.13),color:0xffffff,metalness:0,roughness:1});
  const limestone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.25,.25),color:0x77705f,roughness:.81,side:T.DoubleSide});
  const soffit=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.10,.10),color:0x676b64,roughness:.87});
  const splay=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.085,.085),color:0xad9475,roughness:.84,side:T.DoubleSide});
  const timberVeneer=standard({color:0xaa8e73,map:oakMap,normalMap:oakNormal,normalScale:new T.Vector2(.10,.10),roughness:.52});
  const pierStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.13,.13),color:0xb9b5a5,roughness:.68});
  stone.name="lobby-polished-black-stone";
  const portalStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.25,.25),color:0x978673,roughness:.61});
  const innerStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.13,.13),color:0xa99c88,roughness:.59});
  const galleryDeck=standard({map:plasterMap,color:0xb1aa9a,roughness:.82});
  const darkVeneer=standard({map:oakMap,normalMap:oakNormal,normalScale:new T.Vector2(.12,.12),color:0x675f54,roughness:.53});
  const ribOak=standard({map:oakMap,color:0xad8a62,roughness:.60});
  const warmCut=standard({color:0xe5b57b,emissive:0xffbc74,emissiveIntensity:1.16,roughness:.70});
  const bronze=standard({color:0x8d7862,metalness:.44,roughness:.47});
  const metal=standard({color:0x706653,metalness:.32,roughness:.57});
  const recess=standard({color:0x403e39,roughness:.92,side:T.DoubleSide});
  const entryZ=-3.08,midZ=(entryZ+wallNorth)/2+.09,entryDepth=.64,head=3.29;
  const galleryLeft=.63,galleryRight=4.98;
  // Solid plan dimensions drive the section, pedestrian radius and direct-light occlusion.
  const piece=(name,x,z,width,depth,height)=>({name,x,z,width,depth,height,radius:0});
  const piers=[
    piece("lobby-gallery-left-pier",.045,entryZ-entryDepth/2,1.17,entryDepth,head),
    piece("lobby-gallery-right-pier",(galleryRight+w)/2,entryZ-entryDepth/2,w-galleryRight,entryDepth,head),
    piece("lobby-gallery-inner-left",.75,midZ,.64,.69,3.23),
    piece("lobby-gallery-inner-right",5.23,midZ,.81,.69,3.23),
    piece("lobby-gallery-side-wall",.28,(wallNorth+entryZ)/2,.28,entryZ-wallNorth,3.44),
    piece("lobby-reception-back-wall",(-w+.20)/2,-4.64,w+.20,.21,3.02)
  ];
  const recesses=[{side:-1,start:-2.93,end:1.85,push:.55,top:3.01},
    {side:1,start:-.52,end:2.65,push:.53,top:2.63}];
  const cheeks=recesses.flatMap(b=>[b.start-.085,b.end+.085].map(z=>({x:b.side*(w-b.push/2),z,
    width:b.push+.07,depth:.17,radius:0})));
  const galleryLeaves=[
    piece("lobby-gallery-near-return",.48,entryZ-1.42,.13,1.57,3.15),
    piece("lobby-gallery-mid-return",(w+5.40)/2,midZ-.80,w-5.40,1.84,3.15),
    piece("lobby-gallery-far-return",.51,wallNorth+1.52,.13,2.27,3.15)
  ];
  const rearX=(.48+w)/2,rearWidth=w-.48;
  const rearRelief=piece("lobby-gallery-north-relief",rearX,wallNorth+.128,rearWidth,.255,3.20);
  const jambs=[galleryLeft+.026,galleryRight-.026].map(x=>piece("jamb",x,entryZ-.365,.052,.31,head));
  const partition=partitionPlan(w,d,[...piers,...cheeks,...galleryLeaves,rearRelief,...jambs,...furnitureObstacles]),gardenBays=[];
  const openingLeft=-w+.81,openingRight=w-.82,northSill=3.19,northHead=5.97;
  const slotDepth=.39,outerSill=3.30,outerHead=5.90;
  const slabHeight=t=>2.90-.36*t*t*(3-2*t);
  const partitionOcclusion=`float partitionVisibility(vec3 o,vec3 r,float limit){
    float light=1.;
    ${[...piers,
       {x:(w-.54)/2,z:entryZ-entryDepth/2,width:w+.54,depth:entryDepth,low:head,height:H+.02},
       {x:(w+.42)/2,z:(wallNorth+entryZ-entryDepth)/2,width:w-.42,depth:entryZ-entryDepth-wallNorth,low:3.23,height:3.54}
      ].map(p=>`{
      vec3 lo=vec3(${(p.x-p.width/2).toFixed(4)},${(p.low??.012).toFixed(4)},${(p.z-p.depth/2).toFixed(4)})-o;
      vec3 hi=vec3(${(p.x+p.width/2).toFixed(4)},${p.height.toFixed(4)},${(p.z+p.depth/2).toFixed(4)})-o;
      vec3 inverseRay=1./(r+mix(vec3(-.00002),vec3(.00002),step(vec3(0.),r)));
      vec3 a=lo*inverseRay,b=hi*inverseRay,t0=min(a,b),t1=max(a,b);
      float entry=max(.032,max(max(t0.x,t0.y),t0.z)),exitT=min(limit,min(min(t1.x,t1.y),t1.z));
      light*=1.-smoothstep(.003,.042,exitT-entry);}`).join("\n")}
    if(o.y>2.95 && r.y>=0.)return light;
    ${[8,16,24,32,40].map(i=>{
      const a=partition.line[i-8],b=partition.line[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      return `{vec2 a=vec2(${a.x.toFixed(4)},${a.z.toFixed(4)}),axis=vec2(${((b.x-a.x)/length).toFixed(5)},${((b.z-a.z)/length).toFixed(5)});
        vec2 n=vec2(-axis.y,axis.x),rel=o.xz-a,org=vec2(dot(rel,axis),dot(rel,n));
        vec2 dir=vec2(dot(r.xz,axis),dot(r.xz,n));dir+=mix(vec2(-.00001),vec2(.00001),step(vec2(0.),dir));
        vec2 t0=(vec2(-.015,-.19)-org)/dir,t1=(vec2(${(length+.015).toFixed(4)},.19)-org)/dir;
        vec2 lo=min(t0,t1),hi=max(t0,t1);float hit=max(.035,max(lo.x,lo.y)),exitT=min(limit,min(hi.x,hi.y));
        if(hit<exitT){
          float u=clamp((org.x+hit*dir.x)/${length.toFixed(4)},0.,1.);
          float head=mix(${slabHeight(a.t).toFixed(4)},${slabHeight(b.t).toFixed(4)},u);
          float heightAt=o.y+r.y*(r.y<0.?exitT:hit);
          light=min(light,smoothstep(head-.045,head+.045,heightAt));
        }}`;}).join("\n")}
    // Exact circular free end in plan, including rays grazing either cheek.
    vec2 tip=vec2(${partition.line.at(-1).x.toFixed(4)},${partition.line.at(-1).z.toFixed(4)}),u=o.xz-tip;
    float rr=dot(r.xz,r.xz);
    if(rr>.000001){
      float t=clamp(-dot(u,r.xz)/rr,.035,limit);
      float span=length(u+r.xz*t);
      if(span<.19 && o.y+r.y*t<${slabHeight(1).toFixed(4)})light=0.;
    }
    return light;}
    float warmSpot(vec3 p,vec3 n,vec3 fixture,vec3 aim){
      vec3 diff=fixture-p;float d2=max(.03,dot(diff,diff));
      vec3 l=diff*inversesqrt(d2);float cone=dot(-l,normalize(aim-fixture));
      return smoothstep(.70,.94,cone)*max(0.,dot(n,l))/(.55+.32*d2);
    }`;
  function daylight(mat) {
    mat.onBeforeCompile=shader=>{
      shader.uniforms.treeShadow={value:canopy};
      const sideGlass=gardenBays.map(({low,high,sill,head})=>`{
        vec3 source=vec3(${(-w-.23).toFixed(3)},${((sill+head)/2).toFixed(3)},${((low+high)/2).toFixed(3)})-p;
        float dist2=max(.06,dot(source,source)),area=${((high-low)*(head-sill)).toFixed(3)};
        vec3 unit=source*inversesqrt(dist2);
        westSky+=area/(area+dist2)*max(0.,dot(nWorld,unit))*max(0.,-unit.x);}`).join("\n");
      shader.vertexShader="varying vec3 lobbyPoint;\n"+shader.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nlobbyPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
      shader.fragmentShader="varying vec3 lobbyPoint;uniform sampler2D treeShadow;\n"+partitionOcclusion+"\n"+shader.fragmentShader;
      if(mat===wallStone){
        // Metre-scale slab joints and a displaced sample of the same real scan in each cut.
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
          vec2 panel=vMapUv/vec2(2.14,1.02);
          panel.x+=mod(floor(panel.y),2.)*.41;
          vec2 slab=floor(panel),within=fract(panel);
          float variation=fract(sin(dot(slab,vec2(15.73,61.39)))*15017.36);
          vec2 albedoUv=vMapUv*vec2(.88,1.23)+vec2(variation,.23*slab.x+.31*slab.y);
          vec3 grain=texture2D(map,albedoUv).rgb;
          float value=dot(grain,vec3(.24,.61,.15)),mineral=.529+(value-.529)*.63;
          diffuseColor.rgb*=mix(vec3(mineral*1.045,mineral*1.008,mineral*.948),grain,.28)*(.950+.074*variation);
          vec2 edge=min(within,1.-within)*vec2(2.14,1.02);
          float gap=min(edge.x,edge.y),aa=max(.0006,fwidth(gap));
          float joint=1.-smoothstep(.0012-aa,.0033+aa,gap);
          diffuseColor.rgb*=1.-.40*joint;`);
      } else if(mat===stone){
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
          #include <map_fragment>
          vec2 cutGrid=lobbyPoint.xz/vec2(1.85,1.05);
          cutGrid.x+=.5*mod(floor(cutGrid.y),2.);
          vec2 edge=min(fract(cutGrid),1.-fract(cutGrid))*vec2(1.85,1.05);
          float gap=min(edge.x,edge.y),aa=max(.00045,fwidth(gap));
          float joint=1.-smoothstep(.00065-aa,.002+aa,gap);
          diffuseColor.rgb*=1.-.42*joint;`);
      }else if(mat===oak){
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
          float woodValue=dot(diffuseColor.rgb,vec3(.26,.63,.11));
          diffuseColor.rgb=mix(diffuseColor.rgb,woodValue*vec3(1.34,.97,.68),.47)*1.28;`);
      }else if(mat===soffit || mat===splay){
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
          "#include <map_fragment>\ndiffuseColor.rgb=mix(diffuse,diffuseColor.rgb,.34);");
      }
      shader.fragmentShader=shader.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        vec3 p=lobbyPoint,nWorld=inverseTransformDirection(normal,viewMatrix);
        vec2 sunTilt=vec2(.17,-.284);
        float westSky=0.,windowLight=0.;
        ${sideGlass}
        vec2 upperCenter=vec2(0.,${((rim.north+rim.south)/2).toFixed(4)});
        vec2 lowerCenter=vec2(0.,${((mouth.north+mouth.south)/2).toFixed(4)});
        vec2 upperHalf=vec2(${rim.x.toFixed(4)},${((rim.south-rim.north)/2).toFixed(4)});
        vec2 lowerHalf=vec2(${mouth.x.toFixed(4)},${((mouth.south-mouth.north)/2).toFixed(4)});
        vec2 hi=p.xz+sunTilt*(${rim.y.toFixed(4)}-p.y);
        vec2 lo=p.xz+sunTilt*(${H.toFixed(4)}-p.y);
        vec2 freeRay=min(upperHalf-abs(hi-upperCenter),lowerHalf-abs(lo-lowerCenter));
        float pn=.046+.024*max(0.,${rim.y.toFixed(4)}-p.y);
        float beam=smoothstep(-pn,pn,min(freeRay.x,freeRay.y))*step(p.y,${H.toFixed(4)}+.002);
        // Soft branch shadows from the measured park canopy, projected along the same ray as the roof.
        float leaves=texture2D(treeShadow,(hi-upperCenter)*vec2(.116,.139)+vec2(.37,.64)).r;
        float dapple=mix(.71,1.,smoothstep(.05,.91,leaves));
        float sunFacing=max(0.,dot(nWorld,normalize(vec3(sunTilt.x,1.,sunTilt.y))));
        vec3 toSky=vec3(upperCenter.x,${rim.y.toFixed(4)},upperCenter.y)-p;
        float sky2=max(.05,dot(toSky,toSky));vec3 skyDir=toSky*inversesqrt(sky2);
        vec2 skyAtMouth=mix(p.xz,upperCenter,clamp((${H.toFixed(4)}-p.y)/max(.08,toSky.y),0.,1.));
        vec2 skyBounds=lowerHalf-abs(skyAtMouth-lowerCenter);
        float skyVisible=smoothstep(-.76,.63,min(skyBounds.x,skyBounds.y));
        float sky=18.22/(sky2+18.22)*skyVisible*max(0.,dot(nWorld,skyDir))*max(0.,skyDir.y);
        vec3 toFloor=vec3(-.85,.04,-1.40)-p;
        float floor2=max(.04,dot(toFloor,toFloor));
        float bounce=max(0.,dot(nWorld,toFloor*inversesqrt(floor2)))/(1.+.12*floor2);
        vec3 toGarden=vec3(${((openingLeft+openingRight)/2).toFixed(3)},${((northSill+northHead)/2).toFixed(3)},${wallNorth.toFixed(3)})-p;
        float garden2=max(.05,dot(toGarden,toGarden));vec3 gardenDir=toGarden*inversesqrt(garden2);
        float gardenFactor=${((openingRight-openingLeft)*(northHead-northSill)).toFixed(3)}/(${((openingRight-openingLeft)*(northHead-northSill)).toFixed(3)}+garden2)*max(0.,dot(nWorld,gardenDir))*max(0.,-gardenDir.z);
        // Test both ends of the rising north reveal, then the lowest point of
        // the opaque pitched roof between a receiver and the slot.
        float northSun=max(0.,(p.z-(${wallNorth.toFixed(3)}))/.284);
        float insideY=p.y+northSun,outsideY=insideY+${slotDepth.toFixed(3)}/.284;
        float insideX=p.x+.17*northSun,outsideX=insideX+.17*${slotDepth.toFixed(3)}/.284;
        vec2 slotClear=min(vec2(min(insideX,outsideX)-(${openingLeft.toFixed(3)}),${openingRight.toFixed(3)}-max(insideX,outsideX)),
          vec2(50.));
        float slotMargin=min(min(slotClear.x,slotClear.y),min(min(insideY-${northSill.toFixed(3)},${northHead.toFixed(3)}-insideY),
          min(outsideY-${outerSill.toFixed(3)},${outerHead.toFixed(3)}-outsideY)));
        float lowRoof=p.z<=${pitchStart.toFixed(3)}?1.:1.-smoothstep(${(H-.04).toFixed(3)},${H.toFixed(3)},p.y+(p.z-(${pitchStart.toFixed(3)}))/.284);
        windowLight=smoothstep(-.055,.055,slotMargin)*lowRoof;
        if(windowLight+beam>.001){
          float passing=partitionVisibility(p,vec3(sunTilt.x,1.,sunTilt.y),max(.1,6.5-p.y));
          windowLight*=passing;beam*=passing;
        }
        if(p.z<${(-d+1.6).toFixed(3)}){
          sky*=mix(.34,1.,partitionVisibility(p,skyDir,sqrt(sky2)));
          gardenFactor*=mix(.25,1.,partitionVisibility(p,gardenDir,sqrt(garden2)));
        }
        float wallEdge=min(${w.toFixed(4)}-abs(p.x),min(p.z-(${wallNorth.toFixed(3)}),${d.toFixed(4)}-p.z));
        float actualHead=${H.toFixed(4)}+2.32*clamp((${pitchStart.toFixed(3)}-p.z)/${(pitchStart-wallNorth).toFixed(3)},0.,1.);
        float contact=abs(nWorld.y)>.55 ? wallEdge : min(p.y,actualHead-p.y);
        float ao=mix(.75,1.,smoothstep(-.015,.37,contact));
        ${mat===stone?`float footDistance=100.;
          ${[8,16,24,32,40].map(i=>{const a=partition.line[i-8],b=partition.line[i];return `{
            vec2 start=vec2(${a.x.toFixed(4)},${a.z.toFixed(4)}),v=vec2(${(b.x-a.x).toFixed(4)},${(b.z-a.z).toFixed(4)});
            vec2 rel=p.xz-start;footDistance=min(footDistance,length(rel-v*clamp(dot(rel,v)/dot(v,v),0.,1.)));}`;}).join("\n")}
          ao*=.58+.42*smoothstep(.17,.70,footDistance);`:""}

        reflectedLight.directDiffuse*=.36+.24*windowLight+.46*beam*dapple;
        reflectedLight.indirectDiffuse*=ao*(.74+.16*skyVisible);
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*(vec3(.92,1.01,1.11)*(1.25*westSky+gardenFactor*1.65)+vec3(.86,1.03,1.22)*sky*3.1+
          vec3(1.,.80,.57)*bounce*.91+vec3(1.,.88,.68)*sunFacing*(1.19*windowLight+2.66*beam*dapple));
        bool inGallery=p.x>.42 && p.z<${(entryZ-entryDepth+.045).toFixed(4)} && p.y<3.54;
        if(inGallery){
          // This gallery has its own low ceiling, recessed luminaires and end-wall wash.
          // Its slit view above the ceiling does not act as a light source below it.
          float spots=warmSpot(p,nWorld,vec3(2.15,3.27,-4.35),vec3(1.40,.18,-5.63))+
            warmSpot(p,nWorld,vec3(3.11,3.27,${(midZ-.58).toFixed(3)}),vec3(3.25,.10,${(midZ-1.40).toFixed(3)}))+
            1.25*warmSpot(p,nWorld,vec3(2.77,3.17,${(wallNorth+.77).toFixed(3)}),vec3(2.75,1.38,${wallNorth.toFixed(3)}));
          reflectedLight.directDiffuse*=.41;
          reflectedLight.indirectDiffuse*=.70;
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.82,.61)*(.38+spots*2.3);
        }
        float leftStrip=1.-smoothstep(.10,.69,abs(p.z+4.48));
        float westStrip=1.-smoothstep(.10,.62,abs(p.x+${(w-.064).toFixed(3)}));
        float vertical=smoothstep(2.93,3.08,p.y)*(1.-smoothstep(3.12,4.23,p.y));
        float cove=vertical*max(leftStrip*step(p.x,.34),westStrip*step(-4.62,p.z)*step(p.z,1.96));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.70,.40)*cove*1.95;
        ${mat===soffit?`vec2 fromCourt=max(vec2(0.),abs(p.xz-lowerCenter)-lowerHalf);
          float returnGlow=exp(-length(fromCourt)*.65);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.72,.67,.55)*(.06+.46*returnGlow);`:""}
        ${mat===splay?`float exposure=smoothstep(${H.toFixed(4)},${rim.y.toFixed(4)},p.y);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.66,.72,.79)*(.29+.71*exposure);
          reflectedLight.directDiffuse+=diffuseColor.rgb*vec3(.62,.49,.33)*sunFacing*(.34+.66*exposure);`:""}`);
    };
    mat.customProgramCacheKey=()=>"central-court-"+mat.uuid;
  }
  for(const mat of [wallStone,stone,limestone,soffit,splay,oak,pierStone,timberVeneer,portalStone,innerStone,galleryDeck,darkVeneer,ribOak])daylight(mat);
  function box(wall,mat,width,height,depth,x,y,z,name="") {
    if(Math.min(width,height,depth)<=0)return;
    const key=name||mat;
    let batch=batches.get(key);
    if(!batch){batch={mat,name,pos:[],normal:[],uv:[],index:[]};batches.set(key,batch);}
    const geo=new T.BoxGeometry(width,height,depth);
    const {position,normal}=geo.attributes;
    const c=Math.cos(wall.yaw),s=Math.sin(wall.yaw),first=batch.pos.length/3;
    for(let i=0;i<position.count;i++) {
      const u=position.getX(i)+x,v=position.getY(i)+y,n=position.getZ(i)+z;
      const X=wall.x+u*c+n*s,Z=wall.z-u*s+n*c;
      const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
      batch.pos.push(X,v,Z);batch.normal.push(nx*c+nz*s,ny,-nx*s+nz*c);
      const across=Math.abs(nx*c+nz*s)>.5 ? Z : X;
      const metreUv=mat===wallStone,cutStone=mat.map===stoneMap;
      if(mat===stone)batch.uv.push(X/1.20,Z/1.20);
      else if(mat===darkVeneer||mat===ribOak||mat===timberVeneer)batch.uv.push(across*.68,v*.32);
      else if(mat===oak)batch.uv.push((Math.abs(ny)>.5 ? Z : v)*.64,X*.26);
      else batch.uv.push(across/(metreUv ? 1 : cutStone ? .86 : 1.96),(Math.abs(ny)>.5 ? Z : v)/(metreUv ? 1 : cutStone ? .64 : 1.96));
    }
    for(const index of geo.index.array) batch.index.push(first+index);
    geo.dispose();
  }
  box(world,stone,2*w+.08,.16,d+.12-wallNorth,0,-.08,(d+.04+wallNorth-.08)/2,"lobby-reflective-black-stone");
  // A single level soffit surrounds a splayed court. The floor, the light well, and
  // the exterior roof are open on the same axis; no layer spans the aperture.
  const courtMid=(mouth.north+mouth.south)/2,courtDepth=mouth.south-mouth.north;
  const leftSpan=w+.04-mouth.x;
  for(const side of [-1,1])box(world,soffit,leftSpan,.13,courtDepth,side*(mouth.x+leftSpan/2),H+.065,courtMid);
  const northDepth=mouth.north-pitchStart,southDepth=d+.08-mouth.south;
  box(world,soffit,2*w+.08,.13,northDepth,0,H+.065,mouth.north-northDepth/2);
  box(world,soffit,2*w+.08,.13,southDepth,0,H+.065,mouth.south+southDepth/2);

  // At the northern gallery the roof rises towards the high light scoop.
  // The underside, edge and top are independent surfaces of a solid pitched slab.
  const roofLength=pitchStart-wallNorth+.12,roofRise=northRoof-H;
  const pitch=Math.atan2(roofRise,roofLength),slopeLength=Math.hypot(roofLength,roofRise);
  const annexRoof=new T.Mesh(new T.BoxGeometry(2*w+.18,.20,slopeLength+.05),soffit);
  annexRoof.rotation.x=pitch;
  annexRoof.position.set(0,(northRoof+H)/2+.098,(wallNorth+pitchStart)/2-.04);
  annexRoof.name="atrium-pitched-roof";root.add(annexRoof);

  // Solid glulam members run towards the garden and follow the rising soffit. The grain
  // runs along each beam. Both members and their shadows end at the light court.
  const timberPos=[],timberUv=[];
  function timberRun(x,zA,zB,width,depth,tone){
    if(zB-zA<.025)return;
    const bottomA=roofHeight(zA)-depth,bottomB=roofHeight(zB)-depth;
    const shape=[[-width/2,depth],[width/2,depth],[width/2,.012],[width/2-.012,0],[-width/2+.012,0],[-width/2,.012]];
    const front=shape.map(([dx,h])=>[x+dx,bottomA+h+.006,zA]);
    const back=shape.map(([dx,h])=>[x+dx,bottomB+h+.006,zB]);
    function quad(points,vertical){
      for(const j of [0,1,2,0,2,3]){
        const p=points[j];timberPos.push(...p);
        const head=roofHeight(p[2]);
        timberUv.push(tone+(vertical ? head-p[1] : p[0]-x)*.67,.26*p[2]+.09*tone);
      }
    }
    for(let i=0;i<shape.length;i++){
      const j=(i+1)%shape.length;quad([front[i],back[i],back[j],front[j]],i===1 || i===5);
    }
    for(let j=1;j<shape.length-1;j++){
      for(const face of [[front[0],front[j],front[j+1]],[back[0],back[j+1],back[j]]]){
        for(const p of face){timberPos.push(...p);timberUv.push(.12+p[0]-x,roofHeight(p[2])-p[1]);}
      }
    }
  }
  // Four primary timber lines leave a broad, quiet centre. The east pair bears on
  // the stone piers and makes a continuous porch beside the reception room.
  for(const [i,centre] of [-4.53,-2.88,2.65,4.63].entries()){
    for(const offset of [-.112,.112]){
      const x=centre+offset;
      timberRun(x,wallNorth-.05,pitchStart,.159,.305,.44*i+offset);
      timberRun(x,pitchStart,d+.04,.159,.260,.44*i+offset);
    }
  }
  const beamGeom=new T.BufferGeometry();
  beamGeom.setAttribute("position",new T.Float32BufferAttribute(timberPos,3));beamGeom.setAttribute("uv",new T.Float32BufferAttribute(timberUv,2));beamGeom.computeVertexNormals();
  const beams=new T.Mesh(beamGeom,oak);beams.name="atrium-laminated-oak-beams";root.add(beams);
  // The concave arris is cast in three small bevels, allowing its angled sides to
  // pick up skylight. Above it, the outside of the solid curb meets the roof flashing.
  function ring(width,north,south,h){
    return [[-width,h,south],[-width,h,north],[width,h,north],[width,h,south]];
  }
  const bottom=ring(mouth.x,mouth.north,mouth.south,H);
  const lip=ring(mouth.x-.037,mouth.north+.031,mouth.south-.032,H+.014);
  const bevel=ring(mouth.x-.063,mouth.north+.052,mouth.south-.055,H+.044);
  const crown=ring(rim.x,rim.north,rim.south,rim.y-.045);
  const cap=ring(rim.x+.006,rim.north+.006,rim.south-.006,rim.y);
  const exteriorTop=ring(rim.x+.14,rim.north-.14,rim.south+.14,rim.y);
  const flashing=ring(mouth.x+.14,mouth.north-.14,mouth.south+.14,4.34);
  const wellPos=[],wellUv=[];
  for(const [a,b] of [[bottom,lip],[lip,bevel],[bevel,crown],[crown,cap],[cap,exteriorTop],[exteriorTop,flashing]]){
    for(let i=0;i<4;i++){
      const j=(i+1)%4;
      for(const point of [a[i],a[j],b[j],a[i],b[j],b[i]]){
        wellPos.push(...point);wellUv.push((point[0]+point[2])*.58,point[1]*.58);
      }
    }
  }
  const wellGeometry=new T.BufferGeometry();
  wellGeometry.setAttribute("position",new T.Float32BufferAttribute(wellPos,3));wellGeometry.setAttribute("uv",new T.Float32BufferAttribute(wellUv,2));wellGeometry.computeVertexNormals();
  const lightCourt=new T.Mesh(wellGeometry,splay);lightCourt.name="atrium-open-sky-court";root.add(lightCourt);
  // Two continuous dark stone returns enclose the annex. The large gap between
  // them on the north wall frames an off-axis clerestory.
  const cornerZ=wallNorth+arcRadius;
  const eastPath=[[w,d+.06],[w,pitchStart],[w,cornerZ]];
  for(let j=1;j<=16;j++){
    const t=Math.PI*j/32;eastPath.push([w-arcRadius+arcRadius*Math.cos(t),cornerZ-arcRadius*Math.sin(t)]);
  }
  eastPath.push([openingRight,wallNorth]);
  const westPath=[[openingLeft,wallNorth],[-w+arcRadius,wallNorth]];
  for(let j=1;j<=16;j++){
    const t=Math.PI*j/32;westPath.push([-w+arcRadius-arcRadius*Math.sin(t),cornerZ-arcRadius*Math.cos(t)]);
  }
  westPath.push([-w,pitchStart],[-w,westStart]);
  function stoneReturn(path){
    const offsets=[0],tangents=[];
    for(let i=1;i<path.length;i++){
      const dx=path[i][0]-path[i-1][0],dz=path[i][1]-path[i-1][1],len=Math.hypot(dx,dz);
      offsets.push(offsets[i-1]+len);tangents.push([dx/len,dz/len]);
    }
    const northVertex=path.findIndex(q=>Math.abs(q[1]-wallNorth)<.0001);
    const panelOrigin=path[northVertex][0]+offsets[northVertex];
    function band(mat,low,high,name){
      const pos=[],norm=[],uv=[],indices=[];
      for(let i=0;i<path.length;i++){
        const a=tangents[Math.max(0,i-1)],b=tangents[Math.min(i,tangents.length-1)];
        const len=Math.hypot(a[0]+b[0],a[1]+b[1]),nx=(a[1]+b[1])/len,nz=-(a[0]+b[0])/len;
        const top=roofHeight(path[i][1]);const botY=typeof low==="number"?low:low(top),topY=typeof high==="number"?high:high(top);
        for(const h of [botY,topY]){
          pos.push(path[i][0],h,path[i][1]);norm.push(nx,0,nz);uv.push(panelOrigin-offsets[i],h);
        }
        if(i){const k=i*2;indices.push(k-2,k-1,k+1,k-2,k+1,k);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(pos,3));
      geo.setAttribute("normal",new T.Float32BufferAttribute(norm,3));geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
      const mesh=new T.Mesh(geo,mat);mesh.name=name;root.add(mesh);
    }
    band(limestone,-.016,.118,"atrium-mineral-base");
    band(recess,.118,.135,"atrium-wall-reveal");
    band(wallStone,.135,top=>top-.026,"atrium-curved-mineral-wall");
    band(recess,top=>top-.026,top=>top+.010,"atrium-soffit-reveal");
  }
  stoneReturn(eastPath);stoneReturn(westPath);
  const northWall={x:0,z:wallNorth,yaw:0},frontage=openingRight-openingLeft,windowX=(openingRight+openingLeft)/2;
  // A narrow, high window is cut into the solid end wall. Its glazing sits at
  // the exterior end of a half-metre reveal. The wall below it is uninterrupted.
  const exterior=wallNorth-slotDepth,frontZ=wallNorth;
  // Both jambs, the sloping sill and the rising soffit are actual opaque solids.
  // Indoor and outdoor faces have different sill heights, leaving an open light shaft.
  const slotP=[],slotUV=[];
  function slotQuad(a,b,c,e){
    for(const v of [a,b,c,a,c,e]){slotP.push(...v);slotUV.push(v[0],v[1]+.31*v[2]);}
  }
  function cross(z,low,high){
    slotQuad([openingLeft,low,z],[openingRight,low,z],[openingRight,high,z],[openingLeft,high,z]);
  }
  cross(frontZ,0,northSill);cross(frontZ,northHead,northRoof+.02);
  cross(exterior,0,outerSill);cross(exterior,outerHead,northRoof+.02);
  for(const [low,high] of [[northSill,outerSill],[northHead,outerHead]]){
    slotQuad([openingLeft,low,frontZ],[openingRight,low,frontZ],[openingRight,high,exterior],[openingLeft,high,exterior]);
  }
  for(const x of [openingLeft,openingRight]){
    slotQuad([x,northSill,frontZ],[x,northHead,frontZ],[x,outerHead,exterior],[x,outerSill,exterior]);
  }
  const slotGeometry=new T.BufferGeometry();slotGeometry.setAttribute("position",new T.Float32BufferAttribute(slotP,3));
  slotGeometry.setAttribute("uv",new T.Float32BufferAttribute(slotUV,2));slotGeometry.computeVertexNormals();
  const endWall=new T.Mesh(slotGeometry,wallStone);endWall.name="atrium-north-wall-and-reveal";root.add(endWall);
  // The north clerestory is above the occupied zone. At this height the
  // chamfered sill and external shades intercept direct sun but admit diffuse sky.
  box(northWall,limestone,frontage+.055,.11,.69,windowX,northSill-.043,-.23);
  box(northWall,bronze,frontage,.028,.13,windowX,northSill-.104,.027);
  for(let i=0;i<=5;i++){
    const x=openingLeft+(openingRight-openingLeft)*i/5;
    box(northWall,metal,.047,outerHead-outerSill,.087,x,(outerSill+outerHead)/2,-slotDepth+.019);
  }
  for(const y of [5.22,5.62,5.91])box(northWall,metal,frontage-.06,.032,.25,windowX,y,-slotDepth-.065);
  const glassFinish=material(T.MeshBasicMaterial,{transparent:true,color:0x97a8a1,opacity:.10,side:T.DoubleSide,depthWrite:false});
  const glass=new T.Mesh(new T.PlaneGeometry(frontage-.02,outerHead-outerSill),glassFinish);
  glass.position.set(windowX,(outerHead+outerSill)/2,exterior);glass.name="atrium-north-clerestory-glass";root.add(glass);

  // A trabeated opening bears on two broad masonry walls. The contrasting, deep
  // reveal continues into a genuinely walkable secondary bay at the north end.
  for(const b of piers){
    const mat=b.name.includes("reception")?darkVeneer:b.name.includes("inner")?innerStone:portalStone;
    box(world,mat,b.width,b.height,b.depth,b.x,b.height/2,b.z,b.name);
  }
  const beamWidth=w+.54,beamMid=(w-.54)/2;
  box(world,portalStone,beamWidth,H-head+.015,entryDepth,beamMid,(H+head)/2,entryZ-entryDepth/2,"lobby-gallery-stone-lintel");
  const portalFrame=standard({color:0x433d37,metalness:.28,roughness:.44});
  for(const x of [galleryLeft+.026,galleryRight-.026]){
    box(world,portalFrame,.052,head,.31,x,head/2,entryZ-.365);
  }
  box(world,portalFrame,galleryRight-galleryLeft,.050,.31,(galleryRight+galleryLeft)/2,head-.022,entryZ-.365);
  // Slabs stop at the recessed service channel. Light sources and their shields
  // are modelled inside the recess instead of drawing bright marks onto the ceiling.
  const start=entryZ-entryDepth+.006,run=start-wallNorth,mid=(start+wallNorth)/2;
  const slotX=2.72,slotWidth=.175;
  for(const [left,right,name] of [[.41,slotX-slotWidth/2,"lobby-gallery-ceiling"],[slotX+slotWidth/2,w+.015,"lobby-gallery-ceiling-east"]]){
    box(world,galleryDeck,right-left,.19,run,(left+right)/2,3.325,mid,name);
  }
  box(world,portalFrame,slotWidth+.015,.031,run,slotX,3.395,mid);
  box(world,innerStone,4.03,.14,.36,2.97,3.15,midZ,"lobby-gallery-secondary-header");
  const downGeometry=new T.CylinderGeometry(.059,.059,.015,16),lampPositions=[-4.35,midZ-.58,wallNorth+.77];
  for(const [i,z] of lampPositions.entries()){
    const lamp=new T.Mesh(i===0?downGeometry:downGeometry.clone(),warmCut);
    lamp.position.set(slotX,3.30,z);lamp.name="lobby-gallery-downlight";root.add(lamp);
  }
  // Finite projecting wall leaves catch the light down the corridor and produce
  // occluding edges that a visitor passes in sequence over one continuous floor.
  for(const [i,leaf] of galleryLeaves.entries()){
    const finish=[innerStone,darkVeneer,ribOak][i],edgeX=leaf.x+(leaf.x<2 ? 1 : -1)*(leaf.width/2-.011);
    box(world,finish,leaf.width,leaf.height,leaf.depth,leaf.x,leaf.height/2,leaf.z,leaf.name);
    box(world,bronze,.022,3.12,.028,edgeX,1.57,leaf.z+(leaf.depth-.028)/2);
  }
  box(world,darkVeneer,rearWidth,3.24,.09,rearX,1.62,wallNorth+.05,"lobby-gallery-rear-screen");
  const reedCount=27,reedWidth=(rearWidth-.16)/reedCount;
  for(let i=0;i<reedCount;i++){
    const raised=.095+.042*Math.cos(i*.59),x=.56+(i+.5)*reedWidth;
    box(world,i%4===1?portalStone:i%4===3?ribOak:innerStone,reedWidth-.018,3.08,raised,x,1.58,wallNorth+.092+raised/2);
  }
  box(world,metal,rearWidth,.092,.26,rearX,3.18,wallNorth+.16);
  box(world,warmCut,rearWidth-.21,.016,.034,rearX,3.135,wallNorth+.236);

  // At the welcome bay the ashlar datum becomes a dark timber canopy. Wide vertical
  // cuts above it are seen in relief from both the threshold and the reception desk.
  box(world,darkVeneer,w-.37,.28,.40,(-w-.37)/2,2.98,entryZ-.15,"lobby-reception-canopy");
  box(world,bronze,w-.37,.035,.26,(-w-.37)/2,3.125,entryZ-.13);
  const warmPiers=(length,place)=>{
    const widths=[.48,.26,.58,.36,.51,.31],margin=.036;let pos=0;
    for(let i=0;pos<length-.04;i++){
      const span=Math.min(widths[i%widths.length],length-pos);
      const deep=[.108,.070,.148,.086,.134,.072][i%6];
      place(pos+span/2,span-margin,deep,i%6===2?innerStone:i%6===5?bronze:i%2?ribOak:portalStone);
      pos+=span;
    }
  };
  const upperHeight=H-3.02,upperMid=(H+3.02)/2;
  box(world,darkVeneer,w+.19,upperHeight,.10,(-w+.19)/2,upperMid,-4.65);
  warmPiers(w+.17,(offset,span,deep,mat)=>box(world,mat,span,upperHeight-.045,deep,-w+offset,upperMid,-4.59+deep/2));
  box(world,bronze,w+.17,.10,.26,(-w+.17)/2,3.015,-4.49);
  box(world,warmCut,w+.05,.014,.024,(-w+.17)/2,3.045,-4.48);
  warmPiers(6.48,(offset,span,deep,mat)=>box(world,mat,deep,H-3.13,span,-w+.035+deep/2,(H+3.13)/2,-4.57+offset));
  box(world,bronze,.22,.081,6.5,-w+.094,3.105,-1.34);
  box(world,warmCut,.023,.014,6.32,-w+.115,3.136,-1.34);
  // Cabinet-height side niches leave a service route in front of the joinery.
  // The full-depth cheeks and the overhead return are continuous with the side walls.
  for(const b of recesses){
    const span=b.end-b.start,mid=(b.start+b.end)/2,faceX=b.side*(w-.054);
    const label=b.side<0?"lobby-reception-recess":"lobby-reading-recess";
    const skin=new T.BoxGeometry(.10,b.top-.13,span),uv=skin.attributes.uv,pts=skin.attributes.position;
    for(let i=0;i<uv.count;i++)uv.setXY(i,pts.getZ(i)*.62,pts.getY(i)*.26);
    const back=new T.Mesh(skin,b.side<0?darkVeneer:timberVeneer);back.position.set(faceX,(b.top+.13)/2,mid);back.name=label;root.add(back);
    const panels=Math.max(2,Math.round(span/.72));
    for(let i=1;i<panels;i++)box(world,bronze,.018,b.top-.21,.009,faceX-b.side*.056,(b.top+.14)/2,b.start+span*i/panels);
    const innerX=b.side*(w-b.push/2);
    for(const z of [b.start-.085,b.end+.085]){
      box(world,wallStone,b.push+.07,b.top,.17,innerX,b.top/2,z);
      box(world,bronze,.019,b.top-.10,.055,b.side*(w-b.push-.028),(b.top-.10)/2+.05,z);
    }
    box(world,timberVeneer,b.push+.09,.125,span+.34,innerX,b.top+.010,mid);
    box(world,bronze,.025,.045,span+.32,b.side*(w-b.push-.030),b.top+.073,mid);
  }

  // Two ashlar skins, a honed cap and a rounded free end wrap the same solid curve.
  // The nearer partition drops away to reveal the raised ceiling and far end wall.
  const {line,half}=partition,tip=line.at(-1),front=[],back=[];
  function edge(q,nx,nz){
    const top=slabHeight(q.t);
    return {x:q.x+nx*half,z:q.z+nz*half,nx,nz,top};
  }
  for(const q of line){front.push(edge(q,q.nx,q.nz));back.push(edge(q,-q.nx,-q.nz));}
  const nose=[];
  for(let i=1;i<20;i++){
    const t=Math.PI*i/20;
    nose.push(edge(tip,tip.nx*Math.cos(t)+tip.tx*Math.sin(t),tip.nz*Math.cos(t)+tip.tz*Math.sin(t)));
  }
  const outline=[...front,...nose,...back.slice().reverse()],p=[],normal=[],uv=[],indices=[];
  let length=0;
  for(let i=0;i<=outline.length;i++){
    const q=outline[i%outline.length];
    if(i)length+=Math.hypot(q.x-outline[i-1].x,q.z-outline[i-1].z);
    for(const y of [.055,q.top-.050]){p.push(q.x,y,q.z);normal.push(q.nx,0,q.nz);uv.push(length,y);}
    if(i){const k=i*2;indices.push(k-2,k,k+1,k-2,k+1,k-1);}
  }
  const wallGeom=new T.BufferGeometry();wallGeom.setAttribute("position",new T.Float32BufferAttribute(p,3));
  wallGeom.setAttribute("normal",new T.Float32BufferAttribute(normal,3));wallGeom.setAttribute("uv",new T.Float32BufferAttribute(uv,2));wallGeom.setIndex(indices);
  const screen=new T.Mesh(wallGeom,wallStone);screen.name="atrium-curved-partition";root.add(screen);
  const capPos=[],capUv=[];
  function triangle(a,b,c){
    for(const v of [a,b,c]){capPos.push(...v);capUv.push(v[0]*1.1,(v[2]+v[1])*.77);}
  }
  const at=(q,h)=>[q.x,h,q.z];
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    for(const [lowA,lowB,highA,highB] of [[a.top-.050,b.top-.050,a.top,b.top],[-.01,-.01,.055,.055]]){
      triangle(at(a,lowA),at(b,lowB),at(b,highB));triangle(at(a,lowA),at(b,highB),at(a,highA));
    }
  }
  for(let i=1;i<front.length;i++){
    const a=at(front[i-1],front[i-1].top),b=at(front[i],front[i].top),c=at(back[i],back[i].top),e=at(back[i-1],back[i-1].top);
    triangle(a,b,c);triangle(a,c,e);
  }
  const round=[front.at(-1),...nose,back.at(-1)];
  for(let i=1;i<round.length;i++)triangle([tip.x,round[i].top,tip.z],at(round[i-1],round[i-1].top),at(round[i],round[i].top));
  const caps=new T.BufferGeometry();caps.setAttribute("position",new T.Float32BufferAttribute(capPos,3));caps.setAttribute("uv",new T.Float32BufferAttribute(capUv,2));caps.computeVertexNormals();
  const coping=new T.Mesh(caps,limestone);coping.name="atrium-partition-coping";root.add(coping);

  const westWall={x:-w,z:0,yaw:Math.PI/2},southWall={x:0,z:d,yaw:Math.PI};
  function windowBand(wall,left,right,lower,upper,numBays){
    const wide=right-left,mid=(left+right)/2;
    box(wall,limestone,wide+.04,.058,.32,mid,lower-.015,-.12);
    box(wall,metal,wide,.026,.061,mid,lower+.008,-.20);
    box(wall,metal,wide,.035,.068,mid,upper-.016,-.20);
    for(let k=0;k<=numBays;k++){
      const post=left+wide*k/numBays;
      box(wall,metal,.031,upper-lower,.066,post,(upper+lower)/2,-.20);
    }
  }
  function westPanel(start,end,low,high,thickness=.28){
    box(westWall,wallStone,end-start,high-low,thickness,-(start+end)/2,(low+high)/2,-thickness/2);
  }
  // High, deeply set west lights admit a grazing band without turning the hall
  // into a second glazed room. The changing sill depth is evident when walking.
  const westLights=[[westStart+.29,-d+3.28,2.82,3.58],[1.33,westEnd-.34,2.68,3.47]];
  let previous=westStart;
  for(const [start,end,sillHeight,gardenHead] of westLights){
    westPanel(previous,start,0,H+.015,.45);
    const wide=end-start,mid=(start+end)/2;
    westPanel(start,end,0,sillHeight,.52);
    westPanel(start,end,gardenHead,H+.015,.52);
    windowBand(westWall,-end,-start,sillHeight,gardenHead,2);
    box(westWall,limestone,wide+.025,.045,.57,-mid,sillHeight-.008,-.255);
    for(const side of [-1,1])box(westWall,limestone,.042,gardenHead-sillHeight,.51,-mid+side*(wide/2-.013),(gardenHead+sillHeight)/2,-.25);
    gardenBays.push({low:start,high:end,step:wide/2,sill:sillHeight,head:gardenHead});
    previous=end;
  }
  westPanel(previous,d+.07,0,H+.015,.45);

  // The garden canopy opens into the hall across a flush, 4.8 m wide stone walk.
  // The two glazed side lights meet the same structural fascia. Nothing is built
  // around this passage, and there is no separate lintel or door leaf.
  const openHalf=2.40,glassOuter=w-.36,sill=.10,gardenHeadHeight=3.64,southPlate=H+.045;
  box(southWall,wallStone,2*w,southPlate-gardenHeadHeight,.30,0,(southPlate+gardenHeadHeight)/2,-.15);
  for(const side of [-1,1]){
    const width=glassOuter-openHalf,mid=side*(glassOuter+openHalf)/2;
    box(southWall,limestone,width,sill,.31,mid,sill/2,-.155);
    box(southWall,wallStone,w-glassOuter,gardenHeadHeight,.30,side*(w+glassOuter)/2,gardenHeadHeight/2,-.15);
    windowBand(southWall,mid-width/2,mid+width/2,sill,gardenHeadHeight,Math.max(1,Math.round(width/1.65)));
  }
  let reflectionFloor;
  for(const batch of batches.values()) {
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(batch.pos,3));
    geo.setAttribute("normal",new T.Float32BufferAttribute(batch.normal,3));
    geo.setAttribute("uv",new T.Float32BufferAttribute(batch.uv,2));
    geo.setIndex(batch.index);
    const mesh=new T.Mesh(geo,batch.mat);mesh.name=batch.name;root.add(mesh);
    if(batch.mat===stone)reflectionFloor=mesh;
  }
  batches.clear();
  const radius=Math.max(48,3*Math.hypot(w,d));
  const panorama=texture("garden-canopy.webp",true,false);
  const garden=new T.Mesh(new T.SphereGeometry(radius,40,20),
    material(T.MeshBasicMaterial,{map:panorama,color:0xe3e9e7,side:T.BackSide,fog:false}));
  garden.rotation.y=-1.99;root.add(garden);
  const sky=new T.HemisphereLight(0xf5f7ff,0xc6b496,1.40);root.add(sky);
  const sun=new T.DirectionalLight(0xffedcc,1.32);sun.position.set(1.7,10,-2.84);root.add(sun);
  const bounce=new T.DirectionalLight(0xdbe6eb,.52);bounce.position.set(1,3,d);root.add(bounce);
  const deskHits=buildReception(T,root,{texture,materials,stoneMap,stoneNormal});
  const updateWaypoints=buildWaypoints(T,root,doors,{materials,textures,hits,halfDepth:d});
  root.updateMatrixWorld(true);
  return {hits,deskHits,reflectionFloor,floorMaterial:stone,panorama,updateWaypoints,constrainLobbyStep:partition.constrainLobbyStep,lobbyRoute:partition.lobbyRoute,shiftMenu:updateWaypoints.shiftMenu,menuIndex:updateWaypoints.menuIndex,menuPoint:updateWaypoints.menuPoint,dispose(){
    disposed=true;root.removeFromParent();
    root.traverse(node=>node.geometry?.dispose());
    materials.forEach(mat=>mat.dispose());textures.forEach(tex=>tex.dispose());
  }};
}
