import { mountChoices } from "../mount-fields.js?v=desk33";
import { mountSpec, frameProfiles, scrollBands, handscrollBands, albumPanels, mirrorBands } from "../mount-spec.js?v=desk33";

const framePalettes = [
  ["胡桃與暖白", { frameColor: "#624532", matColor: "#f3ebd9" }],
  ["墨黑與象牙", { frameColor: "#292c2b", matColor: "#f0efe4" }],
  ["香檳與石灰", { frameColor: "#b7a17c", matColor: "#d7d6ca" }],
  ["煙灰與靛青", { frameColor: "#797d76", matColor: "#404d57" }],
];
const scrollPalettes = [
  ["月白石青", { silkColor: "#c8d1c9", accentColor: "#465d62", thirdColor: "#efe9d4", rodColor: "#493c32" }],
  ["茶褐米金", { silkColor: "#b6a285", accentColor: "#d9c8a3", thirdColor: "#796043", rodColor: "#523c2c" }],
  ["黛藍銀灰", { silkColor: "#465765", accentColor: "#b9bcb1", thirdColor: "#d4c291", rodColor: "#303331" }],
  ["藕灰棗紅", { silkColor: "#b8a7a2", accentColor: "#744742", thirdColor: "#e2c8b0", rodColor: "#453830" }],
];

