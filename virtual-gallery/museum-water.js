// Pool and façade geometry share metres. Trace the first opaque architectural
// surface in the reflected direction, then composite any glass in front of it.
export function waterMaterial(T, panorama, front, halfWidth) {
  return new T.ShaderMaterial({
    uniforms: { skyMap:{value:panorama}, front:{value:front}, hallWidth:{value:halfWidth} },
    vertexShader: `
      varying vec3 waterPoint;
      void main() {
        vec4 world=modelMatrix*vec4(position,1.);
        waterPoint=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      uniform sampler2D skyMap;
      uniform float front,hallWidth;
      varying vec3 waterPoint;

      struct Hit {float t;vec3 normal;int surface;};
      bool bounds(vec3 origin,vec3 inverse,vec3 lo,vec3 hi,out float start,out float end,out vec3 normal) {
        vec3 a=(lo-origin)*inverse,b=(hi-origin)*inverse;
        vec3 nearFace=min(a,b),farFace=max(a,b);
        start=max(max(nearFace.x,nearFace.y),nearFace.z);
        end=min(min(farFace.x,farFace.y),farFace.z);
        normal=nearFace.x>=nearFace.y && nearFace.x>=nearFace.z ? vec3(-sign(inverse.x),0,0) :
            (nearFace.y>=nearFace.z ? vec3(0,-sign(inverse.y),0) : vec3(0,0,-sign(inverse.z)));
        return start>.001 && end>=start;
      }
      void block(vec3 origin,vec3 inv,vec3 lo,vec3 hi,int surface,inout Hit hit) {
        float a,b;vec3 n;
        if(bounds(origin,inv,lo,hi,a,b,n) && a<hit.t)hit=Hit(a,n,surface);
      }
      void clipPlane(vec3 p,vec3 r,vec3 normal,float plane,inout float nearT,inout float farT,inout vec3 face) {
        float side=dot(p,normal)-plane,advance=dot(r,normal);
        if(abs(advance)<.00001){if(side>0.)farT=-1.;return;}
        float t=-side/advance;
        if(advance>0.)farT=min(farT,t);
        else if(t>nearT){nearT=t;face=normalize(normal);}
      }
      vec3 landscape(vec3 origin,vec3 ray) {
        // Sample the actual rotated garden sphere, including its close-range parallax.
        float radius=max(48.,3.*length(vec2(hallWidth,front)));
        vec3 world=origin+vec3(0,0,front);
        float offset=dot(world,ray);
        float t=-offset+sqrt(max(0.,offset*offset+radius*radius-dot(world,world)));
        vec3 direction=normalize(world+t*ray);
        vec2 local=mat2(-.407,-.913,.913,-.407)*direction.xz;
        vec2 uv=vec2(fract(atan(local.y,-local.x)/6.2831853),asin(clamp(direction.y,-1.,1.))/3.1415927+.5);
        return texture2D(skyMap,uv,.38).rgb*vec3(.77,.82,.80);
      }
      float seam(float distance,float fade) {
        return (1.-smoothstep(.001,.006+fade,distance))*min(1.,.011/fade);
      }
      vec3 reflection(vec3 p,vec3 r) {
        float w=hallWidth;
        vec3 inv=(2.*step(vec3(0),r)-1.)/max(abs(r),vec3(.00001));
        Hit hit=Hit(10000.,vec3(0),0);
        float left=-w-8.25,right=w+2.05,lengthX=right-left;
        float footSlope=0.,roofSlope=1.36/lengthX;
        float nearT=.0,farT=10000.;vec3 paneNormal=vec3(0);
        clipPlane(p,r,vec3(-1,0,0),-left,nearT,farT,paneNormal);
        clipPlane(p,r,vec3(1,0,0),right,nearT,farT,paneNormal);
        clipPlane(p,r,vec3(-.34,0,1),.64,nearT,farT,paneNormal);
        clipPlane(p,r,vec3(.34,0,-1),5.20-.64,nearT,farT,paneNormal);
        clipPlane(p,r,vec3(footSlope,-1,0),footSlope*left-4.72,nearT,farT,paneNormal);
        clipPlane(p,r,vec3(-roofSlope,1,0),7.46-roofSlope*left+.12,nearT,farT,paneNormal);
        if(nearT>.001 && nearT<farT)hit=Hit(nearT,paneNormal,9);
        float pierX=-w-5.06,pierZ=.34*pierX-1.76;
        block(p,inv,vec3(pierX-.68,0,pierZ-1.91),vec3(pierX+.68,4.87,pierZ+1.91),2,hit);
        pierX=w+.70;pierZ=.34*pierX-1.76;
        block(p,inv,vec3(pierX-.87,0,pierZ-1.91),vec3(pierX+.87,4.87,pierZ+1.91),2,hit);
        block(p,inv,vec3(-w-8.55,0,2.95),vec3(-w-.35,1.005,3.29),2,hit);
        block(p,inv,vec3(-w-8.55,0,-1.40),vec3(-w-8.27,.97,3.20),2,hit);
        block(p,inv,vec3(w+.07,3.64,-4.5),vec3(w+4.87,3.82,-.62),10,hit);
        block(p,inv,vec3(right-2.72,0,.34*(right-2.72)+.64-5.20),vec3(right-.08,7.46+roofSlope*(right-left)-.05,.34*right+.64-3.18),10,hit);
        block(p,inv,vec3(-w-.04,3.82,-.003),vec3(w+.04,4.45,.157),5,hit);
        block(p,inv,vec3(-w,3.64,-.05),vec3(w,3.82,.27),2,hit);
        block(p,inv,vec3(-w,0,-2.*front),vec3(w,4.34,-2.*front+.04),7,hit);
        // The flat soffit is continuous except at the open sky court. World z
        // is translated to the same local façade coordinates as the pool.
        vec3 wellLo=vec3(-2.18,4.34,-front-4.90),wellHi=vec3(2.18,5.20,-front-.72);
        float roofT=(4.34-p.y)*inv.y;
        vec3 roofPoint=p+roofT*r;
        bool inCourt=abs(roofPoint.x)<wellHi.x && roofPoint.z>wellLo.z && roofPoint.z<wellHi.z;
        if(r.y>.001 && roofT<hit.t && abs(roofPoint.x)<w && roofPoint.z>=-2.*front && roofPoint.z<.14 && !inCourt)
          hit=Hit(roofT,vec3(0,-1,0),5);
        float a,b;vec3 n;
        if(bounds(p,inv,wellLo,wellHi,a,b,n) && a<hit.t) {
          if(abs(n.y)<.5)hit=Hit(a,n,8);
          else if(b<hit.t && p.y+b*r.y<wellHi.y-.001) {
            vec3 exitPoint=p+b*r;
            n=abs(abs(exitPoint.x)-wellHi.x)<.002 ? vec3(-sign(exitPoint.x),0,0) : vec3(0,0,-sign(r.z));
            hit=Hit(b,n,8);
          }
        }
        vec3 color;
        if(hit.surface==0)color=landscape(p,r);
        else {
          vec3 q=p+hit.t*r;
          float facing=.81+.10*hit.normal.z-.11*hit.normal.x+.22*hit.normal.y;
          if(hit.surface==9) {
            float base=4.72,top=7.46+roofSlope*(q.x-left);
            if(hit.normal.y<-.5)color=vec3(.115,.097,.071);
            else if(hit.normal.y>.5 || q.y>top-.015 || q.y<base+.30)color=vec3(.057,.067,.062);
            else {
              vec3 env=landscape(q,reflect(r,hit.normal));
              color=vec3(.008,.038,.057)+min(dot(env,vec3(.21,.72,.07)),.72)*vec3(.09,.175,.211)+env*vec3(.034,.058,.066);
              vec2 grid=vec2(abs(hit.normal.x)>.8?(q.z-.34*q.x-.64)/2.60:(q.x-left)*13./lengthX,
                (q.y-base-.30)*4./(top-base-.30));
              float distance=min(abs(fract(grid.x+.5)-.5),abs(fract(grid.y+.5)-.5));
              color=mix(color*.32,color,smoothstep(.005,.037,distance));
            }
          }else if(hit.surface==10)color=vec3(.042,.051,.044);
          else if(hit.surface==6)color=vec3(.16,.118,.079)*facing;
          else if(hit.surface==7)color=mix(vec3(.268,.283,.265),vec3(.44,.438,.395),smoothstep(-2.4,2.,q.x))*facing;
          else if(hit.surface==8)color=vec3(.71,.68,.58)*facing;
          else if(hit.surface==5)color=vec3(.55,.565,.515)*facing;
          else color=vec3(.433,.44,.402)*facing;
        }
        // Only the side lights are glazed; the centre passage opens into the hall.
        if(r.z<-.001) {
          float t=(.199-p.z)*inv.z;vec3 g=p+t*r;
          bool side=abs(g.x)>2.40 && abs(g.x)<w-.36 && g.y>.10 && g.y<3.64;
          if(side && t>0. && t<hit.t) {
            vec3 glassRay=vec3(r.xy,-r.z);
            vec3 reflected=landscape(g,glassRay)*vec3(.87,.98,1.03);
            color=mix(color,reflected,.22+.58*pow(1.-abs(r.z),3.));
            float spacing=(w-.36-2.40)/max(1.,floor((w-.36-2.40)/1.65+.5));
            float mullion=abs(fract((abs(g.x)-2.40)/spacing+.5)-.5)*spacing;
            color=mix(color,vec3(.096,.116,.11),1.-smoothstep(.008,.030,mullion));
          }
        }
        return color;
      }
      void main() {
        vec3 local=waterPoint-vec3(0,0,front);
        vec3 eye=normalize(cameraPosition-waterPoint);
        float swell=sin(local.x*.77+local.z*.51)+.57*sin(local.z*1.47-local.x*.61);
        vec3 normal=normalize(vec3(.0038*sin(local.z*10.6+local.x*3.7+swell)
          +.0015*sin(local.z*17.2-swell),1.,.0041*sin(local.x*8.4+local.z*3.1+swell)));
        vec3 reflected=reflection(local,reflect(-eye,normal));
        float fresnel=.024+.976*pow(1.-clamp(dot(normal,eye),0.,1.),5.);
        gl_FragColor=vec4(mix(vec3(.027,.054,.049),reflected,fresnel),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}
