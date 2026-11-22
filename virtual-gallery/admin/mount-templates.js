import { mountFields } from "../mount-fields.js?v=mount32";

// Explicit defaults replace any decoration inherited from the destination's library record.
function snapshot(art) {
  const base = {
    mount: art.mount === "掛軸" ? "掛軸" : "畫框",
    frame: "木框", finish: "霧面", mat: .07, frameWidth: .06, depth: .05,
  };
  return Object.fromEntries(mountFields.map(key => [key, art[key] ?? base[key] ?? null]));
}

const recipes = [
  ["油畫", "胡桃木浮框", {profile:"浮框", woodSpecies:"胡桃木", frameWidth:.047, depth:.055, mat:0, surfaceSheen:.22}],
  ["油畫", "古典暖金凹面框", {profile:"內凹框", frame:"金屬框", metalFinish:"黃銅", frameColor:"#ac8852", frameWidth:.085, depth:.052, mat:0, surfaceSheen:.46}],
  ["西畫", "水彩棉紙斜面框", {profile:"斜面框", woodSpecies:"梣木", matMaterial:"棉紙", matColor:"#f1ebde", frameWidth:.026, mat:.082, depth:.031}],
  ["西畫", "素描細黑平框", {profile:"平框", woodSpecies:"白橡木", surfaceCover:"包膜", filmPattern:"素色", frameColor:"#292a28", matColor:"#eae8de", frameWidth:.016, mat:.064, depth:.032, surfaceSheen:.12}],
  ["水墨", "素絹淺木鏡片", {mount:"鏡片", profile:"階梯框", woodSpecies:"白橡木", silkPattern:"素絹", silkColor:"#cec4aa", frameWidth:.032, mat:.064, mirrorEnd:.095, depth:.041, surfaceSheen:.18}],
  ["水墨", "石青三色裱", {mount:"掛軸", scrollStyle:"三色裱", silkPattern:"織錦", silkColor:"#43585c", accentColor:"#cabf9e", thirdColor:"#9c926e", mat:.064, topBorder:.30, bottomBorder:.20, rodDiameter:.042}],
  ["水墨", "山水大鑲手卷", {mount:"手卷", handscrollStyle:"大鑲手卷", headLength:.35, tailLength:.56, mat:.032, silkPattern:"素絹", silkColor:"#99977e", accentColor:"#cbb791", thirdColor:"#eee4ce"}],
  ["水墨", "墨綠布面蝴蝶冊", {mount:"冊頁", albumStyle:"蝴蝶裝", albumCoverColor:"#54625b", albumLeafColor:"#e6ddc9", mat:.026}],
  ["書法", "宣紙懸浮盒框", {profile:"立體盒框", woodSpecies:"胡桃木", matColor:"#b5a690", matMaterial:"亞麻", linerColor:"#51483d", frameWidth:.031, depth:.066, floatLift:.012, mat:.072, glazing:"低反射玻璃"}],
  ["書法", "月白宣和裱", {mount:"掛軸", scrollStyle:"宣和裱", silkPattern:"素絹", silkColor:"#666f69", accentColor:"#c5c1aa", thirdColor:"#876f4e", rodMaterial:"漆軸", mat:.04, topBorder:.33, bottomBorder:.22, rodDiameter:.044}],
];

function recipePicker(apply) {
  const section = document.createElement("div");
  section.className = "mount-recipe-picker";
  const label = document.createElement("label");
  label.textContent = "依作品類型選裝裱";
  const list = document.createElement("select");
  const empty = new Option("選擇搭配", "");
  list.setAttribute("aria-label", "依作品類型選裝裱");
  list.add(empty);
  let group;
  recipes.forEach(([medium, title], index) => {
    if (group?.label !== medium) {
      group = document.createElement("optgroup");
      group.label = medium;
      list.append(group);
    }
    group.append(new Option(title, String(index)));
  });
  label.append(list);
  const load = document.createElement("button");
  load.type = "button";
  load.textContent = "套用搭配";
  load.disabled = true;
  list.onchange = () => { load.disabled = !list.value; };
  load.onclick = () => {
    if (list.value) apply(snapshot(recipes[Number(list.value)][2]));
  };
  const reference = document.createElement("a");
  reference.href = "https://ws.tfri.gov.tw/001/Upload/OldFile/files/116%E5%B0%88%E8%A8%8A_%E6%9E%97%E6%A5%AD%E8%AB%96%E5%A3%8708.pdf";
  reference.target = "_blank";
  reference.rel = "noopener noreferrer";
  reference.textContent = "傳統裝裱圖解（林業試驗所 PDF）";
  const source = document.createElement("small");
  const classification = document.createElement("a");
  classification.href = "https://kmweb.moa.gov.tw/subject/subject.php?id=47169";
  classification.target = "_blank";
  classification.rel = "noopener noreferrer";
  classification.textContent = "農業部裝裱分類";
  source.append(classification, " · ", reference);
  section.append(label, load, source);
  return section;
}

export function mountTemplates(host, artwork, apply, db, changed) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "我的常用裝裱";
  const stored = db.mountStyles ?? [];
  const label = document.createElement("label");
  label.textContent = "私人樣式名稱";
  const name = document.createElement("input");
  name.type = "text";
  name.maxLength = 60;
  label.append(name);
  const save = button("儲存目前裝裱");
  const choose = document.createElement("label");
  choose.textContent = "已儲存的樣式";
  const list = document.createElement("select");
  list.setAttribute("aria-label", "已儲存的樣式");
  choose.append(list);
  const use = button("套用到這件作品");
  const remove = button("刪除樣式");
  const actions = document.createElement("div");
  actions.className = "bar";
  actions.append(use, remove);
  const status = document.createElement("small");
  status.setAttribute("role", "status");
  const form = document.createElement("div");
  form.append(label, save, choose, actions, status);
  details.append(summary, form);
  host.replaceChildren(recipePicker(apply), details);

  function button(text) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = text;
    return el;
  }
  function refresh(selected) {
    list.replaceChildren(...stored.map(s => new Option(s.name, s.id)));
    if (selected) list.value = selected;
    if (!stored.length) list.add(new Option("尚無私人樣式", ""));
    list.disabled = use.disabled = remove.disabled = !stored.length;
  }
  save.onclick = () => {
    const title = name.value.trim();
    if (!title) {
      status.textContent = "請輸入樣式名稱。";
      name.focus();
      return;
    }
    let style = stored.find(s => s.name === title);
    if (style && !confirm("更新「" + title + "」的裝裱設定？")) return;
    if (!style) {
      style = { id: crypto.randomUUID(), name: title };
      stored.push(style);
    }
    style.settings = snapshot(typeof artwork === "function" ? artwork() : artwork);
    db.mountStyles = stored;
    changed();
    refresh(style.id);
    name.value = "";
    status.textContent = "已加入常用裝裱。";
  };
  use.onclick = () => {
    const style = stored.find(s => s.id === list.value);
    if (!style) return;
    apply(snapshot(style.settings));
    status.textContent = "已套用「" + style.name + "」。";
  };
  remove.onclick = () => {
    const index = stored.findIndex(s => s.id === list.value);
    if (index < 0 || !confirm("刪除常用樣式「" + stored[index].name + "」？")) return;
    stored.splice(index, 1);
    changed();
    refresh();
    status.textContent = "已刪除常用樣式。";
  };
  refresh();
}
