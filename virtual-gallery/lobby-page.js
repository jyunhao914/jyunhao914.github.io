// The public room directory remains usable while WebGL loads or when it is unavailable.
export function lobbyPage(enterRoom) {
  const el=id=>document.getElementById(id), entrance=el("hallEntrance"), stage=el("lobbyStage");
  const panel=el("lobbyDirectoryPanel"), directory=el("lobbyDirectory"), message=el("lobbyMessage");
  const enter=el("lobbyEnterDoor"), expand=el("lobbyExpand"), home=el("lobbyHome"), retry=el("lobbyRetry");
  if(location.pathname.startsWith("/public/")) {
    el("lobbyAdminLink").href="/";
    el("lobbyDownload").hidden=true;
  }
  let scene, generation=0, active=false, unavailable=false, fallbackFull=false, quietTimer;
  let rooms=[], returnIndex=-1, pointer;
  const fullscreen=()=>document.fullscreenElement===document.documentElement || fallbackFull;
  function reveal() {
    clearTimeout(quietTimer);
    entrance.classList.remove("lobby-quiet");
    if(active && fullscreen() && !panel.open && !entrance.querySelector(".lobby-head :focus-visible")) {
      quietTimer=setTimeout(()=>entrance.classList.add("lobby-quiet"),2800);
    }
  }
  function syncFullscreen() {
    expand.textContent=fullscreen() ? "退出全螢幕" : "全螢幕";
    reveal();
  }
  expand.onclick=async()=>{
    if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    else if(fallbackFull)fallbackFull=false;
    else {
      try {await document.documentElement.requestFullscreen({navigationUI:"hide"});}
      catch {fallbackFull=true;}
    }
    syncFullscreen();
    stage.querySelector("canvas")?.focus({preventScroll:true});
  };
  document.addEventListener("fullscreenchange",()=>{if(active)syncFullscreen();});
  function showDirectory() {
    if(!active || !rooms.length)return;
    scene?.setPaused(true);
    reveal();
    if(!panel.open)panel.showModal();
  }
  directory.onclick=showDirectory;
  el("lobbyDirectoryClose").onclick=()=>panel.close();
  panel.addEventListener("cancel",e=>{if(unavailable)e.preventDefault();});
  panel.addEventListener("close",()=>{
    if(!active || panel.open || unavailable)return;
    scene?.setPaused(false);
    stage.querySelector("canvas")?.focus({preventScroll:true});
    reveal();
  });
  home.onclick=()=>{scene?.home();panel.close();};
  enter.onclick=()=>{scene?.enterNearest();};
  stage.addEventListener("lobbyblanktap",reveal);
  entrance.addEventListener("keydown",e=>{
    if(e.key==="Tab")reveal();
    if(e.key==="Escape" && fallbackFull && !panel.open){fallbackFull=false;syncFullscreen();}
  },true);
  stage.addEventListener("pointerdown",e=>{
    if(!fullscreen())return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
    if(e.target.closest(".walk-stick"))entrance.classList.add("lobby-quiet","stick-active");
  },true);
  stage.addEventListener("pointermove",e=>{
    if(pointer?.id===e.pointerId && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)
      entrance.classList.add("lobby-quiet");
  },true);
  function release(e) {
    if(pointer?.id!==e.pointerId)return;
    pointer=null;
    entrance.classList.remove("stick-active");
  }
  window.addEventListener("pointerup",release,true);
  window.addEventListener("pointercancel",release,true);
  function near(index) {
    const room=rooms[index];
    enter.hidden=!room;
    if(room)enter.textContent="進入"+room.title;
  }
  function destroyScene() {
    ++generation;
    scene?.dispose();
    scene=null;
    stage.replaceChildren();
    near(null);
  }
  function failed() {
    destroyScene();
    unavailable=true;
    message.textContent="此裝置暫時無法顯示 3D 大廳。";
    message.hidden=false;
    el("hallStatus").textContent="3D 大廳暫時無法顯示，可從名錄選展廳。";
    el("lobbyDirectoryClose").hidden=home.hidden=el("lobbyHint").hidden=el("lobbyGuide").hidden=true;
    retry.hidden=false;
    showDirectory();
    el("hallList").querySelector("a")?.focus({preventScroll:true});
    panel.scrollTop=0;
  }
  async function start(exit) {
    destroyScene();
    const version=generation;
    unavailable=false;
    retry.hidden=true;
    home.disabled=true;
    home.hidden=el("lobbyDirectoryClose").hidden=el("lobbyGuide").hidden=false;
    el("hallStatus").textContent="開放參觀 · "+rooms.length+" 個展廳";
    message.textContent="正在開啟展場大廳…";message.hidden=false;
    el("lobbyHint").hidden=true;
    try {
      const {createLobby}=await import("./lobby.js?v=lobby35");
      if(!active || version!==generation)return;
      scene=createLobby(stage,rooms,index=>{
        if(active && !panel.open && rooms[index])enterRoom(rooms[index]);
      },{returnDoorIndex:returnIndex,onNearest:near});
      const canvas=stage.querySelector("canvas");
      canvas.addEventListener("webglcontextlost",e=>{
        if(!active || version!==generation)return;
        e.preventDefault();failed();
      },{once:true});
      home.disabled=false;
      message.hidden=true;
      el("lobbyHint").hidden=false;
      if(panel.open)scene.setPaused(true);
      await exit;
      if(active && !panel.open && version===generation)canvas.focus({preventScroll:true});
    } catch {if(active && version===generation)failed();}
  }
  retry.onclick=()=>{unavailable=false;panel.close();start();};
  return {
    open(doors,fromIndex,exit,expanded) {
      active=true;rooms=doors;returnIndex=fromIndex;fallbackFull=expanded;
      document.body.classList.add("in-lobby");
      directory.disabled=false;
      syncFullscreen();
      start(exit);
    },
    close() {
      if(!active)return false;
      const inherited=fallbackFull;
      active=false;unavailable=false;fallbackFull=false;pointer=null;
      stage.dispatchEvent(new Event("discardnavigation"));
      clearTimeout(quietTimer);
      entrance.classList.remove("lobby-quiet","stick-active");
      document.body.classList.remove("in-lobby");
      if(panel.open)panel.close();
      destroyScene();rooms=[];
      return inherited;
    }
  };
}
