// All profiles are drawn from the finished floor. At ordinary walking and eye heights
// every intermediate reveal stays outside the controller's clear rectangular passage.
export function portalDesign(door,width,height) {
  const q=width/2, h=height;
  const names=[door.room,door.title,door.show?.title].filter(Boolean);
  let kind="standard";
  for(const name of names){
    if(/長卷|手卷|橫卷/.test(name))kind="handscroll";
    else if(/水墨/.test(name))kind="ink";
    else if(/書法|翰墨/.test(name))kind="calligraphy";
    else if(/映像|影像|放映/.test(name))kind="projection";
    else if(/主展廳|主廳/.test(name))kind="main";
    if(kind!=="standard")break;
  }
  let r=q+.035;
  let path=[[-r,0],[-r,h+.025],[r,h+.025],[r,0]];
  const design={kind,signX:0,signY:h+.42,signZ:.075,signW:width+.08,signH:.50,
    signBackground:"#344246",signText:"#fff8e9",lining:"oak",end:3.85,roomHeight:h+.34};
  if(kind==="ink"){
    r=q+.17;const spring=h-.34,rise=.90;
    path=[[-r,0]];
    for(let i=0;i<=40;i++){const t=Math.PI*i/40;path.push([-r*Math.cos(t),spring+rise*Math.sin(t)]);}
    path.push([r,0]);
    Object.assign(design,{lining:"paleStone",signY:h+1.05,signText:"#293a33",signBackground:null,roomHeight:h+.8,end:3.48});
  }else if(kind==="calligraphy"){
    Object.assign(design,{lining:"charred",signY:h+.23,signZ:.321,signW:width+.25,signH:.46,
      signBackground:null,signText:"#fcf2da",end:3.72});
  }else if(kind==="main"){
    r=q+.115;
    path=[[-r,0],[-r,h+.58],[r*.17,h+.58],[r,h+.095],[r,0]];
    Object.assign(design,{lining:"chalk",signY:h+1.16,signBackground:null,signText:"#29363b",end:4.05,roomHeight:h+.76});
  }else if(kind==="projection"){
    r=q+.22;
    path=[[-r,0],[-r,h-.26],[-r+.28,h+.18],[r-.28,h+.18],[r,h-.26],[r,0]];
    Object.assign(design,{lining:"felt",signY:h+.49,signZ:.19,signText:"#efe6cd",signBackground:"#252e35",end:3.43});
  }else if(kind==="handscroll"){
    r=q+.025;
    path=[[-r,0],[-r,h+.025],[-r*.46,h+.025],[-r*.46,h+.14],[r*.28,h+.14],[r*.28,h+.25],[r,h+.25],[r,0]];
    Object.assign(design,{lining:"oak",signY:h+.58,signZ:.521,signBackground:null,signText:"#293630",end:4.28,roomHeight:h+.56});
  }
  const roughHalf=r+(kind==="main" ? .25 : kind==="ink" ? .18 : .16);
  const roughHeight=Math.max(...path.map(p=>p[1]))+.16;
  return {...design,path,roughHalf,roughHeight};
}

// Miter parallel offsets at changes of profile so deep returns remain continuous around
// spring points, acute lintels and the folds of the long-scroll canopy.
function offsetCurve(path,offset) {
  const normals=[];
  for(let i=1;i<path.length;i++){
    const dx=path[i][0]-path[i-1][0],dy=path[i][1]-path[i-1][1],l=Math.hypot(dx,dy);
    normals.push([-dy/l,dx/l]);
  }
  return path.map(([x,y],i)=>{
    const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)];
    const den=1+a[0]*b[0]+a[1]*b[1];
    return [x+offset*(a[0]+b[0])/den,y+offset*(a[1]+b[1])/den];
  });
}

