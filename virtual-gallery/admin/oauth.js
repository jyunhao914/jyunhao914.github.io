import {remember,recall,forget} from "./device-session.js?v=session25";
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
    throw Object.assign(Error(r.error || "GitHub 登入失敗"),{expired:r.expired===true});
  }
  return r;
}
export async function authorize(keep=false) {
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
  const entry=new URLSearchParams(location.search);
  sessionStorage.setItem(
    keys.flow,
    JSON.stringify({ state, verifier, keep, layout:entry.get("layout"),work:entry.get("work"), panel:entry.get("panel"), view:entry.get("view"), time: Date.now() }),
  );
  const params = new URLSearchParams({
    client_id: app.id,
    redirect_uri: home,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    allow_signup: "false",
    ...(keep ? {scope:"offline_access"} : {}),
  });
  location.assign("https://github.com/login/oauth/authorize?" + params);
}
let active, pending;
export let deviceSaveFailed=false;
function accept(ticket,result) {
  active={ticket,token:result.token,until:result.accessUntil || result.expire};
  return active.token;
}
async function resume(ticket) {
  try {
    return accept(ticket,await broker("resume",{ticket}));
  } catch(error) {
    if(error.expired) {
      if(sessionStorage.getItem(keys.ticket)===ticket)sessionStorage.removeItem(keys.ticket);
      if(await recall().catch(()=>null)===ticket)await forget();
      active=null;
    }
    throw error;
  }
}
export async function accessToken() {
  if(!active)throw Error("請重新登入 GitHub。");
  if(Date.now()<active.until-30000)return active.token;
  if(!pending)pending=resume(active.ticket).finally(()=>{pending=null});
  return pending;
}
export async function signOut() {
  const ticket=active?.ticket || sessionStorage.getItem(keys.ticket) || await recall().catch(()=>null);
  active=null;
  sessionStorage.removeItem(keys.ticket);
  await forget().catch(()=>{});
  if(ticket)await broker("logout",{ticket});
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
    if(flow.layout) {
      const entry=new URLSearchParams({layout:flow.layout});
      if(flow.work)entry.set("work",flow.work);
      if(["inventory","position","mount","light"].includes(flow.panel))entry.set("panel",flow.panel);
      history.replaceState(null,"",location.pathname+"?"+entry);
    } else if (["library","backup","desk"].includes(flow.view)) {
      history.replaceState(null,"",location.pathname+"?view="+flow.view);
    }
    const result = await broker("exchange", {
      code: query.get("code"),
      verifier: flow.verifier,
      remember:flow.keep===true,
    });
    if(flow.keep) {
      try {
        await remember(result.ticket,result.expire);
        sessionStorage.removeItem(keys.ticket);
      } catch {
        deviceSaveFailed=true;
        sessionStorage.setItem(keys.ticket,result.ticket);
      }
    } else {
      await forget().catch(()=>{});
      sessionStorage.setItem(keys.ticket,result.ticket);
    }
    return accept(result.ticket,result);
  }
  const ticket = sessionStorage.getItem(keys.ticket) || await recall().catch(()=>null);
  if(ticket)return resume(ticket);
}
