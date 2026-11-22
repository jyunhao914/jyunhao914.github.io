import {cardAspect,makeCardGeometry,makeCardGlass,makeCardFace} from "./lobby-card-surface.js?v=atrium40";

// A compact, three-level fan leaves the middle of the light court unobstructed.
// Distances are metres. Each card follows the same path when the visitor browses.
const slots=[
  {x:-.52,y:1.01,z:-1.91,scale:.48,yaw:.55,roll:.090},
  {x:-.40,y:1.02,z:-1.32,scale:.66,yaw:.28,roll:.048},
  {x:0,y:0,z:0,scale:1,yaw:.035,roll:0},
  {x:.83,y:.53,z:-.81,scale:.75,yaw:-.31,roll:-.045},
  {x:.92,y:.87,z:-1.73,scale:.52,yaw:-.57,roll:-.075}
];
const wrap=(value,count)=>(value%count+count)%count;
function offsetTo(index,current,count){
  return wrap(index-current+count/2,count)-count/2;
}

function receptionGuide(T,root,family,hitMaterial,materials,textures,hits) {
  const group=new T.Group();
  group.name="lobby-reception-guide";
  group.position.set(-2.95,1.37,-.36);
  root.add(group);
  // Three independently tilted glass leaves echo the expanded room cards.
  const leaves=[];
  for(let i=0;i<3;i++){
    const material=makeCardGlass(T),leaf=new T.Mesh(makeCardGeometry(T),material);
    const turn=(i-1)*.27;
    leaf.name="lobby-guide-leaf-"+i;
    leaf.position.set(-1.10+.145*(i-1),.03+.040*Math.abs(i-1),.08*i);
    leaf.scale.set(.54,.75,.48);
    leaf.rotation.set(-.11,turn*1.35,-turn);
    leaf.renderOrder=510+i;group.add(leaf);materials.push(material);leaves.push(material);
  }
  const c=document.createElement("canvas");c.width=650;c.height=174;
  const ctx=c.getContext("2d");
  ctx.font="540 119px "+family;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.lineJoin="round";ctx.lineWidth=7;ctx.strokeStyle="rgba(16,26,30,.72)";
  ctx.strokeText("選擇展廳",325,92,582);
  ctx.fillStyle="#f2f4ec";ctx.fillText("選擇展廳",325,92,582);
  const ink=new T.CanvasTexture(c);ink.colorSpace=T.SRGBColorSpace;ink.anisotropy=4;textures.push(ink);
  const type=new T.MeshBasicMaterial({map:ink,transparent:true,depthWrite:false,toneMapped:false});
  const label=new T.Mesh(new T.PlaneGeometry(2.38,.637),type);
  label.name="lobby-guide-label";label.position.set(.52,0,.18);label.renderOrder=514;
  materials.push(type);group.add(label);
  const hit=new T.Mesh(new T.PlaneGeometry(3.22,1.),hitMaterial);
  hit.name="lobby-menu-trigger";hit.userData.receptionGuide=true;group.add(hit);hits.push(hit);
  const eye=new T.Vector3();
  return (camera,visibility,active,enabled)=>{
    group.visible=visibility>.01;
    hit.userData.pickable=group.visible && enabled && visibility>.18;
    if(!group.visible)return;
    group.rotation.y=Math.atan2(camera.position.x-group.position.x,camera.position.z-group.position.z);
    eye.copy(group.position).applyMatrix4(camera.matrixWorldInverse);
    const px=2*Math.max(.15,-eye.z)*Math.tan(T.MathUtils.degToRad(camera.fov*.5))/Math.max(1,window.innerHeight);
    const size=T.MathUtils.clamp(.275,37*px,47*px);
    group.scale.setScalar(size);
    hit.scale.y=Math.max(1,46*px/size);
    for(const [i,material] of leaves.entries()) {
      material.uniforms.uVisibility.value=visibility*(.80+i*.10);
      material.uniforms.uFocus.value=active?1:.14;
      material.uniforms.uLook.value=.50+i*.28;
    }
    type.opacity=visibility;
    group.updateMatrixWorld(true);
  };
}

