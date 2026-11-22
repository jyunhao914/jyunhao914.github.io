const $ = (id) => document.getElementById(id),
  node = (tag, txt) => {
    let n = document.createElement(tag);
    if (txt) n.textContent = txt;
    return n;
  };
let shows = [],
  current,
  viewer,
  musicIndex = 0,
  seq = 0;
function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(
    new Date(),
  );
}
function valid(s) {
  let d = today();
  return (!s.start || s.start <= d) && (!s.end || s.end >= d);
}
function media(a, thumb = false) {
  let n;
  if (
    a.type === "圖片" ||
    (a.type === "動態" &&
      (a.src.startsWith("data:image") || /\.gif$/i.test(a.src)))
  ) {
    n = node("img");
    n.alt = thumb ? "" : a.title;
    if (thumb) n.loading = "lazy";
  } else if (["影片", "動態"].includes(a.type)) {
    n = node("video");
    n.playsInline = true;
    n.muted = thumb;
    n.preload = thumb ? "metadata" : "auto";
    if (thumb && a.src === "media/motion.mp4") n.poster = "media/motion.webp";
    n.controls = !thumb;
  } else if (a.type === "語音" && !thumb) {
    n = node("audio");
    n.controls = true;
  } else {
    n = node("div", a.type);
    n.className = "placeholder";
    return n;
  }
  n.src = a.src;
  return n;
}
function detail(a) {
  let c = $("content");
  c.replaceChildren(
    media(a),
    node("h2", a.title),
    node(
      "small",
      [a.artist, a.category, a.width + " × " + a.height + " 公尺"]
        .filter(Boolean)
        .join("　／　"),
    ),
    node("p", a.description),
  );
  if (typeof a.source === "string" && a.source.startsWith("https://www.clevelandart.org/art/")) {
    const source = node("a", "克里夫蘭藝術博物館・館藏原頁（CC0）");
    source.href = a.source;
    c.append(source);
  }
  if (a.subtitle) c.append(node("p", a.subtitle));
  if (a.voice) {
    let v = node("audio");
    v.src = a.voice;
    v.controls = true;
    c.append(node("p", "語音導覽"), v);
  }
  if (a.captions) {
    let v = c.querySelector("video");
    if (v) {
      let t = node("track");
      t.kind = "captions";
      t.srclang = "zh-Hant";
      t.label = "繁體中文";
      t.src = a.captions;
      t.default = true;
      v.append(t);
    }
  }
  $("detail").showModal();
}
$("close").onclick = () => $("detail").close();
$("detail").onclose = () => $("content").replaceChildren();
function leave() {
  $("visit").classList.remove("immersive", "expanded");
  document.body.classList.remove("visiting");
  menu(false);
  if (document.fullscreenElement === $("visit"))
    document.exitFullscreen().catch(() => {});
  $("expand").textContent = "放大展廳";
  seq++;
  viewer?.dispose();
  viewer = null;
  $("visit").hidden = true;
  document.querySelector(".hero").hidden = false;
  $("music").pause();
}
function updateEditLink(work) {
  const params=new URLSearchParams({layout:current.id});
  if(work)params.set("work",work.id);
  const link=$("editLayout");
  link.href="admin/?"+params;
  link.textContent=work ? "調整《"+work.title+"》位置（策展登入）" : "調整作品位置（策展登入）";
}
function draw() {
  $("music").pause();
  $("editLayout").hidden=new URLSearchParams(location.search).has("studio-preview") || location.pathname.startsWith("/public/") || location.pathname.startsWith("/preview/");
  updateEditLink(current.works[0]);
  $("title").textContent = $("visitTitle").textContent = current.title;
  const cover = current.works.find((work) => work.type === "圖片");
  const heroImage = document.querySelector(".hero img");
  heroImage.src = cover?.src || "media/hero.webp";
  heroImage.alt = cover?.title || current.title;
  $("desc").textContent = current.description;
  $("dates").textContent =
    current.start || current.end
      ? [current.start || "即日起", current.end || "持續展出"].join(" — ")
      : "常設展覽";
  $("count").textContent = current.works.length + " 件作品";
  $("cards").replaceChildren();
  for (let a of current.works) {
    const card = node("article"), visitButton = node("button"), info = node("button","作品資料");
    card.className="card";
    visitButton.className="card-visit";
    visitButton.setAttribute("aria-label","到展牆看《"+a.title+"》");
    const caption=node("span");
    caption.className="card-caption";
    caption.append(node("small",[a.room,a.category || a.type].filter(Boolean).join(" · ")),
      node("strong",a.title),node("span","到展牆看 →"));
    visitButton.append(media(a,true),caption);
    visitButton.onclick=()=>enter(a.id);
    info.className="card-info";
    info.setAttribute("aria-label","《"+a.title+"》作品資料");
    info.onclick=()=>detail(a);
    card.append(visitButton,info);
    $("cards").append(card);
  }
  $("room").replaceChildren(
    ...[...new Set(current.works.map((a) => a.room))].map(
      (r) => new Option(r, r),
    ),
  );
  musicIndex = 0;
  track();
  $("vol").value = current.volume ?? 0.5;
  $("music").volume = Number($("vol").value);
}
function track() {
  let src = current.playlist[musicIndex];
  $("musicLabel").hidden = $("volLabel").hidden = !src;
  if (src) $("music").src = src;
  else $("music").removeAttribute("src");
}
$("vol").oninput = () => {
  $("music").volume = Number($("vol").value);
};
$("music").onended = () => {
  musicIndex = (musicIndex + 1) % current.playlist.length;
  track();
  $("music")
    .play()
    .catch(() => {});
};
$("music").ontimeupdate = () => {
  let p = $("music"),
    f = current.fade;
  if (f && Number.isFinite(p.duration))
    p.volume =
      Number($("vol").value) *
      Math.max(
        0,
        Math.min(1, p.currentTime / f, (p.duration - p.currentTime) / f),
      );
};
function offerCatalogue(message) {
  const notice=node("div");
  notice.className="gallery-fallback";
  const browse=node("button","查看展出作品");
  browse.onclick=()=>{
    leave();
    $("cards").querySelector(".card-info")?.focus();
  };
  notice.append(node("p",message),browse);
  $("stage").append(notice);
  browse.focus({preventScroll:true});
  return notice;
}
async function enter(workId) {
  const target=current.works.find(work=>work.id===workId);
  if(target)$("room").value=target.room;
  let n = ++seq;
  viewer?.dispose();
  viewer = null;
  $("visit").hidden = false;
  document.body.classList.add("visiting");
  $("visit").classList.add("immersive");
  menu(false);
  showFocus(null);
  syncExpand();
  const roomWorks = current.works.filter((a) => a.room === $("room").value);
  updateEditLink(target || roomWorks[0]);
  $("tour").replaceChildren(
    new Option("選擇導覽作品", ""),
    ...roomWorks.map((a, i) => new Option(a.title, i)),
  );
  document.querySelector(".hero").hidden = true;
  $("stage").textContent = "正在開啟 3D 展廳…";
  $("stage").focus({preventScroll:true});
  try {
    let { gallery } = await import("./gallery.js?v=flow27");
    if (n === seq)
      viewer = gallery(
        $("stage"),
        roomWorks,
        showFocus,
        undefined,
        fraction => {
          $("scrollPosition").value = Math.round(fraction*1000);
          $("scrollPosition").setAttribute("aria-valuetext", "自卷首向左 " + Math.round((1-fraction)*100) + "%");
          $("readPosition").textContent = Math.round((1-fraction)*100) + "%";
        },
      );
    if (n === seq && viewer) {
      if(target)viewer.select(roomWorks.indexOf(target));
      const canvas=$("stage").querySelector("canvas");
      canvas.focus({preventScroll:true});
      let notice;
      canvas.addEventListener("webglcontextlost",()=>{
        if(n===seq && !notice)notice=offerCatalogue("3D 畫面暫停，正在等待圖形服務恢復。");
      });
      canvas.addEventListener("webglcontextrestored",()=>{
        if(n!==seq)return;
        const restoreFocus=notice?.contains(document.activeElement);
        notice?.remove();
        notice=null;
        if(restoreFocus)canvas.focus({preventScroll:true});
      });
    }
  } catch (e) {
    if(n!==seq)return;
    $("stage").replaceChildren();
    offerCatalogue("此裝置暫時無法開啟 3D 展廳。");
    console.error(e);
  }
}
$("enter").onclick = () => enter();
$("room").onchange = () => enter();
$("leave").onclick = leave;
for (const [name, step] of [
  ["prev", -1],
  ["next", 1],
]) {
  $(name).onclick = () => {
    const a = viewer?.next(step);
    if (a)
      $("tour").value = String(
        current.works
          .filter((w) => w.room === $("room").value)
          .findIndex((w) => w.id === a.id),
      );
  };
}
$("tour").onchange = () => {
  if ($("tour").value !== "") viewer?.select(Number($("tour").value));
};
$("homeView").onclick = () => viewer?.home();
$("stage").addEventListener("viewreset", () => {
  showFocus(null);
  updateEditLink(current.works.find(w=>w.room===$("room").value));
  menu(false);
});
const visit = $("visit");
const activePointers = new Set();
let idleTimer, canvasPress, stickPointer, keyboardFocus=false;
function fullView() {
  return document.fullscreenElement === visit || visit.classList.contains("expanded");
}
function revealControls() {
  clearTimeout(idleTimer);
  visit.classList.remove("controls-idle");
  if (fullView() && !activePointers.size && $("visitMenu").hidden) {
    idleTimer=setTimeout(()=>{
      if (fullView() && !activePointers.size && $("visitMenu").hidden &&
          !(keyboardFocus && visit.contains(document.activeElement) && document.activeElement.matches("button,input,select,summary,a")))
        visit.classList.add("controls-idle");
    },2500);
  }
}
function quietNavigation() {
  clearTimeout(idleTimer);
  $("visitMenu").hidden=true;
  $("menuButton").setAttribute("aria-expanded","false");
  visit.classList.add("controls-idle");
}
visit.addEventListener("pointerdown", e=>{
  keyboardFocus=false;
  if(!fullView()) return;
  if(e.target.closest(".walk-stick")){
    quietNavigation();
    stickPointer=e.pointerId;
    visit.classList.add("stick-active");
  } else if(e.target.tagName==="CANVAS"){
    canvasPress={id:e.pointerId,x:e.clientX,y:e.clientY};
  } else {
    activePointers.add(e.pointerId);
    revealControls();
  }
},true);
visit.addEventListener("pointermove", e=>{
  if(fullView() && canvasPress?.id===e.pointerId &&
      Math.hypot(e.clientX-canvasPress.x,e.clientY-canvasPress.y)>6) {
    quietNavigation();
    canvasPress=null;
  }
},{passive:true});
$("stage").addEventListener("galleryblanktap",e=>{
  if(fullView() && visit.classList.contains("controls-idle")) {
    e.preventDefault();
    revealControls();
  }
});
function endInteraction(e) {
  if(canvasPress?.id===e.pointerId) canvasPress=null;
  if(stickPointer===e.pointerId){
    stickPointer=null;
    visit.classList.remove("stick-active");
  }
  if(activePointers.delete(e.pointerId)) revealControls();
}
window.addEventListener("pointerup",endInteraction,true);
window.addEventListener("pointercancel",endInteraction,true);
document.addEventListener("keydown",e=>{
  if(e.key!=="Tab" || !fullView()) return;
  keyboardFocus=true;
  revealControls();
},true);
visit.addEventListener("focusin",e=>{
  if(fullView() && keyboardFocus && e.target.matches("button,input,select,summary,a")) revealControls();
});
function resetControls() {
  activePointers.clear();
  canvasPress=null;
  stickPointer=null;
  visit.classList.remove("stick-active");
  revealControls();
}
window.addEventListener("blur",()=>{
  activePointers.clear();
  canvasPress=null;
  stickPointer=null;
  visit.classList.remove("stick-active");
  if(fullView() && $("visitMenu").hidden) quietNavigation();
});
$("scrollPosition").oninput = e => viewer?.seek(Number(e.target.value)/1000);
$("overview").onclick = () => viewer?.overview();
function showFocus(a) {
  if(a)updateEditLink(a);
  const wide = a && a.width >= 4*a.height;
  $("inspectControls").hidden = !wide;
  $("focusTitle").textContent = a?.title || "";
  $("viewHelp").textContent = a
    ? (wide ? "拖長卷慢移，放手即停" : "左右滑作品換件 · 拖空牆轉身")
    : "點作品靠近 · 拖空牆轉身";
  $("tour").value = a
    ? String(
        current.works
          .filter((w) => w.room === $("room").value)
          .findIndex((w) => w.id === a.id),
      )
    : "";
}
function menu(open) {
  const changed = $("visitMenu").hidden === open;
  $("visitMenu").hidden = !open;
  if(changed) revealControls();
  if(!open && !$("visit").hidden) $("stage").querySelector("canvas")?.focus({preventScroll:true});
  $("menuButton").setAttribute("aria-expanded", String(open));
}
$("menuButton").onclick = () => menu($("visitMenu").hidden);
$("tour").addEventListener("change", () => menu(false));
function syncExpand() {
  resetControls();
  $("expand").textContent =
    document.fullscreenElement === visit || visit.classList.contains("expanded")
      ? "退出全螢幕"
      : "全螢幕";
}
document.addEventListener("fullscreenchange", syncExpand);
$("expand").onclick = async () => {
  if (document.fullscreenElement === visit) await document.exitFullscreen();
  else if (visit.classList.contains("expanded"))
    visit.classList.remove("expanded");
  else {
    try {
      await visit.requestFullscreen({ navigationUI: "hide" });
    } catch {
      visit.classList.add("expanded");
    }
  }
  menu(false);
  syncExpand();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    menu(false);
    visit.classList.remove("expanded");
    syncExpand();
  }
});
const embeddedPreview = location.search === "?studio-preview" && parent !== window;
let previewWork;
async function loadExhibitions() {
  if (embeddedPreview) {
    return new Promise(resolve=>{
      window.addEventListener("message",function receive(e) {
        if(e.origin!==location.origin || e.source!==parent || !Array.isArray(e.data?.galleryPreview))return;
        window.removeEventListener("message",receive);
        previewWork=e.data.work;
        resolve(e.data.galleryPreview);
      });
      parent.postMessage("galleryPreviewReady",location.origin);
    });
  }
  const response=await fetch("exhibitions.json",{cache:"no-store"});
  if(!response.ok)throw Error("展覽資料暫時無法讀取");
  return (await response.json()).filter(valid);
}

