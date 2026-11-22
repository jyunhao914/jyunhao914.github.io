// Pavilion coordinates are measured from the garden elevation. The front
// follows an oblique line while the upper roof rises gently towards the lawn.
export function pavilionProfile(width) {
  const left=-width-8.25,right=width+2.05;
  return {left,right,depth:5.20,face:x=>.34*x+.64,
    base:()=>4.72,top:x=>7.46+1.36*(x-left)/(right-left)};
}
// The parent group is centred on the south wall: local +z faces the garden.
// The grounds own the shared panorama, the materials array and all child geometries.
export function buildFacade(T,root,{width,depth=5.9,panorama,timberTexture,materials}){
  const w=width, group=new T.Group();
  group.name="museum-facade";
  root.add(group);
  function finish(opts){
    const m=new T.MeshStandardMaterial(opts);
    materials.push(m);return m;
  }
  const metal=finish({color:0x263e3b,metalness:.29,roughness:.47});
  const flashing=finish({color:0x545950,metalness:.36,roughness:.45});
  const roof=finish({color:0x89958e,roughness:.64,metalness:.21});
  const lead=finish({color:0x61706b,roughness:.63,metalness:.28});

  // One reflection sample per window fragment. Schlick reflectance changes with the viewing
  // angle. The close soffit and paving intercept reflected rays before the distant tree line.
  const windowMaterial=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{environs:{value:panorama},halfWidth:{value:w}},
    vertexShader:`varying vec3 localPoint;varying vec3 worldPoint;varying vec3 paneNormal;
      void main(){localPoint=position;paneNormal=normalize(mat3(modelMatrix)*normal);vec4 p=modelMatrix*vec4(position,1.);worldPoint=p.xyz;
      gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform sampler2D environs;uniform float halfWidth;
      varying vec3 localPoint;varying vec3 worldPoint;varying vec3 paneNormal;
      void main(){
        vec3 sight=normalize(cameraPosition-worldPoint);
        float incidence=abs(dot(sight,normalize(paneNormal)));
        float fresnel=.045+.955*pow(1.-incidence,5.);
        // Small deviations in large laminated panes disturb reflections while keeping the interior legible.
        vec3 n=normalize(paneNormal+vec3(.0021*sin(localPoint.x*3.4+localPoint.y),.0017*cos(localPoint.y*3.2),0.));
        vec3 r=reflect(-sight,n);
        vec3 panoramaRay=vec3(-.407*r.x+.913*r.z,r.y,-.913*r.x-.407*r.z);
        vec2 uv=vec2(fract(atan(panoramaRay.z,-panoramaRay.x)/6.283185+.99999),asin(clamp(panoramaRay.y,-1.,1.))/3.141593+.5);
        vec3 garden=texture2D(environs,uv).rgb;
        vec3 reflected=garden*vec3(.88,.99,1.05)+vec3(.009,.017,.023);
        float left=-halfWidth-8.25,right=halfWidth+2.05,slope=0.;
        if(r.y-slope*r.x>.001){
          float t=(4.72+slope*(localPoint.x-left)-localPoint.y)/(r.y-slope*r.x);
          vec3 p=localPoint+r*t;float depth=p.z-.34*p.x-.64;
          if(t>0. && p.x>left-.32 && p.x<right+.32 && depth> -5.52 && depth<.32)
            reflected=vec3(.13,.114,.081)*(.8+.20*smoothstep(.002,.008,abs(fract(depth/.205+.5)-.5)*.205));
        }
        if(r.y<-.008){
          vec3 p=localPoint-r*localPoint.y/r.y;
          float middle=.28-2.65*smoothstep(1.,14.,p.z);
          float spread=4.86-2.23*smoothstep(1.,8.,p.z);
          if(p.z>.03 && p.z<32. && abs(p.x-middle)<spread*.5)
            reflected=mix(reflected,vec3(.20,.185,.151),.60);
        }
        float alpha=clamp(.19+.75*fresnel+(1.-incidence)*.10,.10,.93);
        if(dot(sight,paneNormal)<0.){
          reflected=mix(vec3(.16,.125,.089),vec3(.67,.72,.71),smoothstep(-.1,.70,r.y));
          alpha=.036+.67*fresnel;
        }
        gl_FragColor=vec4(reflected,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  materials.push(windowMaterial);

  // The opaque pieces are merged per finish. Keep glazing in its own transparent draw so
  // the light court beyond the glass remains visible from the garden.
  const opaque=new Map();
  function geometryData(){return {p:[],n:[],index:[]};}
  function polygon(data,points){
    const a=new T.Vector3(...points[0]),b=new T.Vector3(...points[1]),c=new T.Vector3(...points[2]);
    const normal=b.sub(a).cross(c.sub(a)).normalize(),start=data.p.length/3;
    for(const point of points){data.p.push(...point);data.n.push(normal.x,normal.y,normal.z);}
    for(let i=1;i<points.length-1;i++)data.index.push(start,start+i,start+i+1);
  }
  function piece(mat){if(!opaque.has(mat))opaque.set(mat,geometryData());return opaque.get(mat);}
  function block(mat,x,y,z,width,height,thickness){
    const geo=new T.BoxGeometry(width,height,thickness);geo.translate(x,y,z);
    const list=piece(mat),base=list.p.length/3;
    list.p.push(...geo.attributes.position.array);list.n.push(...geo.attributes.normal.array);
    for(const index of geo.index.array)list.index.push(base+index);
    geo.dispose();
  }
  function mesh(name,data,mat){
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(data.p,3));
    g.setAttribute("normal",new T.Float32BufferAttribute(data.n,3));g.setIndex(data.index);g.computeBoundingSphere();
    const object=new T.Mesh(g,mat);object.name=name;group.add(object);return object;
  }
  const glass=geometryData();
  const pane=(left,right,bottom,topL,topR,z)=>polygon(glass,
    [[left,bottom,z],[right,bottom,z],[right,topR,z],[left,topL,z]]);
  // Gallery glazing stops at either side of the open 4.8 m garden passage.
  const sideStart=2.40,sideEnd=w-.36,sill=.10,head=3.64;
  for(const side of [-1,1]){
    const low=side<0?-sideEnd:sideStart,high=side<0?-sideStart:sideEnd;
    const bays=Math.max(1,Math.round((high-low)/1.65));
    for(let i=0;i<bays;i++){
      const l=low+(high-low)*i/bays,r=low+(high-low)*(i+1)/bays;
      pane(l+.022,r-.022,sill+.042,head-.041,head-.041,.199);
    }
    // The narrow exterior pressure cap, bead and sill shed read against the reflected garden.
    for(let i=0;i<=bays;i++){
      const x=low+(high-low)*i/bays;
      block(metal,x,(sill+head)/2,.259,.034,head-sill-.023,.021);
    }
    block(flashing,(low+high)/2,sill+.035,.273,high-low,.014,.054);
  }

  // Flat roof over the perimeter gallery; the central light court is open to the sky.
  // The larger cut-out meets the splayed stone lining below its top lip.
  const zFront=.14,zEnd=-2*depth-.05,roofHeight=4.34;
  const frontOfCourt=-.10-depth,backOfCourt=-5.39-depth,clearance=2.84;
  const parapet=finish({color:0x5a5d55,roughness:.86});
  block(parapet,0,4.124,zFront-.07,2*w+.08,.65,.20);
  block(flashing,0,4.46,zFront-.085,2*w+.13,.023,.26);
  block(lead,0,3.80,zFront+.028,2*w+.05,.012,.041);
  function roofDeck(left,right,back,front){
    if(front<=back || right<=left)return;
    polygon(piece(roof),[[left,roofHeight,front],[right,roofHeight,front],
      [right,roofHeight,back],[left,roofHeight,back]]);
  }
  roofDeck(-w,w,frontOfCourt,zFront);
  roofDeck(-w,-clearance,backOfCourt,frontOfCourt);
  roofDeck(clearance,w,backOfCourt,frontOfCourt);
  // The upper gallery is lifted clear of the recessed ground-floor glazing.
  // Its black folded fascia and pale concrete blades stay distinct in silhouette.
  const pavilion=pavilionProfile(w), back=pavilion.depth;
  const {left:L,right:R,base:low,top,face}=pavilion;
  const black=finish({color:0x202624,metalness:.36,roughness:.48});
  const edge=finish({color:0x424946,metalness:.40,roughness:.44});
  const soffit=finish({color:0x767566,roughness:.86});
  if(timberTexture)soffit.onBeforeCompile=shader=>{
    shader.uniforms.grain={value:timberTexture};
    shader.vertexShader="varying vec3 soffitPoint;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nsoffitPoint=position;");
    shader.fragmentShader="varying vec3 soffitPoint;uniform sampler2D grain;\n"+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 deck=vec2(soffitPoint.x,soffitPoint.z-.34*soffitPoint.x);
      float grainValue=texture2D(grain,deck/vec2(2.25,.32)).r;
      float joint=abs(fract(deck.y/.205+.5)-.5)*.205;
      diffuseColor.rgb=vec3(.17,.14,.096)*(.70+.53*grainValue)*(.73+.27*smoothstep(.002,.007,joint));`);
  };
  const inside=finish({color:0x435356,roughness:.78});
  const brace=finish({color:0x91a2a0,metalness:.16,roughness:.66});
  function strip(mat,a,b,ruleA,ruleB) {
    mat.side=T.DoubleSide;
    polygon(piece(mat),[ruleA(a),ruleA(b),ruleB(b),ruleB(a)]);
  }
  const roofAt=(x,z)=>top(x)-.018*z;
  // Two thin roof folds overhang the curtain wall on three sides.
  for(const [baseFn,thickness,projection,skin] of [[low,.32,.32,soffit],[roofAt,.12,.40,black]]){
    const left=L-projection,right=R+projection,rear=-back-projection,front=projection;
    const point=(x,z,dy=0)=>[x,baseFn(x,z)+dy,face(x)+z];
    strip(skin,left,right,x=>point(x,front),x=>point(x,rear));
    strip(black,left,right,x=>point(x,front,thickness),x=>point(x,rear,thickness));
    strip(edge,left,right,x=>point(x,front),x=>point(x,front,thickness));
    strip(black,left,right,x=>point(x,rear),x=>point(x,rear,thickness));
    for(const x of [left,right])polygon(piece(black),[point(x,rear),point(x,front),point(x,front,thickness),point(x,rear,thickness)]);
  }
  // The eastern return contains a structural core from grade to the roof.
  // It overlaps the occupied ground-floor wing and supports the rear of the gallery.
  const core=finish({color:0x46504d,roughness:.80});
  core.side=T.DoubleSide;
  const cL=R-2.72,cR=R-.08,coreFace=-3.18,coreRear=-back+.05;
  for(const offset of [coreFace,coreRear]){
    strip(core,cL,cR,x=>[x,.0,face(x)+offset],x=>[x,roofAt(x,offset),face(x)+offset]);
    strip(black,cL,cR,x=>[x,low(x)-.012,face(x)+offset+.008],x=>[x,low(x)+.012,face(x)+offset+.008]);
  }
  for(const x of [cL,cR]){
    polygon(piece(core),[[x,0,face(x)+coreRear],[x,0,face(x)+coreFace],
      [x,roofAt(x,coreFace),face(x)+coreFace],[x,roofAt(x,coreRear),face(x)+coreRear]]);
  }
  // The lower eastern wing turns the corner in glass and merges into the end core.
  const ex=w+.07,er=w+4.87,ez=-.71,eb=-4.50,eh=3.64;
  block(inside,(ex+er)/2,eh/2,eb,er-ex,eh,.18);
  block(black,(ex+er)/2,eh+.09,(ez+eb)/2,er-ex+.20,.18,ez-eb+.22);
  block(soffit,(ex+er)/2,.065,(ez+eb)/2,er-ex,.13,ez-eb);
  for(let i=0;i<3;i++){
    const xa=ex+(er-ex)*i/3,xb=ex+(er-ex)*(i+1)/3;
    pane(xa+.017,xb-.017,.13,eh-.04,eh-.04,ez);
    block(metal,xa,eh/2,ez+.014,.034,eh,.055);
  }
  for(let i=0;i<2;i++){
    const za=eb+(ez-eb)*i/2,zb=eb+(ez-eb)*(i+1)/2;
    polygon(glass,[[er,.13,zb-.02],[er,.13,za+.02],[er,eh-.04,za+.02],[er,eh-.04,zb-.02]]);
    block(metal,er,eh/2,zb,.06,eh,.035);
  }
  // Two continuous downstand beams run directly over the concrete blades,
  // tying the floor deck to the rear occupied wing instead of a floating gap.
  for(const z of [-.96,-3.72]){
    const facePoint=(x,offset,dy)=>[x,low(x)+dy,face(x)+z+offset];
    strip(edge,L+.20,R-.20,x=>facePoint(x,.14,-.23),x=>facePoint(x,.14,.018));
    strip(black,L+.20,R-.20,x=>facePoint(x,-.14,-.23),x=>facePoint(x,.14,-.23));
    strip(inside,L+.20,R-.20,x=>facePoint(x,-.14,.018),x=>facePoint(x,-.14,-.23));
    for(const x of [L+.20,R-.20])polygon(piece(black),[facePoint(x,-.14,-.23),facePoint(x,.14,-.23),facePoint(x,.14,.018),facePoint(x,-.14,.018)]);
  }
  strip(inside,-w,w,x=>[x,3.96,face(x)-back+.18],x=>[x,low(x)+.08,face(x)-back+.18]);
  // The ground-floor gallery sits deeper under the left cantilever; its end
  // wall, rear wall and dark window band are visible through the colonnade.
  const gx=L+1.30,gr=-w+.08,gz=face(gx)-1.20,gh=3.62;
  block(inside,(gx+gr)/2,gh/2,gz-1.46,gr-gx,gh,.18);
  block(inside,gx+.06,gh/2,gz-.72,.12,gh,1.55);
  block(inside,gr-.06,gh/2,gz-.72,.12,gh,1.55);
  block(black,(gx+gr)/2,gh+.06,gz-.68,gr-gx+.24,.14,1.84);
  for(let i=0;i<4;i++){
    const a=gx+(gr-gx)*i/4,b=gx+(gr-gx)*(i+1)/4;
    pane(a+.02,b-.02,.14,gh-.06,gh-.06,gz);
    block(metal,a,gh/2,gz+.025,.045,gh,.065);
  }
  // Shadowed depth, diagonal structure and rear wall can be seen through the coating.
  strip(inside,L,R,x=>[x,low(x)+.32,face(x)-back+.09],x=>[x,top(x)-.06,face(x)-back+.09]);
  for(let i=0;i<7;i++){
    const ax=L+(R-L)*i/7,bx=L+(R-L)*(i+1)/7;
    strip(brace,ax,bx,x=>[x+.055,(x===ax)===(i%2===0)?low(x)+.20:top(x)-.06,face(x)-.60],
      x=>[x-.055,(x===ax)===(i%2===0)?low(x)+.20:top(x)-.06,face(x)-.60]);
  }
  const upperGlass=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{sky:{value:panorama}},
    vertexShader:`varying vec3 world;varying vec3 faceNormal;
    void main(){world=(modelMatrix*vec4(position,1.)).xyz;faceNormal=normalize(mat3(modelMatrix)*normal);
      gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`uniform sampler2D sky;varying vec3 world;varying vec3 faceNormal;
    void main(){
      vec3 eye=normalize(cameraPosition-world);vec3 n=normalize(faceNormal);
      vec3 r=reflect(-eye,n);vec2 local=mat2(-.407,-.913,.913,-.407)*r.xz;
      vec2 uv=vec2(fract(atan(local.y,-local.x)/6.283185),asin(clamp(r.y,-1.,1.))/3.141593+.5);
      vec3 exterior=texture2D(sky,uv,.48).rgb;
      float grazing=pow(1.-abs(dot(n,eye)),3.);
      float value=dot(exterior,vec3(.21,.72,.07));
      vec3 coated=vec3(.006,.038,.058)+min(value,.72)*vec3(.090,.175,.211)+exterior*vec3(.034,.058,.066)*(.80+.34*grazing);
      gl_FragColor=vec4(coated,.72+.15*grazing);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  materials.push(upperGlass);
  const upperPanes=geometryData(), bays=13, rows=4;
  for(let i=0;i<bays;i++){
    const a=L+(R-L)*i/bays,b=L+(R-L)*(i+1)/bays;
    const h=(x,t)=>low(x)+.30+(top(x)-low(x)-.30)*t;
    for(let j=0;j<rows;j++){
      const z=i%4===1?.010:0;
      polygon(upperPanes,[[a+.017,h(a,j/rows)+.013,face(a)+z],[b-.017,h(b,j/rows)+.013,face(b)+z],
        [b-.017,h(b,(j+1)/rows)-.013,face(b)+z],[a+.017,h(a,(j+1)/rows)-.013,face(a)+z]]);
      if(j>0)strip(black,a,b,x=>[x,h(x,j/rows)-.013,face(x)+.019],x=>[x,h(x,j/rows)+.013,face(x)+.019]);
    }
    block(black,a,(top(a)+low(a)+.30)/2,face(a)+.005,.032,top(a)-low(a)-.30,.055);
  }
  for(const x of [L,R]){
    for(let j=0;j<rows;j++){
      const bottom=low(x)+.30+(top(x)-low(x)-.30)*j/rows;
      const high=low(x)+.30+(top(x)-low(x)-.30)*(j+1)/rows;
      polygon(upperPanes,[[x,bottom+.011,face(x)],[x,bottom+.011,face(x)-back],
        [x,high-.011,face(x)-back],[x,high-.011,face(x)]]);
      block(black,x,bottom,face(x)-back/2,.04,.025,back);
    }
    for(let j=0;j<3;j++)block(black,x,(top(x)+low(x)+.30)/2,face(x)-j*back/2,.045,top(x)-low(x)-.30,.035);
  }
  mesh("museum-lifted-glass-gallery",upperPanes,upperGlass).renderOrder=2;
  const glazing=mesh("museum-reflective-glazing",glass,windowMaterial);
  glazing.renderOrder=3;glazing.raycast=()=>{};
  for(const [mat,data] of opaque){
    mesh(mat===roof?"museum-roof-deck":mat===flashing?"museum-roof-flashing":mat===lead?"museum-roof-folds":"museum-window-caps",data,mat);
  }
  return group;
}
