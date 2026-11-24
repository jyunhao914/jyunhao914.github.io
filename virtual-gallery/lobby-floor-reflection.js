// The stone sees the same room as the visitor. Mirror only views from inside
// the hall and clip at the real floor, keeping objects below the slab out.
export function createFloorReflection(T,renderer,scene,floor,invalidate){
  if(!floor)return null;
  const mirror=new T.PerspectiveCamera(),target=new T.WebGLRenderTarget(1,1,{
    depthBuffer:true,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter
  });
  target.texture.name="reception-stone-reflection";
  const textureMatrix=new T.Matrix4(),size=new T.Vector2(),pixel=new T.Vector2(),look=new T.Vector3(),up=new T.Vector3();
  const plane=new T.Plane(),normal=new T.Vector3(0,1,0),point=new T.Vector3(0,.006,0);
  const clip=new T.Vector4(),q=new T.Vector4(),enabled={value:0};
  const material=floor.material,compile=material.onBeforeCompile,originalKey=material.customProgramCacheKey.bind(material);
  const key=originalKey();
  material.customProgramCacheKey=()=>key+"-polished-stone41";
  material.onBeforeCompile=function(shader,r){
    compile.call(this,shader,r);
    Object.assign(shader.uniforms,{floorMirror:{value:target.texture},floorProjection:{value:textureMatrix},
      reflectionPixel:{value:pixel},reflectionEnabled:enabled});
    shader.vertexShader="uniform mat4 floorProjection; varying vec4 floorImage;\n"+shader.vertexShader.replace("#include <project_vertex>",
      "#include <project_vertex>\nfloorImage=floorProjection*modelMatrix*vec4(transformed,1.);");
    shader.fragmentShader="uniform sampler2D floorMirror; uniform vec2 reflectionPixel; uniform float reflectionEnabled; varying vec4 floorImage;\n"+
      shader.fragmentShader.replace("#include <opaque_fragment>",`
        vec2 projected=floorImage.xy/max(.0001,floorImage.w);
        if(reflectionEnabled>.5 && floorImage.w>0. && all(greaterThan(projected,vec2(0.))) && all(lessThan(projected,vec2(1.)))){
          float facing=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
          vec2 spread=reflectionPixel*mix(1.2,5.5,roughnessFactor)*(1.+.5*facing);
          vec3 field=texture2D(floorMirror,projected).rgb*.40;
          field+=(texture2D(floorMirror,projected+spread*vec2(1.,.5)).rgb+
                  texture2D(floorMirror,projected+spread*vec2(-.5,1.)).rgb+
                  texture2D(floorMirror,projected-spread*vec2(1.,.5)).rgb+
                  texture2D(floorMirror,projected-spread*vec2(-.5,1.)).rgb)*.15;
          float fresnel=(.048+.52*pow(1.-facing,4.))*(1.-.42*roughnessFactor);
          outgoingLight=mix(outgoingLight,field,fresnel);
        }
        #include <opaque_fragment>`);
  };
  material.needsUpdate=true;
  let last=-Infinity,pending=0,forceNext=false;
  function render(camera,inside,now){
    enabled.value=Number(inside);
    if(!inside){clearTimeout(pending);pending=0;forceNext=false;return;}
    // Texture loads, the last step of a walk and the final card transition may
    // arrive inside the rate limit. Always capture their settled state once.
    if(!forceNext && now-last<28){
      if(!pending)pending=setTimeout(()=>{pending=0;forceNext=true;invalidate();},Math.ceil(29-(now-last)));
      return;
    }
    clearTimeout(pending);pending=0;forceNext=false;last=now;
    renderer.getSize(size);
    const scale=Math.min(.46,590/Math.max(size.x,size.y)),w=Math.max(2,Math.round(size.x*scale)),h=Math.max(2,Math.round(size.y*scale));
    if(target.width!==w||target.height!==h)target.setSize(w,h);
    pixel.set(1/w,1/h);
    mirror.position.copy(camera.position);mirror.position.y=-mirror.position.y;
    camera.getWorldDirection(look);look.y=-look.y;look.add(mirror.position);
    up.set(0,1,0).applyQuaternion(camera.quaternion);up.y=-up.y;
    mirror.up.copy(up);mirror.lookAt(look);mirror.updateMatrixWorld();
    mirror.far=camera.far;mirror.near=camera.near;mirror.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(normal,point).applyMatrix4(mirror.matrixWorldInverse);
    clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const m=mirror.projectionMatrix.elements;
    q.set((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
    clip.multiplyScalar(2/clip.dot(q));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1-.001;m[14]=clip.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const original=renderer.getRenderTarget(),visible=floor.visible;
    floor.visible=false;
    try{renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,mirror);}
    finally{renderer.setRenderTarget(original);floor.visible=visible;}
  }
  return {render,dispose(){clearTimeout(pending);target.dispose();}};
}
