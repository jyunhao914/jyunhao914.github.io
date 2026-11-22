// The lettering, etched linework and glass share one gently cambered surface.
export const cardAspect=1.78;
const height=512,width=Math.round(cardAspect*height);

function etchedSymbol(ctx,kind) {
  // All five marks are architectural line drawings. The same three stroke weights
  // describe the silhouette, the return edges and the fine cuts in each material.
  ctx.save();
  ctx.translate(102,34);
  ctx.scale(1.12,1.12);
  ctx.lineJoin="round";ctx.lineCap="round";
  const silver=ctx.createLinearGradient(0,5,400,180);
  silver.addColorStop(0,"#eff7f5");silver.addColorStop(.39,"#d3e4e4");silver.addColorStop(1,"#9dbcc3");
  const weights=[7.7,4.5,2.55],inks=[silver,"rgba(212,230,232,.90)","rgba(184,207,212,.80)"];
  function draw(commands,weight=0,fill=false) {
    const path=new Path2D(commands);
    if(fill){ctx.fillStyle="rgba(194,222,226,.085)";ctx.fill(path);}
    ctx.lineWidth=weights[weight];ctx.strokeStyle=inks[weight];ctx.stroke(path);
  }
  if(kind==="ink"){
    // The same ridge cut by five parallel contour planes; no painting is reproduced.
    draw("M8 146 L88 112 Q110 99 137 99 Q161 98 187 60 Q201 38 224 40 Q241 40 259 63 L285 91 Q300 109 323 99 L353 87 Q365 83 378 94 L410 124");
    draw("M9 158 L89 126 Q116 109 141 111 Q169 111 194 80 Q217 47 239 63 Q248 69 258 82 L282 107 Q300 127 324 116 L359 103 Q370 100 383 111 L414 137",1);
    draw("M25 165 L99 140 Q125 126 149 125 Q173 125 200 101 Q220 78 240 84 Q251 87 266 104 L282 121 Q300 143 325 134 L359 120 Q370 117 385 128 L416 148",1);
    draw("M52 168 C104 155 127 143 154 141 Q179 140 204 122 Q224 105 238 106 Q251 106 266 122 L282 139 Q300 157 324 151 L360 139 Q373 136 386 144 L407 156",2);
    draw("M83 170 Q135 157 165 155 Q187 152 208 140 Q232 125 247 132 Q259 136 275 151 Q294 168 322 165 L359 156",2);
  }else if(kind==="calligraphy"){
    // Two rails, the rolled lower edge, a falling sheet and its shadow in axonometric view.
    draw("M81 40 L246 18 Q253 17 255 25 Q257 32 249 34 L85 56 Q76 57 74 50 Q72 43 81 40 Z",0,true);
    draw("M97 55 L233 37 L233 129 Q231 141 240 146 L103 165 Q93 162 96 151 Z",0,true);
    draw("M104 165 L240 146 C246 145 251 149 251 155 C251 160 248 164 242 165 L104 184 Q94 185 92 177 Q90 168 104 165 Z",0,true);
    draw("M233 37 L243 36 L243 127 Q242 137 249 140 L240 146 M109 58 L108 149 M121 54 L119 134",1);
    draw("M245 19 Q238 26 246 34 M240 147 C234 153 235 162 243 165 M112 168 Q105 174 111 182 M145 130 L149 75 M158 121 L161 73 M170 112 L171 75",2);
    draw("M274 37 L298 34 M271 146 L298 143 M286 45 L286 132",2);
  }else if(kind==="handscroll"){
    // The opened strip twists once between the two turned roller sections.
    draw("M31 94 Q31 80 45 73 C74 62 108 59 145 83 C183 108 216 112 262 90 C295 73 320 64 350 72 L371 81 L371 122 Q342 110 317 117 Q292 124 270 137 C218 163 174 150 136 127 C102 106 78 103 48 118 Q30 126 31 107 Z",0,true);
    draw("M42 74 Q30 80 31 95 Q31 108 43 106 Q51 104 51 94 Q51 88 44 88 M47 111 Q62 104 61 90 Q60 79 53 74",1);
    draw("M350 72 C361 56 380 59 386 73 Q391 84 387 103 Q383 117 371 122 M373 73 Q378 67 383 74 Q390 86 382 98 Q377 104 373 97",1);
    draw("M67 88 Q99 78 140 102 C181 127 214 133 264 111 Q323 79 353 90 M68 94 Q101 86 138 110 C179 136 214 141 264 120 Q324 87 354 98",2);
  }else if(kind==="projection"){
    // An optical section: the lens, diverging rays and the space between two screens.
    draw("M54 110 L95 88 L106 94 L65 117 Z M54 110 L54 127 L65 133 L65 117 M65 133 L106 110 L106 94",0,true);
    draw("M275 46 L364 25 L364 132 L275 155 Z",0,true);
    draw("M291 54 L351 40 L351 124 L291 139 Z",1);
    draw("M382 34 L392 32 L392 145 L300 169 L298 162",1);
    draw("M115 91 L263 49 M116 96 L263 71 M115 101 L263 102 M114 107 L263 149",2);
    draw("M98 82 L110 76 M46 135 L35 141",2);
  }else{
    // A section through an open gallery, with its continuous floor, clerestory and return wall.
    draw("M44 126 L44 49 L178 23 L298 66 L298 138 L259 149 L259 88 L175 59 L83 78 L83 140 Z",0,true);
    draw("M44 49 L82 65 L178 46 L280 81 L298 66 M82 65 L83 78 M178 23 L178 46 M259 88 L280 81",1);
    draw("M45 150 L114 173 L307 133 M84 139 L118 150 L240 124 M118 150 L118 99 L174 88 L237 109",1);
    draw("M183 66 L185 84 M197 71 L199 89 M212 76 L214 94 M228 82 L230 99 M95 79 L95 102 M106 77 L106 100",2);
  }
  ctx.restore();
}

