export const home = "https://jyunhao914.github.io/virtual-gallery/admin/";
const service =
  "https://script.google.com/macros/s/AKfycbyT4AE49CDT2ue2SYGo0ENtEzpx-IQoHI7mFRD3WLNoiUpaL_sLp4rdTHSWixh7BsKQcQ/exec";
export const keys = {
  flow: "virtual-gallery.oauth.flow",
  ticket: "virtual-gallery.oauth.session",
  registration: "virtual-gallery.oauth.registration",
};
export function random() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function broker(op, data = {}) {
  let r;
  try {
    r = await fetch(
      service,
      op
        ? {
            method: "POST",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify({ op, ...data }),
          }
        : {
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
          },
    );
    if (!r.ok) throw Error();
    r = await r.json();
  } catch {
    throw Error("登入服務尚未就緒，請檢查擁有者的 Apps Script 部署授權。");
  }
  if (!r.ok) {
    if (r.expired) sessionStorage.removeItem(keys.ticket);
    throw Error(r.error || "GitHub 登入失敗");
  }
  return r;
}
export async function authorize() {
  const { app } = await broker();
  if (!app.id) {
    location.assign("./register.html");
    return;
  }
  const state = random(),
    verifier = random();
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  sessionStorage.setItem(
    keys.flow,
    JSON.stringify({ state, verifier, layout:new URLSearchParams(location.search).get("layout"), time: Date.now() }),
  );
  const params = new URLSearchParams({
    client_id: app.id,
    redirect_uri: home,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    allow_signup: "false",
  });
  location.assign("https://github.com/login/oauth/authorize?" + params);
}
export async function restore() {
  const query = new URLSearchParams(location.search);
  if (query.has("code") || query.has("error")) {
    history.replaceState(null, "", location.pathname);
    const flow = JSON.parse(sessionStorage.getItem(keys.flow) || "null");
    sessionStorage.removeItem(keys.flow);
    if (
      !flow ||
      flow.state !== query.get("state") ||
      Date.now() - flow.time > 600000
    )
      throw Error("登入請求無法核對，請從此分頁重新登入。");
    if (query.has("error")) throw Error("GitHub 授權已取消。");
    if(flow.layout)history.replaceState(null,"",location.pathname+"?layout="+encodeURIComponent(flow.layout));
    const result = await broker("exchange", {
      code: query.get("code"),
      verifier: flow.verifier,
    });
    sessionStorage.setItem(keys.ticket, result.ticket);
    return result.token;
  }
  const ticket = sessionStorage.getItem(keys.ticket);
  if (ticket) return (await broker("resume", { ticket })).token;
}
