// Safari limits the number of WebGL canvases a page may create. Keep one idle
// canvas per visitor surface while disposing the Three.js scene resources on exit.
const spareContexts=new WeakMap();

export function publicRenderer(T,host,options){
  const spare=spareContexts.get(host);
  spareContexts.delete(host);
  let renderer;
  if(spare && !spare.context.isContextLost()){
    try{renderer=new T.WebGLRenderer({...options,canvas:spare.canvas,context:spare.context});}
    catch{if(!spare.context.isContextLost())spare.context.getExtension("WEBGL_lose_context")?.loseContext();}
  }
  renderer??=new T.WebGLRenderer(options);
  let released=false;
  return {renderer,release(discard=false){
    if(released)return;
    released=true;
    const canvas=renderer.domElement,context=renderer.getContext();
    const reusable=!discard && !context.isContextLost() && !spareContexts.has(host);
    if(reusable)renderer.resetState();
    renderer.dispose();
    if(reusable){
      canvas.width=canvas.height=1;
      spareContexts.set(host,{canvas,context});
    }else if(!context.isContextLost())renderer.forceContextLoss();
  }};
}
