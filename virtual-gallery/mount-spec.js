function curvedProfile(concave) {
  const lip=concave ? .94 : .52;
  const curve=[[0,0],[0,lip]];
  for(let i=0;i<=16;i++) {
    const t=i/16, r=.035+.93*t;
    const arc=Math.sin(t*Math.PI);
    curve.push([r,concave ? .965-.47*arc : .58+.42*arc]);
  }
  curve.push([1,lip],[1,0]);
  return curve;
}
export const frameProfiles={
  "立體盒框":[[0,0],[0,.94],[.032,.99],[.065,1],[.927,1],[.965,.99],[1,.94],[1,.90]],
  "圓弧框":curvedProfile(false),"內凹框":curvedProfile(true),
  "平框":[[0,0],[0,.89],[.035,.975],[.08,1],[.90,1],[.955,.97],[1,.88],[1,0]],
  "斜面框":[[0,0],[0,.88],[.04,.97],[.12,1],[.20,.985],[.83,.70],[.94,.68],[1,.64],[1,0]],
  "階梯框":[[0,0],[0,.88],[.025,.965],[.07,1],[.23,1],[.27,.97],[.28,.80],[.36,.76],
    [.48,.76],[.51,.85],[.55,.87],[.585,.84],[.61,.72],[.83,.60],[.91,.67],[.96,.65],[1,.59],[1,0]],
  "浮框":[[0,0],[0,.94],[.025,1],[.31,1],[.35,.95],[.35,.19],[.40,.14],[1,.14],[1,0]]
};

// All distances are metres in the artwork's local wall plane, measured from the image centre.
const woodColors = { "白橡木": "#c7a579", "胡桃木": "#805638", "梣木": "#dbc49d", "柚木": "#aa7546" };
const metalColors = { "鋁合金": "#a4abb1", "黃銅": "#c49853", "不鏽鋼": "#bdc4c9" };
const rodColors = { "木軸": "#654939", "銅軸": "#aa804c", "漆軸": "#3d2827" };

