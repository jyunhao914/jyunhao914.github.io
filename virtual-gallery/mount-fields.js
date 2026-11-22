// Only these physical mounting properties can be copied between artworks.
export const mountChoices = {
  profile: ["平框", "斜面框", "階梯框", "浮框", "圓弧框", "內凹框", "立體盒框"],
  albumStyle: ["經摺裝", "蝴蝶裝", "推篷裝"],
  handscrollStyle: ["大鑲手卷", "撞邊手卷", "套邊手卷"],
  scrollStyle: ["一色裱", "二色裱", "三色裱", "文人裱", "宣和裱"],
  woodSpecies: ["白橡木", "胡桃木", "梣木", "柚木"],
  metalFinish: ["鋁合金", "黃銅", "不鏽鋼"],
  matMaterial: ["棉紙", "亞麻"],
  silkPattern: ["素絹", "織錦", "細麻"],
  rodMaterial: ["木軸", "銅軸", "漆軸"],
  surfaceCover: ["原材", "包膜"],
  glazing: ["無罩", "透明壓克力", "低反射玻璃"],
  filmPattern: ["素色", "木紋", "髮絲紋", "織紋"],
};
const mountColors = ["frameColor", "matColor", "silkColor", "accentColor", "thirdColor", "linerColor", "albumLeafColor", "albumCoverColor", "rodColor"];
const mountRanges = {
  mirrorEnd: [0, .5],
  headLength: [0, 3], tailLength: [0, 3],
  floatLift: [0, .2],
  topBorder: [0, 2], bottomBorder: [0, 2], rodDiameter: [.01, .2], surfaceSheen: [0, 1],
};
export const mountFields = [
  "mount", "frame", "frameWidth", "mat", "depth", "finish",
  ...Object.keys(mountChoices), ...mountColors, ...Object.keys(mountRanges),
];

export function validateMount(placement) {
  for (const [key, choices] of Object.entries(mountChoices)) {
    if (placement[key] != null && placement[key] !== "" && !choices.includes(placement[key]))
      throw Error("無法辨識裝裱樣式（" + key + "）。");
  }
  for (const key of mountColors) {
    const color = placement[key];
    if (color != null && color !== "" && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)))
      throw Error("裝裱色碼格式無效（" + key + "）。");
  }
  for (const [key, [min, max]] of Object.entries(mountRanges)) {
    const value = placement[key];
    if (value != null && value !== "" && (!Number.isFinite(value) || value < min || value > max))
      throw Error("裝裱規格超出範圍（" + key + "）。");
  }
}
