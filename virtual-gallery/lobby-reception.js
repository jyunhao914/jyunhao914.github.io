// All sizes are metres. The same two footprints are used to build the furniture,
// its contact with the floor, and the clearance used by the first-person visitor.
export const furnitureObstacles=Object.freeze([
  {x:-3.70,z:-.68,yaw:55*Math.PI/180,width:3.52,depth:.95,radius:.105},
  {x:4.99,z:.94,yaw:-Math.PI/2,width:2.52,depth:.57,radius:.044}
]);

export function buildReception(T,root,{texture,materials,stoneMap,stoneNormal}){
  function finish(settings){
    const m=new T.MeshStandardMaterial(settings);materials.push(m);return m;
  }
  const walnutMap=texture("mount/walnut-color.webp"),ashMap=texture("mount/ash-color.webp");
  const walnut=finish({color:0x6b503d,map:walnutMap,roughness:.52});
  const ash=finish({color:0xa48b6b,map:ashMap,roughness:.55});
  const endGrain=finish({color:0x6c513f,map:walnutMap,roughness:.63});
  const stone=finish({color:0xc7beb2,map:texture("reception-counter-stone.webp"),normalMap:stoneNormal,normalScale:new T.Vector2(.041,.041),roughness:.51});
  stone.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
      vec3 quarry=diffuseColor.rgb/max(vec3(.001),diffuse);
      float tone=dot(quarry,vec3(.22,.70,.08));
      diffuseColor.rgb=diffuse*mix(vec3(.43,.415,.399),vec3(tone),.40);`);
  };
  const footStone=finish({color:0x928879,map:stoneMap,normalMap:stoneNormal,normalScale:new T.Vector2(.12,.12),roughness:.66});
  const deep=finish({color:0x373a34,roughness:.61});
  const brass=finish({color:0x998569,metalness:.36,roughness:.39});
  const device=finish({color:0x3e4545,roughness:.46,metalness:.23});
  const glass=finish({color:0x172e31,emissive:0x081b1f,emissiveIntensity:.29,roughness:.32,metalness:.24});
  const diffuser=finish({color:0xe2cd9e,emissive:0xf1cf91,emissiveIntensity:.70,roughness:.58});
  const pad=finish({color:0x575b50,map:texture("mount/linen-color.webp"),roughness:.89});
  function group(name,shape){
    const item=new T.Group();item.name=name;item.position.set(shape.x,0,shape.z);item.rotation.y=shape.yaw;root.add(item);return item;
  }
  function add(parent,g,m,x,y,z){
    const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  // The veneer is laid in metres, including the returns, so it follows the
  // furniture when the desk is turned toward the visitor.
  function grainUV(g,m){
    if(!m.map)return g;
    const pos=g.getAttribute("position"),norm=g.getAttribute("normal"),uv=g.getAttribute("uv");
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const along=Math.abs(norm.getX(i))>.77 ? z : x;
      if(m===stone)uv.setXY(i,.5+along/3.95,.5+(Math.abs(norm.getY(i))>.62?z:y)/1.20);
      else uv.setXY(i,(along+.42)/1.84,(Math.abs(norm.getY(i))>.62?z:y)/.42);
    }
    return g;
  }
  function block(parent,m,x,y,z,w,h,d){return add(parent,grainUV(new T.BoxGeometry(w,h,d),m),m,x,y,z);}
  function slab(parent,m,x,bottom,z,w,h,d,r,bevel=.004){
    const a=w/2,b=d/2,shape=new T.Shape();
    r=Math.min(r,a-.002,b-.002);
    shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);
    shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);
    shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
    const geom=new T.ExtrudeGeometry(shape,{depth:h-2*bevel,curveSegments:5,bevelEnabled:true,
      bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1});
    geom.rotateX(-Math.PI/2);return add(parent,grainUV(geom,m),m,x,bottom+bevel,z);
  }
  function rod(parent,m,a,b,r){
    const A=new T.Vector3(...a),B=new T.Vector3(...b),span=B.clone().sub(A);
    const pole=add(parent,new T.CylinderGeometry(r,r,span.length(),12),m,0,0,0);
    pole.position.copy(A).lerp(B,.5);pole.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),span.normalize());return pole;
  }
  function floorContact(parent,w,d,opacity){
    const extW=w+.91,extD=d+.91;
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
      uniforms:{outer:{value:new T.Vector2(extW,extD)},halfSize:{value:new T.Vector2(w/2-.045,d/2-.045)},strength:{value:opacity}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform vec2 outer,halfSize;uniform float strength;
        void main(){vec2 q=abs((vUv-.5)*outer)-halfSize;
          float sd=length(max(q,0.))+min(max(q.x,q.y),0.)-.045;
          float alpha=strength*exp(-max(0.,sd)*12.)*(1.-smoothstep(.27,.43,sd));
          gl_FragColor=vec4(.068,.056,.047,alpha);
          #include <colorspace_fragment>
        }`
    });materials.push(mat);
    const sheet=add(parent,new T.PlaneGeometry(extW,extD),mat,0,.005,0);
    sheet.rotation.x=-Math.PI/2;sheet.raycast=()=>{};sheet.renderOrder=2;
  }
  // Batch each piece of furniture by finish to keep draw calls low.
  function batchJoinery(parent){
    parent.updateWorldMatrix(true,true);
    const inverse=parent.matrixWorld.clone().invert(),batches=new Map(),original=[];
    parent.traverse(o=>{
      if(!o.isMesh || o.material.transparent)return;
      const g=o.geometry;g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      if(!batches.has(o.material))batches.set(o.material,{position:[],normal:[],uv:[],indices:[]});
      const b=batches.get(o.material),offset=b.position.length/3;
      for(const key of ["position","normal","uv"])b[key].push(...g.getAttribute(key).array);
      if(g.index)for(const i of g.index.array)b.indices.push(i+offset);
      else for(let i=0;i<g.attributes.position.count;i++)b.indices.push(i+offset);
      original.push(o);
    });
    for(const o of original){o.removeFromParent();o.geometry.dispose();}
    for(const [m,b] of batches){
      const geo=new T.BufferGeometry();
      for(const [key,stride] of [["position",3],["normal",3],["uv",2]])geo.setAttribute(key,new T.Float32BufferAttribute(b[key],stride));
      geo.setIndex(b.indices);geo.computeBoundingSphere();add(parent,geo,m,0,0,0);
    }
  }
  const desk=group("museum-reception-counter",furnitureObstacles[0]);
  desk.scale.x=-1;
  floorContact(desk,3.40,.86,.34);
  // The main counter is 94 cm high. The lower return nearest the entrance
  // shares its stone finish, with free knee space behind the visitor edge.
  slab(desk,deep,-.56,.007,-.015,2.16,.096,.69,.057);
  slab(desk,walnut,-.56,.103,-.014,2.32,.778,.85,.099,.008);
  slab(desk,deep,-.56,.881,0,2.32,.021,.865,.098);
  slab(desk,stone,-.56,.902,0,2.40,.038,.944,.107);
  // The veined front is cut from one slab. The folded return exposes the
  // recessed bronze-toned cabinet below the stone as the visitor walks past.
  const profile=new T.Shape();
  profile.moveTo(-1.746,.923);profile.lineTo(.625,.923);
  profile.lineTo(.625,.543);profile.lineTo(-.07,.613);profile.lineTo(-1.41,.688);
  profile.lineTo(-1.54,.109);profile.lineTo(-1.746,.109);profile.closePath();
  const apron=new T.ExtrudeGeometry(profile,{depth:.046,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,steps:1});
  add(desk,grainUV(apron,stone),stone,0,0,.413);
  const returnProfile=new T.Shape();
  returnProfile.moveTo(-.39,.923);returnProfile.lineTo(.442,.923);returnProfile.lineTo(.442,.109);
  returnProfile.lineTo(.323,.105);returnProfile.lineTo(-.39,.337);returnProfile.closePath();
  const waterfall=new T.ExtrudeGeometry(returnProfile,{depth:.036,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2});
  waterfall.rotateY(-Math.PI/2);add(desk,grainUV(waterfall,stone),stone,-1.708,0,0);
  // Veneer bookmatches meet along narrow shadow joints instead of painted stripes.
  for(const x of [-1.03,-.48,.07])block(desk,endGrain,x,.48,.413,.0028,.735,.0025);
  slab(desk,stone,1.18,.711,.017,1.14,.051,.90,.085,.005);
  slab(desk,walnut,1.63,.036,-.035,.155,.676,.75,.039);
  slab(desk,deep,1.63,.009,-.035,.118,.028,.65,.025);
  block(desk,brass,.99,.697,-.331,.74,.029,.036);
  // Staff terminal and a shielded, low task light are scaled against the joinery.
  slab(desk,device,-.64,.941,-.179,.281,.019,.166,.020);
  rod(desk,device,[-.64,.955,-.179],[-.64,1.107,-.144],.016);
  const terminal=new T.Group();terminal.position.set(-.64,1.211,-.147);terminal.rotation.x=.11;desk.add(terminal);
  slab(terminal,device,0,-.134,0,.426,.258,.034,.013,.003);
  block(terminal,glass,0,.002,-.018,.396,.218,.004);
  block(terminal,device,0,-.128,-.020,.156,.013,.014);
  slab(desk,brass,-1.34,.941,-.158,.120,.011,.087,.015);
  rod(desk,brass,[-1.34,.952,-.16],[-1.34,1.239,-.16],.007);
  rod(desk,brass,[-1.34,1.239,-.16],[-1.22,1.263,-.098],.007);
  const lamp=slab(desk,device,-1.18,1.242,-.083,.148,.024,.071,.020);
  lamp.rotation.y=-.16;
  block(desk,diffuser,-1.18,1.241,-.081,.114,.004,.046);
  // A slim visitor-facing terminal sits on the far edge of the 76 cm return.
  const consoleGroup=new T.Group();consoleGroup.position.set(1.28,.807,-.196);consoleGroup.rotation.x=-.50;desk.add(consoleGroup);
  block(consoleGroup,device,0,0,0,.235,.132,.017);
  block(consoleGroup,glass,0,0,.009,.209,.108,.003);
  block(desk,brass,1.28,.781,-.221,.104,.031,.075);
  batchJoinery(desk);

  // A narrow suspended task light marks the staffed side. Its physical light
  // reaches the work surface; the short falloff ends inside the reception bay.
  const pendant=group("museum-reception-pendant",furnitureObstacles[0]);pendant.scale.x=-1;
  const h=2.71;
  for(const x of [-1.02,.60]){
    block(pendant,device,x,4.083,-.09,.091,.033,.072);
    rod(pendant,brass,[x,4.07,-.09],[x,h+.026,-.09],.0065);
  }
  rod(pendant,brass,[-1.26,h,-.09],[.87,h,-.09],.014);
  for(const [x,length] of [[-.95,.42],[-.22,.60],[.52,.40]]){
    block(pendant,brass,x,h-.018,-.087,length,.039,.059);
    block(pendant,diffuser,x,h-.039,-.084,length-.014,.007,.043);
  }
  batchJoinery(pendant);
  const taskLight=new T.SpotLight(0xffdbaf,15,2.53,.75,.75,2);
  taskLight.position.set(-.25,h-.05,-.08);taskLight.target.position.set(-.25,.83,.02);
  pendant.add(taskLight,taskLight.target);

  const bench=group("museum-lobby-bench",furnitureObstacles[1]);
  floorContact(bench,2.34,.48,.24);
  // A continuous oak apron carries three independent upholstered seat pads.
  // The stone feet stop short of the ends and are set back from the visitor.
  for(const x of [-.81,.81]){
    slab(bench,deep,x,.008,0,.234,.026,.376,.025);
    slab(bench,footStone,x,.034,0,.219,.30,.382,.026);
  }
  slab(bench,ash,0,.334,0,2.52,.081,.57,.051);
  for(const x of [-.817,0,.817])slab(bench,pad,x,.416,.002,.805,.046,.525,.060,.008);
  batchJoinery(bench);
}
