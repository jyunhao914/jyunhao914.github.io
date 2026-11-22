import {cardAspect,makeCardGeometry,makeCardGlass,makeCardFace} from "./lobby-card-surface.js?v=directory42";

const wrap=(value,count)=>(value%count+count)%count;

export function buildWaypoints(T,root,doors,{materials,textures,hits,halfDepth}){
  const family=getComputedStyle(document.documentElement).getPropertyValue("--gallery-font-family").trim()||"sans-serif";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const hitMaterial=new T.MeshBasicMaterial({visible:false,side:T.DoubleSide});
  materials.push(hitMaterial);
  const entries=doors.map((door,index)=>{
    const title=door.title||door.room||"展廳";
    const repeated=doors.some((other,i)=>i!==index&&(other.title||other.room)===title);
    const texture=makeCardFace(T,door,repeated?door.show?.title:"",family,index);
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
  let target=0,openness=0;
  const menuIndex=()=>entries.length?wrap(target,entries.length):-1;
  function shiftMenu(direction){
    if(entries.length>1 && direction)target+=Math.sign(direction);
    return menuIndex();
  }
  function menuPoint(index){
    if(!entries[index])return null;
    const entry=entries[index];
    if(entry.hit.userData.pickable)return entry.anchor.position.clone();
    if(index!==menuIndex())return null;
    const portrait=window.innerWidth<window.innerHeight;
    return new T.Vector3(portrait?-1.68:-1.56,1.30,.49);
  }
  function updateWaypoints(camera,highlighted,dt=1/60,expanded=false,pressed=null){
    const portrait=window.innerWidth<window.innerHeight,baseX=portrait?-1.68:-1.56;
    const indoor=1-T.MathUtils.smoothstep(camera.position.z,halfDepth-.68,halfDepth);
    const rate=reduced.matches||!indoor?1:1-Math.exp(-10*Math.max(.001,dt));
    const goal=expanded ? 1 : 0;
    openness+=(goal-openness)*rate;
    if(Math.abs(openness-goal)<.002)openness=goal;
    const active=menuIndex(), first=Math.floor(active/3)*3;
    const dx=camera.position.x-baseX,dz=camera.position.z-.49,distance=Math.hypot(dx,dz);
    const viewHeight=root.parent.userData.viewportHeight || window.innerHeight;
    const metrePerPixel=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2))/viewHeight;
    const width=Math.max(1.70,46*metrePerPixel*cardAspect);
    const rowPitch=width/cardAspect*1.18;
    let moving=openness!==goal;
    for(const entry of entries){
      const {index,anchor,face,glass,text,glassMaterial,inkMaterial,hit}=entry;
      const row=index-first;
      const focusTarget=Number(expanded && index===highlighted);
      entry.focus+=(focusTarget-entry.focus)*rate;
      if(Math.abs(focusTarget-entry.focus)<.002)entry.focus=focusTarget;
      else moving=true;
      const focus=entry.focus;
      anchor.position.set(baseX,1.78+(1-row)*rowPitch,.49);
      anchor.rotation.y=Math.atan2(dx,dz);
      const w=width*(index===pressed ? .965 : 1);
      face.scale.set(w,w/cardAspect,w*.22);
      const visible=(row>=0 && row<3 ? indoor : 0)*T.MathUtils.smoothstep(openness,.06,.80)*T.MathUtils.smoothstep(distance,.38,.94);
      const emphasis=index===active || focus>.01 ? 1 : .91;
      glassMaterial.uniforms.uLook.value=focus*.7;
      glassMaterial.uniforms.uVisibility.value=visible*emphasis;
      glassMaterial.uniforms.uFocus.value=Math.max(index===active ? .36 : 0,focus);
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
