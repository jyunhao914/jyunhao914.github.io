import {portalDesign,portalShell} from "./lobby-portal-styles.js?v=portal36";

// Coordinates are metres. A door's local +z points into the public circulation space.
export function buildLobby(T, scene, doors, {halfWidth,halfDepth,invalidate}={}) {
  const w=halfWidth ?? 5.7, d=halfDepth ?? 5.9, H=4.91;
  const root=new T.Group(), hits=[], textures=[], materials=[], batches=new Map();
  root.name="lobby-interior";
  scene.add(root);
  let disposed=false;
  const loading=new T.TextureLoader();
  const world={x:0,z:0,yaw:0};
  const westSpan=2*d-.54, westBays=Math.max(2,Math.round(westSpan/1.54));
  const bay=westSpan/westBays;
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
  const oak=texture("mount/oak-color.webp"), oakNormals=texture("mount/oak-normal.webp",false);
  const plaster=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.18,.18),color:0xf6f2e7,roughness:.94});
  const stone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.26,.26),color:0xdce1df,roughness:.78});
  const limestone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.27,.27),color:0xc1bdae,roughness:.85});
  const ceiling=standard({map:plasterMap,color:0xf2eee4,emissive:0x3b3933,emissiveIntensity:.70,roughness:.90});
  const timber=standard({map:oak,normalMap:oakNormals,normalScale:new T.Vector2(.23,.23),color:0xb99a72,roughness:.62});
  const smoked=standard({map:oak,color:0x796247,roughness:.58});
  const bronze=standard({color:0x62564a,metalness:.44,roughness:.47});
  const metal=standard({color:0x36403e,metalness:.36,roughness:.58});
  const recess=standard({color:0x4f5550,roughness:.91});
  const lens=standard({color:0xe0d5b9,emissive:0xffe5ae,emissiveIntensity:.42,roughness:.75});
  const plate=standard({color:0x394348,metalness:.32,roughness:.55});
  const basalt=standard({map:plasterMap,normalMap:stoneNormal,normalScale:new T.Vector2(.24,.24),color:0x68736c,roughness:.73});
  const paleStone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.31,.29),color:0xc9d1c9,roughness:.84});
  const chalk=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.34,.31),color:0xd4c7ac,roughness:.87});
  const charred=standard({map:oak,normalMap:oakNormals,normalScale:new T.Vector2(.28,.17),color:0x544737,roughness:.72});
  const felt=standard({map:texture("mount/linen-color.webp"),color:0x505c65,emissive:0x363e48,emissiveIntensity:.24,roughness:.98});
  const paper=standard({map:plasterMap,color:0xddd0a8,emissive:0xb89759,emissiveIntensity:.35,roughness:.92});
  const aisle=standard({color:0xeee3ca,emissive:0xe6c681,emissiveIntensity:.64,roughness:.73});
  const finishes={plaster,paleStone,basalt,chalk,charred,felt,paper,aisle,oak:timber,metal,bronze};
  const tones=[0x9fab98,0x919c8a,0xc0b7a2,0x657385,0xb4a991];
  const plasterTones=tones.map(color=>standard({map:plasterMap,color,roughness:.92}));
  for(const mat of plasterTones) {
    mat.onBeforeCompile=shader=>{
      shader.vertexShader="attribute vec2 washUv;varying vec2 chamberUv;\n"+shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nchamberUv=washUv;");
      shader.fragmentShader="varying vec2 chamberUv;\n"+shader.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        float washWidth=.18+.39*(1.-chamberUv.y);
        float wash=1.-smoothstep(washWidth*.26,washWidth,abs(chamberUv.x-.50));
        float wallBounce=.80+.20*smoothstep(.02,.2,chamberUv.y);
        reflectedLight.indirectDiffuse*=wallBounce;
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.00,.79,.56)*wash*.96;`);
    };
  }
  // The long clerestory is a real opening. Project its diffuse sunlight and mullion shadow into
  // the room; broad penumbrae avoid both shimmering and a shadow-map pass while walking.
  const gardenBays=[];
  function daylight(mat) {
    mat.onBeforeCompile=shader=>{
      const sideGlass=gardenBays.map(gardenBay=>`{
        float lowWindow=smoothstep(.52,.75,windowY)*(1.-smoothstep(2.92,3.15,windowY));
        float inOpening=smoothstep(${gardenBay.low.toFixed(3)}-.13,${gardenBay.low.toFixed(3)}+.12,windowZ)*
          (1.-smoothstep(${gardenBay.high.toFixed(3)}-.12,${gardenBay.high.toFixed(3)}+.13,windowZ));
        float post=abs(fract((windowZ-(${gardenBay.low.toFixed(3)}))/${gardenBay.step.toFixed(3)}+.5)-.5)*${gardenBay.step.toFixed(3)};
        light+=lowWindow*inOpening*smoothstep(-.03,.12,left)*(.36+.64*smoothstep(.016,.12,post));}`).join("\n");
      shader.vertexShader="varying vec3 lobbyPoint;\n"+shader.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nlobbyPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
      shader.fragmentShader="varying vec3 lobbyPoint;\n"+shader.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        vec3 p=lobbyPoint;
        float left=p.x+${w.toFixed(4)};
        float across=left/.99, windowY=p.y+across*.73,windowZ=p.z-across*.46;
        float light=smoothstep(3.49,3.72,windowY)*(1.-smoothstep(4.31,4.61,windowY));
        float inside=(1.-smoothstep(${(d-.40).toFixed(4)},${(d-.13).toFixed(4)},abs(windowZ)))*smoothstep(-.03,.13,left);
        float mullion=abs(fract((windowZ+${(d-.27).toFixed(4)})/${bay.toFixed(4)}+.5)-.5)*${bay.toFixed(4)};
        light*=inside*(.32+.68*smoothstep(.012,.11,mullion));
        ${sideGlass}
        vec3 wallNormal=inverseTransformDirection(normal,viewMatrix);
        float facing=max(0.,dot(wallNormal,normalize(vec3(-1.,.73,-.46))));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.88,.70)*light*facing*1.32;
        float wallEdge=min(${w.toFixed(4)}-abs(p.x),${d.toFixed(4)}-abs(p.z));
        float cavity=abs(wallNormal.y)>.55 ? wallEdge : min(p.y,${H.toFixed(3)}-p.y);
        reflectedLight.indirectDiffuse*=mix(.69,1.,smoothstep(-.01,.35,cavity));`);
      if([plaster,ceiling].includes(mat)){
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
          "#include <map_fragment>\ndiffuseColor.rgb=mix(diffuse,diffuseColor.rgb,.29);");
      }
    };
    if(mat===stone){
      const lighting=mat.onBeforeCompile;
      mat.onBeforeCompile=shader=>{
        lighting(shader);
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
          float limestoneGray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(vec3(limestoneGray),diffuseColor.rgb,.67);
          vec2 naturalSize=vec2(1.38,.82);
          vec2 metric=lobbyPoint.xz/naturalSize;
          metric.x+=.5*mod(floor(metric.y),2.);
          vec2 distanceToJoint=abs(fract(metric+.5)-.5)*naturalSize;
          float narrow=min(distanceToJoint.x,distanceToJoint.y);
          float aa=max(.0007,fwidth(narrow));
          float joint=1.-smoothstep(.0012-aa,.0026+aa,narrow);
          float vein=fract(sin(dot(floor(metric),vec2(9.13,75.49)))*618.93);
          diffuseColor.rgb*=(.972+.035*vein)*(1.-.34*joint);`);
      };
    }
    mat.customProgramCacheKey=()=>"lobby-window-"+(mat===stone?"stone":[plaster,ceiling].includes(mat)?"smooth":"grain")+w+"-"+d+"-"+gardenBays.map(b=>b.low).join(",");
  }
  for(const mat of [plaster,stone,limestone,ceiling,timber,basalt,paleStone,chalk,charred])daylight(mat);
  // Batch the static sandstone, joinery and metalwork by finish. Wood UVs follow the cut,
  // while plaster and floor UVs follow the room continuously across adjoining pieces.
  function box(wall,mat,width,height,depth,x,y,z,vertical=false) {
    if(Math.min(width,height,depth)<=0)return;
    let batch=batches.get(mat);
    if(!batch){batch={pos:[],normal:[],uv:[],index:[]};batches.set(mat,batch);}
    const geo=new T.BoxGeometry(width,height,depth);
    const {position,normal,uv}=geo.attributes;
    if(plasterTones.includes(mat)){
      batch.wash ??= [];
      for(let i=0;i<uv.count;i++)batch.wash.push(uv.getX(i),uv.getY(i));
    }
    const c=Math.cos(wall.yaw),s=Math.sin(wall.yaw),first=batch.pos.length/3;
    for(let i=0;i<position.count;i++) {
      const u=position.getX(i)+x,v=position.getY(i)+y,n=position.getZ(i)+z;
      const X=wall.x+u*c+n*s,Z=wall.z-u*s+n*c;
      const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
      batch.pos.push(X,v,Z);batch.normal.push(nx*c+nz*s,ny,-nx*s+nz*c);
      if(mat===timber || mat===smoked || mat===charred) {
        const cross=Math.abs(nx)>.5 ? n : u;
        batch.uv.push((vertical ? v : cross)/2.65,(vertical ? cross : Math.abs(ny)>.5 ? n : v)/.255);
      } else {
        const across=Math.abs(nx*c+nz*s)>.5 ? Z : X;
        const cutStone=mat.map===stoneMap;
        batch.uv.push(across/(cutStone ? .70 : 1.96),(Math.abs(ny)>.5 ? Z : v)/(cutStone ? .52 : 1.96));
      }
    }
    for(const index of geo.index.array) batch.index.push(first+index);
    geo.dispose();
  }
  const walls=[
    {x:0,z:-d,yaw:0,half:w},{x:-w,z:0,yaw:Math.PI/2,half:d},
    {x:0,z:d,yaw:Math.PI,half:w},{x:w,z:0,yaw:-Math.PI/2,half:d}
  ];
  const sides=walls.map(()=>[]);
  doors.forEach((door,index)=>{
    const side=walls.reduce((best,wall,i)=>Math.cos(door.yaw-wall.yaw)>Math.cos(door.yaw-walls[best].yaw)?i:best,0);
    const wall=walls[side],x=(door.x-wall.x)*Math.cos(wall.yaw)-(door.z-wall.z)*Math.sin(wall.yaw);
    const width=door.width ?? 2.15,height=door.height ?? 2.8;
    sides[side].push({door,index,x,width,height,design:portalDesign(door,width,height)});
  });
  box(world,stone,2*w+.03,.16,2*d+.03,0,-.08,0);
  // Three longitudinal concrete vaults collect sky through their crown slots. The paired
  // matte reflector wings hang beneath each slot, clear of the wall and the clerestory.
  const vaultFinish=standard({map:plasterMap,color:0xe8e6db,roughness:.91,emissive:0x8b8f8c,emissiveIntensity:.24,vertexColors:true});
  const reflector=standard({color:0xd8dbd6,metalness:.22,roughness:.54,emissive:0xa1a6a0,emissiveIntensity:.19,side:T.DoubleSide});
  const daylightGlass=standard({color:0xf3f5f1,emissive:0xe3ecef,emissiveIntensity:.9,roughness:.72});
  vaultFinish.onBeforeCompile=shader=>{
    shader.vertexShader="attribute float ridge;varying float roofRidge;varying float roofZ;\n"+shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nroofRidge=ridge;roofZ=position.z;");
    shader.fragmentShader="varying float roofRidge;varying float roofZ;\n"+shader.fragmentShader
      .replace("#include <map_fragment>","#include <map_fragment>\ndiffuseColor.rgb=mix(diffuse,diffuseColor.rgb,.19);float edge=abs(fract(roofZ/2.64+.50)-.50)*2.64;float aa=max(.0008,fwidth(edge));diffuseColor.rgb*=.90+.10*smoothstep(.001-aa,.003+aa,edge);")
      .replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        float reflectedSky=.16+1.19*exp(-pow(roofRidge*2.55,1.48));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.70,.88,1.07)*reflectedSky;`);
  };
  const roofPieces={p:[],uv:[],normals:[],tones:[],ridge:[]};
  const nVaults=3,halfBay=w/nVaults, spring=4.14,rise=.72;
  for(let k=0;k<nVaults;k++){
    const center=-w+halfBay*(2*k+1);
    for(const side of [-1,1]){
      let last;
      for(let j=0;j<=36;j++){
        const theta=side*(.032+(Math.PI/2-.032)*j/36);
        const dx=halfBay*Math.sin(theta),y=spring+rise*Math.cos(theta);
        const magnitude=Math.hypot(rise*Math.sin(theta),halfBay*Math.cos(theta));
        const node={x:center+dx,y,nx:-rise*Math.sin(theta)/magnitude,ny:-halfBay*Math.cos(theta)/magnitude,
          tint:.80+.20*Math.cos(theta),ridge:Math.abs(Math.sin(theta))};
        if(last){
          const L=side===1?last:node,R=side===1?node:last;
          for(const [pt,z] of [[L,-d-.08],[R,-d-.08],[R,d+.08],[L,-d-.08],[R,d+.08],[L,d+.08]]){
            roofPieces.p.push(pt.x,pt.y,z);roofPieces.uv.push(pt.x/2.33,z/2.33);
            roofPieces.normals.push(pt.nx,pt.ny,0);roofPieces.tones.push(pt.tint,pt.tint,pt.tint);roofPieces.ridge.push(pt.ridge);
          }
        }
        last=node;
      }
      const wing=new T.Mesh(new T.BoxGeometry(.22,.029,2*d-.58),reflector);
      wing.position.set(center+side*.115,H-.22,0);wing.rotation.z=-side*.19;
      wing.name="lobby-skylight-reflector";root.add(wing);
    }
    box(world,daylightGlass,.15,.055,2*d+.04,center,H-.03,0);
    for(let z=-d+.34;z<d;z+=2.45)box(world,metal,.018,.19,.018,center,H-.13,z);
  }
  const roofGeom=new T.BufferGeometry();
  for(const [attr,arr,n] of [["position",roofPieces.p,3],["normal",roofPieces.normals,3],["uv",roofPieces.uv,2],["color",roofPieces.tones,3]])
    roofGeom.setAttribute(attr,new T.Float32BufferAttribute(arr,n));
  roofGeom.setAttribute("ridge",new T.Float32BufferAttribute(roofPieces.ridge,1));
  const shell=new T.Mesh(roofGeom,vaultFinish);shell.name="lobby-daylight-vaults";root.add(shell);
  function wallSection(wall,left,right,top) {
    const wide=right-left,mid=(left+right)/2;
    if(wide<=0)return;
    box(wall,plaster,wide,top,.30,mid,top/2,-.15);
    box(wall,recess,wide,.095,.032,mid,.0475,.018);
    box(wall,limestone,wide,.24,.050,mid,.171,.014);
  }
  function windowBand(wall,left,right,lower,upper,numBays) {
    const wide=right-left,mid=(left+right)/2;
    box(wall,limestone,wide+.08,.085,.38,mid,lower-.02,-.10);
    box(wall,metal,wide+.03,.046,.102,mid,lower+.025,-.205);
    box(wall,metal,wide+.03,.055,.102,mid,upper-.026,-.205);
    for(let k=0;k<=numBays;k++){
      const post=left+wide*k/numBays;
      box(wall,metal,.046,upper-lower,.11,post,(upper+lower)/2,-.205);
    }
  }
  // Wall and floor are separate solids. Soft occlusion at the deep return and directional
  // shadows from its two feet anchor the portal, independent of the camera position.
  function thresholdContact(group,item) {
    const extent=item.design.roughHalf+.65,yaw=item.door.yaw;
    const opening=item.design.path[0][0]*-1;
    const geo=new T.PlaneGeometry(2*extent,2.15);
    geo.rotateX(-Math.PI/2);geo.translate(0,.010,-.27);
    const direction=new T.Vector2(Math.cos(yaw)-.46*Math.sin(yaw),Math.sin(yaw)+.46*Math.cos(yaw)).normalize();
    const mat=material(T.ShaderMaterial,{transparent:true,depthWrite:false,uniforms:{
      halfOpening:{value:opening}, extent:{value:extent}, shadowDirection:{value:direction}},
      vertexShader:`varying vec2 f;void main(){f=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 f;uniform float halfOpening,extent;uniform vec2 shadowDirection;
        float segmentDistance(vec2 p,vec2 start,vec2 span){
          return length(p-start-span*clamp(dot(p-start,span)/dot(span,span),0.,1.));
        }
        void main(){
          float sides=smoothstep(halfOpening-.49,halfOpening+.02,abs(f.x));
          float recess=(1.-smoothstep(-.78,.18,f.y))*(.10+.15*sides);
          float shadow=0.;
          for(int i=0;i<2;i++){
            vec2 foot=vec2((float(i)*2.-1.)*(halfOpening+.052),.04);
            float distance=segmentDistance(f,foot,shadowDirection*.39);
            shadow=max(shadow,(1.-smoothstep(.018,.22,distance))*.18);
          }
          float fade=(1.-smoothstep(extent-.31,extent,abs(f.x)))*smoothstep(-1.30,-.91,f.y)*(1.-smoothstep(.47,.77,f.y));
          gl_FragColor=vec4(.042,.049,.045,fade*(recess+shadow));
          #include <colorspace_fragment>
        }`});
    const mesh=new T.Mesh(geo,mat);mesh.name="lobby-threshold-shadow-"+item.design.kind;mesh.renderOrder=1;
    mesh.raycast=()=>{};group.add(mesh);
  }
  const family=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim() || "sans-serif";
  const hitMat=material(T.MeshBasicMaterial,{visible:false});
  function portal(wall,item) {
    const {index,x,width:opening,height:h,door,design}=item,hw=opening/2,passage=1.25;
    const group=new T.Group();
    group.name="lobby-portal-"+design.kind+"-"+index;group.userData.portalKind=design.kind;
    group.userData.doorIndex=index;
    group.position.set(door.x,0,door.z);group.rotation.y=door.yaw;root.add(group);
    const beam=(mat,width,height,depth,offset,y,z,vertical)=>box(wall,mat,width,height,depth,x+offset,y,z,vertical);
    portalShell(T,group,design,item,finishes,beam);
    thresholdContact(group,item);
    box(wall,stone,2*design.roughHalf,.12,passage+.08,x,-.059,-passage/2-.025);
    const tone={ink:0,calligraphy:1,main:2,projection:3,handscroll:4,standard:2}[design.kind];
    const accent=plasterTones[tone];
    // Beyond the timber reveal, the antechamber opens up on both sides. Floor, ceiling and
    // four solid returns meet; the garden never peeks through the recessed passage.
    const far=design.end, insideW=Math.max(opening+.68,2*design.roughHalf+.06),roomH=design.roomHeight,run=far-passage;
    const mid=-(far+passage)/2;
    box(wall,stone,insideW+.22,.14,run+.14,x,-.069,mid);
    box(wall,ceiling,insideW+.22,.12,run+.18,x,roomH+.060,mid);
    box(wall,accent,insideW+.22,roomH+.10,.15,x,(roomH+.10)/2,-far);
    for(const sign of [-1,1]){
      box(wall,plaster,.15,roomH,run+.18,x+sign*(insideW/2+.075),roomH/2,mid);
      box(wall,limestone,.044,.19,run+.08,x+sign*(insideW/2-.014),.095,mid);
      const throat=2*design.roughHalf;
      box(wall,finishes[design.lining],(insideW-throat)/2+.10,roomH,.12,x+sign*((throat+insideW)/4+.045),roomH/2,-passage-.035,true);
      box(wall,bronze,.068,.022,run-.40,x+sign*opening*.31,roomH-.014,mid);
      box(wall,lens,.041,.009,run-.49,x+sign*opening*.31,roomH-.030,mid);
    }
    const apertureHeight=design.roughHeight;
    box(wall,plaster,2*design.roughHalf,roomH-apertureHeight+.03,.12,x,(roomH+apertureHeight)/2,-passage-.035);
    box(wall,limestone,insideW,.19,.047,x,.095,-far+.088);
    const cover=door.cover;
    if(cover?.src && cover.width>0 && cover.height>0){
      const fit=Math.min(insideW*.74/cover.width,1.53/cover.height);
      const pw=fit*cover.width,ph=fit*cover.height,cy=1.48;
      const display=new T.Group();
      display.visible=false;
      group.add(display);
      const image=loading.load(new URL(cover.src,import.meta.url).href,()=>{
        if(disposed)return;
        display.visible=true;
        invalidate?.();
      });
      image.colorSpace=T.SRGBColorSpace;
      textures.push(image);
      const support=new T.Mesh(new T.BoxGeometry(pw+.075,ph+.075,.058),smoked);
      support.position.set(0,cy,-far+.125);display.add(support);
      const picture=new T.Mesh(new T.PlaneGeometry(pw,ph),
        material(T.MeshStandardMaterial,{map:image,emissiveMap:image,emissive:0xffffff,emissiveIntensity:.20,roughness:.91}));
      picture.name="lobby-room-art-"+index;
      picture.position.set(0,cy,-far+.156);display.add(picture);
    }
    const {signW,signH,signY:sy,signZ,signBackground}=design;
    if(signBackground)box(wall,plate,signW,signH,.040,x,sy,signZ-.023);
    const label=document.createElement("canvas");label.width=960;label.height=222;
    const ctx=label.getContext("2d");
    if(signBackground){ctx.fillStyle=signBackground;ctx.fillRect(0,0,label.width,label.height);}
    ctx.fillStyle=design.signText;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="700 110px "+family;
    const title=String(door.title || "");
    function fitLine(context,text,available) {
      if(context.measureText(text).width<=available)return text;
      let fitted="";
      for(const glyph of text){
        if(context.measureText(fitted+glyph+"…").width>available)break;
        fitted+=glyph;
      }
      return fitted+"…";
    }
    ctx.fillText(fitLine(ctx,title,label.width-50),label.width/2,label.height/2);
    const labelTexture=new T.CanvasTexture(label);
    labelTexture.colorSpace=T.SRGBColorSpace;textures.push(labelTexture);
    const sign=new T.Mesh(new T.PlaneGeometry(signW-.018,signH-.012),material(T.MeshBasicMaterial,{map:labelTexture,transparent:!signBackground,alphaTest:.1}));
    sign.name="lobby-door-sign-"+index;sign.userData.doorIndex=index;
    sign.position.set(design.signX,sy,signZ);group.add(sign);hits.push(sign);
    if(door.show?.title && door.show.title!==title && doors.some((other,i)=>i!==index && other.title===title)){
      const card=document.createElement("canvas");card.width=512;card.height=108;
      const caption=card.getContext("2d");
      caption.fillStyle="#e5e1d6";caption.fillRect(0,0,card.width,card.height);
      caption.fillStyle="#2b3434";caption.font="600 43px "+family;
      caption.textBaseline="middle";
      caption.fillText(fitLine(caption,String(door.show.title),card.width-28),14,card.height/2);
      const map=new T.CanvasTexture(card);map.colorSpace=T.SRGBColorSpace;textures.push(map);
      const labelMesh=new T.Mesh(new T.PlaneGeometry(.76,.16),material(T.MeshBasicMaterial,{map}));
      labelMesh.position.set(hw+.56,1.53,.035);labelMesh.userData.doorIndex=index;
      labelMesh.name="lobby-show-sign-"+index;group.add(labelMesh);hits.push(labelMesh);
    }
    const hit=new T.Mesh(new T.PlaneGeometry(opening,h),hitMat);
    hit.name="lobby-door-hit-"+index;hit.userData.doorIndex=index;
    hit.position.set(0,h/2,.004);group.add(hit);hits.push(hit);
  }
  walls.forEach((wall,i)=>{
    const span=wall.half,list=sides[i].sort((a,b)=>a.x-b.x),clerestory=i===1;
    if(i===2 && !list.length){
      const lower=.55,upper=3.64,halfOpening=1.20,doorHead=3.10,southPlate=3.86;
      for(const side of [-1,1]){
        const from=halfOpening+.19,to=span-.36,windowWidth=to-from,mid=side*(from+to)/2;
        wallSection(wall,side===1?to:-span,side===1?span:-to,southPlate);
        wallSection(wall,side===1?halfOpening:-from,side===1?from:-halfOpening,southPlate);
        box(wall,plaster,windowWidth,lower,.34,mid,lower/2,-.17);
        box(wall,plaster,windowWidth,southPlate-upper,.34,mid,(southPlate+upper)/2,-.17);
        windowBand(wall,mid-windowWidth/2,mid+windowWidth/2,lower,upper,Math.max(1,Math.round(windowWidth/1.65)));
      }
      box(wall,plaster,2*halfOpening,southPlate-doorHead,.30,0,(southPlate+doorHead)/2,-.15);
      // The park and the lobby meet at floor level. Open leaves are stacked on the sides;
      // no sill, opaque wall, pane or crossbar enters the 2.40 by 3.10 metre door opening.
      const entry=new T.Group();entry.name="lobby-south-entrance";
      entry.position.set(0,0,d);entry.rotation.y=Math.PI;root.add(entry);
      for(const side of [-1,1]){
        const jamb=new T.Mesh(new T.BoxGeometry(.070,doorHead,.22),bronze);
        jamb.position.set(side*(halfOpening+.035),doorHead/2,-.10);entry.add(jamb);
        box(wall,metal,.046,doorHead-.08,.055,side*(halfOpening+.047),(doorHead-.08)/2,-.71);
        box(wall,metal,.042,.055,.80,side*(halfOpening+.047),doorHead-.095,-.39);
      }
      box(wall,bronze,2*halfOpening+.14,.077,.22,0,doorHead+.0385,-.10);
      return;
    }
    const lower=clerestory ? 3.61 : H;
    function solidSection(left,right) {
      if(!clerestory || (left>-span && right<span) || right-left<2.21){wallSection(wall,left,right,lower);return;}
      const start=left+.34,end=right-.39,wide=end-start,mid=(start+end)/2;
      wallSection(wall,left,start,lower);wallSection(wall,end,right,lower);
      box(wall,limestone,wide,.59,.48,mid,.295,-.24);
      box(wall,plaster,wide,lower-3.02,.42,mid,(3.02+lower)/2,-.21);
      box(wall,paleStone,wide+.11,.11,.64,mid,.587,-.18);
      for(const side of [-1,1])box(wall,smoked,.045,2.42,.39,mid+side*(wide/2-.022),1.81,-.19,true);
      const bays=Math.max(1,Math.round(wide/1.55));
      windowBand(wall,start,end,.64,3.02,bays);
      // Outside the glazing the stone terrace runs under a garden eave. All the depth is
      // on the courtyard side of the circulation wall.
      box(wall,basalt,wide+.08,.12,1.39,mid,.28,-.90);
      box(wall,timber,wide+.08,.125,.82,mid,3.15,-.69);
      gardenBays.push({low:-end,high:-start,step:wide/bays});
    }
    let cursor=-span;
    for(const item of list){
      const l=item.x-item.design.roughHalf,r=item.x+item.design.roughHalf;
      solidSection(cursor,l);
      box(wall,plaster,r-l,lower-item.design.roughHeight,.30,item.x,(lower+item.design.roughHeight)/2,-.15);
      portal(wall,item);cursor=r;
    }
    solidSection(cursor,span);
    if(clerestory){
      const upper=4.46;
      box(wall,plaster,2*span,H-upper,.33,0,(H+upper)/2,-.165);
      for(const sign of [-1,1])box(wall,plaster,.27,upper-lower,.33,sign*(span-.135),(upper+lower)/2,-.165);
      windowBand(wall,-span+.27,span-.27,lower,upper,westBays);
    }
  });
  for(const [mat,batch] of batches) {
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(batch.pos,3));
    geo.setAttribute("normal",new T.Float32BufferAttribute(batch.normal,3));
    geo.setAttribute("uv",new T.Float32BufferAttribute(batch.uv,2));
    if(batch.wash)geo.setAttribute("washUv",new T.Float32BufferAttribute(batch.wash,2));
    geo.setIndex(batch.index);root.add(new T.Mesh(geo,mat));
  }
  batches.clear();
  const radius=Math.max(48,3*Math.hypot(w,d));
  const panorama=texture("garden-panorama.webp",true,false);
  const garden=new T.Mesh(new T.SphereGeometry(radius,40,20),
    material(T.MeshBasicMaterial,{map:panorama,color:0xe3e9e7,side:T.BackSide,fog:false}));
  garden.rotation.y=-.48;root.add(garden);
  const sky=new T.HemisphereLight(0xf5f7ff,0xc6b496,1.40);root.add(sky);
  const sun=new T.DirectionalLight(0xffedcc,1.32);sun.position.set(-8,5.84,-3.68);root.add(sun);
  const bounce=new T.DirectionalLight(0xdbe6eb,.52);bounce.position.set(1,3,d);root.add(bounce);
  root.updateMatrixWorld(true);
  return {hits,panorama,dispose(){
    disposed=true;root.removeFromParent();
    root.traverse(node=>node.geometry?.dispose());
    materials.forEach(mat=>mat.dispose());textures.forEach(tex=>tex.dispose());
  }};
}
