import { exhibitionCheck } from "./exhibition-check.js?v=desk33";
import { mountEditor, paintWallMount } from "./mount-editor.js?v=desk33";
import { mountTemplates } from "./mount-templates.js?v=desk33";
import { readDimensions } from "./dimensions.js";
import * as wallTools from "./wall-tools.js?v=hall34";
import {roomSize} from "../room-size.js?v=desk33";
import { artworkList, artworkDetail } from "./art-preview.js?v=wall24";
import { state, post, versions, exhibition } from "./storage.js?v=desk33";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  status = $("#status");
const workspaceViews = {
  "展覽管理": "exhibitions",
  "作品資料庫": "library",
  "佈展設定": "desk",
  "備份與版本": "backup",
};
const requestedView = new URLSearchParams(location.search).get("view");
let db = await state(),
  tab = Object.keys(workspaceViews).find(name => workspaceViews[name] === requestedView) || "展覽管理",
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
function syncWorkspaceNav() {
  const nav = $("#tabs");
  if (!nav.childElementCount) {
    for (const name of Object.keys(workspaceViews)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.onclick = () => {
        if (name !== tab) {
          tab = name;
          render();
        }
        if (tab !== "佈展設定") window.scrollTo(0, 0);
      };
      nav.append(button);
    }
  }
  for (const button of nav.children) button.setAttribute("aria-current", String(button.textContent === tab));
  document.title = tab + "｜虛擬策展工作室";
  const route = new URL(location.href);
  if (tab !== "佈展設定") {
    for (const key of ["layout", "work", "panel"]) route.searchParams.delete(key);
  }
  if (tab === "展覽管理" || (tab === "佈展設定" && route.searchParams.has("layout"))) route.searchParams.delete("view");
  else route.searchParams.set("view", workspaceViews[tab]);
  if (route.href !== location.href) history.replaceState(null, "", route);
}
function render() {
  const inspector=$("#layout-inspector"), deskWasOpen=Boolean(inspector);
  const previousScroll=inspector && inspector.dataset.show===sid ? inspector.scrollTop : 0;
  const openTools=inspector ? Array.from(inspector.querySelectorAll("[data-desk-advanced][open]"),el=>el.dataset.deskAdvanced) : [];
  token++;
  viewer?.dispose();
  viewer = null;
  syncWorkspaceNav();
  if (tab === "作品資料庫") library();
  else if (tab === "展覽管理") manage();
  else if (tab === "佈展設定") {
    layout();
    const panel=$("#layout-inspector");
    if(panel) {
      panel.dataset.show=sid;
      panel.scrollTop=previousScroll;
      for(const key of openTools) {
        const group=panel.querySelector('[data-desk-advanced="'+key+'"]');
        if(group)group.open=true;
      }
      const compactLandscape=matchMedia("(orientation:landscape) and (max-height:550px)").matches;
      if(!deskWasOpen && (compactLandscape || matchMedia("(max-width:740px)").matches)) {
        requestAnimationFrame(()=>{
          if(panel.isConnected)$(compactLandscape?"#wall-preview":".desk-heading").scrollIntoView({block:"start"});
        });
      }
    }
  }
  else backup();
  paintCheckReturn();
}
let libraryDetailOpen=false;
function library() {
  const a=art();
  const desk=document.createElement("section");
  desk.className="catalog-desk library-desk";
  desk.dataset.detail=String(Boolean(a && libraryDetailOpen));
  app.replaceChildren(desk);
  desk.innerHTML='<div class="catalog-heading"><h1>作品資料庫</h1><div class="catalog-actions">'+
    '<label class="catalog-upload">上傳作品<input id="batch" type="file" multiple accept="image/*,video/*,audio/*" aria-label="上傳作品（可多選）"></label>'+
    btn("new","新增文字作品")+'</div></div><div class="catalog-columns"><div class="catalog-sidebar library-browser">'+
    '<div class="catalog-filters"><label>搜尋作品<input id="query" type="search"></label><label>分類<select id="filter"><option value="">全部分類</option>'+
    options([...new Set(db.arts.map(x=>x.category).filter(Boolean))],filter)+'</select></label></div>'+
    '<aside id="art-list" aria-label="作品清單"></aside><p id="art-empty" class="catalog-empty" hidden></p></div>'+
    '<div class="catalog-editor" id="form"></div></div>';
  const list=()=>{
    const term=search.trim().toLocaleLowerCase();
    const matches=db.arts.filter(x=>(!filter || x.category===filter) &&
      [x.title,x.artist,x.category].join(" ").toLocaleLowerCase().includes(term));
    artworkList($("#art-list"),matches,aid,i=>{
      aid=i;libraryDetailOpen=true;render();
      $("#art-heading")?.focus({preventScroll:true});
      if(matchMedia("(max-width:700px)").matches)$("#form").scrollIntoView({block:"start",behavior:"instant"});
    });
    const empty=$("#art-empty");
    empty.hidden=Boolean(matches.length);
    if(!matches.length) empty.textContent=db.arts.length ? "沒有符合的作品。" : "尚無作品。可上傳圖像、影音或新增文字作品。";
  };
  $("#query").value=search;
  $("#query").oninput=e=>{search=e.target.value;list();};
  $("#filter").onchange=e=>{filter=e.target.value;list();};
  function openAdded() {search=filter="";libraryDetailOpen=true;changed();render();}
  list();
  action("new",async()=>{
    const dimensions=await readDimensions(["新作品"]);
    if(!dimensions)return;
    aid=id();
    db.arts.push({...defaults,...dimensions[0],id:aid,title:"新作品"});
    openAdded();
    $('#form [data-key="title"] input').select();
  });
  $("#batch").onchange=async e=>{
    const input=e.target, files=Array.from(input.files);
    input.value="";
    if(!files.length)return;
    input.disabled=true;
    try {
      const dimensions=await readDimensions(files.map(f=>f.name));
      if(!dimensions)return;
      const imported=[];
      for (const [i,file] of files.entries()) {
        const type=file.type.startsWith("video")?"影片":file.type.startsWith("audio")?"語音":file.type==="image/gif"?"動態":"圖片";
        imported.push({...defaults,...dimensions[i],id:id(),title:file.name.replace(/\.[^.]+$/,""),src:await fileData(file),type});
      }
      db.arts.push(...imported);
      aid=imported.at(-1).id;
      openAdded();
    } catch(err){error(err);}
    finally {input.disabled=false;}
  };
  if(!a) {
    $("#form").hidden=true;
    return;
  }
  $("#form").innerHTML='<div class="library-return">'+btn("back-library","返回作品清單")+'</div>'+
    '<div class="art-overview"><div id="art-preview"></div><div class="art-heading-wrap"><h2 id="art-heading" tabindex="-1"></h2><p class="catalog-meta" id="art-summary"></p></div></div>'+
    '<fieldset class="catalog-basic"><legend>基本資料</legend><div class="fields">'+
    field(a,"title","作品名稱",null,"text","required")+field(a,"artist","創作者")+field(a,"category","分類")+
    field(a,"type","作品類型",["圖片","影片","動態","文字","語音"])+
    num(a,"width","原作寬度（公尺）",.05,100)+num(a,"height","原作高度（公尺）",.05,4.4)+
    field(a,"description","作品說明／文字內容",null,"textarea")+'</div></fieldset>'+
    '<details class="catalog-section"><summary>作品檔案、語音與字幕</summary><div class="fields">'+
    '<label>替換作品媒體<input id="src" type="file" accept="image/*,video/*,audio/*"></label>'+
    '<label>語音導覽<input id="voice" type="file" accept="audio/*"></label>'+
    '<label>WebVTT 字幕<input id="captions" type="file" accept=".vtt"></label>'+
    field(a,"subtitle","字幕說明")+'</div></details>'+
    '<details class="catalog-section"><summary>移除作品</summary><div class="catalog-actions">'+btn("delete","刪除作品")+'</div></details>';
  const refreshPreview=()=>artworkDetail($("#art-preview"),a);
  function updateHeading() {
    $("#art-heading").textContent=a.title;
    $("#art-summary").textContent=[a.artist,a.category,a.type].filter(Boolean).join(" · ");
  }
  updateHeading();refreshPreview();
  action("back-library",()=>{
    libraryDetailOpen=false;
    desk.dataset.detail="false";
    const selected=$("#art-list [aria-current=true]") || $("#query");
    selected.focus();
  });
  bind($("#form"),a,k=>{
    if(["title","artist","category","type"].includes(k)){updateHeading();list();}
    if(["title","description","type"].includes(k))refreshPreview();
  });
  $('#form [data-key="category"] input').onchange=()=>{
    const categories=[...new Set(db.arts.map(x=>x.category).filter(Boolean))];
    if(!categories.includes(filter))filter="";
    const select=$("#filter");
    select.innerHTML='<option value="">全部分類</option>'+options(categories,filter);
    list();
  };
  for(const k of ["src","voice","captions"]) $("#"+k).onchange=async e=>{
    const input=e.target,file=input.files[0];
    if(!file)return;
    try {
      a[k]=await fileData(file,k==="captions"?"text/vtt":null);
      if(k==="src" && input.isConnected){list();refreshPreview();}
      changed();
    } catch(err){error(err);}
    finally {input.value="";}
  };
  action("delete",()=>{
    if(!confirm("刪除「"+a.title+"」及其佈展位置？"))return;
    db.arts=db.arts.filter(x=>x.id!==a.id);
    db.shows.forEach(s=>{s.ids=s.ids.filter(i=>i!==a.id);delete s.layout[a.id];});
    aid=db.arts[0]?.id;libraryDetailOpen=false;
    changed();render();
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
let openReviewShow=null, checkExcursion=null;
function paintCheckReturn() {
  if (!checkExcursion) return;
  if (checkExcursion.id!==sid || checkExcursion.view!==tab) {
    checkExcursion=null;
    return;
  }
  const back=document.createElement("button");
  back.id="back-to-check";back.type="button";back.textContent="返回展前檢查";
  back.onclick=()=>{
    tab="展覽管理";
    openReviewShow=sid;
    render();
    const summary=$("#show-check summary");
    summary.focus({preventScroll:true});summary.scrollIntoView({block:"nearest"});
  };
  app.prepend(back);
}
function manage() {
  const s = show();
  app.innerHTML = '<section class="catalog-desk"><div class="catalog-heading"><h1>展覽管理</h1>' +
    btn("new","建立展覽") + '</div><div class="catalog-columns"><div class="catalog-sidebar" id="show-browser">' +
    '<button id="switch-show" aria-controls="show-list" aria-expanded="false">切換展覽</button><h2>展覽清單</h2>' +
    '<aside id="show-list" aria-label="展覽清單"></aside></div><div id="form" class="catalog-editor"></div></div></section>';
  const selectShow = (next) => {
    if (next === sid) {
      $("#show-browser").classList.remove("is-open");
      $("#switch-show").setAttribute("aria-expanded", "false");
      if(matchMedia("(max-width:700px)").matches)$("#switch-show").focus();
      return;
    }
    sid = next;
    render();
    $("#show-title")?.focus({preventScroll:true});
  };
  function listShows() {
    const covers = new Map(db.arts.map(a => [a.id, a]));
    const cards = db.shows.map(ex => {
      const first = ex.ids.map(i => covers.get(i)).find(a => a?.src);
      return { ...first, id:ex.id, title:ex.title, description:first?.description || "展" };
    });
    artworkList($("#show-list"), cards, sid, selectShow);
    $("#show-list").querySelectorAll("small").forEach((label,i) => {
      const ex = db.shows[i];
      label.textContent = ex.status + " · " + ex.ids.length + " 件作品";
    });
  }
  listShows();
  $("#switch-show").onclick = e => {
    const open = $("#show-browser").classList.toggle("is-open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
  };
  action("new", () => {
    sid = id();
    db.shows.push({id:sid, title:"新展覽", description:"", status:"草稿", start:"", end:"",
      ids:[], layout:{}, playlist:[], volume:.5, fade:2});
    changed();
    render();
    $("#show-info").open = true;
    const input = $('#show-info [data-key="title"] input');
    input.select();
  });
  if (!s) {
    $("#show-browser").hidden=true;
    $("#form").innerHTML = '<p class="catalog-empty">尚無展覽。點「建立展覽」開始選作品。</p>';
    return;
  }
  const published = s.status === "已發布";
  $("#form").innerHTML = '<section class="show-overview"><span class="show-status"></span><h2 id="show-title" tabindex="-1"></h2>' +
    '<p class="catalog-meta"><span id="show-dates"></span> · <span id="show-count"></span></p>' +
    '<div class="catalog-actions">'+btn("layout","進入佈展")+btn("preview","參觀預覽")+btn("publish",published?"更新公開展覽":"發布展覽") +
    '</div><p id="show-first-work" class="catalog-empty" hidden></p>' +
    (published ? '<a class="live-exhibition" target="_blank" rel="noopener noreferrer" href="../#'+encodeURIComponent(s.id)+'">查看公開展覽</a>' : '') + '</section>' +
    '<details class="catalog-section" id="show-check"><summary>展前檢查 <small id="check-count"></small></summary>'+
    '<p id="check-progress"></p><ul id="check-list"></ul></details>'+
    '<details class="catalog-section" id="show-info"><summary>展覽資料與檔期</summary><div class="fields">' +
    field(s,"title","展覽名稱",null,"text","required")+field(s,"description","策展說明",null,"textarea")+
    field(s,"start","開展日",null,"date")+field(s,"end","結束日",null,"date")+'</div></details>'+
    '<details class="catalog-section" id="show-members"><summary>展出作品 <small id="member-count"></small></summary>' +
    (db.arts.length>8 ? '<label>搜尋可展出作品<input id="member-query" type="search"></label>' : '') +
    '<div id="members" class="catalog-members"></div><p id="members-empty" hidden>沒有符合的作品。</p></details>'+
    '<details class="catalog-section" id="show-music"><summary>背景音樂</summary><div class="fields">'+
    num(s,"volume","音量（0–1）",0,1)+num(s,"fade","淡入淡出秒數",0,30)+
    '<label>依序加入曲目<input type="file" id="tracks" multiple accept="audio/*"></label></div><ol id="tracksList"></ol></details>'+
    '<details class="catalog-section"><summary>其他展務</summary><div class="catalog-actions">'+btn("copy","複製展覽")+
    btn("end","結束並典藏")+'</div></details>';
  const checkPanel=$("#show-check");
  checkPanel.open=openReviewShow===s.id;
  checkPanel.ontoggle=()=>{
    if(checkPanel.isConnected)openReviewShow=checkPanel.open ? s.id : null;
  };
  function openIssue(issue) {
    if(issue.kind==="schedule" || issue.kind==="members") {
      const panel=$(issue.kind==="schedule"?"#show-info":"#show-members");
      panel.open=true;
      const date=issue.field==="end" ? "end" : "start";
      const target=panel.querySelector(issue.kind==="schedule" ? '[data-key="'+date+'"] input' : 'input,button') || panel.querySelector("summary");
      target.focus({preventScroll:true});target.scrollIntoView({block:"nearest"});
      return;
    }
    if (!issue.workId) return;
    aid=issue.workId;
    if(issue.kind==="art") {
      tab="作品資料庫";
      libraryDetailOpen=true;
      search=filter="";
    } else {
      tab="佈展設定";
      deskTool="position";
    }
    openReviewShow=s.id;
    checkExcursion={id:s.id,view:tab};
    render();
    if(issue.kind==="art") {
      const target=issue.field==="src" ? $("#src") :
        issue.field==="width" || issue.field==="height" ? $('[data-key="'+issue.field+'"] input') : $("#art-heading");
      const section=target.closest("details");
      if(section)section.open=true;
      target.focus({preventScroll:true});target.scrollIntoView({block:"nearest"});
    }
  }
  function updateCheck() {
    const {works,reviewed,issues}=exhibitionCheck(db,s);
    $("#check-count").textContent=issues.length ? "待檢查 "+issues.length+" 項" : "檢查完成";
    $("#check-progress").textContent="已確認掛位 "+reviewed+" / "+works+" 件";
    const defaultAction={schedule:"調整檔期",members:"選擇作品",art:"編輯作品",position:"調整掛點",review:"確認掛位"};
    const rows=issues.map(issue=>{
      const item=document.createElement("li"), text=document.createElement("span"), button=document.createElement("button");
      text.textContent=issue.text;
      button.type="button";button.dataset.checkKind=issue.kind;
      if(issue.workId)button.dataset.checkWork=issue.workId;
      button.textContent=issue.label || defaultAction[issue.kind];
      button.onclick=()=>openIssue(issue);
      item.append(text,button);return item;
    });
    $("#check-list").replaceChildren(...rows);
  }
  function updateOverview() {
    updateCheck();
    $(".show-status").textContent = s.status;
    $("#show-title").textContent = s.title;
    $("#show-dates").textContent = s.start && s.end ? s.start+" 至 "+s.end :
      s.start ? s.start+" 起" : s.end ? "至 "+s.end : "未設定展期";
    $("#show-count").textContent = s.ids.length+" 件作品";
    $("#member-count").textContent = "已選 "+s.ids.length+" 件";
    const empty = !s.ids.length;
    for (const k of ["layout","preview","publish"]) $('[data-act="'+k+'"]').disabled = empty;
    const hint = $("#show-first-work");
    hint.hidden = !empty;
    if(empty)hint.textContent = db.arts.length ? "先在下方「展出作品」勾選要展出的作品。" : "先將作品加入作品資料庫，再回來選件。";
  }
  updateOverview();
  $("#show-members").open = !s.ids.length;
  bind($("#form"),s,k=>{
    if (["title","start","end"].includes(k)) updateOverview();
    if (k === "title") listShows();
  });
  // Some mobile date pickers commit with change alone, including clearing a date.
  for(const date of $("#show-info").querySelectorAll('input[type="date"]')) {
    date.addEventListener("change",()=>{
      const key=date.closest("[data-key]").dataset.key;
      if(date.validity.valid && s[key]!==date.value) {
        s[key]=date.value;
        changed();
        updateOverview();
      }
    });
  }
  for (const a of db.arts) {
    const label=document.createElement("label"), choice=document.createElement("input");
    choice.type="checkbox"; choice.checked=s.ids.includes(a.id);
    choice.setAttribute("aria-label",a.title);
    const caption=document.createElement("span"), title=document.createElement("strong"), meta=document.createElement("small");
    title.textContent=a.title;meta.textContent=[a.artist,a.category].filter(Boolean).join(" · ");
    caption.append(title,meta);
    label.append(choice,caption);
    $("#members").append(label);
    choice.onchange=()=>{
      s.ids=s.ids.filter(i=>i!==a.id);
      if(choice.checked)s.ids.push(a.id);
      changed();
      updateOverview();
      listShows();
    };
  }
  const memberQuery=$("#member-query");
  if(memberQuery)memberQuery.oninput=()=>{
    const term=memberQuery.value.trim().toLocaleLowerCase();
    let visible=0;
    $("#members").querySelectorAll("label").forEach(label=>{
      label.hidden=!label.textContent.toLocaleLowerCase().includes(term);
      if(!label.hidden)visible++;
    });
    $("#members-empty").hidden=visible>0;
  };
  if (!db.arts.length) {
    $("#members").innerHTML=btn("to-library","前往作品資料庫");
    action("to-library",()=>{libraryDetailOpen=false;tab="作品資料庫";render();});
  }
  action("layout",()=>{tab="佈展設定";if(!s.ids.includes(aid))aid=s.ids[0];render();});
  action("preview",()=>previewShow(s));
  action("copy",()=>{
    const clone=structuredClone(s);
    clone.id=sid=id(); clone.title+=" 副本"; clone.status="草稿";
    db.shows.push(clone);
    changed();render();
    $("#show-info").open=true;
    $('#show-info [data-key="title"] input').select();
  });
  function listTracks() {
    const list=$("#tracksList");
    list.replaceChildren();
    s.playlist.forEach((v,i)=>{
      const item=document.createElement("li"), remove=document.createElement("button");
      const title=v.startsWith("media/") ? v.split("/").pop() : "匯入音軌 "+(i+1);
      item.append(title); remove.textContent="移除"; remove.setAttribute("aria-label","移除"+title);
      remove.onclick=()=>{s.playlist.splice(i,1);changed();listTracks();};
      item.append(" ",remove);list.append(item);
    });
  }
  listTracks();
  $("#tracks").onchange=async e=>{
    const input=e.currentTarget, files=Array.from(input.files);
    input.disabled=true;
    try {
      const tracks=[];
      for (const file of files) tracks.push(await fileData(file));
      s.playlist.push(...tracks);
      if(tracks.length)changed();
      if(input.isConnected)listTracks();
    } catch(err){error(err);}
    finally {input.value="";input.disabled=false;}
  };
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
const deskTools={inventory:"作品清單",position:"位置",mount:"裝裱",light:"燈光"};
const requestedTool=new URLSearchParams(location.search).get("panel");
let deskTool=Object.hasOwn(deskTools,requestedTool) ? requestedTool : "position";
const lightFields=["lx","ly","lz","power","kelvin","angle"];
let rulerPreference=null;
matchMedia("(orientation:landscape) and (max-height:550px)").addEventListener("change",event=>{
  if(event.matches && tab==="佈展設定")requestAnimationFrame(()=>$("#wall-preview")?.scrollIntoView({block:"start"}));
});
function showDeskRulers() {
  const button=$("#ruler-toggle"), readout=$(".wall-readout");
  if(!button || !readout)return;
  const visible=rulerPreference ?? (deskTool==="position");
  $(".hanging-desk").dataset.rulers=visible ? "on" : "off";
  readout.hidden=!visible;
  const details=readout.closest("details");
  if(details)details.hidden=!visible;
  button.textContent=visible ? "隱藏尺標" : "顯示尺標";
  button.setAttribute("aria-pressed",String(visible));
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
  let a = works.find((work) => work.id === aid);
  if(!a)deskTool="inventory";
  const inspectorBefore=$("#layout-inspector"), activeBefore=document.activeElement;
  const advancedBefore=keepScene ? Array.from(inspectorBefore.querySelectorAll("[data-desk-advanced][open]"),el=>el.dataset.deskAdvanced) : [];
  const priorFocus=keepScene && inspectorBefore.contains(activeBefore) ? activeBefore : null;
  const toolButtons=Object.entries(deskTools).map(([key,label])=>
    '<button type="button" role="tab" id="'+(key==="mount"?"jump-mount":"desk-tab-"+key)+'" data-desk-tool="'+key+'" aria-controls="desk-panel-'+key+'">'+label+'</button>').join("");
  if(!keepScene) app.innerHTML =
    '<div class="desk-heading"><h1>佈展設定</h1><label>展覽<select id="ex"></select></label></div>'+
    '<div class="hanging-desk"><section id="wall-preview" aria-label="即時展牆預覽"><div class="surface-tools">'+
    '<div class="desk-view-modes" role="group" aria-label="展牆視圖">'+btn("3D","3D 實景")+btn("2D","2D 展牆")+'</div>'+
    (mode==="3D" && a ? '<button id="ruler-toggle" aria-pressed="true">隱藏尺標</button>' : '')+
    btn("preview","參觀預覽")+'</div><div id="surface"></div>'+
    '<div class="wall-save"><span role="status" id="wall-save-status"></span><button id="wall-save-retry" data-save-retry hidden>重試儲存</button></div></section>'+
    '<div class="desk-sidebar"><div class="desk-work-picker"><label for="sel">編輯作品</label><select id="sel"></select></div>'+
    '<div class="desk-tool-tabs" role="tablist" aria-label="佈展工具">'+toolButtons+'</div>'+
    '<div id="layout-inspector" role="region" aria-label="佈展工具內容" tabindex="-1"><section id="desk-panel-inventory" class="inventory" role="tabpanel" aria-labelledby="desk-tab-inventory" data-desk-panel="inventory">'+
    '<p id="wall-progress"></p><div id="wall-list"></div></section><div id="form"></div></div></div></div>';
  function activateTool(key,resetScroll=false) {
    deskTool=key;
    for(const el of app.querySelectorAll("[data-desk-tool]")) {
      const current=el.dataset.deskTool===key;
      el.setAttribute("aria-selected",String(current));
      el.tabIndex=current ? 0 : -1;
      el.disabled=!a && el.dataset.deskTool!=="inventory";
    }
    for(const el of app.querySelectorAll("[data-desk-panel]"))el.hidden=el.dataset.deskPanel!==key;
    const route=new URL(location.href);
    route.searchParams.set("panel",key);
    if(route.href!==location.href)history.replaceState(null,"",route);
    showDeskRulers();
    if(resetScroll)$("#layout-inspector").scrollTop=0;
  }
  const controls=[...app.querySelectorAll("[data-desk-tool]")];
  for(const button of controls) {
    button.onclick=()=>activateTool(button.dataset.deskTool,true);
    button.onkeydown=e=>{
      const available=controls.filter(el=>!el.disabled),i=available.indexOf(button);
      const next={ArrowLeft:available[(i+available.length-1)%available.length],ArrowRight:available[(i+1)%available.length],Home:available[0],End:available.at(-1)}[e.key];
      if(!next)return;
      e.preventDefault();e.stopPropagation();
      next.focus({preventScroll:true});next.click();
    };
  }
  activateTool(deskTool);
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
  artworkList($("#wall-list"),works,aid,chosen=>{
    activateTool("position",true);
    selectWork(chosen);
    $("#desk-tab-position")?.focus({preventScroll:true});
  },w=>[w.room,wallNames[w.wall],w.groupId?"連屏":"",w.reviewed?"掛位已確認":"待確認"].filter(Boolean).join(" · "));
  action("preview",()=>previewShow(s,a));
  for(const m of ["2D","3D"])app.querySelector('[data-act="'+m+'"]').setAttribute("aria-current",String(m===mode));
  for (let m of ["2D", "3D"])
    action(m, () => {
      if(mode===m)return;
      mode = m;
      render();
    });
  $("#sel").disabled=!works.length;
  if (!a) {
    $("#surface").textContent = works.length ? "這件公開作品無法對應目前的草稿，請從清單選擇要編輯的作品。" : "請先於展覽管理勾選展出作品";
    return;
  }
  room = a.room;
  wall = a.wall;
  let nearby = works.filter((o) => o.room === room),
    same = nearby.filter((o) => o.wall === wall);
  function patch(i, obj) {
    Object.assign((s.layout[i] ??= {}),{reviewed:false},obj);
    const index=works.findIndex(w=>w.id===i), work=works[index];
    const reviewed=Boolean(obj.reviewed);
    if(work && Boolean(work.reviewed)!==reviewed) {
      work.reviewed=reviewed;
      $("#wall-progress").textContent=s.status+"　·　掛位已確認 "+works.filter(w=>w.reviewed).length+" / "+works.length;
      const meta=$("#wall-list").children[index]?.querySelector("small");
      if(meta)meta.textContent=meta.textContent.replace(reviewed?"待確認":"掛位已確認",reviewed?"掛位已確認":"待確認");
      const review=app.querySelector('[data-act="review"]');
      if(work.id===aid && review)review.textContent=reviewed?"重新標記待確認":"確認此作掛位";
    }
    changed();
  }
  let dimensions=roomSize(nearby);
  let span=2*dimensions[wall%2 ? "depth" : "width"], height=dimensions.height;
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  const group=wallTools.members(same,a), ordered=wallTools.units(same);
  function rowSize() {
    const boxes=ordered.map(wallTools.envelope);
    const total=boxes.reduce((sum,b)=>sum+b.right-b.left,0);
    const gaps=boxes.slice(1).map((b,i)=>b.left-boxes[i].right);
    const currentGap=gaps.length?Math.max(0,Math.round(100*gaps.reduce((sum,x)=>sum+x,0)/gaps.length)):0;
    return {boxes,total,currentGap};
  }
  const currentGap=rowSize().currentGap;
  function savePositions(list) {
    for (const o of list)patch(o.id,{x:+o.x.toFixed(5),y:+o.y.toFixed(5)});
  }
  function shift(list,dx,dy) {
    wallTools.movement(list,span/2,height)(dx,dy);
    savePositions(list);
  }
  function refreshPlacement() {
    if(viewer)viewer.updatePlacements(nearby);
    layout(true);
    if(mode==="2D")scene();
  }
  function scene() {
    let surface = $("#surface");
    if (mode === "3D") {
      surface.innerHTML =
         '<div id="stage"><span class="stage-loading">正在開啟展牆…</span></div>';
      showDeskRulers();
      $("#ruler-toggle").onclick=()=>{
        rulerPreference=$(".wall-readout").hidden;
        showDeskRulers();
      };
      let t = token;
      import("../gallery.js?v=hall34")
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
            undefined,{...wallTools,canMove:()=>deskTool==="position"}
          );
          viewer.focus(nearby.indexOf(a));
          updateMountViews();
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
      b.dataset.workId=o.id;
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
      const face=document.createElement("div");
      face.className="plan-face";
      b.append(face);
      paintWallMount(b,o);
      if (o.type === "圖片")
        face.style.backgroundImage =
          'url("' + o.src.replace(/^media\//, "../media/") + '")';
      let label = document.createElement("span");
      label.textContent = o.title;
      label.className = "plan-label";
      label.setAttribute("aria-hidden","true");
      b.setAttribute("aria-label",o.title);
      b.onclick = e => {if(e.detail===0 || deskTool!=="position")selectWork(o.id);};
      b.append(label);
      w.append(b);
      let d;
      b.onpointerdown = (e) => {
        if(deskTool!=="position")return;
        b.setPointerCapture(e.pointerId);
        const list=wallTools.members(same,o);
        d={x:e.clientX,y:e.clientY,list,move:wallTools.movement(list,span/2,height)};
      };
      b.onpointermove = (e) => {
        if (!d) return;
        if(!d.moved && Math.hypot(e.clientX-d.x,e.clientY-d.y)<3)return;
        d.moved=true;
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
        if(d.moved)savePositions(d.list);
        d=null;
        aid=o.id; render();
      };
      b.onpointercancel = () => {
        d = null;
        render();
      };
    }
  }
  const n = (k, l, lo, hi) => num(a, k, l, lo, hi);
  const cm=(key,label,min,max)=>num({[key]:+(a[key]*100).toFixed(3)},key,label,min*100,max*100);
  const panel=(key,contents)=>'<section data-desk-panel="'+key+'" id="desk-panel-'+key+'" role="tabpanel" aria-labelledby="'+(key==="mount"?"jump-mount":"desk-tab-"+key)+'" '+(key===deskTool?'':'hidden')+'>'+contents+'</section>';
  const advanced=(key,label,contents)=>'<details class="desk-advanced" data-desk-advanced="'+key+'" '+(advancedBefore.includes(key)?'open':'')+'><summary>'+label+'</summary><div>'+contents+'</div></details>';
  const picks=works.filter(w=>!group.includes(w));
  const wallSelector='<label data-key="wall">展牆<select>'+wallNames.map((name,i)=>'<option value="'+i+'" '+(a.wall===i?'selected':'')+'>'+name+'</option>').join("")+'</select></label>';
  const placement =
    '<div id="position-pad" role="group" aria-label="作品位置微調"><div class="pad-caption"><strong>位置微調</strong><span>每次 5 公分</span></div>'+
    '<div class="nudge-keys">'+btn("left","← 左移")+btn("right","右移 →")+btn("up","↑ 升高")+btn("down","↓ 降低")+'</div></div>'+
    '<div class="desk-primary-fields">'+cm("x","水平位置（公分）",-100,100)+cm("y","掛點高度（公分）",0,height)+'</div>'+
    btn("review",a.reviewed?"重新標記待確認":"確認此作掛位")+
    (mode==="3D"?advanced("measures","量測明細",'<output class="wall-readout" aria-label="展牆量測"></output>'):"")+
    advanced("placement","展牆、尺寸與旋轉",'<div class="fields">'+field(a,"room","展廳名稱",null,"text","required")+wallSelector+
      n("z","離牆距離（公尺）",0,3)+n("rotate","旋轉（度）",-180,180)+n("width","展出寬度（公尺）",.05,100)+n("height","展出高度（公尺）",.05,4.4)+'</div>'+btn("actualSize","按原作尺寸展示（1:1）"))+
    (picks.length?advanced("swap","交換掛位",'<label>交換對象<select id="swap-target">'+picks.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.title)+' · '+esc(w.room)+'</option>').join("")+'</select></label>'+btn("swap","互換位置")):"")+
    (same.length>1?advanced("group","連屏組合",'<div class="panel-members">'+same.filter(o=>!o.groupId || o.groupId===a.groupId || o.id===aid).map(o=>
      '<label><input type="checkbox" data-panel="'+esc(o.id)+'" '+(group.includes(o)?'checked ':'')+(o.id===aid?'disabled':'')+'>'+esc(o.title)+'</label>').join("")+'</div><div class="bar">'+btn("group","儲存連屏組合")+(group.length>1?btn("ungroup","解散連屏")+'<label>屏間淨距（公分）<input id="panel-gap" type="number" min="0" step="any"></label>'+btn("spacePanels","套用屏間距"):"")+'</div>'):"")+
    (ordered.length>1?advanced("spacing","同牆對齊與間距",'<label>同牆作品間距（公分）<input id="gap" type="number" min="0" step="any" value="'+currentGap+'"></label><div class="bar">'+btn("spacing","套用同牆間距")+btn("align","同牆作品對齊高度")+btn("distribute","同牆作品等距排列")+'</div>'):"");
  const lighting='<div class="bar light-looks">'+btn("warm","暖光聚焦")+btn("day","日光漫射")+'</div>'+
    '<div class="desk-primary-fields">'+n("power","亮度（燭光）",0,120)+n("kelvin","色溫（K）",2500,7000)+n("angle","照射半角（度）",5,85)+'</div>'+
    advanced("light-position","燈具位置",'<div class="fields">'+n("lx","水平位置（公尺）",-4,4)+n("ly","相對掛點高度（公尺）",-2,4)+n("lz","距牆（公尺）",.1,6)+'</div>');
  const existingReadout=keepScene ? $(".wall-readout") : null;
  $("#form").innerHTML=panel("position",placement)+panel("mount",'<fieldset id="mount-controls"><legend>作品裝裱</legend></fieldset>')+panel("light",lighting);
  if(existingReadout)$(".wall-readout")?.replaceWith(existingReadout);
  showDeskRulers();
  const mountHost=$("#mount-controls");
  const mountViews=document.createElement("div");
  mountViews.className="board-view-actions";
  mountViews.setAttribute("role","group");
  mountViews.setAttribute("aria-label","板裱檢視角度");
  mountViews.innerHTML=btn("mountEdge","近看板邊")+btn("mountFront","看整件");
  mountHost.before(mountViews);
  function updateMountViews() {
    mountViews.hidden=mode!=="3D" || !["無框板裱","壓克力面裱"].includes(a.mount);
    for(const button of mountViews.children)button.disabled=!viewer;
  }
  action("mountEdge",()=>viewer?.inspectMountEdge(a.id));
  action("mountFront",()=>viewer?.focus(nearby.indexOf(a)));
  updateMountViews();
  let mountFrame=0;
  mountEditor(mountHost,a,delta=>{
    patch(a.id,delta);
    updateMountViews();
    // Input can fire repeatedly while moving the system colour picker or sheen slider.
    // Save every accepted value above and update the existing scene once per frame.
    if(mountFrame)return;
    const sceneToken=token;
    mountFrame=requestAnimationFrame(()=>{
      mountFrame=0;
      if(sceneToken!==token)return;
      const required=roomSize(nearby), axis=wall%2 ? "depth" : "width";
      if(required.height!==dimensions.height || required.theme!==dimensions.theme ||
          required.width!==dimensions.width || required.depth!==dimensions.depth) {
        dimensions=required;
        span=2*dimensions[axis];
        height=dimensions.height;
        const hangingHeight=$('#form [data-key="y"] input');
        if(hangingHeight)hangingHeight.max=height*100;
        token++;
        viewer?.dispose();
        viewer=null;
        scene(); // Keep the active input and the inspector when the wall needs more room.
      } else if(viewer)viewer.updateMount(a.id,a);
      else if(mode==="2D") {
        const piece=Array.from(document.querySelectorAll(".piece")).find(el=>el.dataset.workId===a.id);
        if(piece)paintWallMount(piece,a);
      }
      const gap=$("#gap");
      if(gap && aid===a.id)gap.value=rowSize().currentGap;
      const panelGap=$("#panel-gap");
      if(panelGap && aid===a.id) {
        const env=wallTools.envelope(group);
        const width=group.reduce((sum,w)=>{const b=wallTools.bounds(w);return sum+b.right-b.left;},0);
        panelGap.value=Math.max(0,Math.round(1000*(env.right-env.left-width)/(group.length-1))/10);
      }
    });
  },(host,apply)=>mountTemplates(host,()=>a,apply,db,changed));
  action("review",()=>{patch(a.id,{reviewed:!a.reviewed});layout(true);});
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
      if(w.z<-.00001 || w.z>3.00001 || b.left< -half-.00001 || b.right>half+.00001 || b.bottom<-.00001 || b.top>size.height+.00001)
        throw Error("互換後會超出展牆，請先調整掛位或選擇其他作品。");
    }
    moves.forEach(({id,x,y,z,room,wall})=>patch(id,{x:+x.toFixed(5),y:+y.toFixed(5),z:+z.toFixed(5),room,wall}));
    render();
  });
  if(group.length>1) {
    const panelSize=()=>{
      const panels=group.map(w=>({w,b:wallTools.bounds(w)})).sort((a,b)=>a.b.left-b.b.left);
      return {panels,width:panels.reduce((sum,p)=>sum+p.b.right-p.b.left,0),original:wallTools.envelope(group)};
    };
    const {width,original}=panelSize();
    $("#panel-gap").value=Math.max(0,Math.round(1000*(original.right-original.left-width)/(group.length-1))/10);
    action("spacePanels",()=>{
      const input=$("#panel-gap");
      if(!input.value.trim() || !input.reportValidity())return;
      const {panels,width,original}=panelSize();
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
      const value=a[k]/100, old=(s.layout[a.id]?.[k] ?? db.arts.find(o=>o.id===a.id)[k]);
      a[k]=old;
      shift(group,k==="x"?value-old:0,k==="y"?value-old:0);
      viewer?.updatePlacements(group);
    } else if(k==="wall" || k==="room") {
      if(k==="wall")a.wall=Number(a.wall);
      group.forEach(o=>patch(o.id,{[k]:a[k]}));
    } else {
      patch(a.id, { [k]: a[k] });
      if(lightFields.includes(k))viewer?.updateLight(a.id,a);
    }
  });
  $("#form").onchange=(e)=>{
    const key=e.target.closest("[data-key]")?.dataset.key;
    if(!key || lightFields.includes(key))return;
    setTimeout(()=>{if(tab==="佈展設定") {
      if(["x","y","z","rotate"].includes(key))refreshPlacement();else render();
    }},0);
  };
  for(const [name,dx,dy] of [["left",-.05,0],["right",.05,0],["up",0,.05],["down",0,-.05]]) {
    action(name,()=>{shift(group,dx,dy);refreshPlacement();});
  }
  function spaceRow(gap) {
    const {boxes,total}=rowSize();
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
  action("distribute",()=>spaceRow(Math.max(0,(span-rowSize().total)/(ordered.length+1))));
  for (let [k, v] of [
    ["warm", [3000, 28, 25]],
    ["day", [6200, 18, 55]],
  ])
    action(k, () => {
      const settings={kelvin:v[0],power:v[1],angle:v[2]};
      Object.assign(a,settings);
      patch(a.id,settings);
      for(const [key,value] of Object.entries(settings))$('#form [data-key="'+key+'"] input').value=value;
      viewer?.updateLight(a.id,a);
    });
  if(priorFocus && !priorFocus.isConnected) {
    const field=priorFocus.closest("[data-key]")?.dataset.key;
    const action=priorFocus.dataset.act;
    const row=priorFocus.closest("#wall-list button");
    const replacement=field ? $('#form [data-key="'+field+'"] :is(select,input)') :
      action ? app.querySelector('[data-act="'+action+'"]') :
      row ? $('#wall-list button[aria-current="true"]') : null;
    replacement?.focus({preventScroll:true});
  }
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
  app.innerHTML='<section class="catalog-desk backup-desk"><div class="catalog-heading"><h1>備份與版本</h1></div>'+
    '<section class="backup-card"><h2>匯出工作室</h2><p>下載作品原檔、展覽與私人佈展設定，保存至裝置或 Google Drive。</p>'+
    btn("export","下載完整備份")+'</section>'+
    '<details class="catalog-section" id="restore-file-panel"><summary>從備份檔還原</summary><p>選擇完整工作室備份，確認後取代目前資料。</p>'+
    '<label>選擇備份檔<input id="import" type="file" accept=".json"></label></details>'+
    '<details class="catalog-section" id="restore-history-panel"><summary>從歷史版本還原</summary><label>選擇版本<select id="versions"></select></label>'+
    btn("restore","還原所選版本")+'</details></section>';
  const versionPanel=$("#restore-history-panel"),select=$("#versions"),restore=$('[data-act="restore"]');
  restore.disabled=true;
  let loaded=false;
  versionPanel.ontoggle=async()=>{
    if (!versionPanel.open || loaded) return;
    loaded=true; select.replaceChildren(new Option("讀取中…","")); select.disabled=true;
    try {
      const entries=await versions();
      const options=entries.map(n=>new Option(n.label,n.id));
      select.replaceChildren(...(options.length ? options : [new Option("尚無歷史版本","")]));
      select.disabled=restore.disabled=!options.length;
    } catch(err) {
      loaded=false;
      select.replaceChildren(new Option("展開面板可再試一次",""));
      error(err);
    }
  };
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
    tab="佈展設定";
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
