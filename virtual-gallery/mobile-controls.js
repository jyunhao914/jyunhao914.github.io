import * as T from "./vendor/three.module.js";

export function mobileControls(host, turn, suspended) {
  const pad = document.createElement("div");
  pad.className = "pad walk-pad";
  pad.innerHTML = '<button class="walk-stick" type="button" aria-label="移動搖桿"><span class="walk-knob"></span></button>';
  const stick = pad.firstElementChild, knob = stick.firstElementChild;
  host.append(pad);
  const vector = new T.Vector2();
  let pointer = null, previous = null, listening = false, disposed = false, timer;
  function release() {
    pointer = null;
    vector.set(0,0);
    knob.style.transform = "";
    previous = null;
  }
  function steer(e) {
    const r = stick.getBoundingClientRect();
    vector.set((e.clientX-r.left-r.width/2)/(r.width*.36),(e.clientY-r.top-r.height/2)/(r.height*.36)).clampLength(0,1);
    if(vector.lengthSq()<.012) vector.set(0,0);
    knob.style.transform = 'translate('+vector.x*19+'px,'+vector.y*19+'px)';
  }
  stick.onpointerdown = e => {
    if(pointer!==null)return;
    e.preventDefault();
    pointer=e.pointerId;
    stick.setPointerCapture(pointer);
    steer(e);
  };
  stick.onpointermove=e=>{if(pointer===e.pointerId) steer(e)};
  stick.onlostpointercapture=stick.onpointercancel=stick.onpointerup=e=>{if(pointer===e.pointerId) release()};

  const toggle=document.getElementById("gyroTurn"), status=document.getElementById("gyroStatus");
  const direction=new T.Vector3(), rotation=new T.Euler();
  function sample(e) {
    if(![e.alpha,e.beta,e.gamma].every(Number.isFinite)) return;
    clearTimeout(timer);
    if(status && status.textContent!=="已啟用") status.textContent="已啟用";
    if(suspended() || document.hidden){previous=null;return}
    const rad=Math.PI/180;
    rotation.set(e.beta*rad,e.alpha*rad,-e.gamma*rad,"YXZ");
    direction.set(0,-1,0).applyEuler(rotation);
    const pitch=Math.asin(T.MathUtils.clamp(direction.y,-1,1)), yaw=Math.atan2(-direction.x,-direction.z);
    if(previous) {
      const dyaw=Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw));
      if(Math.abs(dyaw)<.55 && Math.abs(pitch-previous.pitch)<.55)
        turn(Math.abs(direction.y)<.98 ? dyaw : 0,pitch-previous.pitch);
    }
    previous={yaw,pitch};
  }
  function disable() {
    clearTimeout(timer);
    window.removeEventListener("deviceorientation",sample);
    listening=false;previous=null;
    toggle?.setAttribute("aria-pressed","false");
  }
  async function toggleMotion() {
    if(listening){disable();status.textContent="已關閉";return}
    toggle.disabled=true;
    try {
      const sensor=window.DeviceOrientationEvent;
      if(!sensor) throw Error();
      if(typeof sensor.requestPermission==="function" && await sensor.requestPermission()!=="granted") throw Error();
      if(disposed)return;
      listening=true;previous=null;
      toggle.setAttribute("aria-pressed","true");
      status.textContent="等待感測器";
      window.addEventListener("deviceorientation",sample);
      timer=setTimeout(()=>{disable();status.textContent="未收到感測資料，可拖曳轉身"},3500);
    } catch { if(!disposed) status.textContent="未取得感測權限，可拖曳轉身"; }
    finally {if(!disposed)toggle.disabled=false;}
  }
  if(toggle){toggle.disabled=false;toggle.setAttribute("aria-pressed","false");status.textContent="已關閉";toggle.onclick=toggleMotion;}
  window.addEventListener("blur",release);
  return {vector,release,dispose(){
    disposed=true;disable();release();window.removeEventListener("blur",release);
    if(toggle)toggle.onclick=null;
    pad.remove();
  }};
}