const albumPalettes = [
  ["月白墨藍", {albumLeafColor:"#ede8d7", albumCoverColor:"#384b5b"}],
  ["象牙赭石", {albumLeafColor:"#f1eadb", albumCoverColor:"#955f44"}],
  ["米紙靛青", {albumLeafColor:"#e2ceb0", albumCoverColor:"#434c61"}],
  ["茶箋松綠", {albumLeafColor:"#d9c5a6", albumCoverColor:"#525e52"}],
];
const mirrorPalettes = [
  ["胡桃與月白絹", {frameColor:"#624532", silkColor:"#c8d1c9"}],
  ["墨框與灰絹", {frameColor:"#292c2b", silkColor:"#b8b9ae"}],
  ["暖金與黛青", {frameColor:"#b7a17c", silkColor:"#63716e"}],
  ["淺木與米絹", {frameColor:"#b49065", silkColor:"#d7c69e"}],
];
function elem(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

const openSections = new Set();

export function mountEditor(host, art, save, addTemplates) {
  const title = host.querySelector("legend");
  host.onkeydown = e => {
    if (e.code === "Space" && e.target.closest("button,summary")) e.stopPropagation();
  };
  let swatches, paletteList;
  const sizeReadout=elem("div",undefined,"mount-size-readout");
  sizeReadout.setAttribute("role","status");
  sizeReadout.setAttribute("aria-label","裝裱尺寸，寬乘高");
  const imageSize=elem("span"), outerSize=elem("span");
  sizeReadout.append(imageSize,outerSize);
  const cmFormat=new Intl.NumberFormat("zh-Hant",{maximumFractionDigits:2,useGrouping:false});
  const sizeText=(width,height)=>cmFormat.format(width*100)+" × "+cmFormat.format(height*100)+" 公分";
  // Truncate the physical ceiling to the same hundredth of a centimetre shown on screen.
  const availableLiftCm = spec => Math.floor((spec.maxLift + Number.EPSILON) * 10000) / 100;
  // Update the controls in place, including controls whose defaults depend on other fields.
  function refresh() {
    const spec = mountSpec(art);
    const imageText="畫心 "+sizeText(spec.w,spec.h), outerText="裝裱完成 "+sizeText(spec.width,spec.height);
    if(imageSize.textContent!==imageText)imageSize.textContent=imageText;
    if(outerSize.textContent!==outerText)outerSize.textContent=outerText;
    const isScroll=spec.isScroll, isHand=spec.isHandscroll, textile=isScroll || isHand;
    const album=spec.isAlbum, mirror=spec.isMirror, board=spec.isBoard, frameMount=!textile && !album && !board;
    const isFramed = frameMount && art.frame !== "無框";
    const visibility = {
      scroll:isScroll, hand:isHand, textile, album, mirror, silk:textile || mirror, board,
      acrylic:spec.isAcrylic, trim:!board, finishable:isFramed || board,
      picture:frameMount, framed:isFramed, card:frameMount && !mirror, materials:!album,
      paperColor:isHand || frameMount && !mirror,
      wood: isFramed && art.frame !== "金屬框", metal: isFramed && art.frame === "金屬框",
      box: isFramed && spec.profile === "立體盒框",
      film: isFramed && spec.surfaceCover === "包膜",
      accent: isHand || isScroll && spec.scrollStyle !== "一色裱",
      third: isHand || isScroll && ["三色裱", "宣和裱"].includes(spec.scrollStyle),
    };
    for (const group of host.querySelectorAll("[data-mount-when]"))
      group.hidden = !visibility[group.dataset.mountWhen];
    host.querySelector('[data-mount-field="mat"]').parentElement.firstChild.textContent =
      (album ? "頁面留邊" : isHand || mirror && art.width>art.height ? "上下裱邊寬" :
        isScroll || mirror ? "左右裱邊寬" : "卡紙寬") + "（公分）";
    host.querySelector('[data-mount-field="mirrorEnd"]').parentElement.firstChild.textContent =
      (art.width>art.height ? "左右耳寬" : "上下天地寬") + "（公分）";
    host.querySelector('[data-mount-field="matColor"]').parentElement.firstChild.textContent =
      isHand ? "引首與拖尾紙色" : visibility.box ? "背板色" : "卡紙色";
    host.querySelector('[data-mount-field="matMaterial"]').parentElement.firstChild.textContent =
      visibility.box ? "背板材質" : "卡紙材質";
    host.querySelector('[data-mount-field="floatLift"]').max = availableLiftCm(spec);
    host.querySelector('[data-mount-field="thirdColor"]').parentElement.firstChild.textContent =
      isHand ? "隔水細邊色" : spec.scrollStyle === "宣和裱" ? "仿古細邊色" : "副隔水色";
    if(board) {
      const backing=spec.boardThickness, cover=spec.isAcrylic ? spec.acrylicThickness : 0, gap=spec.wallStandoff;
      const profile=host.querySelector("#mount-board-section");
      const mm=value=>cmFormat.format(1000*value);
      profile.querySelector("[data-board-gap]").style.flexGrow=gap*1000;
      const core=profile.querySelector("[data-board-backing]");
      core.style.flexGrow=backing*1000;core.style.backgroundColor=spec.boardEdgeColor;
      core.dataset.boardBacking=spec.boardMaterial;
      const face=profile.querySelector("[data-board-cover]");
      face.style.flexGrow=cover*1000;face.hidden=!cover;
      profile.querySelector("figcaption").textContent=(gap ? "離牆 "+mm(gap)+" mm" : "貼牆")+
        " · 背板 "+mm(backing)+" mm"+(cover ? " · 壓克力 "+mm(cover)+" mm" : "")+
        "　總厚 "+mm(backing+cover)+" mm";
    }
    for (const button of host.querySelectorAll("[data-mount-sample]")) {
      button.setAttribute("aria-pressed", String(spec[button.dataset.sampleKey] === button.dataset.mountSample));
    }
    for (const input of host.querySelectorAll("[data-mount-field]")) {
      const key = input.dataset.mountField;
      let value = spec[key] ?? art[key];
      if (key === "mount") value = board ? art.mount : album ? "冊頁" : mirror ? "鏡片" : isHand ? "手卷" : isScroll ? "掛軸" : "畫框";
      if (key === "frame") value = art.frame || "木框";
      if (key === "finish") value = art.finish || "霧面";
      const factor=Number(input.dataset.factor) || (key==="surfaceSheen" ? 100 : 1);
      if(factor!==1)value=+(value*factor).toFixed(2);
      // Keep a partially entered decimal usable on touch keyboards.
      if (document.activeElement !== input || input.type !== "number") input.value = value;
      if (key === "surfaceSheen") host.querySelector("output").textContent = value + "%";
    }
    const materialLabel = board ? spec.boardMaterial : textile || mirror ? spec.silkPattern : [
      art.frame === "金屬框" ? spec.metalFinish : isFramed ? spec.woodSpecies : spec.matMaterial,
      spec.surfaceCover === "包膜" && isFramed ? spec.filmPattern + "包膜" : "",
    ].filter(Boolean).join(" · ");
    materialValue.textContent = materialLabel;
    const spanLabel = textile || album || mirror ? "留邊" : isFramed ? "框寬" : "卡紙";
    const spanCm = cmFormat.format(100 * (isFramed && !mirror ? spec.frameWidth : spec.mat));
    sizeValue.textContent = spanLabel + " " + spanCm + " 公分";
    const palettes = album ? albumPalettes : mirror ? mirrorPalettes : textile ? scrollPalettes : framePalettes;
    const match = palettes.find(([, colors]) => Object.entries(colors).every(([key, value]) => spec[key].toLowerCase() === value));
    colorValue.textContent = match ? match[0] : "目前用色";
    const chips = album ? [spec.albumCoverColor, spec.albumLeafColor] : textile ?
      [spec.silkColor, spec.accentColor, spec.rodColor] : mirror ? [spec.frameColor,spec.silkColor] : [spec.frameColor,spec.matColor];
    for (const [index, chip] of [...currentChips.children].entries()) {
      chip.hidden = !chips[index];
      if (chips[index]) chip.style.backgroundColor = chips[index];
    }
    if (paletteList !== palettes) {
      paletteList = palettes;
      swatches.replaceChildren(...palettes.map(([name, colors]) => {
        const b = elem("button", undefined, "mount-palette");
        b.type = "button";
        b.dataset.mountPalette = name;
        const chips = elem("span", undefined, "mount-chips");
        chips.setAttribute("aria-hidden", "true");
        for (const color of Object.values(colors)) {
          const chip = elem("i");
          chip.style.backgroundColor = color;
          chips.append(chip);
        }
        b.append(chips, name);
        b.onclick = () => apply(colors);
        return b;
      }));
    }
    palettes.forEach(([,colors], i) => swatches.children[i].setAttribute(
      "aria-pressed", Object.entries(colors).every(([key, value]) => spec[key].toLowerCase() === value)
    ));
  }
  function apply(patch) {
    const delta = {...patch};
    if (delta.profile === "立體盒框" && art.profile !== delta.profile && !("depth" in delta) && art.floatLift == null) {
      delta.depth = Math.max(.06, mountSpec(art).depth);
      delta.floatLift = .01;
    }
    const next = mountSpec({...art,...delta});
    if (next.isBox) {
      const lift = Math.min(next.floatLift, availableLiftCm(next) / 100);
      if (lift !== (delta.floatLift ?? art.floatLift)) delta.floatLift = lift;
    }
    Object.assign(art, delta);
    save(delta);
    refresh();
  }
  function section(title, when) {
    const group = elem(title ? "details" : "div", undefined, "mount-section");
    if (when) group.dataset.mountWhen = when;
    if (title) {
      group.append(elem("summary", title));
      group.open = openSections.has(title);
      group.addEventListener("toggle", () => {
        if (!group.isConnected) return;
        if (group.open) openSections.add(title);
        else openSections.delete(title);
      });
    }
    const grid = elem("div", undefined, "mount-grid");
    group.append(grid);
    host.append(group);
    return grid;
  }
  function shapeSamples(key, caption, when) {
    const grid = section("比較" + caption, when);
    grid.className = "mount-samples";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", caption);
    for (const name of mountChoices[key]) {
      const button = elem("button");
      button.type = "button";
      button.dataset.mountSample = name;
      button.dataset.sampleKey = key;
      button.onclick = () => apply({ [key]:name });
      const sample = elem("span", undefined, "mount-example");
      sample.setAttribute("aria-hidden", "true");
      if (key === "profile") {
        const slice = elem("i", undefined, "frame-slice");
        const points = frameProfiles[name].map(([u,v]) => 100*u + "% " + (100-100*v) + "%");
        slice.style.clipPath = "polygon(" + points.join(",") + ")";
        if (name === "立體盒框") {
          sample.classList.add("box-example");
          const backing=elem("i", undefined, "box-example-backing");
          sample.append(backing);
        }
        sample.append(slice);
      } else if (key === "albumStyle") {
        const example={mount:"冊頁", albumStyle:name, width:.29, height:.30, mat:.045,
          albumLeafColor:"#e6dcc4",albumCoverColor:"#515f58"};
        const spec=mountSpec(example);
        const scale=Math.min(62/spec.width,54/spec.height);
        const canvas=elem("i",undefined,"album-sample");
        canvas.style.width=example.width*scale+"px";
        canvas.style.height=example.height*scale+"px";
        canvas.style.left="calc(50% - "+(spec.right+spec.left)*scale/2+"px)";
        canvas.style.top="calc(50% + "+(spec.top+spec.bottom)*scale/2+"px)";
        canvas.append(elem("i",undefined,"paper-sample"));
        paintWallMount(canvas,example);
        sample.append(canvas);
      } else {
        const hand=key === "handscrollStyle";
        const canvas = elem("i", undefined, hand ? "handscroll-sample" : "scroll-sample");
        canvas.append(elem("i", undefined, "paper-sample"));
        paintWallMount(canvas, {
          width:hand ? 1.2 : .48, height:hand ? .36 : .78, mat:hand ? .085 : .12,
          topBorder:.44, bottomBorder:.25, headLength:.48, tailLength:.34, rodDiameter:.055,
          mount:hand ? "手卷" : "掛軸", [key]:name, silkColor:"#aeb8ac", accentColor:"#506567", thirdColor:"#c19668"
        });
        sample.append(canvas);
      }
      button.append(sample, name);
      grid.append(button);
    }
  }
  function control(parent, key, label, opts, when) {
    const wrap = elem("label", label);
    if (when) wrap.dataset.mountWhen = when;
    const input = elem(opts.choices ? "select" : "input");
    input.dataset.mountField = key;
    if (opts.choices) {
      const aliases = key === "handscrollStyle" ? {"大鑲手卷":"大鑲手卷（翻邊）","套邊手卷":"套邊手卷（包邊）"} : {};
      input.append(...opts.choices.map(value => new Option(aliases[value] ?? value, value)));
    }
    else {
      input.type = opts.type;
      if (opts.type === "number" || opts.type === "range") {
        input.min = opts.min;
        input.max = opts.max;
        input.step = opts.type === "number" ? "any" : "1";
        if (opts.type === "number") {
          input.dataset.factor = String(opts.factor || 100);
          input.inputMode = "decimal";
          input.required = true;
        }
      }
    }
    if (key === "surfaceSheen") wrap.append(elem("output"));
    if (input.type === "color") wrap.className = "mount-color";
    wrap.append(input);
    parent.append(wrap);
    const update = () => {
      if (!input.value || !input.validity.valid) return;
      let value = input.value;
      if (input.dataset.factor || key==="surfaceSheen") value=Number(value)/Number(input.dataset.factor || 100);
      if (art[key] === value) return;
      const delta = { [key]: value };
      if (key === "frame" && art.frame === "無框" && value !== "無框" && !(art.frameWidth > 0))
        delta.frameWidth = .04;
      if (key === "finish") delta.surfaceSheen = null;
      if (key === "mount" && ["畫框","鏡片"].includes(value) && art.frame === "無框" && !art.profile) {
        delta.frame = "木框";
        if (!(art.frameWidth > 0)) delta.frameWidth = .04;
      }
      apply(delta);
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    if (input.type === "number") input.onblur = () => {
      const value = mountSpec(art)[key];
      input.value = +(value * Number(input.dataset.factor)).toFixed(2);
    };
    return input;
  }
  const select = (parent, key, label, choices, when) => control(parent, key, label, {choices}, when);
  const cm = (parent, key, label, min, max, when) =>
    control(parent, key, label + "（公分）", {type:"number", min, max}, when);
  const color = (parent, key, label, when) => control(parent, key, label, {type:"color"}, when);
  host.replaceChildren(title,sizeReadout);
  const form = section();
  select(form, "mount", "裝裱方式", ["畫框", "掛軸", "手卷", "冊頁", "鏡片", "無框板裱", "壓克力面裱"]);
  const plain=elem("button","無框・只加厚度");
  plain.type="button";plain.dataset.mountQuick="thickness";
  plain.onclick=()=>apply({mount:"無框板裱",frame:"無框",frameWidth:0,mat:0,profile:null,
    boardMaterial:mountSpec(art).boardMaterial,boardThickness:art.boardThickness || .01,wallStandoff:0});
  form.append(plain);
  select(form, "frame", "框材", ["木框", "金屬框", "無框"], "picture");
  select(form, "profile", "框型", mountChoices.profile, "framed");
  select(form, "scrollStyle", "掛軸形式", mountChoices.scrollStyle, "scroll");
  select(form, "handscrollStyle", "手卷形式", mountChoices.handscrollStyle, "hand");
  select(form, "albumStyle", "冊頁裝式", mountChoices.albumStyle, "album");
  const boards=section(undefined,"board");
  const mm=(key,label,min,max,when)=>control(boards,key,label+"（mm）",{type:"number",min,max,factor:1000},when);
  mm("boardThickness","背板厚度",1,50);
  color(boards,"boardEdgeColor","側邊顏色");
  select(boards,"boardMaterial","背板材質",mountChoices.boardMaterial);
  mm("wallStandoff","離牆距離",0,120);
  mm("acrylicThickness","壓克力厚度",1,30,"acrylic");
  const resetEdge=elem("button","使用板材原色");
  resetEdge.type="button";resetEdge.onclick=()=>apply({boardEdgeColor:""});
  boards.append(resetEdge);
  const crossSection=elem("figure");
  crossSection.id="mount-board-section";
  const caption=elem("figcaption"), sectionBar=elem("div",undefined,"mount-board-cross-section");
  sectionBar.setAttribute("aria-hidden","true");
  for(const key of ["boardGap","boardBacking","boardCover"]) {
    const segment=elem("i");segment.dataset[key]="";sectionBar.append(segment);
  }
  crossSection.append(elem("strong","側面剖面　牆 → 作品正面"),sectionBar,caption);
  boards.after(crossSection);
  shapeSamples("profile", "框條剖面", "framed");
  shapeSamples("scrollStyle", "裱式小樣", "scroll");
  shapeSamples("handscrollStyle", "手卷小樣", "hand");
  shapeSamples("albumStyle", "冊頁單開小樣", "album");
  function recap(grid) {
    const value = elem("small", undefined, "mount-recap");
    grid.parentElement.querySelector("summary").append(value);
    return value;
  }
  const material = section("材質與表面", "materials");
  const materialValue = recap(material);
  select(material, "woodSpecies", "木種", mountChoices.woodSpecies, "wood");
  select(material, "metalFinish", "金屬", mountChoices.metalFinish, "metal");
  select(material, "matMaterial", "卡紙材質", mountChoices.matMaterial, "card");
  select(material, "glazing", "罩面", mountChoices.glazing, "box");
  select(material, "surfaceCover", "框面處理", mountChoices.surfaceCover, "framed");
  select(material, "filmPattern", "包膜紋理", mountChoices.filmPattern, "film");
  select(material, "silkPattern", "裱料", mountChoices.silkPattern, "silk");
  select(material, "rodMaterial", "軸頭材質", mountChoices.rodMaterial, "textile");
  select(material, "finish", "表面光澤", ["霧面", "亮面"], "framed");
  control(material, "surfaceSheen", "光澤微調", {type:"range", min:0, max:100}, "finishable");

  const colors = section("配色","trim");
  const colorValue = recap(colors);
  const currentChips = elem("span", undefined, "mount-chips mount-current-chips");
  currentChips.setAttribute("aria-hidden","true");
  currentChips.append(elem("i"),elem("i"),elem("i"));
  colorValue.after(currentChips);
  swatches = elem("div", undefined, "mount-palettes");
  colors.before(swatches);
  color(colors, "frameColor", "框色", "framed");
  color(colors, "matColor", "卡紙色", "paperColor");
  color(colors, "linerColor", "內襯色", "box");
  color(colors, "silkColor", "裱料主色", "silk");
  color(colors, "albumLeafColor", "頁紙色", "album");
  color(colors, "albumCoverColor", "封面色", "album");
  color(colors, "accentColor", "副裱色", "accent");
  color(colors, "thirdColor", "副隔水色", "third");
  color(colors, "rodColor", "軸頭色", "textile");
  const restore = elem("button", "恢復原材色", "mount-restore");
  restore.type = "button";
  restore.onclick = () => {
    const palette=art.mount==="掛軸" || art.mount==="手卷"
      ? {silkColor:"", accentColor:"", thirdColor:"", rodColor:""} : {frameColor:"", matColor:"", linerColor:""};
    if(art.mount==="冊頁")return apply({albumLeafColor:"",albumCoverColor:""});
    if(art.mount==="手卷")palette.matColor="";
    if(art.mount==="鏡片")palette.silkColor="";
    apply(palette);
  };
  colors.after(restore);

  const specs = section("實際規格","trim");
  const sizeValue = recap(specs);
  cm(specs, "frameWidth", "框寬", 0, 50, "framed");
  cm(specs, "depth", "框深", 1, 50, "framed");
  cm(specs, "floatLift", "畫心墊高", 0, 20, "box");
  // A single mat field stores the side margin of either mount.
  cm(specs, "mat", "卡紙／裱邊寬", 0, 50);
  cm(specs, "mirrorEnd", "上下天地寬", 0, 50, "mirror");
  cm(specs, "topBorder", "天頭高度", 0, 200, "scroll");
  cm(specs, "bottomBorder", "地頭高度", 0, 200, "scroll");
  cm(specs, "rodDiameter", "地軸直徑", 1, 20, "scroll");
  cm(specs, "headLength", "引首長", 0, 300, "hand");
  cm(specs, "tailLength", "拖尾長", 0, 300, "hand");
  const proportion=elem("button", "依天頭配地頭（3:2）", "mount-ratio");
  proportion.type="button";
  proportion.dataset.mountWhen="scroll";
  proportion.onclick=()=>apply({bottomBorder:+(mountSpec(art).topBorder * 2 / 3).toFixed(4)});
  specs.after(proportion);
  const templates = elem("div", undefined, "mount-section");
  host.append(templates);
  addTemplates(templates, apply);
  const recipes=templates.querySelector(".mount-recipe-picker");
  if (recipes) {
    form.parentElement.before(recipes);
    const source = recipes.querySelector("small");
    if (source) {
      const references = elem("details", undefined, "mount-section mount-reference");
      references.append(elem("summary", "裝裱參考資料"), source);
      host.append(references);
    }
  }
  refresh();
}

// The plan uses the same physical dimensions as the 3D mount. Layers are
// positioned relative to the artwork so its size and hanging point stay fixed.
export function paintWallMount(button, art) {
  const spec = mountSpec(art);
  button.querySelector(".plan-mount")?.remove();
  const layers = elem("div", undefined, "plan-mount");
  layers.setAttribute("aria-hidden", "true");
  const layer = (left, right, top, bottom, color) => {
    const el = elem("i");
    el.style.left = -100 * left / art.width + "%";
    el.style.right = -100 * right / art.width + "%";
    el.style.top = -100 * top / art.height + "%";
    el.style.bottom = -100 * bottom / art.height + "%";
    el.style.backgroundColor = color;
    layers.append(el);
  };
  const m = spec.mat;
  const cut=(color,x,y,w,h)=>{
    const dx=(w-art.width)/2, dy=(h-art.height)/2;
    layer(dx-x, dx+x, dy+y, dy-y, color);
  };
  if (spec.isBoard) {
    layers.dataset.boardMount=art.mount;
    layer(0,0,0,0,spec.boardEdgeColor);
    if(spec.wallStandoff) {
      const offset=Math.min(4,spec.wallStandoff*100);
      layers.style.boxShadow=offset*.45+"px "+offset+"px "+(1+offset)+"px #192c3545";
    }
  } else if (spec.isAlbum) {
    albumPanels(spec,cut);
  } else if (spec.isMirror) {
    const f=spec.frameWidth;
    layer(spec.borderX+f,spec.borderX+f,spec.borderY+f,spec.borderY+f,spec.frameColor);
    layer(spec.borderX,spec.borderX,spec.borderY,spec.borderY,spec.silkColor);
    mirrorBands(spec,cut);
  } else if (spec.isHandscroll) {
    const base=spec.rects[0];
    cut(spec.handscrollStyle === "大鑲手卷" ? spec.silkColor : spec.matColor,base.x,base.y,base.w,base.h);
    handscrollBands(spec,cut);
    const [,core,cover]=spec.rects;
    cut(spec.rodColor,core.x,core.y,core.w,core.h);
    cut(spec.accentColor,cover.x,cover.y,cover.w,cover.h);
  } else if (spec.isScroll) {
    layer(m, m, spec.topBorder, spec.bottomBorder, spec.silkColor);
    scrollBands(spec,cut);
    const cap = spec.battenHeight / 2;
    layer(m, m, spec.topBorder + cap, -art.height - spec.topBorder + cap, spec.rodColor);
    const rod = spec.rodDiameter;
    const rollerTop = -art.height - spec.bottomBorder + rod / 2, rollerBottom = spec.bottomBorder + rod / 2;
    layer(m + spec.finialLength, m + spec.finialLength, rollerTop, rollerBottom, spec.rodColor);
    layer(m, m, rollerTop, rollerBottom, spec.silkColor);
  } else {
    const f = art.frame === "無框" ? 0 : spec.frameWidth;
    layer(m+f, m+f, m+f, m+f, spec.frameColor);
    layer(m, m, m, m, spec.matColor);
  }
  button.prepend(layers);
}