export function buildWaypoints(T,root,doors,{materials,textures,hits,halfDepth}){
  const family=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim()||"sans-serif";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const hitMaterial=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});
  materials.push(hitMaterial);
  const guide=receptionGuide(T,root,family,hitMaterial,materials,textures,hits);
  const entries=doors.map((door,index)=>{
    const title=door.title||door.room||"展廳";
    const repeated=doors.some((other,i)=>i!==index&&(other.title||other.room)===title);
    const texture=makeCardFace(T,door,repeated?door.show?.title:"",family);
    textures.push(texture);
    const anchor=new T.Group();anchor.userData.doorIndex=index;anchor.name="lobby-waypoint-"+index;
    const face=new T.Group();anchor.add(face);root.add(anchor);
    const geometry=makeCardGeometry(T),glassMaterial=makeCardGlass(T);
    const inkMaterial=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});
    materials.push(glassMaterial,inkMaterial);
    const glass=new T.Mesh(geometry,glassMaterial),text=new T.Mesh(geometry,inkMaterial);
    glass.name="lobby-waypoint-glass-"+index;text.name="lobby-waypoint-text-"+index;text.position.z=.002;
    face.add(glass,text);
    const hit=new T.Mesh(geometry,hitMaterial);hit.name="lobby-waypoint-hit-"+index;hit.userData.doorIndex=index;
    face.add(hit);hits.push(hit);return {index,anchor,face,glass,text,glassMaterial,inkMaterial,hit,focus:0};
  });
  let target=0,position=0,openness=0;
  const menuIndex=()=>entries.length?wrap(target,entries.length):-1;
  function shiftMenu(direction){
    if(entries.length>1 && direction)target+=Math.sign(direction);
    return menuIndex();
  }
  function menuPoint(index){
    if(!entries[index])return null;
    // A click on a receding card uses its current physical location. A direct
    // directory selection can resolve to the active slot before another frame.
    const entry=entries[index];
    if(entry.hit.userData.pickable)return entry.anchor.position.clone();
    if(index!==menuIndex())return null;
    const portrait=window.innerWidth<window.innerHeight;
    return new T.Vector3(portrait?-1.68:-1.56,1.30,.49);
  }
  function updateWaypoints(camera,highlighted,dt=1/60,expanded=false){
    const portrait=window.innerWidth<window.innerHeight,baseX=portrait?-1.68:-1.56;
    const size=portrait ? .68 : .86,spread=portrait ? .74 : 1;
    const indoor=1-T.MathUtils.smoothstep(camera.position.z,halfDepth-.68,halfDepth);
    const rate=reduced.matches||!indoor?1:1-Math.exp(-10*Math.max(.001,dt));
    const goal=expanded ? 1 : 0;
    openness+=(goal-openness)*rate;
    if(Math.abs(openness-goal)<.002)openness=goal;
    guide(camera,indoor*(1-T.MathUtils.smoothstep(openness,0,.44)),highlighted==="reception",!expanded);
    position+=(target-position)*rate;
    if(Math.abs(position-target)<.001)position=target;
    let moving=position!==target || openness!==goal;
    for(const entry of entries){
      const {index,anchor,face,glass,text,glassMaterial,inkMaterial,hit}=entry;
      const rel=offsetTo(index,position,entries.length),r=Math.min(2,Math.max(-2,rel))+2;
      const lo=Math.min(3,Math.floor(r)),a=slots[lo],b=slots[lo+1],blend=r-lo;
      const sample=key=>a[key]+(b[key]-a[key])*blend;
      const focusTarget=Number(expanded && index===highlighted);
      entry.focus+=(focusTarget-entry.focus)*rate;
      if(Math.abs(focusTarget-entry.focus)<.002)entry.focus=focusTarget;
      else moving=true;
      const focus=entry.focus;
      anchor.position.set(baseX+sample("x")*spread,1.30+sample("y")*(portrait ? .85 : 1)+.038*focus,.49+sample("z"));
      const dx=camera.position.x-anchor.position.x,dz=camera.position.z-anchor.position.z,distance=Math.hypot(dx,dz);
      const facing=Math.atan2(dx,dz),rest=Math.atan2(-anchor.position.x,halfDepth-1.65-anchor.position.z);
      const turn=T.MathUtils.clamp(Math.atan2(Math.sin(rest-facing),Math.cos(rest-facing)),-.55,.55);
      anchor.rotation.y=facing;face.rotation.y=sample("yaw")*(1-focus*.37)+turn;
      face.rotation.z=sample("roll")*(1-focus*.35);
      const h=size*sample("scale");face.scale.set(h*cardAspect,h,h*cardAspect);
      // Fade only at the back of the fan. Invisible cards never intercept a drag.
      const edge=1-T.MathUtils.smoothstep(Math.abs(rel),1,1.49);
      const visible=indoor*edge*T.MathUtils.smoothstep(openness,.12,.96)*T.MathUtils.smoothstep(distance,.38,.94);
      const emphasis=1-.19*Math.min(1,Math.abs(rel));
      glassMaterial.uniforms.uLook.value=Math.sin(facing-rest)+sample("yaw")*.65;
      glassMaterial.uniforms.uVisibility.value=visible*emphasis;
      glassMaterial.uniforms.uFocus.value=focus;
      inkMaterial.opacity=visible*emphasis;
      glass.visible=text.visible=visible>.01;
      hit.userData.pickable=expanded && visible>.18;
      // Composite the transparent ink and glass of each leaf together, back to front.
      const order=500-Math.min(195,Math.round(8*Math.hypot(dx,dz,anchor.position.y-camera.position.y)));
      glass.renderOrder=2*order;text.renderOrder=2*order+1;
      anchor.updateMatrixWorld(true);
    }
    return moving&&indoor>0;
  }
  // Keep the render hook callable for existing interior integrations.
  return Object.assign(updateWaypoints,{shiftMenu,menuIndex,menuPoint});
}
