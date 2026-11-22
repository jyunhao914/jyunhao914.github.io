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

export function buildWaypoints(T,root,doors,{materials,textures,hits,halfDepth}){
  const family=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim()||"sans-serif";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const hitMaterial=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});
  materials.push(hitMaterial);
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
  let target=0,position=0;
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
    return new T.Vector3(portrait?-.24:-1.62,1.19,.30);
  }
  function updateWaypoints(camera,highlighted,dt=1/60){
    const portrait=window.innerWidth<window.innerHeight,baseX=portrait?-.24:-1.62;
    const size=portrait ? .68 : .86,spread=portrait ? .74 : 1;
    const indoor=1-T.MathUtils.smoothstep(camera.position.z,halfDepth-.68,halfDepth);
    const rate=reduced.matches||!indoor?1:1-Math.exp(-10*Math.max(.001,dt));
    position+=(target-position)*rate;
    if(Math.abs(position-target)<.001)position=target;
    let moving=position!==target;
    for(const entry of entries){
      const {index,anchor,face,glass,text,glassMaterial,inkMaterial,hit}=entry;
      const rel=offsetTo(index,position,entries.length),r=Math.min(2,Math.max(-2,rel))+2;
      const lo=Math.min(3,Math.floor(r)),a=slots[lo],b=slots[lo+1],blend=r-lo;
      const sample=key=>a[key]+(b[key]-a[key])*blend;
      const focusTarget=Number(index===highlighted);
      entry.focus+=(focusTarget-entry.focus)*rate;
      if(Math.abs(focusTarget-entry.focus)<.002)entry.focus=focusTarget;
      else moving=true;
      const focus=entry.focus;
      anchor.position.set(baseX+sample("x")*spread,1.19+sample("y")*(portrait ? .85 : 1)+.038*focus,.30+sample("z"));
      const dx=camera.position.x-anchor.position.x,dz=camera.position.z-anchor.position.z,distance=Math.hypot(dx,dz);
      const facing=Math.atan2(dx,dz),rest=Math.atan2(-anchor.position.x,halfDepth-1.65-anchor.position.z);
      const turn=T.MathUtils.clamp(Math.atan2(Math.sin(rest-facing),Math.cos(rest-facing)),-.55,.55);
      anchor.rotation.y=facing;face.rotation.y=sample("yaw")*(1-focus*.37)+turn;
      face.rotation.z=sample("roll")*(1-focus*.35);
      const h=size*sample("scale");face.scale.set(h*cardAspect,h,h*cardAspect);
      // Fade only at the back of the fan. Invisible cards never intercept a drag.
      const edge=1-T.MathUtils.smoothstep(Math.abs(rel),1,1.49);
      const visible=indoor*edge*T.MathUtils.smoothstep(distance,.38,.94);
      const emphasis=1-.19*Math.min(1,Math.abs(rel));
      glassMaterial.uniforms.uLook.value=Math.sin(facing-rest)+sample("yaw")*.65;
      glassMaterial.uniforms.uVisibility.value=visible*emphasis;
      glassMaterial.uniforms.uFocus.value=focus;
      inkMaterial.opacity=visible*emphasis;
      glass.visible=text.visible=visible>.01;
      hit.userData.pickable=visible>.18;
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
