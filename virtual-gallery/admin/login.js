import { login } from "./storage.js?v=publish69";
import { authorize, restore, signOut, accessToken, deviceSaveFailed, keys } from "./oauth.js?v=publish69";
const $ = (id) => document.getElementById(id);
let studio;
async function show(value,provider) {
  await login(value,provider);
  $("key").value = "";
  studio=await import("./studio.js?v=publish69");
  $("login").hidden = true;
  $("logout").hidden = false;
  $("status").textContent = deviceSaveFailed ? "已登入，瀏覽器未允許記住裝置。" : "已連線至私人作品庫";
}
async function run(fn) {
  $("account").disabled = $("signin").disabled = true;
  try {
    await fn();
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    $("account").disabled = $("signin").disabled = false;
  }
}
$("account").onclick = () => run(()=>authorize($("remember-device").checked));
$("signin").onclick = () => run(() => show($("key").value.trim()));
$("key").onkeydown = (e) => {
  if (e.key === "Enter") $("signin").click();
};
$("logout").onclick = () =>
  run(async () => {
    $("logout").disabled=true;
    document.querySelector("main").inert=true;
    try {
      await studio.saveBeforeLogout();
      try { await signOut(); }
      finally {
        channel?.postMessage("logout");
        location.reload();
      }
    } finally {
      $("logout").disabled=false;
      document.querySelector("main").inert=false;
    }
  });
const channel=typeof BroadcastChannel==="function" ? new BroadcastChannel("virtual-gallery.login") : null;
if(channel)channel.onmessage=event=>{
  if(event.data==="logout") {
    sessionStorage.removeItem(keys.ticket);
    location.reload();
  }
};
run(async () => {
  $("status").textContent="正在確認登入狀態…";
  const token = await restore();
  if (token) await show(token,accessToken);
  else $("status").textContent="尚未登入";
});
