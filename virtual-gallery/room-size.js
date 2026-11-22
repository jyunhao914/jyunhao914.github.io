import { mountSpec } from "./mount-spec.js?v=mount32";

export function roomSize(works) {
  const room=works[0]?.room;
  const theme=({"書法展廳":"calligraphy","水墨畫展廳":"ink","映像廳":"projection","主展廳":"main"})[room] || "";
  let [width,depth,height]=({calligraphy:[3.1,9,3.65],projection:[5.2,4.4,3.35],main:[8,5.5,5.8]})[theme] || [6,7,5.26];
  let panorama=false;
  for(const a of works) {
    const s=mountSpec(a),boundMount=s.isHandscroll || s.isAlbum || s.isMirror;
    const displayWidth=boundMount ? s.width : a.width;
    const long=displayWidth>=10 || displayWidth>=4*(boundMount ? s.height : a.height);
    if(!long && !boundMount)continue;
    const angle=(a.rotate || 0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    let extent=0,highest=0;
    for(const r of s.rects) {
      const x=(a.x||0)+r.x*cos-r.y*sin,y=(a.y||0)+r.x*sin+r.y*cos;
      extent=Math.max(extent,Math.abs(x)+(Math.abs(cos)*r.w+Math.abs(sin)*r.h)/2);
      highest=Math.max(highest,y+(Math.abs(sin)*r.w+Math.abs(cos)*r.h)/2);
    }
    const span=extent+1,halfWall=a.wall%2 ? depth : width;
    if(!long && extent<halfWall-.06 && highest<=height)continue;
    // Small open albums retain their room. Expand a low ceiling for an upper facing leaf.
    const adaptive=["main","calligraphy","projection"].includes(theme);
    panorama ||= long || !adaptive;
    const retreat=long ? (displayWidth+2)*1.85+(a.z||0) : 0;
    if(a.wall%2) {depth=Math.max(depth,span);width=Math.max(width,retreat);}
    else {width=Math.max(width,span);depth=Math.max(depth,retreat);}
    if(boundMount && highest>height)height=highest+.18;
  }
  if(panorama)height=Math.max(5.8,height);
  return {theme:panorama ? "panorama" : theme,width,depth,height};
}
