import { roomSize } from "../room-size.js?v=desk33";
import { bounds } from "./wall-tools.js?v=hall34";

const taipeiDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" });
const mediaTypes = new Set(["圖片", "動態", "影片", "語音"]);
const sized = work => [work.width, work.height].every(value => Number.isFinite(value) && value > 0);

// Use the same per-exhibition overrides, physical mounts and adaptive room size as the 3D wall.
export function exhibitionCheck(db, show) {
  const issues = [];
  const today = taipeiDate.format(new Date());
  if (show.start && show.end && show.start > show.end) {
    issues.push({ kind: "schedule", field: "end", text: "結束日期早於開始日期，請調整展期。" });
  } else if (show.start && today < show.start) {
    issues.push({ kind: "schedule", field: "start", text: "展期從 " + show.start + " 開始，屆時即可發布。" });
  } else if (show.end && today > show.end) {
    issues.push({ kind: "schedule", field: "end", text: "展期已於 " + show.end + " 結束。" });
  }

  const ids = show.ids || [];
  const arts = new Map(db.arts.map(work => [work.id, work]));
  const rooms = new Map();
  let reviewed = 0;
  if (!ids.length) issues.push({ kind: "members", text: "尚未選擇這次展出的作品。" });
  for (const workId of ids) {
    const original = arts.get(workId);
    if (!original) {
      issues.push({ kind: "members", text: "清單中有作品已不在資料庫，請重新選件。" });
      continue;
    }
    const work = { ...original, ...show.layout?.[workId] };
    if (work.reviewed) reviewed++;
    const title = "〈" + (work.title || "未命名作品") + "〉";
    if (!sized(original)) issues.push({ kind: "art", workId, field: Number.isFinite(original.width) && original.width > 0 ? "height" : "width", text: title + "需要填寫有效的原作寬高。" });
    if (mediaTypes.has(work.type) && !work.src?.trim()) {
      issues.push({ kind: "art", workId, field: "src", text: title + "尚未加入作品媒體。" });
    }
    if (!sized(work) || !Number.isFinite(work.x) || !Number.isFinite(work.y) ||
        !Number.isInteger(work.wall) || work.wall < 0 || work.wall > 3) {
      if (sized(original) || sized(work))
        issues.push({ kind: "position", workId, text: title + "的展示尺寸或掛點座標無效。" });
      continue;
    }
    if (!rooms.has(work.room)) rooms.set(work.room, []);
    rooms.get(work.room).push(work);
  }
  for (const works of rooms.values()) {
    const room = roomSize(works);
    for (const work of works) {
      const box = bounds(work);
      const half = work.wall % 2 ? room.depth : room.width;
      const tolerance = .001;
      const overhang = Math.max(-half - box.left, box.right - half, -box.bottom, box.top - room.height);
      const title = "〈" + work.title + "〉";
      if (overhang > tolerance) {
        issues.push({ kind: "position", workId: work.id,
          text: title + "的裝裱超出展牆約 " + Number((overhang * 100).toFixed(1)) + " 公分。" });
      } else if (!work.reviewed) {
        issues.push({ kind: "review", workId: work.id, text: title + "的掛位尚待確認。" });
      }
    }
  }
  return { works: ids.length, reviewed, issues };
}
