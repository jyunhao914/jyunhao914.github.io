import { broker, random, home, keys } from "./oauth.js";
const $ = (id) => document.getElementById(id),
  form = $("manifest");
function installed(app) {
  form.hidden = true;
  $("install").href =
    "https://github.com/apps/" +
    encodeURIComponent(app.slug) +
    "/installations/new";
  $("install").hidden = false;
  $("message").textContent = "應用程式已建立。請確認安裝範圍後返回後台登入。";
}
async function init() {
  const q = new URLSearchParams(location.search);
  if (q.has("code")) {
    history.replaceState(null, "", location.pathname);
    const expected = sessionStorage.getItem(keys.registration);
    if (!expected || expected !== q.get("state"))
      throw Error("註冊請求無法核對。請重新開啟設定。");
    const { app } = await broker("register", { code: q.get("code") });
    sessionStorage.removeItem(keys.registration);
    installed(app);
    return;
  }
  const { app } = await broker();
  if (app.id) return installed(app);
  const state = random();
  form.action =
    "https://github.com/settings/apps/new?state=" + encodeURIComponent(state);
  form.elements.manifest.value = JSON.stringify({
    name: "jyunhao914-gallery-studio",
    url: home,
    redirect_url: home + "register.html",
    callback_urls: [home],
    hook_attributes: { active: false },
    public: false,
    default_permissions: { contents: "write" },
    default_events: [],
  });
  form.onsubmit = () => sessionStorage.setItem(keys.registration, state);
  $("create").disabled = false;
}
init().catch((e) => ($("message").textContent = e.message));
