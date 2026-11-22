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
    n.alt = a.title;
  } else if (["影片", "動態"].includes(a.type)) {
    n = node("video");
    n.playsInline = true;
    n.muted = thumb;
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
function draw() {
  $("music").pause();
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
    let b = node("button");
    b.className = "card";
    let d = node("div");
    d.append(node("small", a.category || a.type), node("h3", a.title));
    b.append(media(a, true), d);
    b.onclick = () => detail(a);
    $("cards").append(b);
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
async function enter() {
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
  $("tour").replaceChildren(
    new Option("選擇導覽作品", ""),
    ...roomWorks.map((a, i) => new Option(a.title, i)),
  );
  document.querySelector(".hero").hidden = true;
  $("stage").textContent = "正在開啟 3D 展廳…";
  $("stage").focus({preventScroll:true});
  try {
    let { gallery } = await import("./gallery.js?v=precision16");
    if (n === seq)
      viewer = gallery(
        $("stage"),
        current.works.filter((a) => a.room === $("room").value),
        showFocus,
        undefined,
        fraction => {
          $("scrollPosition").value = Math.round(fraction*1000);
          $("scrollPosition").setAttribute("aria-valuetext", "自卷首向左 " + Math.round((1-fraction)*100) + "%");
          $("readPosition").textContent = Math.round((1-fraction)*100) + "%";
        },
      );
    if (n === seq && viewer) $("stage").querySelector("canvas")?.focus({preventScroll:true});
  } catch (e) {
    $("stage").textContent = "此裝置無法啟動 WebGL 2。可於展出作品區開啟展籤。";
    console.error(e);
  }
}
$("enter").onclick = enter;
$("room").onchange = enter;
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
  menu(false);
});
const visit = $("visit");
$("scrollPosition").oninput = e => viewer?.seek(Number(e.target.value)/1000);
$("overview").onclick = () => viewer?.overview();
function showFocus(a) {
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
  $("visitMenu").hidden = !open;
  if(!open && !$("visit").hidden) $("stage").querySelector("canvas")?.focus({preventScroll:true});
  $("menuButton").setAttribute("aria-expanded", String(open));
}
$("menuButton").onclick = () => menu($("visitMenu").hidden);
$("tour").addEventListener("change", () => menu(false));
function syncExpand() {
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
try {
  const preview = location.search === "?studio-preview" && parent !== window;
  shows = preview
    ? await new Promise((resolve) => {
        window.addEventListener("message", function receive(e) {
          if (
            e.origin === location.origin &&
            e.source === parent &&
            Array.isArray(e.data?.galleryPreview)
          ) {
            window.removeEventListener("message", receive);
            resolve(e.data.galleryPreview);
          }
        });
        parent.postMessage("galleryPreviewReady", location.origin);
      })
    : (
        await (await fetch("exhibitions.json", { cache: "no-store" })).json()
      ).filter(valid);
  function selectShow(index) {
    current = shows[index];
    $("shows").value = $("visitShows").value = String(index);
    draw();
    enter();
  }
  for (const control of [$("shows"), $("visitShows")]) {
    control.replaceChildren(...shows.map((s, i) => new Option(s.title, i)));
    control.onchange = () => {
      selectShow(Number(control.value));
      if (!preview) history.replaceState(null, "", "#" + encodeURIComponent(current.id));
    };
  }
  if (shows.length) {
    selectShow(Math.max(0, shows.findIndex(s => "#" + encodeURIComponent(s.id) === location.hash)));
  } else {
    leave();
    $("title").textContent = "目前休展";
    $("enter").hidden = true;
  }
} catch {
  leave();
  $("title").textContent = "展覽資料讀取失敗，請重新整理";
  $("enter").hidden = true;
}
