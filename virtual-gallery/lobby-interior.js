// Coordinates are metres. A door's local +z points into the public circulation space.
export function buildLobby(T, scene, doors, {halfWidth,halfDepth,invalidate}={}) {
  const w=halfWidth ?? 5.7, d=halfDepth ?? 5.9, H=4.72;
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
  const stoneMap=texture("stone-color.webp"),stoneNormal=texture("stone-normal.webp",false);
  const oak=texture("mount/oak-color.webp"), oakNormals=texture("mount/oak-normal.webp",false);
  const plaster=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.18,.18),color:0xf6f2e7,roughness:.94});
  const stone=standard({map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.23,.23),color:0xe1e5df,roughness:.68});
  const limestone=standard({map:plasterMap,normalMap:plasterNormal,normalScale:new T.Vector2(.17,.17),color:0xb7b1a0,roughness:.81});
  const ceiling=standard({map:plasterMap,color:0xf2eee4,emissive:0x3b3933,emissiveIntensity:.70,roughness:.90});
  const timber=standard({map:oak,normalMap:oakNormals,normalScale:new T.Vector2(.23,.23),color:0xb99a72,roughness:.62});
  const smoked=standard({map:oak,color:0x796247,roughness:.58});
  const bronze=standard({color:0x62564a,metalness:.44,roughness:.47});
  const metal=standard({color:0x36403e,metalness:.36,roughness:.58});
  const recess=standard({color:0x4f5550,roughness:.91});
  const lens=standard({color:0xe0d5b9,emissive:0xffe5ae,emissiveIntensity:.42,roughness:.75});
  const plate=standard({color:0x394348,metalness:.32,roughness:.55});
  const tones=[0xa1b0a4,0x9caeb9,0xb8a795,0xb9b6a1];
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
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.93,.79)*wash*.64;`);
    };
  }
  // The long clerestory is a real opening. Project its diffuse sunlight and mullion shadow into
  // the room; broad penumbrae avoid both shimmering and a shadow-map pass while walking.
  function daylight(mat) {
    mat.onBeforeCompile=shader=>{
      shader.vertexShader="varying vec3 lobbyPoint;\n"+shader.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nlobbyPoint=(modelMatrix*vec4(transformed,1.)).xyz;");
      shader.fragmentShader="varying vec3 lobbyPoint;\n"+shader.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
        vec3 p=lobbyPoint;
        float left=p.x+${w.toFixed(4)},back=p.z+${d.toFixed(4)};
        float across=left/.99, windowY=p.y+across*.73,windowZ=p.z-across*.46;
        float light=smoothstep(3.28,3.52,windowY)*(1.-smoothstep(4.28,4.51,windowY));
        float inside=(1.-smoothstep(${(d-.40).toFixed(4)},${(d-.13).toFixed(4)},abs(windowZ)))*smoothstep(-.03,.13,left);
        float mullion=abs(fract((windowZ+${(d-.27).toFixed(4)})/${bay.toFixed(4)}+.5)-.5)*${bay.toFixed(4)};
        light*=inside*(.32+.68*smoothstep(.012,.11,mullion));
        vec3 wallNormal=inverseTransformDirection(normal,viewMatrix);
        float facing=max(0.,dot(wallNormal,normalize(vec3(-1.,.73,-.46))));
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(1.,.88,.70)*light*facing*1.05;
        float wallEdge=min(${w.toFixed(4)}-abs(p.x),${d.toFixed(4)}-abs(p.z));
        float cavity=abs(wallNormal.y)>.55 ? wallEdge : min(p.y,${H.toFixed(3)}-p.y);
        reflectedLight.indirectDiffuse*=mix(.71,1.,smoothstep(-.01,.39,cavity));`);
    };
    if(mat===stone){
      const lighting=mat.onBeforeCompile;
      mat.onBeforeCompile=shader=>{
        lighting(shader);
        shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
          float limestoneGray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(vec3(limestoneGray),diffuseColor.rgb,.40);`);
      };
    }
    mat.customProgramCacheKey=()=>"lobby-window-"+(mat===stone?"stone-":"")+w+"-"+d;
  }
  for(const mat of [plaster,stone,limestone,ceiling,timber])daylight(mat);
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
      if(mat===timber || mat===smoked) {
        const cross=Math.abs(nx)>.5 ? n : u;
        batch.uv.push((vertical ? v : cross)/2.65,(vertical ? cross : Math.abs(ny)>.5 ? n : v)/.255);
      } else {
        const across=Math.abs(nx*c+nz*s)>.5 ? Z : X;
        const period=mat===stone ? 2.42 : 1.96;
        batch.uv.push(across/period,(Math.abs(ny)>.5 ? Z : v)/period);
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
    sides[side].push({door,index,x,width:door.width ?? 2.15,height:door.height ?? 2.8});
  });
  box(world,stone,2*w+.03,.16,2*d+.03,0,-.08,0);
  box(world,ceiling,2*w+.2,.22,2*d+.2,0,H+.11,0);
  const beamCount=Math.max(4,Math.round(2*d/1.74));
  for(let i=0;i<=beamCount;i++){
    const z=-d+.19+(2*d-.38)*i/beamCount;
    box(world,timber,2*w-.22,.22,.105,0,H-.11,z);
    // Brushed aluminium channel and the warm recessed diffuser contained within it.
    if(i%2===1){
      box(world,metal,2*w-1.36,.022,.069,0,H-.018,z+.13);
      box(world,lens,2*w-1.43,.010,.036,0,H-.034,z+.13);
    }
  }
  function wallSection(wall,left,right,top) {
    const wide=right-left,mid=(left+right)/2;
    if(wide<=0)return;
    box(wall,plaster,wide,top,.30,mid,top/2,-.15);
    box(wall,limestone,wide,.49,.038,mid,.255,.010);
    box(wall,bronze,wide,.012,.022,mid,.512,.014);
    box(wall,recess,wide,.030,.032,mid,.021,.019);
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
  const family=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim() || "sans-serif";
  const hitMat=material(T.MeshBasicMaterial,{visible:false});
  function portal(wall,item) {
    const {index,x,width:opening,height:h,door}=item, hw=opening/2, passage=1.25;
    const group=new T.Group();
    group.position.set(door.x,0,door.z);group.rotation.y=door.yaw;root.add(group);
    // The opening remains clear until the visitor crosses the threshold. Facing, lining and
    // back return sit on different planes, making the passage legible from a grazing angle.
    for(const sign of [-1,1]){
      box(wall,smoked,.145,h+.14,.17,x+sign*(hw+.073),h/2+.062,.045,true);
      box(wall,bronze,.019,h+.042,.028,x+sign*(hw+.018),h/2+.018,.136,true);
      box(wall,smoked,.084,h,passage+.135,x+sign*(hw+.031),h/2,(-passage+.135)/2,true);
    }
    box(wall,smoked,opening+.29,.145,.17,x,h+.073,.045);
    box(wall,bronze,opening+.06,.018,.029,x,h+.023,.136);
    box(wall,smoked,opening+.026,.10,passage+.135,x,h+.038,(-passage+.135)/2);
    box(wall,stone,opening,.12,passage+.08,x,-.059,-passage/2-.025);
    box(wall,bronze,opening,.008,.035,x,.003,.032);
    const accent=plasterTones[index%plasterTones.length];
    // Beyond the timber reveal, the antechamber opens up on both sides. Floor, ceiling and
    // four solid returns meet; the garden never peeks through the recessed passage.
    const far=3.96, insideW=opening+.68, roomH=h+.33, run=far-passage;
    const mid=-(far+passage)/2;
    box(wall,stone,insideW+.22,.14,run+.14,x,-.069,mid);
    box(wall,ceiling,insideW+.22,.12,run+.18,x,roomH+.060,mid);
    box(wall,accent,insideW+.22,roomH+.10,.15,x,(roomH+.10)/2,-far);
    for(const sign of [-1,1]){
      box(wall,plaster,.15,roomH,run+.18,x+sign*(insideW/2+.075),roomH/2,mid);
      box(wall,limestone,.044,.19,run+.08,x+sign*(insideW/2-.014),.095,mid);
      box(wall,smoked,(insideW-opening)/2+.09,roomH,.12,x+sign*((opening+insideW)/4+.041),roomH/2,-passage-.02,true);
      box(wall,bronze,.068,.022,run-.40,x+sign*opening*.31,roomH-.014,mid);
      box(wall,lens,.041,.009,run-.49,x+sign*opening*.31,roomH-.030,mid);
    }
    box(wall,plaster,opening,roomH-h+.02,.12,x,(roomH+h)/2,-passage-.02);
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
    const signW=opening+.10,signH=.53,sy=h+.45;
    box(wall,plate,signW,signH,.047,x,sy,.039);
    const label=document.createElement("canvas");label.width=960;label.height=222;
    const ctx=label.getContext("2d");
    ctx.fillStyle="#374449";ctx.fillRect(0,0,label.width,label.height);
    ctx.fillStyle="#fbf6e9";ctx.textAlign="center";ctx.textBaseline="middle";
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
    const sign=new T.Mesh(new T.PlaneGeometry(signW-.018,signH-.012),material(T.MeshBasicMaterial,{map:labelTexture}));
    sign.name="lobby-door-sign-"+index;sign.userData.doorIndex=index;
    sign.position.set(0,sy,.064);group.add(sign);hits.push(sign);
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
      const lower=.55,upper=3.64,jamb=.48;
      wallSection(wall,-span,-span+jamb,H);wallSection(wall,span-jamb,span,H);
      box(wall,plaster,2*(span-jamb),lower,.34,0,lower/2,-.17);
      box(wall,plaster,2*(span-jamb),H-upper,.34,0,(H+upper)/2,-.17);
      windowBand(wall,-span+jamb,span-jamb,lower,upper,Math.round((2*span-2*jamb)/1.65));
      return;
    }
    const lower=clerestory ? 3.40 : H;
    let cursor=-span;
    for(const item of list){
      const l=item.x-item.width/2,r=item.x+item.width/2;
      wallSection(wall,cursor,l,lower);
      box(wall,plaster,r-l,lower-item.height,.30,item.x,(lower+item.height)/2,-.15);
      portal(wall,item);cursor=r;
    }
    wallSection(wall,cursor,span,lower);
    if(clerestory){
      const upper=4.38;
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
  const garden=new T.Mesh(new T.SphereGeometry(radius,40,20),
    material(T.MeshBasicMaterial,{map:texture("woodland.webp",true,false),color:0xe3e9e7,side:T.BackSide,fog:false}));
  garden.rotation.y=-.48;root.add(garden);
  const sky=new T.HemisphereLight(0xf5f7ff,0xc6b496,1.40);root.add(sky);
  const sun=new T.DirectionalLight(0xffedcc,1.32);sun.position.set(-w,7,2);root.add(sun);
  const bounce=new T.DirectionalLight(0xdbe6eb,.52);bounce.position.set(1,3,d);root.add(bounce);
  root.updateMatrixWorld(true);
  return {hits,dispose(){
    disposed=true;root.removeFromParent();
    root.traverse(node=>node.geometry?.dispose());
    materials.forEach(mat=>mat.dispose());textures.forEach(tex=>tex.dispose());
  }};
}