function selectShow(index, openHall, work) {
  current = shows[index];
  $("shows").value = $("visitShows").value = String(index);
  draw();
  if(openHall)enter(work);
}

function collectionStatus(message, retry) {
  leave();
  for(const el of [document.querySelector(".hero"),$("exhibits"),$("works"),$("cards")])el.hidden=true;
  const panel=$("collection-status") || node("section");
  panel.id="collection-status";
  panel.setAttribute("role","status");
  panel.replaceChildren(node("h1",message));
  if(retry) {
    const button=node("button","重新載入展覽");
    button.onclick=()=>{
      button.disabled=true;
      button.textContent="正在讀取…";
      openCollection();
    };
    panel.append(button);
  }
  document.querySelector("main").prepend(panel);
}

async function openCollection() {
  try {
    shows=await loadExhibitions();
    if(!shows.length) {
      collectionStatus("目前休展",false);
      return;
    }
    $("collection-status")?.remove();
    for(const el of [$("exhibits"),$("works"),$("cards")])el.hidden=false;
    for(const control of [$("shows"),$("visitShows")]) {
      control.replaceChildren(...shows.map((s,i)=>new Option(s.title,i)));
      control.onchange=()=>{
        selectShow(Number(control.value),control===$("visitShows"));
        if(!embeddedPreview)history.replaceState(null,"","#"+encodeURIComponent(current.id));
      };
    }
    const offlinePreview=location.pathname.startsWith("/preview/");
    const work=offlinePreview ? new URLSearchParams(location.search).get("work") : previewWork;
    selectShow(Math.max(0,shows.findIndex(s=>"#"+encodeURIComponent(s.id)===location.hash)),true,work);
  } catch {
    collectionStatus("展覽資料暫時無法讀取",!embeddedPreview);
  }
}
openCollection();
