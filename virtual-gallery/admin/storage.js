import { mountFields, validateMount } from "../mount-fields.js?v=mount31";

const owner = "jyunhao914",
  privateRepo = "virtual-gallery-private",
  publicRepo = "jyunhao914.github.io";
const privatePath = "studio.json",
  publicPath = "virtual-gallery/exhibitions.json";
let tokenProvider, credential = "",
  stateSha = "",
  loadedRevision;
const endpoint = (repo, path = "") => "/repos/" + owner + "/" + repo + path;
async function api(
  path,
  { method = "GET", body, accept = "application/vnd.github+json" } = {},
) {
  if(tokenProvider) credential=await tokenProvider();
  if (!credential) throw Error("請先登入 GitHub。");
  let response = await fetch("https://api.github.com" + path, {
    method,
    redirect: "error",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: {
      Authorization: "Bearer " + credential,
      Accept: accept,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let msg = {
      401: "憑證無效或已到期。",
      403: "權限不足或已達 GitHub 速率限制。請確認兩個儲存庫的 Contents 讀寫權限。",
      404: "無法存取指定儲存庫，請檢查憑證所選的兩個儲存庫。",
      409: "其他裝置已更新資料。請備份當前變更後重新登入。",
      422: "GitHub 拒絕此次變更，請檢查檔案大小及分支規則。",
    };
    throw Error(msg[response.status] || "GitHub 回應 " + response.status);
  }
  return response.json();
}
async function guard() {
  let repo = await api(endpoint(privateRepo));
  if (repo.private !== true || !repo.permissions?.push)
    throw Error("草稿庫必須為私人，且登入者須具備寫入權限。");
}
export async function login(value,provider) {
  tokenProvider=provider;
  credential = value;
  try {
    let user = await api("/user");
    if (user.login.toLowerCase() !== owner)
      throw Error("請使用策展帳號 jyunhao914。");
    await guard();
    let pub = await api(endpoint(publicRepo));
    if (!pub.permissions?.push) throw Error("缺少展廳發布權限。");
  } catch (e) {
    credential = "";
    tokenProvider=undefined;
    throw e;
  }
}
const decoder = new TextDecoder(),
  encoder = new TextEncoder();
function decode(value) {
  return JSON.parse(
    decoder.decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0))),
  );
}
function encode(value) {
  let bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > 85_000_000)
    throw Error("資料超過 85 MB，請縮小影音或移除大型檔案。");
  let chunks = [];
  for (let i = 0; i < bytes.length; i += 24576)
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 24576))));
  return chunks.join("");
}
async function file(repo, path, ref = "main") {
  let meta = await api(
    endpoint(repo, "/contents/" + path + "?ref=" + encodeURIComponent(ref)),
    { accept: "application/vnd.github.object+json" },
  );
  let data =
    meta.encoding === "base64"
      ? decode(meta.content)
      : decode((await api(endpoint(repo, "/git/blobs/" + meta.sha))).content);
  return { data, sha: meta.sha };
}
async function write(repo, path, data, sha, message) {
  return (
    await api(endpoint(repo, "/contents/" + path), {
      method: "PUT",
      body: { branch: "main", sha, message, content: encode(data) },
    })
  ).content.sha;
}
export async function state() {
  await guard();
  let result = await file(privateRepo, privatePath);
  validate(result.data);
  stateSha = result.sha;
  loadedRevision = result.data.rev;
  return result.data;
}
function validate(s) {
  if (
    !Number.isSafeInteger(s.rev) ||
    !Array.isArray(s.arts) ||
    !Array.isArray(s.shows)
  )
    throw Error("策展備份格式無效。");
  for (let items of [s.arts, s.shows]) {
    if (
      new Set(items.map((a) => a.id)).size !== items.length ||
      items.some((a) => typeof a.id !== "string" || !a.title?.trim())
    )
      throw Error("展覽與作品需要名稱及唯一識別碼。");
  }
  for (let a of s.arts)
    if (
      typeof a.src !== "string" ||
      !Number.isFinite(a.width) ||
      !Number.isFinite(a.height)
    )
      throw Error("作品媒體或尺寸無效。");
  if (s.mountStyles != null) {
    if (!Array.isArray(s.mountStyles) ||
        s.mountStyles.some(t => !t || typeof t.name !== "string" || !t.name.trim() ||
          typeof t.id !== "string" || !t.settings || typeof t.settings !== "object") ||
        new Set(s.mountStyles.map(t => t.id)).size !== s.mountStyles.length)
      throw Error("私人裝裱樣式格式無效。");
    s.mountStyles.forEach(t => validateMount(t.settings));
  }
  s.arts.forEach(validateMount);
  let ids = new Set(s.arts.map((a) => a.id));
  for (let x of s.shows) {
    if (
      !x.layout ||
      !Array.isArray(x.playlist) ||
      !Array.isArray(x.ids) ||
      x.ids.some((i) => !ids.has(i)) ||
      (x.start && x.end && x.start > x.end)
    )
      throw Error("請檢查展覽作品、播放清單與檔期。");
    Object.values(x.layout).forEach(validateMount);
  }
}
async function save(s) {
  validate(s);
  if (s.rev !== loadedRevision) throw Error("版本已變更，請重新載入。");
  let next = s.rev + 1;
  await guard();
  stateSha = await write(
    privateRepo,
    privatePath,
    { ...s, rev: next },
    stateSha,
    "Save gallery studio revision " + next,
  );
  loadedRevision = next;
  return next;
}
const workFields = [
  ..."id title artist category type description src tiles source voice captions subtitle room wall x y z width height rotate kelvin power angle lx ly lz".split(" "),
  ...mountFields,
];
function pick(obj, keys) {
  return Object.fromEntries(
    keys.filter((k) => Object.hasOwn(obj, k)).map((k) => [k, obj[k]]),
  );
}
export function exhibition(s, x) {
  return {
    ...pick(
      x,
      "id title description start end playlist volume fade".split(" "),
    ),
    works: x.ids.map((id) =>
      pick({ ...s.arts.find((a) => a.id === id), ...x.layout[id] }, workFields),
    ),
  };
}
export async function versions() {
  return (
    await api(
      endpoint(privateRepo, "/commits?sha=main&path=studio.json&per_page=100"),
    )
  ).map((c) => ({
    id: c.sha,
    label:
      c.commit.author.date.replace("T", " ").slice(0, 19) +
      " UTC · " +
      c.sha.slice(0, 7),
  }));
}
export async function post(op, input) {
  let body = structuredClone(input);
  if (op === "save") return save(body);
  if (op === "restore") {
    let old = (await file(privateRepo, privatePath, body.version)).data;
    old.rev = body.rev;
    return save(old);
  }
  let knownSha = stateSha;
  let latest = await file(privateRepo, privatePath);
  if (latest.sha !== knownSha || latest.data.rev !== body.rev)
    throw Error("草稿已由其他裝置更新，請重新登入。");
  let s = latest.data,
    x = s.shows.find((a) => a.id === body.id);
  if (!x || !["publish", "end"].includes(op)) throw Error("找不到展覽。");
  let today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
  }).format(new Date());
  if (
    op === "publish" &&
    (!x.ids.length || (x.start && today < x.start) || (x.end && today > x.end))
  )
    throw Error("請選擇作品並於展期內發布。");
  let previous = await file(publicRepo, publicPath),
    items = previous.data.filter((a) => a.id !== x.id);
  if (op === "publish") items.unshift(exhibition(s, x));
  await write(
    publicRepo,
    publicPath,
    items,
    previous.sha,
    op === "publish"
      ? "Publish curated exhibition"
      : "Archive curated exhibition",
  );
  x.status = op === "publish" ? "已發布" : "歷史典藏";
  try {
    return await save(s);
  } catch (e) {
    throw Error(
      "公開清單已更新，但私人狀態儲存失敗。請重新登入核對。" + e.message,
    );
  }
}
