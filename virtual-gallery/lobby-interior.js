import {buildWaypoints} from "./lobby-waypoints.js?v=atrium40";

// One sampled centreline is shared by the masonry, the contact shadow, and walking.
function partitionPlan(w,d){
  const pts=[[-w-.20,-d+.68],[-3.86,-d+.63],[-1.64,-d-.01],[.54,-d-.91]],line=[];
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
      x=movedX;z=movedZ;
    }
    return {x,z};
  }
  function clearPath(a,b){
    const dx=b.x-a.x,dz=b.z-a.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
    for(let i=0;i<=steps;i++){
      const x=a.x+i/steps*dx,z=a.z+i/steps*dz;
      if(withinBounds(x,z)&&nearest(x,z).distance<clear-.001)return false;
    }
    return true;
  }
  const guides=[];
  for(const i of [6,18,30,40]){
    const q=line[i];
    for(const sign of [-1,1])guides.push({x:q.x+sign*.68*q.nx,z:q.z+sign*.68*q.nz});
  }
  guides.push({x:tip.x+.80*tip.tx,z:tip.z+.80*tip.tz});
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
  const wallStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.12,.12),color:0x75685c,roughness:.85,side:T.DoubleSide});
  const stone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.13,.13),color:0x80705c,roughness:.72});
  const limestone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.25,.25),color:0x665c50,roughness:.84,side:T.DoubleSide});
  const soffit=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.10,.10),color:0x545956,roughness:.93});
  const splay=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.085,.085),color:0x97816a,roughness:.88,side:T.DoubleSide});
  const metal=standard({color:0x706653,metalness:.32,roughness:.57});
  const recess=standard({color:0x403e39,roughness:.92,side:T.DoubleSide});
  const partition=partitionPlan(w,d),gardenBays=[];
  const openingLeft=1.01,openingRight=3.81,northSill=4.27,northHead=5.29;
  const slotDepth=.48,outerSill=5.18,outerHead=6.18;
  const slabHeight=t=>3.96-.79*t*t*(3-2*t);
  const partitionOcclusion=`float partitionVisibility(vec3 o,vec3 r,float limit){
    if(o.y>4.05 && r.y>=0.)return 1.;
    float light=1.;
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
    return light;}`;
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
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
          float scan=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(vec3(scan),diffuseColor.rgb,.57);
          vec2 metres=vec2(1.64,.92),tile=lobbyPoint.xz/metres;
          tile.x+=.42*mod(floor(tile.y),2.);
          vec2 edge=min(fract(tile),1.-fract(tile))*metres;
          float gap=min(edge.x,edge.y),aa=max(.0007,fwidth(gap));
          float variation=fract(sin(dot(floor(tile),vec2(8.71,75.33)))*914.8);
          diffuseColor.rgb*=(.962+.060*variation)*(1.-.24*(1.-smoothstep(.0011-aa,.0027+aa,gap)));`);
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
        float dapple=mix(.53,1.,smoothstep(.05,.91,leaves));
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
        float gardenFactor=2.86/(2.86+garden2)*max(0.,dot(nWorld,gardenDir))*max(0.,-gardenDir.z);
        // Test both ends of the rising north reveal, then the lowest point of
        // the opaque pitched roof between a receiver and the slot.
        float northSun=max(0.,(p.z-(${wallNorth.toFixed(3)}))/.284);
        float insideY=p.y+northSun,outsideY=insideY+${slotDepth.toFixed(3)}/.284;
        float insideX=p.x+.17*northSun,outsideX=insideX+.17*${slotDepth.toFixed(3)}/.284;
        vec2 slotClear=min(vec2(min(insideX,outsideX)-${openingLeft.toFixed(3)},${openingRight.toFixed(3)}-max(insideX,outsideX)),
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
        ${mat===soffit?`vec2 fromCourt=max(vec2(0.),abs(p.xz-lowerCenter)-lowerHalf);
          float returnGlow=exp(-length(fromCourt)*.65);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.72,.67,.55)*(.06+.46*returnGlow);`:""}
        ${mat===splay?`float exposure=smoothstep(${H.toFixed(4)},${rim.y.toFixed(4)},p.y);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.66,.72,.79)*(.29+.71*exposure);
          reflectedLight.directDiffuse+=diffuseColor.rgb*vec3(.62,.49,.33)*sunFacing*(.34+.66*exposure);`:""}`);
    };
    mat.customProgramCacheKey=()=>"central-court-"+mat.uuid;
  }
  for(const mat of [wallStone,stone,limestone,soffit,splay,oak])daylight(mat);
  function box(wall,mat,width,height,depth,x,y,z) {
    if(Math.min(width,height,depth)<=0)return;
    let batch=batches.get(mat);
    if(!batch){batch={pos:[],normal:[],uv:[],index:[]};batches.set(mat,batch);}
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
      if(mat===oak)batch.uv.push((Math.abs(ny)>.5 ? Z : v)*.64,X*.26);
      else batch.uv.push(across/(metreUv ? 1 : cutStone ? .86 : 1.96),(Math.abs(ny)>.5 ? Z : v)/(metreUv ? 1 : cutStone ? .64 : 1.96));
    }
    for(const index of geo.index.array) batch.index.push(first+index);
    geo.dispose();
  }
  box(world,stone,2*w+.08,.16,d+.12-wallNorth,0,-.08,(d+.04+wallNorth-.08)/2);
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
  const spacing=.91,beamCount=Math.floor((w-.24)/spacing);
  for(let i=-beamCount;i<=beamCount;i++){
    const x=i*spacing;
    timberRun(x,wallNorth-.06,pitchStart,.195,.279,i*.387);
    if(Math.abs(x)<mouth.x+.11){
      timberRun(x,pitchStart,mouth.north-.060,.195,.19,i*.387);
      timberRun(x,mouth.south+.06,d+.045,.195,.19,i*.387);
    }else timberRun(x,pitchStart,d+.045,.195,.19,i*.387);
  }
  // The headers carry the cut joists along the edge of the well. No timber crosses its opening.
  box(world,oak,2*mouth.x+.34,.20,.125,0,H-.094,mouth.south+.052);
  box(world,oak,2*mouth.x+.34,.271,.15,0,H-.130,mouth.north-.067);
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
  for(const side of [-1,1]){
    box(northWall,metal,.025,outerHead-outerSill,.041,windowX+side*(frontage/2-.011),(outerSill+outerHead)/2,-slotDepth+.003);
  }
  const glassFinish=material(T.MeshBasicMaterial,{transparent:true,color:0x91a8a5,opacity:.065,side:T.DoubleSide,depthWrite:false});
  const glass=new T.Mesh(new T.PlaneGeometry(frontage-.02,outerHead-outerSill),glassFinish);
  glass.position.set(windowX,(outerHead+outerSill)/2,exterior);glass.name="atrium-north-clerestory-glass";root.add(glass);

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
  const openHalf=2.40,glassOuter=w-.36,sill=.10,head=3.64,southPlate=H+.045;
  box(southWall,wallStone,2*w,southPlate-head,.30,0,(southPlate+head)/2,-.15);
  for(const side of [-1,1]){
    const width=glassOuter-openHalf,mid=side*(glassOuter+openHalf)/2;
    box(southWall,limestone,width,sill,.31,mid,sill/2,-.155);
    box(southWall,wallStone,w-glassOuter,head,.30,side*(w+glassOuter)/2,head/2,-.15);
    windowBand(southWall,mid-width/2,mid+width/2,sill,head,Math.max(1,Math.round(width/1.65)));
  }
  for(const [mat,batch] of batches) {
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(batch.pos,3));
    geo.setAttribute("normal",new T.Float32BufferAttribute(batch.normal,3));
    geo.setAttribute("uv",new T.Float32BufferAttribute(batch.uv,2));
    geo.setIndex(batch.index);root.add(new T.Mesh(geo,mat));
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
  const updateWaypoints=buildWaypoints(T,root,doors,{materials,textures,hits,halfDepth:d});
  root.updateMatrixWorld(true);
  return {hits,panorama,updateWaypoints,constrainLobbyStep:partition.constrainLobbyStep,lobbyRoute:partition.lobbyRoute,shiftMenu:updateWaypoints.shiftMenu,menuIndex:updateWaypoints.menuIndex,menuPoint:updateWaypoints.menuPoint,dispose(){
    disposed=true;root.removeFromParent();
    root.traverse(node=>node.geometry?.dispose());
    materials.forEach(mat=>mat.dispose());textures.forEach(tex=>tex.dispose());
  }};
}
