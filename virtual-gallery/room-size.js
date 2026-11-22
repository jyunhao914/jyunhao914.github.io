export function roomSize(works) {
  const room = works[0]?.room;
  const theme = ({"書法展廳":"calligraphy","水墨畫展廳":"ink","映像廳":"projection","主展廳":"main"})[room] || "";
  let [width,depth] = ({calligraphy:[3.1,9],projection:[5.2,4.4],main:[8,5.5]})[theme] || [6,7];
  let wide = false;
  for (const a of works) {
    if (a.width < 10 && a.width < a.height*4) continue;
    wide = true;
    const span = Math.abs(a.x || 0) + a.width/2 + (a.mat || 0) + (a.frameWidth || 0) + 1;
    const retreat = (a.width + 2) * 1.85 + (a.z || 0);
    if (a.wall % 2) { depth = Math.max(depth,span); width = Math.max(width,retreat); }
    else { width = Math.max(width,span); depth = Math.max(depth,retreat); }
  }
  return {theme:wide ? "panorama" : theme, width, depth};
}
