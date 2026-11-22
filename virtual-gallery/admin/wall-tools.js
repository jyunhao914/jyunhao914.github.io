import { mountSpec } from "../mount-spec.js?v=desk33";

// Wall coordinates and physical artwork dimensions are expressed in metres.
export function wallHeight(theme) {
  return {calligraphy:3.65, projection:3.35, main:5.8, panorama:5.8}[theme] ?? 5.26;
}

function rotated(a,x,y) {
  const angle=(a.rotate || 0)*Math.PI/180;
  return [a.x+x*Math.cos(angle)-y*Math.sin(angle),a.y+x*Math.sin(angle)+y*Math.cos(angle)];
}

export function bounds(a) {
  const corners=[];
  for (const {w,h,x=0,y=0} of mountSpec(a).rects) {
    for (const dx of [-w/2,w/2])
      for (const dy of [-h/2,h/2]) corners.push(rotated(a,x+dx,y+dy));
  }
  return {left:Math.min(...corners.map(p=>p[0])),right:Math.max(...corners.map(p=>p[0])),
    bottom:Math.min(...corners.map(p=>p[1])),top:Math.max(...corners.map(p=>p[1]))};
}

export function envelope(works) {
  const boxes=works.map(bounds);
  return {left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),
    bottom:Math.min(...boxes.map(b=>b.bottom)),top:Math.max(...boxes.map(b=>b.top))};
}
export function members(works,art) {
  return works.filter(w=>w.id===art.id || (art.groupId && w.groupId===art.groupId && w.wall===art.wall && w.room===art.room));
}
export function units(wall) {
  const groups=new Map();
  for(const art of wall) {
    const key=art.groupId?'g'+art.groupId:'w'+art.id;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(art);
  }
  return Array.from(groups.values()).sort((a,b)=>envelope(a).left-envelope(b).left);
}

export function movement(works,half,height) {
  const origins=works.map(art=>({art,x:art.x,y:art.y})),box=envelope(works);
  function limit(value,min,max) {
    return min>max ? 0 : Math.max(min,Math.min(max,value));
  }
  return (dx,dy)=>{
    dx=dx===0 ? 0 : limit(dx,-half-box.left,half-box.right);
    dy=dy===0 ? 0 : limit(dy,-box.bottom,height-box.top);
    for(const {art,x,y} of origins) { art.x=x+dx; art.y=y+dy; }
  };
}
const cm=value=>Number((value*100).toFixed(1))+' 公分';
function measures(wall,a) {
  const group=members(wall,a), box=envelope(group), metrics=[];
  const measure=(label,value,p,q,kind)=>metrics.push({text:label+' '+cm(value),p,q,kind});
  measure('畫心寬',a.width,rotated(a,-a.width/2,a.height/2),rotated(a,a.width/2,a.height/2),'art');
  measure('畫心高',a.height,rotated(a,-a.width/2,-a.height/2),rotated(a,-a.width/2,a.height/2),'art');
  const mid=(box.left+box.right)/2;
  measure('離地',box.bottom,[mid,0],[mid,box.bottom],'floor');
  function gap(label,left,right,y) {
    const delta=right-left;
    measure(label+(delta<-.0005?'重疊':''),Math.abs(delta),[left,y],[right,y],'gap');
  }
  if(group.length>1) {
    measure('整組寬',box.right-box.left,[box.left,box.top+.13],[box.right,box.top+.13],'group');
    measure('整組高',box.top-box.bottom,[box.right+.08,box.bottom],[box.right+.08,box.top],'group');
    const panels=group.map(bounds).sort((l,r)=>l.left-r.left);
    panels.slice(1).forEach((b,i)=>gap('屏 '+(i+1)+'–'+(i+2)+' ',panels[i].right,b.left,Math.min(b.bottom,panels[i].bottom)-.09));
  }
  const row=units(wall), index=row.findIndex(g=>g.includes(a));
  if(index>0)gap('左鄰',envelope(row[index-1]).right,box.left,a.y);
  if(index<row.length-1)gap('右鄰',box.right,envelope(row[index+1]).left,a.y);
  return metrics;
}

export function makeRulers(T,host,works,groups,cam) {
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  const report=host.closest('.hanging-desk').querySelector('.wall-readout');
  svg.classList.add('wall-rulers');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden';
  svg.setAttribute('aria-hidden','true');
  host.append(svg);
  const cameraMatrix=new T.Matrix4(),projection=new T.Matrix4(),point=new T.Vector3();
  let index=0, dirty=true, metrics=[],width=0,height=0,front=0;
  function element(tag,attrs,txt) {
    const el=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
    if(txt)el.textContent=txt;
    svg.append(el);
  }
  function draw() {
    const a=works[index];
    if(!a || report.hidden)return;
    const w=host.clientWidth,h=host.clientHeight;
    if(!dirty && w===width && h===height && cameraMatrix.equals(cam.matrixWorld) && projection.equals(cam.projectionMatrix))return;
    if(dirty) {
      metrics=measures(works.filter(o=>o.wall===a.wall && o.room===a.room),a);
      front=mountSpec(a).faceZ+.001;
      report.textContent=metrics.map(m=>m.text).join('　·　');
    }
    dirty=false; width=w; height=h; cameraMatrix.copy(cam.matrixWorld); projection.copy(cam.projectionMatrix);
    const normal=(a.wall===3?-1:a.wall)*Math.PI/2, co=Math.cos(normal),si=Math.sin(normal);
    const g=groups[index];
    function project([x,y]) {
      point.set(g.position.x+(x-a.x)*co+si*front,y,g.position.z-(x-a.x)*si+co*front).project(cam);
      return {x:(point.x+1)*w/2,y:(1-point.y)*h/2,z:point.z};
    }
    svg.replaceChildren();
    for(const {text,p,q,kind} of metrics) {
      const s=project(p),t=project(q);
      if([s,t].some(v=>v.z< -1 || v.z>1))continue;
      const dx=t.x-s.x,dy=t.y-s.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*4,ny=dx/len*4;
      const color={art:'#ebfaf8',floor:'#ffe5a7',gap:'#ffe5a7',group:'#9ce3d9'}[kind];
      const path='M'+s.x+' '+s.y+'L'+t.x+' '+t.y+' M'+(s.x-nx)+' '+(s.y-ny)+'l'+(2*nx)+' '+(2*ny)+' M'+(t.x-nx)+' '+(t.y-ny)+'l'+(2*nx)+' '+(2*ny);
      element('path',{d:path,stroke:'#16312e','stroke-width':3.6,fill:'none'});
      element('path',{d:path,stroke:color,'stroke-width':1.4,fill:'none'});
      const mx=(s.x+t.x)/2,my=(s.y+t.y)/2;
      if(mx>=0 && mx<=w && my>=8 && my<h)
        element('text',{x:Math.min(w-48,Math.max(48,mx)),y:my-6,'text-anchor':'middle',fill:color,stroke:'#152825','stroke-width':3,'paint-order':'stroke','font-size':12,'font-weight':600},text);
    }
  }
  return {draw,select(i){index=i;dirty=true},dirty(){dirty=true}};
}