function number(value, fallback) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return fallback;
  return Math.max(0, Number(value));
}
function select(value, choices) { return choices.includes(value) ? value : choices[0]; }
function color(value, fallback) { return /^#[\da-f]{6}$/i.test(value) ? value : fallback; }

export function mountSpec(a) {
  const w=number(a.width,1), h=number(a.height,1);
  const isScroll=a.mount === "掛軸", isHandscroll=a.mount === "手卷", frame=select(a.frame,["木框","金屬框","無框"]);
  const isAlbum=a.mount==="冊頁", isMirror=a.mount==="鏡片";
  const frameWidth=!isScroll && !isHandscroll && !isAlbum && frame!=="無框" ? number(a.frameWidth,.06) : 0;
  const mat=number(a.mat,.07), depth=number(a.depth,.05);
  const topBorder=number(a.topBorder,.29), bottomBorder=number(a.bottomBorder,.19);
  const rodDiameter=number(a.rodDiameter,.054);
  const scrollWidth=w+mat*2, scrollHeight=h+topBorder+bottomBorder;
  const head=h/2+topBorder, foot=-h/2-bottomBorder;
  const battenHeight=Math.min(.025,rodDiameter*.26);
  const finialLength=rodDiameter*(.05/.054);
  const rect=(w,h,y=0,x=0)=>({w,h,x,y});
  const handscrollStyle=select(a.handscrollStyle,["大鑲手卷","撞邊手卷","套邊手卷"]);
  const headLength=Math.min(3,number(a.headLength,.45)),tailLength=Math.min(3,number(a.tailLength,.72));
  const handHeight=h+2*mat;
  const part=(left,width)=>({left,right:left+width,width});
  // Drawing from right to left: protective silk cover, frontispiece, image and colophon.
  const divider=Math.max(.012,Math.min(.065,h*.058));
  const coverWidth=Math.min(.42,Math.max(.11,h*.39));
  const handParts={art:part(-w/2,w),head:part(w/2+divider,headLength),
    tail:part(-w/2-(tailLength ? divider : 0)-tailLength,tailLength)};
  handParts.cover=part(handParts.head.right+(headLength ? divider : 0),coverWidth);
  const sheetLeft=handParts.tail.left,sheetRight=handParts.cover.right;
  const coreRadius=Math.min(.022,Math.max(.008,h*.027)), endProjection=coreRadius*.38;
  const handRects=[rect(sheetRight-sheetLeft,handHeight,0,(sheetLeft+sheetRight)/2),
    rect(2*coreRadius,handHeight+2*endProjection,0,sheetLeft-coreRadius),
    rect(1.44*coreRadius,handHeight,0,sheetRight)];
  const mirrorEnd=Math.min(.5,number(a.mirrorEnd,.12));
  const borderX=isMirror && w>h ? mirrorEnd : mat, borderY=isMirror && w<=h ? mirrorEnd : mat;
  const innerW=w+2*borderX,innerH=h+2*borderY;
  const albumStyle=select(a.albumStyle,["經摺裝","蝴蝶裝","推篷裝"]);
  const albumLeafColor=color(a.albumLeafColor,"#e5dcc4"), albumCoverColor=color(a.albumCoverColor,"#54635d");
  const leafW=w+mat*2,leafH=h+mat*2, gap=Math.min(.012,.018*Math.min(leafH,leafW)), lip=Math.min(.014,.024*Math.min(leafW,leafH));
  const albumLeaves=[];
  if(isAlbum) {
    albumLeaves.push({x:0,y:0,w:leafW,h:leafH,kind:"art"});
    if(albumStyle==="經摺裝"){
      for(const side of [-1,1]) {
        const wing=leafW*.44;
        albumLeaves.push({x:side*((leafW+wing)/2+gap),y:0,w:wing,h:leafH,kind:"wing",side});
      }
    } else if(albumStyle==="蝴蝶裝")albumLeaves.push({x:leafW+gap,y:0,w:leafW,h:leafH,kind:"facing"});
    else albumLeaves.push({x:0,y:leafH+gap,w:leafW,h:leafH,kind:"facing"});
  }
  const albumLeft=isAlbum ? Math.min(...albumLeaves.map(p=>p.x-p.w/2))-lip : 0;
  const albumRight=isAlbum ? Math.max(...albumLeaves.map(p=>p.x+p.w/2))+lip : 0;
  const albumBottom=isAlbum ? Math.min(...albumLeaves.map(p=>p.y-p.h/2))-lip : 0;
  const albumTop=isAlbum ? Math.max(...albumLeaves.map(p=>p.y+p.h/2))+lip : 0;
  const albumCover=rect(albumRight-albumLeft,albumTop-albumBottom,(albumTop+albumBottom)/2,(albumRight+albumLeft)/2);
  const rects=isAlbum ? [albumCover] : isHandscroll ? handRects : isScroll ? [
    rect(scrollWidth,scrollHeight,(head+foot)/2),
    rect(scrollWidth,battenHeight,head),
    rect(scrollWidth+finialLength*2,rodDiameter,foot)
  ] : [rect(innerW+2*frameWidth,innerH+2*frameWidth)];
  const left=Math.min(...rects.map(r=>r.x-r.w/2)), right=Math.max(...rects.map(r=>r.x+r.w/2));
  const bottom=Math.min(...rects.map(r=>r.y-r.h/2)), top=Math.max(...rects.map(r=>r.y+r.h/2));
  const profile=select(a.profile,["平框","斜面框","階梯框","浮框","圓弧框","內凹框","立體盒框"]);
  const scrollStyle=select(a.scrollStyle,["一色裱","二色裱","三色裱","文人裱","宣和裱"]);
  const woodSpecies=select(a.woodSpecies,["胡桃木","白橡木","梣木","柚木"]);
  const surfaceCover=select(a.surfaceCover,["原材","包膜"]), filmPattern=select(a.filmPattern,["素色","木紋","髮絲紋","織紋"]);
  const metalFinish=select(a.metalFinish,["鋁合金","黃銅","不鏽鋼"]);
  const surfaceSheen=Math.min(1,number(a.surfaceSheen,a.finish==="亮面" ? .85 : .19));
  const matMaterial=select(a.matMaterial,["棉紙","亞麻"]), silkPattern=select(a.silkPattern,["織錦","素絹","細麻"]);
  const rodMaterial=select(a.rodMaterial,["木軸","銅軸","漆軸"]);
  // The guide group sits 70 mm in front of the inner wall surface.
  const backZ=-.064, isBox=frameWidth>0 && profile==="立體盒框";
  const boxFloorZ=backZ+Math.min(.003,depth*.12), glassZ=backZ+depth*.90;
  const paperThickness=Math.min(.0012,depth*.065);
  const maxLift=Math.max(0,Math.min(.2,glassZ-boxFloorZ-paperThickness-Math.min(.004,depth*.09)));
  const floatLift=Math.min(maxLift,number(a.floatLift,.009));
  const faceZ=isBox ? boxFloorZ+floatLift+paperThickness : backZ+depth*(frameWidth ? .73 : 1);
  const glazing=select(a.glazing,["無罩","透明壓克力","低反射玻璃"]);
  const matColor=color(a.matColor,"#eee8d8");
  const shade=matColor.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.84).toString(16).padStart(2,"0")).join("");
  const linerColor=color(a.linerColor,"#"+shade);
  return {w,h,rects,left,right,top,bottom,width:right-left,height:top-bottom,
    isAlbum,isMirror,albumStyle,albumLeafColor,albumCoverColor,albumLeaves,albumCover,albumGap:gap,mirrorEnd,borderX,borderY,innerW,innerH,
    isHandscroll,handscrollStyle,headLength,tailLength,handHeight,handParts,divider,sheetLeft,sheetRight,coreRadius,endProjection,
    isScroll,isBox,boxFloorZ,glassZ,paperThickness,maxLift,floatLift,glazing,linerColor,frame,frameWidth,mat,depth,backZ,faceZ,topBorder,bottomBorder,rodDiameter,finialLength,battenHeight,
    scrollWidth,scrollHeight,head,foot,profile,scrollStyle,woodSpecies,surfaceCover,filmPattern,metalFinish,surfaceSheen,
    matMaterial,silkPattern,rodMaterial,frameColor:color(a.frameColor,frame==="金屬框" ? metalColors[metalFinish] : woodColors[woodSpecies]),
    matColor,silkColor:color(a.silkColor,"#c8ba94"),
    accentColor:color(a.accentColor,"#776952"),thirdColor:color(a.thirdColor,scrollStyle==="宣和裱" ? "#73543f" : "#baa87c"),rodColor:color(a.rodColor,rodColors[rodMaterial])};
}