function fitLines(ctx,text,fontFamily,maxWidth,pointSize,maxLines){
  const glyphs=Array.from(String(text));
  let size=pointSize,lines;
  // Preserve natural letterforms. Long custom names wrap before reducing the type.
  do{
    ctx.font="570 "+size+"px "+fontFamily;
    lines=[""];
    for(const char of glyphs){
      let i=lines.length-1;
      if(lines[i] && ctx.measureText(lines[i]+char).width>maxWidth){lines.push("");i++;}
      lines[i]+=char;
    }
    if(lines.length<=maxLines||size<=55)break;
    size-=4;
  }while(size>0);
  if(lines.length>maxLines){
    lines=lines.slice(0,maxLines);
    let last=Array.from(lines[maxLines-1]);
    while(last.length && ctx.measureText(last.join("")+"…").width>maxWidth)last.pop();
    lines[maxLines-1]=last.join("")+"…";
  }
  return {lines,size};
}

export function makeCardFace(T,door,secondary,family){
  const c=document.createElement("canvas");c.width=width;c.height=height;
  const ctx=c.getContext("2d"),title=String(door.title||door.room||"展廳"),font=family||"sans-serif";
  const room=String(door.room||title);
  const kind=/長卷|橫卷|手卷/.test(room)?"handscroll":/水墨/.test(room)?"ink":/書法|翰墨/.test(room)?"calligraphy":/映像|影像|放映/.test(room)?"projection":"main";
  etchedSymbol(ctx,kind);
  const inner=width-204,left=60;
  // Keep duplicate exhibition names inside the same card without introducing a badge.
  const heading=fitLines(ctx,title,font,inner,secondary?76:91,secondary?1:2);
  const caption=secondary?fitLines(ctx,secondary,font,inner,heading.size,1):null;
  const textSize=caption?Math.min(heading.size,caption.size):heading.size;
  const lines=heading.lines.length+(caption?1:0),lineHeight=textSize*1.10;
  const lastBaseline=height-63,firstBaseline=lastBaseline-(lines-1)*lineHeight;
  ctx.textAlign="left";ctx.textBaseline="alphabetic";
  ctx.fillStyle="#f1f5ef";ctx.shadowColor="rgba(6,20,25,.63)";ctx.shadowBlur=4;ctx.shadowOffsetY=2;
  ctx.font="570 "+textSize+"px "+font;
  heading.lines.forEach((line,i)=>ctx.fillText(line,left,firstBaseline+i*lineHeight));
  if(caption){
    ctx.fillStyle="#d2dcdb";ctx.font="400 "+textSize+"px "+font;ctx.fillText(caption.lines[0],left,lastBaseline);
  }
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const ax=width-87,ay=height-91;
  ctx.beginPath();ctx.moveTo(ax-21,ay);ctx.lineTo(ax+18,ay);ctx.moveTo(ax+1,ay-17);ctx.lineTo(ax+18,ay);ctx.lineTo(ax+1,ay+17);
  ctx.lineJoin="round";ctx.lineCap="round";ctx.lineWidth=5;ctx.strokeStyle="#cedcdd";ctx.stroke();
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function makeCardGeometry(T){
  const segments=34,angle=.52,radius=.5/Math.sin(angle*.5),pos=[],uv=[],indices=[];
  for(let i=0;i<=segments;i++){
    const u=i/segments,t=(u-.5)*angle,x=radius*Math.sin(t),z=radius*(Math.cos(t)-1.);
    for(const y of [0,1]){pos.push(x,y-.5,z);uv.push(u,y);}
    if(i){const k=2*i;indices.push(k-2,k,k+1,k-2,k+1,k-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function makeCardGlass(T){
  return new T.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{uFocus:{value:0},uVisibility:{value:0},uLook:{value:0}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uFocus,uVisibility,uLook;
      void main(){
        float radius=.058;
        vec2 p=(vUv-.50)*vec2(${cardAspect.toFixed(3)},1.);
        vec2 box=abs(p)-vec2(${(cardAspect*.5).toFixed(3)}-radius,.5-radius);
        float sd=length(max(box,0.))+min(max(box.x,box.y),0.)-radius;
        float aa=clamp(fwidth(sd),.0006,.05);
        float coverage=1.-smoothstep(-aa*.6,aa*.6,sd);
        if(coverage<.004||uVisibility<.005)discard;
        float depth=-sd;
        float rim=1.-smoothstep(.005-aa,.011+aa,depth);
        float inner=1.-smoothstep(.002,.009+aa,abs(depth-.018));
        // The edge cools on the shaded side and catches a directional silver highlight.
        float bevelLight=clamp(.49+.34*vUv.y-.20*vUv.x+.13*uLook,0.,1.);
        float shift=.62*vUv.x+.92*vUv.y-.22*uLook;
        float satin=exp(-pow(abs(shift-1.065-.065*uFocus)*4.2,2.));
        float radial=exp(-length((vUv-vec2(.16,.9))*vec2(2.,2.6)));
        vec3 glass=mix(vec3(.012,.022,.030),vec3(.084,.131,.153),.14+.33*vUv.y+.31*satin+.16*radial+.07*uFocus);
        float shoulder=.2*exp(-abs(depth-.035)*64.);
        glass=mix(glass,vec3(.30,.43,.47),shoulder+.11*inner);
        glass=mix(glass,mix(vec3(.28,.43,.50),vec3(.72,.82,.84),bevelLight),rim*.95);
        float inkShade=1.-smoothstep(.16,.68,vUv.y);
        float opacity=.43+.23*inkShade+.09*satin+.05*uFocus+.32*rim;
        gl_FragColor=vec4(glass,min(.94,opacity)*coverage*clamp(uVisibility,0.,1.));
        #include <colorspace_fragment>
      }`
  });
}
