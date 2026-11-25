// Coordinates describe the irregular cut edges of fired slabs, in metres.
function outline(T,start,segments){
  const path=new T.Shape();
  path.moveTo(...start);
  for(const segment of segments){
    if(segment.length===2)path.lineTo(...segment);
    else path.bezierCurveTo(...segment);
  }
  path.closePath();
  return path;
}

function finishes(T,materials,normalMap,map){
  function clay(color){
    const m=new T.MeshStandardMaterial({color,map,normalMap,normalScale:new T.Vector2(.50,.50),roughness:.88});
    materials.push(m);
    return m;
  }
  const shadow=new T.MeshBasicMaterial({color:0x302b24,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
  materials.push(shadow);
  return {chalk:clay(0xc5b8a1),shale:clay(0x494846),smoke:clay(0x827d71),shadow};
}

function slab(T,group,path,finish,shadow,{depth=.056,lift=.048,bend=.045}={}){
  const geo=new T.ExtrudeGeometry(path,{depth,bevelEnabled:true,bevelSize:.009,
    bevelThickness:.009,bevelSegments:3,steps:1,curveSegments:22});
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);
    p.setZ(i,p.getZ(i)+bend*(.52*Math.sin(2.1*x+.85*y)+.48*Math.cos(3.7*y-.52*x)));
  }
  geo.computeVertexNormals();
  const piece=new T.Mesh(geo,finish);
  piece.position.z=lift;group.add(piece);
  const cast=new T.Mesh(new T.ShapeGeometry(path,20),shadow);
  cast.position.set(.024+lift*.15,-.032-lift*.22,.006);group.add(cast);
}

export function mountReceptionRelief(T,root,materials,plasterNormal,plasterMap){
  const group=new T.Group();
  group.name="reception-fired-clay-relief";
  group.position.set(-2.67,1.90,-4.530);root.add(group);
  const {chalk,shale,smoke,shadow}=finishes(T,materials,plasterNormal,plasterMap);
  const cut=(start,segments)=>outline(T,start,segments);
  // A single chalk-coloured slab folds back around a deep undercut. The long
  // opening exposes the timber support wall between the two lips.
  const shell=cut([-1.22,.49],[
    [-.76,.56,-.47,.52,-.21,.535],[.13,.54,.64,.40,.85,.29],
    [.77,.17,.49,.16,.27,.13],[-.09,.11,-.35,.02,-.49,-.15],
    [-.67,-.34,-.61,-.43,-.44,-.44],[-.27,-.45,-.20,-.38,-.12,-.36],
    [-.21,-.53],[-.53,-.62,-.87,-.57,-.99,-.42],
    [-1.18,-.22,-1.13,-.04,-1.18,.14],[-1.22,.49]]);
  slab(T,group,shell,chalk,shadow,{depth:.105,lift:.085,bend:.12});
  const fracture=cut([-.45,-.34],[
    [-.34,-.12,-.08,.035,.22,.055],[.55,.076,.83,.11,1.24,.26],
    [1.19,-.13],[.95,-.19,.72,-.24,.47,-.29],
    [.19,-.34,-.12,-.35,-.45,-.34]]);
  slab(T,group,fracture,shale,shadow,{depth:.085,lift:.11,bend:-.08});
  const chip=cut([.66,-.32],[[.95,-.27,1.05,-.25,1.16,-.23],[1.11,-.40],[.72,-.49],[.66,-.32]]);
  slab(T,group,chip,smoke,shadow,{depth:.04,lift:.038,bend:.015});
}

export function mountCorridorReliefs(T,root,materials,{doorLeft,doorRight,exterior,plasterNormal,plasterMap}){
  const {chalk,shale,smoke,shadow}=finishes(T,materials,plasterNormal,plasterMap);
  function mount(index,left,z){
    const group=new T.Group();
    group.name="lobby-glass-side-relief-"+index;
    group.position.set(left?doorLeft+.012:doorRight-.012,1.63,z);
    group.rotation.y=left?Math.PI/2:-Math.PI/2;
    root.add(group);
    return group;
  }
  const a=mount(1,true,exterior-3.31),b=mount(2,false,exterior-5.97);
  const cut=(start,segments)=>outline(T,start,segments);
  slab(T,a,cut([-.43,.58],[[.16,.52],[.18,.30],[-.05,.20,-.22,.07,-.20,-.22],
    [-.19,-.40,-.09,-.50,.04,-.58],[-.33,-.53],[-.48,-.28,-.48,.24,-.43,.58]]),shale,shadow);
  slab(T,a,cut([.26,.50],[[.42,.46],[.39,-.30],[.06,-.49],[-.13,-.26,-.12,-.04,.02,.11],
    [.16,.23,.22,.28,.26,.50]]),chalk,shadow,{lift:.09,bend:-.045});
  slab(T,b,cut([-.57,.26],[[.22,.34],[.51,.19],[.28,.15,.12,.07,-.07,-.09],
    [-.21,-.17,-.32,-.19,-.45,-.18],[-.57,.26]]),smoke,shadow);
  slab(T,b,cut([-.43,-.26],[[-.17,-.26,-.09,-.23,.08,-.11],[.23,.01,.34,.08,.51,.09],
    [.48,-.26],[.17,-.37],[-.43,-.26]]),chalk,shadow,{lift:.083,bend:.036});
}