// Fabric cut list, shared with the editing elevation. Ink and paper never shrink to fit the trims.
export function scrollBands(s,cut) {
  const {scrollStyle:style,w,h,mat,scrollWidth:sw,topBorder:upper,bottomBorder:lower}=s;
  const band=(color,x,y,w,h,layer=1)=>{if(w>0 && h>0)cut(color,x,y,w,h,layer);};
  if(style==="二色裱" || style==="三色裱") {
    // The side strips and the two primary crosspieces form the jade pool (玉池).
    const head=upper*.31,foot=lower*.32;
    for(const side of [-1,1])band(s.accentColor,side*(w+mat)/2,0,mat,h);
    band(s.accentColor,0,(h+head)/2,sw,head);
    band(s.accentColor,0,-(h+foot)/2,sw,foot);
    if(style==="三色裱") {
      const thinHead=upper*.12,thinFoot=lower*.12;
      band(s.thirdColor,0,(h+thinHead)/2+head,sw,thinHead);
      band(s.thirdColor,0,-(h+thinFoot)/2-foot,sw,thinFoot);
    }
  } else if(style==="宣和裱") {
    const trim=Math.min(.009,mat*.17),above=Math.min(trim,upper),below=Math.min(trim,lower);
    for(const side of [-1,1])band(s.thirdColor,side*(w+trim)/2,0,trim,h);
    band(s.thirdColor,0,(h+above)/2,w+2*trim,above);
    band(s.thirdColor,0,-(h+below)/2,w+2*trim,below);
    const head=(upper-above)*.26,foot=(lower-below)*.26;
    band(s.accentColor,0,(h+head)/2+above,sw,head);
    band(s.accentColor,0,-(h+foot)/2-below,sw,foot);
    const ribbon=Math.min(.031,sw*.038), length=(upper-above-head)*.81;
    for(const side of [-1,1])band(s.accentColor,side*sw*.267,s.head-length/2,ribbon,length);
  } else if(style==="文人裱") {
    const seam=Math.min(.012,mat*.15);
    for(const side of [-1,1])band(s.accentColor,side*(w+seam)/2,0,seam,h);
    for(const [sign,available] of [[1,upper],[-1,lower]]) {
      const margin=available*.16, line=Math.min(seam,available*.08);
      band(s.accentColor,0,sign*(h+line)/2,sw,line);
      band(s.accentColor,0,sign*((h+line*.55)/2+margin),sw,line*.55);
    }
  }
}

