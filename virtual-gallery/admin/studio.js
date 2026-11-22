import { readDimensions } from "./dimensions.js";
import * as wallTools from "./wall-tools.js?v=wall24";
import {roomSize} from "../room-size.js";
import { artworkList, artworkDetail } from "./art-preview.js?v=wall24";
import { state, post, versions, exhibition } from "./storage.js?v=session25";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  status = $("#status");
let db = await state(),
  tab = "展覽管理",
  sid = db.shows[0]?.id,
  aid = db.arts[0]?.id,
  search = "",
  filter = "",
  timer,
  chain = Promise.resolve(),
  viewer,
  mode = "3D",
  wall = 0,
  room = "",
  generation = 0,
  dirty = false;
const show = () => db.shows.find((x) => x.id === sid),
  art = () => db.arts.find((x) => x.id === aid),
  id = () => crypto.randomUUID(),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let saveMessage="尚無修改", saveFailed=false;
function showSaveStatus(message,failed=false) {
  saveMessage=message;
  saveFailed=failed;
  status.textContent=message;
  paintSaveStatus();
}
function paintSaveStatus() {
  const label=$("#wall-save-status");
  if(label)label.textContent=saveMessage;
  for(const button of document.querySelectorAll("[data-save-retry]")) {
    button.hidden=!saveFailed;
    button.onclick=retrySave;
  }
}
function retrySave() {
  flush().catch(()=>{}); // flush displays the error and keeps the draft available.
}
function flush() {
  clearTimeout(timer);
  chain=chain.catch(()=>{}).then(async()=>{
    while(dirty) {
      const gen=generation;
      showSaveStatus("儲存中…");
      try {
        db.rev=await post("save",db);
      } catch(e) {
        showSaveStatus("草稿未儲存 · "+e.message,true);
        throw e;
      }
      if(gen===generation)dirty=false;
    }
    if(saveMessage==="儲存中…")showSaveStatus("已儲存 · 版本 "+db.rev);
  });
  return chain;
}
function changed() {
  dirty=true;
  generation++;
  showSaveStatus("等待儲存");
  clearTimeout(timer);
  timer=setTimeout(retrySave,1200);
}
function error(e) {
  if(saveFailed)return;
  status.textContent = "操作失敗 · " + e.message;
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
let token = 0;
const options = (items, v) =>
  items
    .map(
      (x) =>
        "<option " + (x === v ? "selected" : "") + ">" + esc(x) + "</option>",
    )
    .join("");
function field(o, k, label, choices, type = "text", attrs = "") {
  let v = esc(o[k]);
  let inner = choices
    ? '<select aria-label="' +
      esc(label) +
      '">' +
      options(choices, o[k]) +
      "</select>"
    : type === "textarea"
      ? "<textarea>" + v + "</textarea>"
      : '<input type="' + type + '" value="' + v + '" ' + attrs + ">";
  return '<label data-key="' + k + '">' + label + inner + "</label>";
}
function bind(root, obj, after) {
  root.querySelectorAll("[data-key]").forEach((l) => {
    let el = l.firstElementChild;
    el.addEventListener("input", () => {
      if (!el.checkValidity()) return;
      obj[l.dataset.key] = el.type === "number" ? Number(el.value) : el.value;
      changed();
      after?.(l.dataset.key);
    });
  });
}
const btn = (name, label) =>
  '<button data-act="' + name + '">' + label + "</button>";
function action(k, fn) {
  let b = app.querySelector('[data-act="' + k + '"]');
  if (b)
    b.onclick = async () => {
      try {
        await fn();
      } catch (e) {
        error(e);
      }
    };
}
export {flush as saveBeforeLogout};
function fileData(f, mime) {
  return new Promise((ok, no) => {
    let r = new FileReader();
    r.onload = () =>
      ok(
        mime
          ? String(r.result).replace(/^data:[^;]*;/, "data:" + mime + ";")
          : r.result,
      );
    r.onerror = no;
    r.readAsDataURL(f);
  });
}
const defaults = {
  artist: "",
  category: "",
  type: "文字",
  description: "",
  src: "",
  voice: "",
  captions: "",
  subtitle: "",
  room: "主展廳",
  x: 0,
  y: 1.7,
  z: 0,
  wall: 0,
  rotate: 0,
  frame: "木框",
  frameWidth: 0.06,
  mat: 0.07,
  depth: 0.05,
  finish: "霧面",
  kelvin: 3800,
  power: 18,
  angle: 34,
  lx: 0,
  ly: 1.65,
  lz: 2,
};
function render() {
  const inspector=$("#layout-inspector");
  const previousScroll=inspector?.dataset.show===sid ? inspector.scrollTop : 0;
  token++;
  viewer?.dispose();
  viewer = null;
  $("#tabs").replaceChildren(
    ...["展覽管理", "作品資料庫", "布展編輯", "備份與版本"].map((k) => {
      let b = document.createElement("button");
      b.textContent = k;
      b.setAttribute("aria-current", k === tab);
      b.onclick = () => {
        tab = k;
        render();
      };
      return b;
    }),
  );
  if (tab === "作品資料庫") library();
  else if (tab === "展覽管理") manage();
  else if (tab === "布展編輯") {
    layout();
    const panel=$("#layout-inspector");
    if(panel) {
      panel.dataset.show=sid;
      panel.scrollTop=previousScroll;
      if(!inspector)requestAnimationFrame(()=>{if(panel.isConnected)$("#wall-preview").scrollIntoView({block:"start"});});
    }
  }
  else backup();
}
function listButtons(arr, selected, fn, host) {
  host.replaceChildren(
    ...arr.map((x) => {
      let b = document.createElement("button");
      b.textContent = x.title;
      b.setAttribute("aria-current", selected === x.id);
      b.onclick = () => fn(x.id);
      return b;
    }),
  );
}
function library() {
  let a = art();
  app.innerHTML =
    '<h1>作品資料庫</h1><div class="bar">' +
    btn("new", "新增文字作品") +
    '<label>批次匯入媒體<input id="batch" type="file" multiple accept="image/*,video/*,audio/*"></label></div><div class="panel"><div><label>搜尋作品<input id="query"></label><label>分類<select id="filter"><option value="">全部分類</option>' +
    options(
      [...new Set(db.arts.map((x) => x.category).filter(Boolean))],
      filter,
    ) +
    '</select></label><aside></aside></div><div id="form"></div></div>';
  let list = () =>
    artworkList(
      $("aside"),
      db.arts.filter(
        (x) =>
          (!filter || x.category === filter) &&
          [x.title, x.artist, x.category].join(" ").includes(search),
      ),
      aid,
      (i) => {
        aid = i;
        render();
      },
    );
  $("#query").value = search;
  $("#query").oninput = (e) => {
    search = e.target.value;
    list();
  };
  $("#filter").onchange = (e) => {
    filter = e.target.value;
    list();
  };
  list();
  action("new", async () => {
    const dimensions=await readDimensions(["新作品"]);
    if(!dimensions)return;
    aid = id();
    db.arts.push({ ...defaults, ...dimensions[0], id: aid, title: "新作品" });
    changed();
    render();
  });
  $("#batch").onchange = async (e) => {
    try {
      const files=Array.from(e.target.files);
      e.target.value="";
      if(!files.length)return;
      const dimensions=await readDimensions(files.map(file=>file.name));
      if(!dimensions)return;
      const imported=[];
      for (const [index,f] of files.entries()) {
        let type = f.type.startsWith("video")
          ? "影片"
          : f.type.startsWith("audio")
            ? "語音"
            : f.type === "image/gif"
              ? "動態"
              : "圖片";
        let src = await fileData(f);
        imported.push({
          ...defaults,
          id: id(),
          ...dimensions[index],
          title: f.name.replace(/\.[^.]+$/, ""),
          src,
          type,
        });
      }
      db.arts.push(...imported);
      aid=imported[imported.length-1].id;
      changed();
      render();
    } catch (err) {
      error(err);
    }
  };
  if (!a) return;
  $("#form").innerHTML =
    '<div id="art-preview"></div><fieldset><legend>作品資料</legend><div class="fields">' +
    field(a, "title", "作品名稱", null, "text", "required") +
    field(a, "artist", "創作者") +
    field(a, "category", "分類") +
    field(a, "type", "作品類型", ["圖片", "影片", "動態", "文字", "語音"]) +
    field(a, "description", "作品說明／文字內容", null, "textarea") +
    field(a, "subtitle", "字幕說明") +
    num(a, "width", "原作寬度（公尺）", 0.05, 100) +
    num(a, "height", "原作高度（公尺）", 0.05, 4.4) +
    ["src", "voice", "captions"]
      .map(
        (k, i) =>
          "<label>" +
          ["替換作品媒體", "語音導覽", "WebVTT 字幕"][i] +
          '<input id="' +
          k +
          '" type="file" accept="' +
          ["image/*,video/*,audio/*", "audio/*", ".vtt"][i] +
          '"></label>',
      )
      .join("") +
    "</div></fieldset>" +
    btn("delete", "刪除作品");
  const refreshPreview = () => artworkDetail($("#art-preview"), a);
  refreshPreview();
  bind($("#form"), a, (k) => {
    list();
    if (["title", "description", "type"].includes(k)) refreshPreview();
  });
  for (let k of ["src", "voice", "captions"])
    $("#" + k).onchange = async (e) => {
      let f = e.target.files[0];
      if (f) {
        a[k] = await fileData(f, k === "captions" ? "text/vtt" : null);
        if (k === "src") {
          list();
          refreshPreview();
        }
        changed();
      }
    };
  action("delete", () => {
    if (!confirm("刪除此作品及其私人布展位置？")) return;
    db.arts = db.arts.filter((x) => x.id !== aid);
    db.shows.forEach((s) => {
      s.ids = s.ids.filter((i) => i !== aid);
      delete s.layout[aid];
    });
    aid = db.arts[0]?.id;
    changed();
    render();
  });
}
function num(o, k, l, min, max) {
  return field(
    o,
    k,
    l,
    null,
    "number",
    'step="any" min="' + min + '" max="' + max + '" required',
  );
}
function manage() {
  let s = show();
  app.innerHTML =
    '<h1>展覽管理</h1><div class="bar">' +
    btn("new", "建立展覽") +
    btn("copy", "複製展覽") +
    '</div><div class="panel"><aside></aside><div id="form"></div></div>';
  listButtons(
    db.shows,
    sid,
    (i) => {
      sid = i;
      render();
    },
    $("aside"),
  );
  action("new", () => {
    sid = id();
    db.shows.push({
      id: sid,
      title: "新展覽",
      description: "",
      status: "草稿",
      start: "",
      end: "",
      ids: [],
      layout: {},
      playlist: [],
      volume: 0.5,
      fade: 2,
    });
    changed();
    render();
  });
  if (!s) return;
  action("copy", () => {
    let x = structuredClone(s);
    x.id = sid = id();
    x.title += " 副本";
    x.status = "草稿";
    db.shows.push(x);
    changed();
    render();
  });
  $("#form").innerHTML =
    "<fieldset><legend>" +
    esc(s.status) +
    '</legend><div class="fields">' +
    field(s, "title", "展覽名稱", null, "text", "required") +
    field(s, "description", "策展說明", null, "textarea") +
    field(s, "start", "開展日", null, "date") +
    field(s, "end", "結束日", null, "date") +
    '</div></fieldset><fieldset><legend>展出作品</legend><div id="members" class="fields"></div></fieldset><fieldset><legend>背景音樂</legend><div class="fields">' +
    num(s, "volume", "音量（0–1）", 0, 1) +
    num(s, "fade", "淡入淡出秒數", 0, 30) +
    '<label>依序加入曲目<input type="file" id="tracks" multiple accept="audio/*"></label></div><ol id="tracksList"></ol></fieldset><div class="bar">' +
    btn("preview", "預覽展覽") +
    (s.status==="已發布" ? '<a class="live-exhibition" target="_blank" rel="noopener noreferrer" href="../#'+encodeURIComponent(s.id)+'">查看公開展覽</a>' : "") +
    btn("publish", "發布至 GitHub Pages") +
    btn("end", "結束並典藏") +
    "</div>";
  bind($("#form"), s, (k) => {
    if (k === "title")
      listButtons(
        db.shows,
        sid,
        (i) => {
          sid = i;
          render();
        },
        $("aside"),
      );
  });
  for (let a of db.arts) {
    let l = document.createElement("label"),
      c = document.createElement("input");
    c.type = "checkbox";
    c.checked = s.ids.includes(a.id);
    l.style.display = "block";
    l.append(c, a.title);
    $("#members").append(l);
    c.onchange = () => {
      s.ids = s.ids.filter((i) => i !== a.id);
      if (c.checked) s.ids.push(a.id);
      changed();
    };
  }
  s.playlist.forEach((v, i) => {
    let li = document.createElement("li");
    li.textContent = v.startsWith("media/")
      ? v.split("/")[1]
      : "匯入音軌 " + (i + 1);
    let b = document.createElement("button");
    b.textContent = "移除";
    b.onclick = () => {
      s.playlist.splice(i, 1);
      changed();
      render();
    };
    li.append(" ", b);
    $("#tracksList").append(li);
  });
  $("#tracks").onchange = async (e) => {
    for (let f of e.target.files) s.playlist.push(await fileData(f));
    changed();
    render();
  };
  action("preview",()=>previewShow(s));
  for (let k of ["publish", "end"])
    action(k, async () => {
      if (
        !confirm(
          k === "end"
            ? "從公開清單撤展並保留私人典藏？"
            : "將本展所選作品與影音公開至 GitHub？",
        )
      )
        return;
      document.querySelector("main").inert = true;
      try {
        await flush();
        status.textContent = "正在更新 GitHub…";
        await post(k, { id: s.id, rev: db.rev });
        db = await state();
      } finally {
        document.querySelector("main").inert = false;
      }
      status.textContent = "GitHub 已更新，Pages 正在建置";
      render();
    });
}
async function previewShow(s,work) {
    const dialog = document.querySelector("#preview"),
      frame = dialog.querySelector("iframe");
    const data = exhibition(db, s);
    data.start = data.end = "";
    const send = (e) => {
      if (
        e.origin === location.origin &&
        e.source === frame.contentWindow &&
        e.data === "galleryPreviewReady"
      ) {
        frame.contentWindow.postMessage(
          { galleryPreview: [data], work:work?.id },
          location.origin,
        );
        window.removeEventListener("message", send);
      }
    };
    window.addEventListener("message", send);
    dialog.addEventListener(
      "close",
      () => window.removeEventListener("message", send),
      { once: true },
    );
    $("#previewTitle").textContent=work ? s.title+" ／ "+work.title : s.title;
    dialog.showModal();
    viewer?.setPaused(true);
    frame.src = "../?studio-preview";
  }
function layout(keepScene=false) {
  let s = show();
  if (!s) {
    app.textContent = "請先建立展覽";
    return;
  }
  let works = s.ids.map((i) => ({
    ...db.arts.find((a) => a.id === i),
    ...s.layout[i],
  }));
  const needsSelection=unmatchedEntry===s.id && !aid;
  if (!needsSelection && !works.some((a) => a.id === aid)) aid = works[0]?.id;
  if(aid) {
    const route=new URL(location.href);
    if(route.searchParams.get("layout")!==sid || route.searchParams.get("work")!==aid) {
      route.searchParams.set("layout",sid);
      const original=Object.entries(s.publicWorkIds || {}).find(([,id])=>id===aid);
      route.searchParams.set("work",original?.[0] || aid);
      if(route.href!==location.href)history.replaceState(null,"",route);
    }
  }
  let a = works.find((a) => a.id === aid);
  if(!keepScene) app.innerHTML =
    '<h1>布展編輯</h1><div class="bar"><label>展覽<select id="ex"></select></label><label>編輯作品<select id="sel"></select></label>' +
    btn("2D", "2D 展牆") +
    btn("3D", "實景布展") +
    '</div><div class="hanging-desk"><section id="wall-preview" aria-label="即時展牆預覽"><div class="surface-tools"><strong>展牆預覽'+
    (mode==="3D" && a ? '<small class="pinch-tip"> · 雙指縮放</small>' : '')+'</strong>'+
    (mode==="3D" && a ? '<button id="ruler-toggle" aria-pressed="true">隱藏尺標</button>' : '')+
    btn("preview","參觀預覽")+'</div><div id="surface"></div>' +
    '<div id="position-pad" role="group" aria-label="作品位置微調"><div class="pad-caption"><strong id="adjusting-title"></strong><span>每次 5 公分</span></div><div class="nudge-keys">'+
    btn("left","← 左移")+btn("right","右移 →")+btn("up","↑ 升高")+btn("down","↓ 降低")+
    '</div></div><div class="wall-save"><span role="status" id="wall-save-status"></span><button id="wall-save-retry" data-save-retry hidden>重試儲存</button></div></section><div id="layout-inspector" role="region" aria-label="作品清單與布展設定" tabindex="0"><section class="inventory"><h2>布展清單</h2><p id="wall-progress"></p><div id="wall-list"></div></section><div id="form"></div></div></div>';
  paintSaveStatus();
  function picker(el, items, current, fn) {
    el.replaceChildren(...items.map((x) => new Option(x.title, x.id)));
    el.value = current;
    el.onchange = () => fn(el.value);
  }
  picker($("#ex"), db.shows, sid, (v) => {
    sid = v;
    render();
  });
  function selectWork(chosen) {
    unmatchedEntry=null;
    const next=works.find(w=>w.id===chosen);
    aid=chosen;
    if(viewer && next?.room===a?.room) {
      viewer.focus(works.filter(w=>w.room===next.room).indexOf(next));
      layout(true);
    } else render();
  }
  picker($("#sel"), works, aid, selectWork);
  if(needsSelection) {
    const placeholder=new Option("請選擇作品","",false,true);
    placeholder.disabled=true;
    $("#sel").prepend(placeholder);
    $("#sel").value="";
  }
  const reviewed=works.filter(w=>w.reviewed).length;
  $("#wall-progress").textContent=s.status+"　·　掛位已確認 "+reviewed+" / "+works.length;
  const wallNames=["北牆","西牆","南牆","東牆"];
  artworkList($("#wall-list"),works,aid,selectWork,w=>[w.room,wallNames[w.wall],w.groupId?"連屏":"",w.reviewed?"掛位已確認":"待確認"].filter(Boolean).join(" · "));
  action("preview",()=>previewShow(s,a));
  for(const m of ["2D","3D"])app.querySelector('[data-act="'+m+'"]').setAttribute("aria-current",String(m===mode));
  for (let m of ["2D", "3D"])
    action(m, () => {
      mode = m;
      render();
    });
  $("#position-pad").hidden=!a;
  $("#adjusting-title").textContent=a?.title || "";
  if (!a) {
    $("#surface").textContent = works.length ? "這件公開作品無法對應目前的草稿，請從清單選擇要編輯的作品。" : "請先於展覽管理勾選展出作品";
    return;
  }
  room = a.room;
  wall = a.wall;
  let nearby = works.filter((o) => o.room === room),
    same = nearby.filter((o) => o.wall === wall);
  function patch(i, obj) {
    Object.assign((s.layout[i] ??= {}), {reviewed:false},obj);
    changed();
  }
  const dimensions=roomSize(nearby);
  const span=2*dimensions[wall%2 ? "depth" : "width"], height=wallTools.wallHeight(dimensions.theme);
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  const group=wallTools.members(same,a), ordered=wallTools.units(same);
  const boxes=ordered.map(wallTools.envelope);
  const total=boxes.reduce((sum,b)=>sum+b.right-b.left,0);
  const gaps=boxes.slice(1).map((b,i)=>b.left-boxes[i].right);
  const currentGap=gaps.length?Math.max(0,Math.round(100*gaps.reduce((sum,x)=>sum+x,0)/gaps.length)):0;
  function savePositions(list) {
    for (const o of list)patch(o.id,{x:+o.x.toFixed(5),y:+o.y.toFixed(5)});
  }
  function shift(list,dx,dy) {
    wallTools.movement(list,span/2,height)(dx,dy);
    savePositions(list);
  }
  function refreshPlacement() {
    if(!viewer){render();return;}
    viewer.updatePlacements(nearby);
    layout(true);
  }
  function scene() {
    let surface = $("#surface");
    if (mode === "3D") {
      surface.innerHTML =
         '<div id="stage"><span class="stage-loading">正在開啟展牆…</span></div><output class="wall-readout" aria-label="展牆量測"></output>';
      const toggle=$("#ruler-toggle"), readout=$(".wall-readout");
      toggle.onclick=()=>{
        readout.hidden=!readout.hidden;
        const svg=surface.querySelector(".wall-rulers");
        if(svg)svg.style.display=readout.hidden?"none":"";
        toggle.textContent=readout.hidden?"顯示尺標":"隱藏尺標";
        toggle.setAttribute("aria-pressed",String(!readout.hidden));
      };
      let t = token;
      import("../gallery.js?v=pinch28")
        .then(({ gallery }) => {
          if (t !== token) return;
          viewer = gallery(
            $("#stage"),
            nearby.map((work) => ({
              ...work,
              tiles: work.tiles?.map(path => path.replace(/^media\//,"../media/")),
              src: work.src.replace(/^media\//, "../media/"),
            })),
            (o) => { aid=o.id; layout(true); },
            (o,moved) => {
              savePositions(moved);
              aid=o.id;
              layout(true);
            },
            undefined,wallTools
          );
          viewer.focus(nearby.indexOf(a));
          if($("#preview").open)viewer.setPaused(true);
        })
        .catch(e=>{
          if(t!==token)return;
          error(e); mode="2D"; render();
          $("#surface")?.insertAdjacentHTML("afterbegin","<p>此裝置暫時無法顯示 3D，已切換為可調整的 2D 展牆。</p>");
        });
      return;
    }
    surface.innerHTML =
      "<p>" +
      esc(room) +
      "　／　" +
      ["北牆", "西牆", "南牆", "東牆"][wall] +
      '　·　拖曳作品調整掛點</p><div class="wall"></div>';
    let w = $(".wall"),
      span = 2 * roomSize(nearby)[wall % 2 ? "depth" : "width"];
    w.style.aspectRatio=span+"/"+height;
    w.style.setProperty("--wall-ratio",span/height);
    const pieces=new Map();
    for (let o of same) {
      let b = document.createElement("button");
      pieces.set(o.id,b);
      b.className = "piece" + (o.id === aid ? " sel" : "");
      b.style.cssText =
        "left:" +
        (50 + (100 * o.x) / span) +
        "%;top:" +
        (100 - (o.y / height) * 100) +
        "%;width:" +
        (100 * o.width) / span +
        "%;height:" +
        (100 * o.height) / height +
        "%;rotate:" +
        -o.rotate +
        "deg";
      if (o.type === "圖片")
        b.style.backgroundImage =
          'url("' + o.src.replace(/^media\//, "../media/") + '")';
      let label = document.createElement("span");
      label.textContent = o.title;
      b.append(label);
      w.append(b);
      let d;
      b.onpointerdown = (e) => {
        b.setPointerCapture(e.pointerId);
        const list=wallTools.members(same,o);
        d={x:e.clientX,y:e.clientY,list,move:wallTools.movement(list,span/2,height)};
      };
      b.onpointermove = (e) => {
        if (!d) return;
        const rect=w.getBoundingClientRect();
        d.move((e.clientX-d.x)*span/rect.width,-(e.clientY-d.y)*height/rect.height);
        for(const member of d.list) {
          const node=pieces.get(member.id);
          node.style.left=50+100*member.x/span+"%";
          node.style.top=100-100*member.y/height+"%";
        }
      };
      b.onpointerup = () => {
        if(!d)return;
        savePositions(d.list); d=null;
        aid=o.id; render();
      };
      b.onpointercancel = () => {
        d = null;
        render();
      };
    }
  }
  const n = (k, l, lo, hi) => num(a, k, l, lo, hi);
  $("#form").innerHTML =
    '<fieldset><legend>'+esc(a.title)+'</legend><div class="bar">'+
    btn("review",a.reviewed?"重新標記待確認":"確認此作掛位")+
    (works.some(w=>!group.includes(w))?'<label>交換掛位<select id="swap-target">'+works.filter(w=>!group.includes(w)).map(w=>'<option value="'+esc(w.id)+'">'+esc(w.title)+'　·　'+esc(w.room)+'</option>').join("")+'</select></label>'+btn("swap","互換位置"):"")+'</div></fieldset>'+
    '<fieldset><legend>連屏組合</legend><div class="panel-members">'+
    same.filter(o=>!o.groupId || o.groupId===a.groupId || o.id===aid).map(o=>
      '<label><input type="checkbox" data-panel="'+esc(o.id)+'" '+(group.includes(o)?'checked ':'')+(o.id===aid?'disabled':'')+'>'+esc(o.title)+'</label>').join("")+
    '</div><div class="bar">'+btn("group","儲存連屏組合")+(group.length>1?btn("ungroup","解散連屏")+'<label>屏間淨距（公分）<input id="panel-gap" type="number" min="0" step="any"></label>'+btn("spacePanels","套用屏間距"):"")+'</div></fieldset>'+
    (ordered.length>1 ? '<fieldset><legend>同牆間距</legend><label>同牆作品間距（公分）<input id="gap" type="number" min="0" step="any" value="'+currentGap+'"></label>'+btn("spacing","套用同牆間距")+'</fieldset>' : '')+
    '<fieldset><legend>展牆與掛點</legend><div class="fields">' +
    field(a, "room", "展廳名稱", null, "text", "required") +
    field(a, "wall", "展牆（0 北、1 西、2 南、3 東）", [0, 1, 2, 3]) +
    n("x", "水平 X（公尺）", -100, 100) +
    n("y", "掛點高度 Y（公尺）", 0, height) +
    n("z", "離牆 Z（公尺）", 0, 3) +
    n("rotate", "旋轉（度）", -180, 180) +
    n("width", "展出寬度（公尺）", 0.05, 100) +
    n("height", "展出高度（公尺）", 0.05, 4.4) +
    '</div><div class="bar">' +
    btn("actualSize","按原作尺寸展示（1:1）") +
    btn("align", "同牆作品對齊高度") +
    btn("distribute", "同牆作品等距排列") +
    '</div></fieldset><fieldset><legend>裝裱</legend><div class="fields">' +
    field(a, "frame", "畫框", ["木框", "金屬框", "無框"]) +
    field(a, "finish", "表面", ["霧面", "亮面"]) +
    n("mat", "卡紙寬（公尺）", 0, 0.5) +
    n("frameWidth", "框寬（公尺）", 0, 0.5) +
    n("depth", "厚度（公尺）", 0.01, 0.5) +
    '</div></fieldset><fieldset><legend>作品燈具</legend><div class="fields">' +
    n("lx", "燈具水平位置", -4, 4) +
    n("ly", "相對掛點高度", -2, 4) +
    n("lz", "距牆距離", 0.1, 6) +
    n("power", "光強（燭光）", 0, 120) +
    n("kelvin", "色溫（K）", 2500, 7000) +
    n("angle", "照射半角（度）", 5, 85) +
    '</div><div class="bar">' +
    btn("warm", "暖光聚焦") +
    btn("day", "日光漫射") +
    "</div></fieldset>";
  action("review",()=>{patch(a.id,{reviewed:!a.reviewed});layout(mode==="3D");});
  action("swap",()=>{
    const target=works.find(w=>w.id===$("#swap-target").value);
    const other=wallTools.members(works,target);
    const center=list=>({x:list.reduce((sum,w)=>sum+w.x,0)/list.length,y:list.reduce((sum,w)=>sum+w.y,0)/list.length,z:list.reduce((sum,w)=>sum+(w.z || 0),0)/list.length});
    const here=center(group),there=center(other);
    function transfer(list,from,to,dest) {
      return list.map(w=>({...w,x:w.x+to.x-from.x,y:w.y+to.y-from.y,z:(w.z || 0)+to.z-from.z,room:dest.room,wall:dest.wall}));
    }
    const moves=[...transfer(group,here,there,target),...transfer(other,there,here,a)];
    const after=works.map(w=>moves.find(m=>m.id===w.id) ?? w);
    for(const w of moves) {
      const size=roomSize(after.filter(o=>o.room===w.room)), half=w.wall%2?size.depth:size.width, b=wallTools.bounds(w);
      if(w.z<-.00001 || w.z>3.00001 || b.left< -half-.00001 || b.right>half+.00001 || b.bottom<-.00001 || b.top>wallTools.wallHeight(size.theme)+.00001)
        throw Error("互換後會超出展牆，請先調整掛位或選擇其他作品。");
    }
    moves.forEach(({id,x,y,z,room,wall})=>patch(id,{x:+x.toFixed(5),y:+y.toFixed(5),z:+z.toFixed(5),room,wall}));
    render();
  });
  if(group.length>1) {
    const panels=group.map(w=>({w,b:wallTools.bounds(w)})).sort((a,b)=>a.b.left-b.b.left);
    const width=panels.reduce((sum,p)=>sum+p.b.right-p.b.left,0);
    const original=wallTools.envelope(group);
    $("#panel-gap").value=Math.max(0,Math.round(1000*(original.right-original.left-width)/(group.length-1))/10);
    action("spacePanels",()=>{
      const input=$("#panel-gap");
      if(!input.value.trim() || !input.reportValidity())return;
      const gap=Number(input.value)/100, length=width+(group.length-1)*gap;
      if(length>span)throw Error("屏間距超出展牆寬度。");
      let left=clamp((original.left+original.right-length)/2,-span/2,span/2-length);
      for(const {w,b} of panels) {
        shift([w],left-b.left,0);
        left+=b.right-b.left+gap;
      }
      refreshPlacement();
    });
  }
  action("group",()=>{
    const ids=new Set(Array.from(document.querySelectorAll("[data-panel]:checked"),el=>el.dataset.panel));
    if(ids.size<2)throw Error("請選取至少兩幅同牆作品。");
    const key=a.groupId || id();
    same.forEach(o=>{if(ids.has(o.id) || group.includes(o))patch(o.id,{groupId:ids.has(o.id)?key:null});});
    render();
  });
  action("ungroup",()=>{group.forEach(o=>patch(o.id,{groupId:null}));render();});
  bind($("#form"), a, (k) => {
    if(k==="x" || k==="y") {
      const value=a[k], old=(s.layout[a.id]?.[k] ?? db.arts.find(o=>o.id===a.id)[k]);
      a[k]=old;
      shift(group,k==="x"?value-old:0,k==="y"?value-old:0);
      viewer?.updatePlacements(group);
    } else if(k==="wall" || k==="room") {
      if(k==="wall")a.wall=Number(a.wall);
      group.forEach(o=>patch(o.id,{[k]:a[k]}));
    } else patch(a.id, { [k]: a[k] });
  });
  $("#form").onchange=(e)=>{
    const key=e.target.closest("[data-key]")?.dataset.key;
    if(!key)return;
    setTimeout(()=>{if(tab==="布展編輯") {
      if(["x","y","z","rotate"].includes(key))refreshPlacement();else render();
    }},0);
  };
  for(const [name,dx,dy] of [["left",-.05,0],["right",.05,0],["up",0,.05],["down",0,-.05]]) {
    action(name,()=>{shift(group,dx,dy);refreshPlacement();});
  }
  function spaceRow(gap) {
    const length=total+gap*(ordered.length-1);
    if(length>span+.000001)throw Error("展牆寬度不足，請縮小間距或改掛其他展牆。");
    const center=(boxes[0].left+boxes.at(-1).right)/2;
    let left=clamp(center-length/2,-span/2,span/2-length);
    ordered.forEach((list,i)=>{
      shift(list,left-boxes[i].left,0);
      left+=boxes[i].right-boxes[i].left+gap;
    });
    refreshPlacement();
  }
  action("spacing",()=>{
    const input=$("#gap");
    if(input.value.trim() && input.reportValidity())spaceRow(Number(input.value)/100);
  });
  action("actualSize",()=>{
    const placement=s.layout[a.id];
    if(placement){delete placement.width;delete placement.height;patch(a.id,{reviewed:false});}
    render();
  });
  action("align", () => {
    const center=a.y;
    ordered.filter(list=>!list.includes(a)).forEach(list=>{
      const box=wallTools.envelope(list);
      shift(list,0,center-(box.top+box.bottom)/2);
    });
    refreshPlacement();
  });
  action("distribute",()=>spaceRow(Math.max(0,(span-total)/(ordered.length+1))));
  for (let [k, v] of [
    ["warm", [3000, 28, 25]],
    ["day", [6200, 18, 55]],
  ])
    action(k, () => {
      patch(a.id, { kelvin: v[0], power: v[1], angle: v[2] });
      render();
    });
  if(!keepScene)scene();
}
async function refreshRestored() {
  db = await state();
  sid = db.shows[0]?.id;
  aid = db.arts[0]?.id;
  dirty = false;
  showSaveStatus("已還原 · 版本 " + db.rev);
  render();
}
function backup() {
  app.innerHTML =
    '<h1>備份與版本</h1><p>備份含作品原檔、草稿、展覽與布展設定。可手動保存到 Google Drive。</p><div class="bar">' +
    btn("export", "下載完整備份") +
    '<label>還原備份檔<input id="import" type="file" accept=".json"></label></div><label>私人歷史版本<select id="versions"></select></label>' +
    btn("restore", "還原所選版本");
  versions()
    .then((v) => {
      if ($("#versions"))
        $("#versions").replaceChildren(
          ...v.map((n) => new Option(n.label, n.id)),
        );
    })
    .catch(error);
  action("export", async () => {
    let url = URL.createObjectURL(
      new Blob([JSON.stringify(db)], { type: "application/json" }),
    );
    let a = document.createElement("a");
    a.href = url;
    a.download = "策展備份-v" + db.rev + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#import").onchange = async (e) => {
    try {
      let f = e.target.files[0];
      if (!f || !confirm("以備份取代目前資料？目前版本會保留。")) return;
      let imported = JSON.parse(await f.text());
      await flush();
      imported.rev = db.rev;
      await post("save", imported);
      await refreshRestored();
    } catch (err) {
      error(err);
    }
  };
  action("restore", async () => {
    if (!$("#versions").value || !confirm("還原選取的版本？")) return;
    await flush();
    await post("restore", {
      rev: db.rev,
      version: $("#versions").value,
    });
    await refreshRestored();
  });
}
// A published work can have a different ID in an imported private draft.
let unmatchedEntry=null;
const entry=new URLSearchParams(location.search), requested=entry.get("layout");
if(requested) {
  let draft=db.shows.find(item=>item.id===requested);
  const workId=entry.get("work");
  let selected=draft?.ids.includes(workId) ? workId : draft?.publicWorkIds?.[workId];
  if(!draft || (workId && !draft.ids.includes(selected))) {
    const live=await (await fetch("../exhibitions.json",{cache:"no-store"})).json();
    const published=live.find(item=>item.id===requested);
    if(!draft && published) {
      const {works,...metadata}=published;
      draft={...metadata,status:"草稿",ids:[],layout:{},publicWorkIds:{}};
      for(const work of works) {
        const key=db.arts.some(item=>item.id===work.id)?id():work.id;
        if(key!==work.id)draft.publicWorkIds[work.id]=key;
        if(work.id===workId)selected=key;
        db.arts.push({...work,id:key});
        draft.ids.push(key);
      }
      db.shows.push(draft);
    } else if(draft) {
      const publicWork=published?.works.find(w=>w.id===workId);
      // Old imports have no ID mapping. Only a unique matching media source qualifies.
      if(publicWork?.src) {
        const matches=db.arts.filter(w=>draft.ids.includes(w.id) && w.type===publicWork.type && w.src===publicWork.src);
        if(matches.length===1) {
          selected=matches[0].id;
          (draft.publicWorkIds ??= {})[workId]=selected;
        }
      }
    }
  }
  if(draft) {
    sid=draft.id;
    aid=workId ? (draft.ids.includes(selected) ? selected : null) : draft.ids[0];
    if(workId && !aid)unmatchedEntry=sid;
    tab="布展編輯";
  }
}

render();

document.querySelector("#closePreview").onclick = () =>
  document.querySelector("#preview").close();
document.querySelector("#preview").onclose = () => {
  let f = document.querySelector("#preview iframe");
  f.onload = null;
  f.src = "about:blank";
  viewer?.setPaused(false);
};
