import { roomSize } from "../room-size.js?v=desk33";
import { bounds } from "./wall-tools.js?v=hall34";

// An oversized mount can straddle both limits. Centre it for manual adjustment.
function fit(value, min, max) {
  return min > max ? (min + max) / 2 : Math.max(min, Math.min(value, max));
}

function wallPosition(work, roomWorks) {
  const size = roomSize([work, ...roomWorks]);
  const half = work.wall % 2 ? size.depth : size.width;
  const mount = bounds({ ...work, x: 0, y: 0 });
  const y = fit(work.y, -mount.bottom, size.height - mount.top);
  const x = fit(work.x, -half - mount.left, half - mount.right);
  const occupied = roomWorks.filter(other => (other.wall ?? 0) === work.wall)
    .map(other => bounds({ ...other, x: other.x ?? 0, y: other.y ?? 1.7 }))
    .filter(box => box.top > y + mount.bottom && box.bottom < y + mount.top)
    .sort((a, b) => a.left - b.left);
  if (!occupied.some(box => x + mount.right > box.left && x + mount.left < box.right)) {
    return { x, y };
  }

  let left = -half, nearest, widest = 0, fallback = x;
  function considerGap(right) {
    const width = right - left;
    if (width <= 0) return;
    const min = left - mount.left, max = right - mount.right;
    if (min <= max) {
      // Leave up to ten centimetres of breathing room at either end.
      const gap = Math.min(0.10, (max - min) / 2);
      const candidate = fit(x, min + gap, max - gap);
      if (nearest === undefined || Math.abs(candidate - x) < Math.abs(nearest - x)) nearest = candidate;
    } else if (width > widest) {
      widest = width;
      fallback = fit((min + max) / 2, -half - mount.left, half - mount.right);
    }
  }
  for (const box of occupied) {
    considerGap(Math.min(box.left, half));
    left = Math.max(left, box.right);
    if (left >= half) break;
  }
  considerGap(half);
  return { x: nearest ?? fallback, y };
}

// works contains the current exhibition members with their layout overrides applied.
export function addToExhibition(show, art, works, anchor) {
  if (show.ids.includes(art.id)) return false;
  const layout = show.layout ??= {};
  if (!Object.hasOwn(layout, art.id)) {
    const work = {
      ...art, room: anchor?.room || art.room || "主展廳", wall: anchor?.wall ?? art.wall ?? 0,
      x: art.x ?? 0, y: art.y ?? 1.7
    };
    const roomWorks = works.filter(other => (other.room || "主展廳") === work.room);
    const placement = { room: work.room, wall: work.wall, ...wallPosition(work, roomWorks) };
    if (art.reviewed) placement.reviewed = false;
    const override = Object.fromEntries(Object.entries(placement).filter(([key, value]) => value !== art[key]));
    if (Object.keys(override).length) show.layout = { ...layout, [art.id]: override };
  }
  show.ids.push(art.id);
  return true;
}