// Ordered cuts for the horizontal handscroll; x is positive toward the viewer's right.
// The painted paper is a separate face covering exactly its recorded width and height.
export function handscrollBands(s,cut) {
  const {handParts:p,handHeight:H,handscrollStyle:style,mat,h,divider,sheetLeft:l,sheetRight:r}=s;
  function panel(name,material,color,left,right,y,height,layer=1) {
    if(right>left && height>0)cut(color,(left+right)/2,y,right-left,height,layer,name,material);
  }
  const end=p.cover.left;
  // The frontispiece is decorated paper, the colophon is lighter uninscribed paper.
  panel("head","cotton",s.matColor,p.head.left,p.head.right,0,h);
  panel("tail","cotton",s.matColor,p.tail.left,p.tail.right,0,h);
  panel("cover","silk",s.silkColor,p.cover.left,p.cover.right,0,H);
  const seams=[[p.art.right,p.head.left]];
  if(p.head.width)seams.push([p.head.right,p.cover.left]);
  if(p.tail.width)seams.push([p.tail.right,p.art.left]);
  for(const [a,b] of seams) {
    panel("divider","silk",s.accentColor,a,b,0,H,2);
    if(style==="大鑲手卷"){
      const strip=divider*.21;
      panel("secondary-divider","silk",s.thirdColor,a,a+strip,0,H,3);
      panel("secondary-divider","silk",s.thirdColor,b-strip,b,0,H,3);
    }
  }
  for(const sign of [-1,1]) {
    const edge=(H/2)*sign;
    if(style==="撞邊手卷") {
      const fold=Math.min(.004,mat);
      panel("fold","cotton",s.thirdColor,l,end,edge-sign*fold/2,fold,4);
    } else if(style==="套邊手卷") {
      const binding=Math.min(mat,.020),lip=Math.min(.0026,binding*.32);
      panel("binding","silk",s.accentColor,l,end,edge-sign*binding/2,binding,3);
      panel("fold","cotton",s.thirdColor,l,end,edge-sign*lip/2,lip,4);
    } else {
      const rim=Math.min(.0028,mat);
      panel("fold","silk",s.thirdColor,l,r,edge-sign*rim/2,rim,4);
    }
  }
  const brocade=Math.min(.065,p.cover.width*.21);
  panel("cover-wrap","silk",s.accentColor,r-brocade,r,0,H,5);
}

// Flat elevation of the book. In the 3D construction the outer accordion wings rise at their folds.
export function albumPanels(s,cut) {
  const {albumCover:c,albumGap:gap,albumLeaves:leaves}=s;
  cut(s.albumCoverColor,c.x,c.y,c.w,c.h,0,"cover","cloth");
  for(const p of leaves)cut(s.albumLeafColor,p.x,p.y,p.w,p.h,1,p.kind,"paper");
  const p=leaves[0];
  if(!p)return;
  if(s.albumStyle==="推篷裝")cut(s.albumCoverColor,0,(p.h+gap)/2,p.w,gap,2,"hinge","cloth");
  else for(const leaf of leaves.slice(1))cut(s.albumCoverColor,Math.sign(leaf.x)*(p.w+gap)/2,0,gap,p.h,2,"hinge","cloth");
}
export function mirrorBands(s,cut) {
  const {w,h,borderX:dx,borderY:dy,silkColor:color}=s;
  // On a vertical work, long borders run alongside the image; on a horizontal work the end panels are ears.
  for(const side of [-1,1]) {
    if(dx>0)cut(color,side*(w+dx)/2,0,dx,h+(w>h ? 2*dy : 0),1,w>h ? "ends" : "sides","silk");
    if(dy>0)cut(color,0,side*(h+dy)/2,w+(w<=h ? 2*dx : 0),dy,1,w>h ? "sides" : "ends","silk");
  }
}
