// Trace the visitor's own Chinese sans-serif glyphs. Solid interior spans form
// the front caps; antialiased boundary samples form the cut edges and returns.
function cutLetters(T,mask,width,height,depth) {
  const {width:w,height:h}=mask;
  const pixels=mask.getContext("2d").getImageData(0,0,w,h).data;
  const caps=[],edges=[];
  const point=(x,y,z)=>[(x/w-.5)*width,(.5-y/h)*height,z];
  function cap(poly) {
    for(let i=1;i<poly.length-1;i++)
      caps.push(...point(...poly[0],depth),...point(...poly[i+1],depth),...point(...poly[i],depth));
  }
  const alpha=(x,y)=>pixels[(y*w+x)*4+3];
  for(let y=0;y<h-1;y++){
    let run=-1;
    for(let x=0;x<w-1;x++){
      const a=[alpha(x,y),alpha(x+1,y),alpha(x+1,y+1),alpha(x,y+1)];
      const inside=a.map(v=>v>=128);
      if(inside.every(Boolean)){if(run<0)run=x;continue;}
      if(run>=0){cap([[run,y],[x,y],[x,y+1],[run,y+1]]);run=-1;}
      if(!inside.some(Boolean))continue;
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],cross=[];
      for(let k=0;k<4;k++){
        const j=(k+1)%4;
        if(inside[k]===inside[j])continue;
        const t=(127.5-a[k])/(a[j]-a[k]);
        cross[k]=corners[k].map((v,n)=>v+t*(corners[j][n]-v));
      }
      // Trace each occupied arc independently so a diagonal contact stays open.
      for(let k=0;k<4;k++)if(inside[k]&&!inside[(k+3)%4]){
        const start=cross[(k+3)%4],poly=[start];
        let j=k;
        while(inside[j]){poly.push(corners[j]);j=(j+1)%4;}
        const end=cross[(j+3)%4];poly.push(end);cap(poly);
        const p=point(...start,0),q=point(...end,0),u=point(...start,depth),v=point(...end,depth);
        edges.push(...u,...v,...p,...v,...q,...p);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(caps.concat(edges),3));
  geo.addGroup(0,caps.length/3,0);geo.addGroup(caps.length/3,edges.length/3,1);
  geo.computeVertexNormals();
  return geo;
}

export function mountPierLetters(T,root,{title,width,height,x,y,z,family,face,edge,materials,textures}){
  const mask=document.createElement("canvas");mask.width=416;mask.height=Math.round(416*height/width);
  const ctx=mask.getContext("2d",{willReadFrequently:true});
  let size=Math.floor(mask.height*.84);
  ctx.font="650 "+size+"px "+family;
  while(size>16&&ctx.measureText(title).width>mask.width-22)ctx.font="650 "+(--size)+"px "+family;
  ctx.textBaseline="middle";ctx.fillStyle="white";
  const glyphs=Array.from(title);
  let label=title;
  while(glyphs.length && ctx.measureText(label).width>mask.width-22){glyphs.pop();label=glyphs.join("")+"…";}
  ctx.fillText(label,10,mask.height*.49);
  const letters=new T.Mesh(cutLetters(T,mask,width,height,.032),[face,edge]);
  letters.name="pier-metal-letters";letters.position.set(x,y,z-.003);root.add(letters);

  // The wall receives the silhouette cast by the upper-left grazing light.
  const cast=document.createElement("canvas");cast.width=mask.width;cast.height=mask.height;
  const ink=cast.getContext("2d");
  ink.shadowColor="rgba(23,15,8,.85)";ink.shadowBlur=2.4;ink.shadowOffsetX=5;ink.shadowOffsetY=3;
  ink.drawImage(mask,0,0);
  ink.globalCompositeOperation="source-in";ink.fillStyle="#211910";ink.fillRect(0,0,cast.width,cast.height);
  const map=new T.CanvasTexture(cast);map.colorSpace=T.SRGBColorSpace;textures.push(map);
  const mat=new T.MeshBasicMaterial({map,transparent:true,opacity:.66,depthWrite:false});
  materials.push(mat);
  const shadow=new T.Mesh(new T.PlaneGeometry(width,height),mat);
  shadow.position.set(x,y,z+.001);root.add(shadow);
}
