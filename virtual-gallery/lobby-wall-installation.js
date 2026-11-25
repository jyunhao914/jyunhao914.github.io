// Five individually formed bronze ribbons share a sweep, then turn away from
// one another. Their closed, tapered sections give each fold a real return edge.
export function mountReceptionRelief(T,root,materials){
  const installation=new T.Group();
  installation.name="reception-folded-bronze-relief";
  installation.position.set(-2.61,1.89,-4.531);
  root.add(installation);
  const patinas=[0x9d7549,0xbf9158,0x57796d,0xb78954,0x82948a];
  const shadow=new T.MeshBasicMaterial({color:0x2a201b,transparent:true,opacity:.17,depthWrite:false});
  materials.push(shadow);
  const count=64,sections=12;
  for(let band=0;band<5;band++){
    const metal=new T.MeshStandardMaterial({color:patinas[band],metalness:.52,roughness:.34});
    materials.push(metal);
    const positions=[],indices=[];
    for(let i=0;i<=count;i++){
      const t=i/count, wave=Math.sin(Math.PI*t), end=Math.max(.022,Math.pow(wave,.62));
      const x=(t-.5)*(2.79-band*.075)+(band-2)*.048;
      const y=.32*Math.sin(t*Math.PI*1.76-.92)+.21*(t-.5)+(band-2)*(.158+.053*Math.cos(t*Math.PI*2-.7));
      const rise=.078+.14*wave*wave+.026*Math.cos(t*6.2+band);
      const twist=.24+1.13*Math.sin(t*5.3+band*.48);
      for(let j=0;j<sections;j++){
        const a=2*Math.PI*j/sections;
        const broad=.092*end*Math.cos(a),edge=.015*end*Math.sin(a);
        positions.push(x,y+broad*Math.cos(twist)-edge*Math.sin(twist),rise+broad*Math.sin(twist)+edge*Math.cos(twist));
        if(i<count){
          const n=i*sections+j,m=i*sections+(j+1)%sections;
          indices.push(n,m,n+sections,m,m+sections,n+sections);
        }
      }
    }
    for(const cap of [0,count*sections]){
      for(let j=1;j<sections-1;j++){
        if(cap)indices.push(cap,cap+j,cap+j+1);
        else indices.push(cap,cap+j+1,cap+j);
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    installation.add(new T.Mesh(geometry,metal));
    // Shallow projected silhouettes approximate the wall contact under the
    // high left-hand light without allocating a mobile shadow map.
    const cast=new T.Mesh(geometry,shadow);
    cast.position.set(.037,-.048,.004+band*.0003);cast.scale.z=.01;
    installation.add(cast);
  }
}
