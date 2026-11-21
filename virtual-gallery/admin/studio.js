import { artworkList, artworkDetail } from "./art-preview.js";
import { state, post, versions, exhibition } from "./storage.js";
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
  mode = "2D",
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
function flush() {
  clearTimeout(timer);
  let run = chain
    .catch(() => {})
    .then(async () => {
      if (!dirty) return;
      let gen = generation;
      status.textContent = "儲存中…";
      db.rev = await post("save", db);
      if (gen === generation) dirty = false;
      status.textContent = "已儲存 · 版本 " + db.rev;
    });
  chain = run;
  return run;
}
function changed() {
  dirty = true;
  generation++;
  status.textContent = "尚有變更";
  clearTimeout(timer);
  timer = setTimeout(() => flush().catch(error), 1200);
}
function error(e) {
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
  width: 1.8,
  height: 1.25,
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
  else if (tab === "布展編輯") layout();
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
  action("new", () => {
    aid = id();
    db.arts.push({ ...defaults, id: aid, title: "新作品" });
    changed();
    render();
  });
  $("#batch").onchange = async (e) => {
    try {
      for (let f of e.target.files) {
        let type = f.type.startsWith("video")
          ? "影片"
          : f.type.startsWith("audio")
            ? "語音"
            : f.type === "image/gif"
              ? "動態"
              : "圖片";
        let src = await fileData(f);
        aid = id();
        db.arts.push({
          ...defaults,
          id: aid,
          title: f.name.replace(/\.[^.]+$/, ""),
          src,
          type,
        });
        changed();
      }
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
    num(a, "width", "原作寬度（公尺）", 0.05, 10) +
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
  action("preview", async () => {
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
          { galleryPreview: [data] },
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
    dialog.showModal();
    frame.src = "../?studio-preview";
  });
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
      await flush();
      status.textContent = "正在更新 GitHub…";
      document.querySelector("main").inert = true;
      try {
        await post(k, { id: sid, rev: db.rev });
      } finally {
        document.querySelector("main").inert = false;
      }
      db = await state();
      status.textContent = "GitHub 已更新，Pages 正在建置";
      render();
    });
}
function layout() {
  let s = show();
  if (!s) {
    app.textContent = "請先建立展覽";
    return;
  }
  let works = s.ids.map((i) => ({
    ...db.arts.find((a) => a.id === i),
    ...s.layout[i],
  }));
  if (!works.some((a) => a.id === aid)) aid = works[0]?.id;
  let a = works.find((a) => a.id === aid);
  app.innerHTML =
    '<h1>布展編輯</h1><div class="bar"><label>展覽<select id="ex"></select></label><label>編輯作品<select id="sel"></select></label>' +
    btn("2D", "2D 展牆") +
    btn("3D", "3D 空間") +
    '</div><div id="surface"></div><div id="form"></div>';
  function picker(el, items, current, fn) {
    el.replaceChildren(...items.map((x) => new Option(x.title, x.id)));
    el.value = current;
    el.onchange = () => fn(el.value);
  }
  picker($("#ex"), db.shows, sid, (v) => {
    sid = v;
    render();
  });
  picker($("#sel"), works, aid, (v) => {
    aid = v;
    render();
  });
  for (let m of ["2D", "3D"])
    action(m, () => {
      mode = m;
      render();
    });
  if (!a) {
    $("#surface").textContent = "請先於展覽管理勾選展出作品";
    return;
  }
  room = a.room;
  wall = a.wall;
  let nearby = works.filter((o) => o.room === room),
    same = nearby.filter((o) => o.wall === wall);
  function patch(i, obj) {
    Object.assign((s.layout[i] ??= {}), obj);
    changed();
  }
  function scene() {
    let surface = $("#surface");
    if (mode === "3D") {
      surface.innerHTML =
        '<p>拖曳作品調整位置，拖曳空白處環顧展間。</p><div id="stage"></div>';
      let t = token;
      import("../gallery.js")
        .then(({ gallery }) => {
          if (t !== token) return;
          viewer = gallery(
            $("#stage"),
            nearby.map((work) => ({
              ...work,
              src: work.src.replace(/^media\//, "../media/"),
            })),
            (o) => {
              aid = o.id;
              render();
            },
            (o) => {
              patch(o.id, { x: o.x, y: o.y });
              aid = o.id;
              render();
            },
          );
          viewer.focus(nearby.indexOf(a));
        })
        .catch(error);
      return;
    }
    surface.innerHTML =
      "<p>" +
      esc(room) +
      "　／　" +
      ["北牆", "西牆", "南牆", "東牆"][wall] +
      '　·　拖曳作品調整掛點</p><div class="wall"></div>';
    let w = $(".wall"),
      span = wall % 2 ? 14 : 12;
    for (let o of same) {
      let b = document.createElement("button");
      b.className = "piece" + (o.id === aid ? " sel" : "");
      b.style.cssText =
        "left:" +
        (50 + (100 * o.x) / span) +
        "%;top:" +
        (100 - (o.y / 4.5) * 100) +
        "%;width:" +
        (100 * o.width) / span +
        "%;height:" +
        (100 * o.height) / 4.5 +
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
        d = [e.clientX, e.clientY, o.x, o.y];
      };
      b.onpointermove = (e) => {
        if (!d) return;
        let rect = w.getBoundingClientRect();
        o.x = Math.max(
          -span / 2 + o.width / 2,
          Math.min(
            span / 2 - o.width / 2,
            d[2] + ((e.clientX - d[0]) * span) / rect.width,
          ),
        );
        o.y = Math.max(
          o.height / 2,
          Math.min(
            4.5 - o.height / 2,
            d[3] - ((e.clientY - d[1]) * 4.5) / rect.height,
          ),
        );
        b.style.left = 50 + (100 * o.x) / span + "%";
        b.style.top = 100 - (o.y / 4.5) * 100 + "%";
      };
      b.onpointerup = () => {
        d = null;
        aid = o.id;
        patch(o.id, { x: +o.x.toFixed(3), y: +o.y.toFixed(3) });
        render();
      };
      b.onpointercancel = () => {
        d = null;
        render();
      };
    }
  }
  const n = (k, l, lo, hi) => num(a, k, l, lo, hi);
  $("#form").innerHTML =
    '<fieldset><legend>展牆與掛點</legend><div class="fields">' +
    field(a, "room", "展廳名稱", null, "text", "required") +
    field(a, "wall", "展牆（0 北、1 西、2 南、3 東）", [0, 1, 2, 3]) +
    n("x", "水平 X（公尺）", -7, 7) +
    n("y", "高度 Y（公尺）", 0, 4.5) +
    n("z", "離牆 Z（公尺）", 0, 3) +
    n("rotate", "旋轉（度）", -180, 180) +
    n("width", "展出寬度（公尺）", 0.05, 11) +
    n("height", "展出高度（公尺）", 0.05, 4.4) +
    '</div><div class="bar">' +
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
  bind($("#form"), a, (k) => {
    if (k === "wall") a.wall = Number(a.wall);
    patch(a.id, { [k]: a[k] });
  });
  $("#form").addEventListener("change", () => {
    setTimeout(() => {
      if (tab === "布展編輯") render();
    }, 0);
  });
  action("align", () => {
    same.forEach((o) => patch(o.id, { y: a.y }));
    render();
  });
  action("distribute", () => {
    let span = wall % 2 ? 14 : 12;
    same
      .sort((l, r) => l.x - r.x)
      .forEach((o, i) =>
        patch(o.id, { x: span * ((i + 0.5) / same.length - 0.5) }),
      );
    render();
  });
  for (let [k, v] of [
    ["warm", [3000, 28, 25]],
    ["day", [6200, 18, 55]],
  ])
    action(k, () => {
      patch(a.id, { kelvin: v[0], power: v[1], angle: v[2] });
      render();
    });
  scene();
}
async function refreshRestored() {
  db = await state();
  sid = db.shows[0]?.id;
  aid = db.arts[0]?.id;
  dirty = false;
  status.textContent = "已還原 · 版本 " + db.rev;
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
render();

document.querySelector("#closePreview").onclick = () =>
  document.querySelector("#preview").close();
document.querySelector("#preview").onclose = () => {
  let f = document.querySelector("#preview iframe");
  f.onload = null;
  f.src = "about:blank";
};
