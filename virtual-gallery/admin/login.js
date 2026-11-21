import { login } from "./storage.js";
import { authorize, restore, broker, keys } from "./oauth.js";
const $ = (id) => document.getElementById(id);
async function show(value) {
  await login(value);
  $("key").value = "";
  await import("./studio.js");
  $("login").hidden = true;
  $("logout").hidden = false;
  $("status").textContent = "已連線至私人作品庫";
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
$("account").onclick = () => run(authorize);
$("signin").onclick = () => run(() => show($("key").value.trim()));
$("key").onkeydown = (e) => {
  if (e.key === "Enter") $("signin").click();
};
$("logout").onclick = () =>
  run(async () => {
    const ticket = sessionStorage.getItem(keys.ticket);
    if (ticket) await broker("logout", { ticket });
    sessionStorage.removeItem(keys.ticket);
    location.reload();
  });
run(async () => {
  const token = await restore();
  if (token) await show(token);
});
