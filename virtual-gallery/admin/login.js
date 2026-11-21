import { login } from "./storage.js";
const $ = (id) => document.getElementById(id);
async function enter() {
  if (!$("key").value.trim() || $("signin").disabled) return;
  $("signin").disabled = true;
  $("status").textContent = "正在驗證 GitHub 權限…";
  try {
    await login($("key").value.trim());
    $("key").value = "";
    await import("./studio.js");
    $("login").hidden = true;
    $("logout").hidden = false;
    $("status").textContent = "已連線至私人作品庫";
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    $("signin").disabled = false;
  }
}
$("signin").onclick = enter;
$("key").onkeydown = (e) => {
  if (e.key === "Enter") enter();
};
$("logout").onclick = () => location.reload();
