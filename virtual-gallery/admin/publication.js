// JSON field order is immaterial. The order of works and playlist entries is public.
export function samePublication(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && samePublication(left[key], right[key]));
}

// GitHub identifies a Git blob by the hash of its exact byte representation.
// This lets us reuse a verified Pages download for the repository copy as well.
async function blobId(bytes) {
  const prefix = new TextEncoder().encode("blob " + bytes.byteLength + "\0");
  const input = new Uint8Array(prefix.length + bytes.byteLength);
  input.set(prefix);
  input.set(bytes, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function requireCatalogue(data) {
  if (!Array.isArray(data) || !data.every(show => typeof show?.id === "string" && Array.isArray(show.works))) {
    throw Error("公開展覽清單格式異常，請稍後重新核對。");
  }
  return data;
}

export async function readPages(previous, signal) {
  const url = new URL("../exhibitions.json", import.meta.url);
  url.searchParams.set("verify", String(Date.now()));
  const response = await fetch(url, {
    cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal,
    headers: previous?.etag ? { "If-None-Match": previous.etag } : {},
  });
  if (response.status === 304 && previous) return previous;
  if (!response.ok) throw Error("正式站讀取失敗（HTTP " + response.status + "）。");
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Without a supported digest the source and live projections can still be compared directly.
  const sha = await blobId(bytes).catch(() => null);
  const data = sha && sha === previous?.sha ? previous.data :
    requireCatalogue(JSON.parse(new TextDecoder().decode(bytes)));
  return { data, sha, etag: response.headers.get("ETag") };
}

export function describePublication(projected, show, snapshot, today) {
  const { source, live, checkedAt } = snapshot;
  const hasSource = Boolean(source), hasLive = Boolean(live);
  const draftChanged = hasSource && !samePublication(projected, source);
  let state;
  if (!hasSource) {
    state = hasLive ? "withdrawing" : show.status === "歷史典藏" ? "archived" : "draft";
  } else if (!samePublication(source, live)) {
    state = "deploying";
  } else {
    state = draftChanged ? "changed" : "live";
  }
  let scheduled = null;
  if (live?.start && live.start > today) scheduled = "future";
  if (live?.end && live.end < today) scheduled = "ended";
  return { state, hasSource, hasLive, draftChanged, scheduled, checkedAt };
}

export function listChanges(projected, live) {
  const previous = live?.works ?? [];
  const old = new Map(previous.map(work => [work.id, work]));
  const next = new Set(projected.works.map(work => work.id));
  const changes = [];
  function describeWorks(label, works) {
    if (!works.length) return;
    const titles = works.slice(0, 3).map(work => "《" + work.title + "》").join("、");
    changes.push(label + " " + works.length + " 件　" + titles + (works.length > 3 ? " 等" : ""));
  }
  describeWorks("新增", projected.works.filter(work => !old.has(work.id)));
  if (!live) return changes;
  describeWorks("移除", previous.filter(work => !next.has(work.id)));
  const retained = projected.works.filter(work => old.has(work.id));
  describeWorks("調整", retained.filter(work => !samePublication(work, old.get(work.id))));
  const oldOrder = previous.filter(work => next.has(work.id));
  if (retained.some((work, i) => work.id !== oldOrder[i]?.id)) changes.push("作品順序已調整");

  const metadata = [];
  if (live.title !== projected.title) metadata.push("展覽名稱");
  if (live.description !== projected.description) metadata.push("策展說明");
  if (live.start !== projected.start || live.end !== projected.end) metadata.push("展期");
  if (!samePublication(live.playlist, projected.playlist) || live.volume !== projected.volume || live.fade !== projected.fade) {
    metadata.push("背景音樂設定");
  }
  if (metadata.length) changes.push("更新" + metadata.join("、"));
  return changes;
}
