// The public room directory remains usable while WebGL loads or when it is unavailable.
export function lobbyPage(enterRoom,prepareRoom) {
  const el=id=>document.getElementById(id), entrance=el("hallEntrance"), stage=el("lobbyStage");
  const panel=el("lobbyDirectoryPanel"), directory=el("lobbyDirectory"), message=el("lobbyMessage");
  const enter=el("lobbyEnterDoor"), expand=el("lobbyExpand"), home=el("lobbyHome"), retry=el("lobbyRetry");
  if(location.pathname.startsWith("/public/")) {
    el("lobbyAdminLink").href="/";
    el("lobbyDownload").hidden=true;
  }
  let scene, generation=0, active=false, unavailable=false, fallbackFull=false, quietTimer, zone="grounds";
  let rooms=[], selectedIndex=0, returnIndex=-1, pointer, crossing=false, waitTimer, blend;
  const fullscreen=()=>document.fullscreenElement===document.documentElement || fallbackFull;
  function reveal() {
    clearTimeout(quietTimer);
    entrance.classList.remove("lobby-quiet");
    if(active && fullscreen() && !panel.open && !entrance.querySelector(".lobby-head :focus-visible, .lobby-wayfinding :focus-visible")) {
      quietTimer=setTimeout(()=>entrance.classList.add("lobby-quiet"),2800);
    }
  }
  function syncFullscreen() {
    const label=fullscreen() ? "退出全螢幕" : "全螢幕";
    expand.querySelector(".lobby-tool-label").textContent=label;
    expand.setAttribute("aria-label",label);
    expand.setAttribute("aria-pressed",String(fullscreen()));
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
    if(!active || crossing || !rooms.length)return;
    scene?.setPaused(true);
    reveal();
    if(!panel.open)panel.showModal();
  }
  directory.onclick=showDirectory;
  el("lobbyDirectoryClose").onclick=()=>panel.close();
  panel.addEventListener("cancel",e=>{if(unavailable)e.preventDefault();});
  panel.addEventListener("close",()=>{
    if(!active || panel.open || unavailable || crossing)return;
    scene?.setPaused(false);
    stage.querySelector("canvas")?.focus({preventScroll:true});
    reveal();
  });
  home.onclick=()=>{scene?.home();panel.close();};
  enter.onclick=()=>{
    if(zone==="grounds")scene?.enterMuseum();
    else if(selectedIndex!=null)scene?.enterDoor(selectedIndex);
  };
  el("lobbyPrevHall").onclick=()=>scene?.cycleMenu(-1);
  el("lobbyNextHall").onclick=()=>scene?.cycleMenu(1);
  el("lobbyMenuNav").addEventListener("keydown",event=>{
    if(zone!=="lobby" || event.altKey || event.ctrlKey || event.metaKey ||
      !["ArrowLeft","ArrowRight"].includes(event.key))return;
    event.preventDefault();
    event.stopPropagation();
    scene?.cycleMenu(event.key==="ArrowRight" ? 1 : -1);
  });
  el("lobbyMenuNav").addEventListener("focusin",reveal);
  el("lobbyReturnGrounds").onclick=()=>{
    panel.close();
    scene?.setPaused(false);
    scene?.exitMuseum();
    stage.querySelector("canvas")?.focus({preventScroll:true});
  };
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
    if(Number.isInteger(index))selectedIndex=index;
    const outdoors=zone==="grounds";
    for(const direction of ["lobbyPrevHall","lobbyNextHall"])
      el(direction).hidden=outdoors || unavailable || rooms.length<2;
    const room=rooms[selectedIndex];
    enter.hidden=unavailable || (!outdoors && !room);
    enter.textContent=outdoors || !room ? "" : room.title;
    enter.setAttribute("aria-label",outdoors ? "進入展場大廳" : "進入"+(room?.title || "展廳"));
    const selection=outdoors || !room ? "" : room.title+"，第 "+(selectedIndex+1)+" 個展廳，共 "+rooms.length+" 個";
    if(el("lobbySelection").textContent!==selection)el("lobbySelection").textContent=selection;
  }
  function setZone(value) {
    zone=value;
    document.body.dataset.zone=zone;
    entrance.dataset.zone=zone;
    const outside=zone==="grounds";
    el("entranceTitle").textContent=outside ? "美術館園區" : "展場大廳";
    stage.setAttribute("aria-label",outside ? "可步行的美術館園區" : "可步行的 3D 展場大廳");
    stage.querySelector("canvas")?.setAttribute("aria-label",outside ? "美術館園區" : "展場大廳");
    el("lobbyHint").textContent=outside ? "拖曳環顧 · 沿石徑入館" : "拖曳環顧 · 左右滑動展廳卡片，點選進場";
    el("lobbyReturnGrounds").hidden=outside || unavailable;
    home.textContent=outside ? "回到園區起點" : "回到大廳起點";
    el("lobbyDirectoryClose").textContent=outside ? "返回園區" : "返回大廳";
    document.title=el("entranceTitle").textContent+"｜虛擬策展工作室";
    el("lobbyMenuNav").setAttribute("aria-label",outside ? "園區入口" : "展廳卡片");
    near(null);
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
    enter.hidden=true;
    el("lobbyReturnGrounds").hidden=el("lobbyPrevHall").hidden=el("lobbyNextHall").hidden=true;
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
    setZone(returnIndex>=0 ? "lobby" : "grounds");
    enter.disabled=el("lobbyPrevHall").disabled=el("lobbyNextHall").disabled=true;
    message.textContent=returnIndex>=0 ? "正在開啟展場大廳…" : "正在載入空間…";message.hidden=false;
    el("lobbyHint").hidden=true;
    try {
      const {createLobby}=await import("./lobby.js?v=atrium40");
      if(!active || version!==generation)return;
      const signs=rooms.map(({title,subtitle,room,show})=>({title,subtitle,room,show:{id:show.id,title:show.title}}));
      scene=createLobby(stage,signs,index=>{
        if(active && !panel.open && rooms[index])enterRoom(rooms[index]);
      },{
        returnDoorIndex:returnIndex,onNearest:near,onZone:setZone,
        onTravel:walking=>entrance.classList.toggle("portal-walking",walking),
        onApproach() {
          entrance.classList.add("portal-approach");
          prepareRoom();
        },
        onApproachCancel() {entrance.classList.remove("portal-approach");}
      });
      const canvas=stage.querySelector("canvas");
      canvas.addEventListener("webglcontextlost",e=>{
        if(!active || version!==generation)return;
        e.preventDefault();failed();
      },{once:true});
      home.disabled=false;
      enter.disabled=el("lobbyPrevHall").disabled=el("lobbyNextHall").disabled=false;
      message.hidden=true;
      el("lobbyHint").hidden=false;
      if(panel.open)scene.setPaused(true);
      await exit;
      if(active && !panel.open && version===generation)canvas.focus({preventScroll:true});
    } catch {if(active && version===generation)failed();}
  }
  retry.onclick=()=>{unavailable=false;panel.close();start();};
  function resetCrossing() {
    clearTimeout(waitTimer);
    blend?.cancel();
    blend=null;
    crossing=false;
    stage.inert=false;
    el("portalWait").hidden=true;
    entrance.classList.remove("portal-approach","portal-outgoing","portal-blending","portal-walking");
  }
  return {
    open(doors,fromIndex,exit,expanded) {
      resetCrossing();
      active=true;rooms=doors;returnIndex=fromIndex;selectedIndex=fromIndex>=0 ? fromIndex : 0;fallbackFull=expanded;
      document.body.classList.add("in-lobby");
      directory.disabled=false;
      syncFullscreen();
      start(exit);
    },
    choose(index) {
      if(!active || !scene || unavailable || crossing)return false;
      if(panel.open)panel.close();
      scene.setPaused(false);
      stage.querySelector("canvas")?.focus({preventScroll:true});
      return scene.enterDoor(index);
    },
    hold() {
      crossing=true;
      scene?.setPaused(true);
      stage.inert=true;
      entrance.classList.add("portal-outgoing");
      waitTimer=setTimeout(()=>{if(crossing)el("portalWait").hidden=false;},900);
      return fallbackFull;
    },
    async revealRoom() {
      clearTimeout(waitTimer);
      el("portalWait").hidden=true;
      entrance.classList.add("portal-blending");
      const duration=matchMedia("(prefers-reduced-motion: reduce)").matches ? 90 : 550;
      blend=entrance.animate([{opacity:1},{opacity:0}],{duration,easing:"ease-in-out",fill:"forwards"});
      await blend.finished.catch(()=>{});
    },
    close() {
      if(!active)return false;
      const inherited=fallbackFull;
      active=false;unavailable=false;fallbackFull=false;pointer=null;
      resetCrossing();
      stage.dispatchEvent(new Event("discardnavigation"));
      clearTimeout(quietTimer);
      entrance.classList.remove("lobby-quiet","stick-active");
      document.body.classList.remove("in-lobby");
      delete document.body.dataset.zone;
      if(panel.open)panel.close();
      destroyScene();rooms=[];
      return inherited;
    }
  };
}