export function portalShell(T,group,design,item,mats,beam) {
  const {path,roughHalf,roughHeight,kind}=design,{width,height:h}=item,q=width/2;
  const batches=new Map();
  const loop=(offset,depth)=>offsetCurve(path,offset).map(([x,y])=>[x,y,depth]);
  function strip(mat,A,B) {
    let data=batches.get(mat);
    if(!data){data={p:[],uv:[]};batches.set(mat,data);}
    for(let i=1;i<A.length;i++){
      const corners=[A[i-1],A[i],B[i],B[i-1]];
      const dz=Math.abs(A[i][2]-B[i][2]);
      const side=Math.abs(A[i][0]-A[i-1][0])<Math.abs(A[i][1]-A[i-1][1]);
      for(const j of [0,1,2,0,2,3]){
        const [x,y,z]=corners[j];data.p.push(x,y,z);
        if(mat===mats.plaster){
          const across=Math.abs(Math.sin(item.door.yaw))>.5 ? item.door.z-x*Math.sin(item.door.yaw) : item.door.x+x*Math.cos(item.door.yaw);
          data.uv.push(across/1.96,y/1.96);
        }else if(mat===mats.oak || mat===mats.charred)data.uv.push((side?y:x)/2.65,(dz>.07?z:side?x:y)/.255);
        else if(mat===mats.paleStone || mat===mats.chalk)data.uv.push((side && dz>.07?z:x)/.70,(side || dz<.07?y:z)/.52);
        else data.uv.push((side && dz>.07?z:x)/1.37,(side || dz<.07?y:z)/1.37);
      }
    }
  }
  function profile(mat,section) {
    for(let i=1;i<section.length;i++)strip(mat,loop(...section[i-1]),loop(...section[i]));
  }
  const outer=path.map(([x],i)=>[roughHalf*x/Math.abs(path[0][0]),(i===0 || i===path.length-1)?0:roughHeight,0]);
  const behind=outer.map(([x,y])=>[x,y,-.30]);
  strip(mats.plaster,loop(.034,.002),outer);
  strip(mats.plaster,behind,loop(.034,-.30));
  const liner=mats[design.lining];
  if(kind==="ink"){
    // Honed limestone is turned continuously through the arch, with a shadow rebate at the spring.
    profile(liner,[[.058,-1.29],[0,-.71],[0,.020],[.012,.063],[.034,.084],[.128,.084],[.153,.044],[.153,-.018]]);
    profile(mats.bronze,[[.142,-.010],[.142,.023],[.153,.023],[.153,-.017]]);
    beam(mats.basalt,width+.21,.012,.31,0,.006,.03);
  }else if(kind==="calligraphy"){
    profile(liner,[[.018,-1.27],[.010,.09],[.042,.14],[.10,.14],[.10,-.02]]);
    beam(mats.charred,width+.63,.41,.45,0,h+.212,.076);
    beam(mats.oak,width+.83,.082,.56,0,h+.456,.066);
    for(const side of [-1,1]){
      beam(mats.charred,.16,h+.26,.27,side*(q+.125),(h+.26)/2,.04,true);
      beam(mats.basalt,.204,.25,.30,side*(q+.125),.125,.037);
    }
    // A lit paper screen and spaced vertical oak battens flank the timber joint.
    beam(mats.paper,.37,h-.30,.042,-q-.354,(h+.25)/2,.03);
    for(let i=0;i<6;i++)beam(mats.oak,.030,h-.30,.081,-q-.505+i*.059,(h+.25)/2,.079,true);
    beam(mats.charred,.40,.052,.099,-q-.354,.25,.083);
    beam(mats.charred,.40,.052,.099,-q-.354,h+.018,.083);
  }else if(kind==="main"){
    // Sloping cut through a stepped masonry mass; its broad splay continues into the room.
    profile(mats.chalk,[[.006,-1.28],[.006,-.43],[.175,.26],[.195,.274],[.278,.274],[.28,-.034]]);
    profile(mats.bronze,[[.014,-.48],[.014,-.31],[.027,-.30],[.027,-.48]]);
    beam(mats.chalk,.23,h+.65,.33,-q-.289,(h+.65)/2,.086);
    beam(mats.basalt,width+.27,.014,.65,0,.007,-.13);
  }else if(kind==="projection"){
    profile(liner,[[.032,-1.30],[.032,.076],[.180,.076],[.180,-.02]]);
    for(const depth of [.15,-.23,-.64,-1.03]){
      profile(mats.metal,[[.030,depth-.065],[0,depth-.026],[0,depth],[.10,depth+.023],[.112,depth],[.112,depth-.065]]);
    }
    beam(mats.basalt,width+.20,.012,1.53,0,.006,-.56);
    for(const side of [-1,1]){
      beam(mats.bronze,.023,.015,.92,side*(q-.035),.009,-.43);
      beam(mats.aisle,.010,.006,.87,side*(q-.035),.018,-.43);
    }
  }else if(kind==="handscroll"){
    profile(mats.oak,[[.035,-1.28],[.035,.19],[.08,.23],[.16,.23],[.16,-.018]]);
    // Three overlapping eaves follow the turns of the stepped lintel; their projecting ends
    // expose both the soffit and edge of each board as the visitor walks alongside.
    const levels=[[-q*.57,.99,.06,.55],[-.01,width*.76,.19,.69],[q*.53,1.10,.30,.82]];
    for(const [x,span,level,deep] of levels){
      beam(mats.oak,span,.14,deep,x,h+level+.14,.07);
      beam(mats.bronze,span+.06,.026,deep+.035,x,h+level+.221,.07);
    }
    beam(mats.oak,width+.55,.36,.54,0,h+.575,.246);
    for(const side of [-1,1])for(const depth of [-.04,-.44,-.84]){
      beam(mats.oak,.095,h+.05,.092,side*(q+.083),(h+.05)/2,depth,true);
    }
    beam(mats.oak,width,.012,1.29,0,.006,-.53);
    for(const z of [-.90,-.55,-.21,.09])beam(mats.bronze,width,.006,.006,0,.015,z);
  }else{
    profile(liner,[[.015,-1.28],[.015,.058],[.043,.09],[.114,.09],[.114,-.02]]);
  }
  let n=0;
  for(const [mat,data] of batches){
    const geom=new T.BufferGeometry();
    geom.setAttribute("position",new T.Float32BufferAttribute(data.p,3));
    geom.setAttribute("uv",new T.Float32BufferAttribute(data.uv,2));geom.computeVertexNormals();
    const mesh=new T.Mesh(geom,mat);mesh.name="lobby-shell-"+kind+"-"+n++;
    group.add(mesh);
  }
}
