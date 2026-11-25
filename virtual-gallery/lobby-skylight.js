// A drained rooflight sits on the masonry curb. Dimensions are in metres.
// Keep the glass and the three aluminium / rubber finishes in four draws.
export function buildSkylight(T,root,{rim,mouth,soffitY,halfWidth,northWall,southWall,
  sky,skyTurn,texture,material}){
  const group=new T.Group();
  group.name="museum-skylight-glazing";
  root.add(group);
  const fall=.044,span=rim.south-rim.north,mid=(rim.north+rim.south)/2;
  const seat=z=>rim.y+.055+(rim.south-z)*fall;
  const divisionsX=3,divisionsZ=2;
  const bayX=2*rim.x/divisionsX,bayZ=span/divisionsZ;
  const aluminium=material(T.MeshStandardMaterial,{color:0x736c60,metalness:.45,roughness:.34});
  const cap=material(T.MeshStandardMaterial,{color:0xa5a397,metalness:.39,roughness:.29});
  const seal=material(T.MeshStandardMaterial,{color:0x302f2a,metalness:.03,roughness:.83});
  const frame=new Map();
  function profile(finish,x0,x1,z0,z1,bottom,top){
    let batch=frame.get(finish);
    if(!batch){batch={positions:[],indices:[]};frame.set(finish,batch);}
    const y=(z,h)=>typeof h==="number"?seat(z)+h:h(z);
    const corners=[[x0,y(z0,bottom),z0],[x1,y(z0,bottom),z0],[x1,y(z1,bottom),z1],[x0,y(z1,bottom),z1],
                   [x0,y(z0,top),z0],[x1,y(z0,top),z0],[x1,y(z1,top),z1],[x0,y(z1,top),z1]];
    for(const quad of [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]){
      const n=batch.positions.length/3;
      for(const i of quad)batch.positions.push(...corners[i]);
      batch.indices.push(n,n+1,n+2,n,n+2,n+3);
    }
  }
  // A perimeter upstand closes the wedge between level masonry and pitched glass.
  for(const sign of [-1,1]){
    const x=sign*(rim.x+.030),z=sign<0?rim.north-.031:rim.south+.031;
    profile(aluminium,x-.051,x+.051,rim.north-.083,rim.south+.083,()=>rim.y-.027,-.012);
    profile(aluminium,-rim.x+.021,rim.x-.021,z-.052,z+.052,()=>rim.y-.027,-.012);
  }
  // Continuous rafters run downslope. Transoms bear on either side of the rafters.
  // The broader gasket and raised cap leave a fine dark line beside the metal.
  for(let col=0;col<=divisionsX;col++){
    const x=-rim.x+col*bayX;
    profile(aluminium,x-.031,x+.031,rim.north-.04,rim.south+.04,-.105,-.007);
    profile(seal,x-.038,x+.038,rim.north-.045,rim.south+.045,-.009,.021);
    profile(cap,x-.024,x+.024,rim.north-.055,rim.south+.055,.021,.039);
  }
  for(let row=0;row<=divisionsZ;row++){
    const z=rim.north+bayZ*row;
    for(let col=0;col<divisionsX;col++){
      const x=-rim.x+bayX*col;
      profile(aluminium,x+.031,x+bayX-.031,z-.023,z+.023,-.066,-.007);
      profile(seal,x+.031,x+bayX-.031,z-.031,z+.031,-.009,.020);
      profile(cap,x+.024,x+bayX-.024,z-.020,z+.020,.020,.032);
    }
  }
  for(const [finish,data] of frame){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(data.positions,3));
    geometry.setIndex(data.indices);geometry.computeVertexNormals();
    const member=new T.Mesh(geometry,finish);
    member.name=finish===seal?"skylight-glazing-gaskets":finish===cap?"skylight-pressure-caps":"skylight-rafters-and-curb";
    group.add(member);
  }

  const inside=texture("atrium-interior-reflection.webp",true,false);
  inside.wrapS=T.RepeatWrapping;
  const positions=[],uvs=[],indices=[];
  for(let row=0;row<divisionsZ;row++)for(let col=0;col<divisionsX;col++){
    const x=-rim.x+bayX*col,z=rim.north+bayZ*row,n=positions.length/3;
    for(const [u,v] of [[0,0],[0,1],[1,1],[1,0]]){
      const px=x+(u?bayX-.023:.023),pz=z+(v?bayZ-.019:.019);
      positions.push(px,seat(pz)+.002,pz);uvs.push(u,v);
    }
    indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geo.setAttribute("uv",new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
  const glass=material(T.ShaderMaterial,{
    side:T.DoubleSide,toneMapped:false,
    uniforms:{insideView:{value:inside},daySky:{value:sky},skyTurn:{value:skyTurn},
      paneFall:{value:fall},baySize:{value:new T.Vector2(bayX,bayZ)},
      probe:{value:new T.Vector3(0,rim.y-.04,mid)},
      mouth:{value:new T.Vector4(mouth.x,mouth.north,mouth.south,soffitY)},
      rim:{value:new T.Vector4(rim.x,rim.north,rim.south,rim.y)},
      room:{value:new T.Vector3(halfWidth,northWall,southWall)}},
    vertexShader:`varying vec3 point;varying vec2 paneUv;
      void main(){
        point=(modelMatrix*vec4(position,1.)).xyz;paneUv=uv;
        gl_Position=projectionMatrix*viewMatrix*vec4(point,1.);
      }`,
    fragmentShader:`uniform sampler2D insideView,daySky;
      uniform float paneFall,skyTurn;uniform vec2 baySize;
      uniform vec3 probe,room;uniform vec4 mouth,rim;
      varying vec3 point;varying vec2 paneUv;
      vec2 sphereUV(vec3 ray,float turn){
        return vec2(atan(ray.z,ray.x)*.159154943+turn,asin(clamp(ray.y,-1.,1.))*.318309886+.5);
      }
      vec3 interiorRay(vec3 origin,vec3 ray){
        // Intersect the tapered masonry reveal before the room to correct parallax
        // near the edges of the glazed roof. The panorama was captured at the curb.
        vec3 p=origin+ray*max(0.,(rim.w-origin.y)/min(-.0001,ray.y));
        vec3 slopes=(rim.xyz-mouth.xyz)/(rim.w-mouth.w);
        float toSoffit=(mouth.w-p.y)/min(-.0001,ray.y),hit=toSoffit;
        for(int i=0;i<4;i++){
          vec3 plane=i==0?vec3(1.,-slopes.x,0.):i==1?vec3(-1.,-slopes.x,0.):
                     i==2?vec3(0.,slopes.y,-1.):vec3(0.,-slopes.z,1.);
          float edge=i<2?rim.x:i==2?-rim.y:rim.z;
          float velocity=dot(plane,ray);
          float t=(edge-dot(plane,p-vec3(0.,rim.w,0.)))/max(.0001,velocity);
          if(velocity>0.)hit=min(hit,max(0.,t));
        }
        if(hit<toSoffit)return normalize(p+ray*hit-probe);
        vec3 wall=vec3(ray.x<0.?-room.x:room.x,0.,ray.z<0.?room.y:room.z);
        vec3 run=(wall-origin)/(sign(ray+vec3(.000001))*max(abs(ray),vec3(.00001)));
        return normalize(origin+ray*min(run.x,min(run.y,run.z))-probe);
      }
      void main(){
        vec3 look=normalize(point-cameraPosition);
        // Small elastic bowing affects reflected lines near each pane edge.
        vec2 bow=.0024*sin(6.283185*paneUv)*sin(3.141593*paneUv.yx);
        vec3 normal=normalize(vec3(bow.x,1.,paneFall+bow.y));
        float incidence=abs(dot(look,normal));
        vec3 reflected=reflect(look,normal);
        bool below=look.y>0.;
        vec3 exterior=texture2D(daySky,sphereUV(below?look:reflected,skyTurn)).rgb;
        vec3 ray=below?reflected:look;
        vec3 interior=texture2D(insideView,sphereUV(interiorRay(point,ray),.5)).rgb;
        // Internal and external interfaces share the Fresnel return. Absorption
        // increases with optical path length; the laminate edge stays blue-green.
        float f=.04+.96*pow(1.-incidence,5.);
        float reflectance=2.*f/(1.+f);
        vec2 border=min(paneUv,1.-paneUv)*baySize;
        float spacer=(1.-smoothstep(.009,.020,min(border.x,border.y)));
        vec3 transmission=exp(-vec3(.130,.054,.069)*(1.+.52*(1.-incidence)+2.3*spacer));
        vec3 transmitted=(below?exterior:interior)*transmission;
        gl_FragColor=vec4(mix(transmitted,below?interior:exterior,reflectance),1.);
        #include <colorspace_fragment>
      }`
  });
  const panes=new T.Mesh(geo,glass);panes.name="lobby-skylight-laminated-panes";
  group.add(panes);
  // Direct sunlight follows the same rafter layout through the glass to the floor.
  // The penumbra grows with the distance to the receiving surface.
  return `float skylightTransmission(vec3 point,vec2 sunTilt){
    float travel=(${seat(0).toFixed(5)}-point.y-${fall}*point.z)/(1.+${fall}*sunTilt.y);
    vec2 hit=point.xz+sunTilt*travel-vec2(${(-rim.x).toFixed(5)},${rim.north.toFixed(5)});
    vec2 bay=vec2(${bayX.toFixed(6)},${bayZ.toFixed(6)});
    vec2 joint=abs(fract(hit/bay+.5)-.5)*bay;
    float blur=.004+.009*max(0.,travel);
    vec2 cover=clamp((vec2(.033,.026)+blur-joint)/(2.*blur),0.,1.)*min(vec2(1.),vec2(.033,.026)/blur);
    return .88*(1.-max(cover.x,cover.y));
  }`;
}
