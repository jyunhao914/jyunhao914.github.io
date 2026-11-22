// The lettering, directional mark and glass share one gently cambered surface.
export const cardAspect=4.1;
const height=512,width=Math.round(cardAspect*height);

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

export function makeCardFace(T,door,secondary,family,index){
  const c=document.createElement("canvas");c.width=Math.ceil(width/2);c.height=height/2;
  const ctx=c.getContext("2d"),font=family||"sans-serif";
  ctx.scale(c.width/width,.5);
  ctx.textBaseline="middle";
  ctx.font="450 106px "+font;ctx.fillStyle="#a9ccc6";
  ctx.fillText(String(index+1).padStart(2,"0"),85,height/2);
  const left=340;
  const heading=fitLines(ctx,door.title||door.room||"展廳",font,width-left-200,156,secondary?1:2);
  const lines=heading.lines.length+(secondary?1:0),step=heading.size*1.08;
  let y=height/2-(lines-1)*step/2;
  ctx.fillStyle="#f5f7f4";ctx.font="550 "+heading.size+"px "+font;
  for(const line of heading.lines){ctx.fillText(line,left,y);y+=step;}
  if(secondary){
    const caption=fitLines(ctx,secondary,font,width-left-200,96,1);
    ctx.font="420 "+caption.size+"px "+font;ctx.fillStyle="#d2dcdb";ctx.fillText(caption.lines[0],left,y);
  }
  const x=width-115;
  ctx.beginPath();ctx.moveTo(x-24,height/2-32);ctx.lineTo(x+8,height/2);ctx.lineTo(x-24,height/2+32);
  ctx.strokeStyle="#c4d9d4";ctx.lineWidth=7;ctx.stroke();
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
        glass=mix(glass,vec3(.16,.34,.32),.56*uFocus);
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
