// The parent group is centred on the south wall: local +z faces the garden.
// The grounds own the shared panorama, the materials array and all child geometries.
export function buildFacade(T,root,{width,depth=5.9,panorama,materials}){
  const w=width, group=new T.Group();
  group.name="museum-facade";
  root.add(group);
  function finish(opts){
    const m=new T.MeshStandardMaterial(opts);
    materials.push(m);return m;
  }
  const metal=finish({color:0x44534e,metalness:.29,roughness:.47});
  const flashing=finish({color:0x88918c,metalness:.36,roughness:.45});
  const roof=finish({color:0x89958e,roughness:.64,metalness:.21});
  const lead=finish({color:0x61706b,roughness:.63,metalness:.28});

  // One reflection sample per window fragment. Schlick reflectance changes with the viewing
  // angle. The close soffit and paving intercept reflected rays before the distant tree line.
  const windowMaterial=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{environs:{value:panorama},halfWidth:{value:w}},
    vertexShader:`varying vec3 localPoint;varying vec3 worldPoint;
      void main(){localPoint=position;vec4 p=modelMatrix*vec4(position,1.);worldPoint=p.xyz;
      gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform sampler2D environs;uniform float halfWidth;
      varying vec3 localPoint;varying vec3 worldPoint;
      void main(){
        vec3 sight=normalize(cameraPosition-worldPoint);
        float incidence=abs(sight.z);
        float fresnel=.045+.955*pow(1.-incidence,5.);
        // Small deviations in large laminated panes disturb reflections while keeping the interior legible.
        vec3 n=normalize(vec3(.0021*sin(localPoint.x*3.4+localPoint.y),.0017*cos(localPoint.y*3.2),1.));
        vec3 r=reflect(-sight,n);
        vec3 panoramaRay=vec3(.887*r.x+.462*r.z,r.y,-.462*r.x+.887*r.z);
        vec2 uv=vec2(fract(atan(panoramaRay.z,-panoramaRay.x)/6.283185+.99999),asin(clamp(panoramaRay.y,-1.,1.))/3.141593+.5);
        vec3 garden=texture2D(environs,uv).rgb;
        vec3 reflected=garden*vec3(.88,.99,1.05)+vec3(.009,.017,.023);
        if(r.y>.002 && localPoint.y<3.415){
          float t=(3.415-localPoint.y)/r.y;vec3 p=localPoint+r*t;
          if(p.z>.01 && p.z<3.37 && abs(p.x)<halfWidth+.86){
            float slat=abs(fract((p.x+halfWidth+.82)/.29+.5)-.5)*.29;
            reflected=mix(vec3(.14,.100,.063),vec3(.068,.055,.040),smoothstep(.020,.047,slat));
          }
        }
        if(r.y<-.008){
          float t=-localPoint.y/r.y;vec3 p=localPoint+r*t;
          if(p.z>.15 && p.z<15. && p.x>-2.75 && p.x<3.86)
            reflected=mix(reflected,vec3(.20,.185,.151),.60);
        }
        float alpha=clamp(.19+.75*fresnel+(1.-incidence)*.10,.10,.93);
        if(sight.z<0.){
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
  // interior door lettering and artworks are visible, including as the camera approaches.
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
  // Match the existing metal mullions in the foyer. The door and its stacked leaves
  // occupy the middle 2.4 m. No glazing crosses this route, even at the floor.
  const sideStart=1.39,sideEnd=w-.36,sill=.55,head=3.64;
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

  const vaults=3,halfBay=w/vaults,spring=4.14,rise=.72,topPlate=3.86;
  const zGlass=-.115,zFront=.142,zEnd=-2*depth-.05;
  block(metal,0,topPlate+.021,.004,2*w+.02,.051,.42);
  block(flashing,0,topPlate+.044,.160,2*w+.06,.014,.15);
  block(lead,0,topPlate+.027,.230,2*w+.06,.027,.018);
  function vaultY(dx){return spring+rise*Math.sqrt(Math.max(0,1-(dx/halfBay)**2));}
  for(let i=0;i<vaults;i++){
    const cx=(-vaults+1+2*i)*halfBay,divisions=48;
    // The low arched top of the clerestory is clear glass. Its long sill continues
    // across the three bays without the solid gable used for a load-bearing wall.
    for(let j=0;j<divisions;j++){
      const t=-Math.PI/2+j*Math.PI/divisions,q=-Math.PI/2+(j+1)*Math.PI/divisions;
      const x1=cx+halfBay*Math.sin(t),x2=cx+halfBay*Math.sin(q);
      const h1=spring+rise*Math.cos(t),h2=spring+rise*Math.cos(q);
      pane(x1,x2,topPlate+.043,h1-.018,h2-.018,zGlass);
      polygon(piece(metal),[[x1,h1-.037,zGlass+.020],[x2,h2-.037,zGlass+.020],[x2,h2+.008,zGlass+.020],[x1,h1+.008,zGlass+.020]]);
      // The folded edge is 58 mm tall. Standing-seam sheets follow the actual
      // underside (+65 mm) and recede behind the facade; no solid semicircular cap.
      const y1=h1+.065,y2=h2+.065;
      polygon(piece(flashing),[[x1,y1-.058,zFront],[x2,y2-.058,zFront],[x2,y2,zFront],[x1,y1,zFront]]);
      polygon(piece(lead),[[x1,h1+.007,zGlass+.015],[x2,h2+.007,zGlass+.015],[x2,y2-.056,zFront],[x1,y1-.056,zFront]]);
      polygon(piece(roof),[[x1,y1,zFront],[x2,y2,zFront],[x2,y2,zEnd],[x1,y1,zEnd]]);
      if((j%8===4 || j%8===5) && j>2 && j<divisions-3){
        const left=j%8===4,x=left?x2:x1,y=left?y2:y1,edge=x+(left?-.009:.009);
        polygon(piece(lead),[[x,y+.020,zFront-.045],[edge,y,zFront-.045],[edge,y,zEnd],[x,y+.020,zEnd]]);
      }
    }
    for(const fraction of [-1,-.40,.40,1]){
      if(i>0 && fraction===-1)continue;
      const dx=fraction*halfBay,h=vaultY(dx)-topPlate;
      block(metal,cx+dx,topPlate+h/2,zGlass+.029,.034,h,.092);
      block(flashing,cx+dx,topPlate+h/2,zGlass+.082,.012,h,.015);
    }
  }
  const glazing=mesh("museum-reflective-glazing",glass,windowMaterial);
  glazing.renderOrder=3;glazing.raycast=()=>{};
  for(const [mat,data] of opaque){
    mesh(mat===roof?"museum-vault-standing-seam":mat===flashing?"museum-vault-flashing":mat===lead?"museum-roof-folds":"museum-window-caps",data,mat);
  }
  return group;
}
