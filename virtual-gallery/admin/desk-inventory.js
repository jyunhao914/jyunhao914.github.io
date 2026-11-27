import { artworkList } from "./art-preview.js?v=wall24";

export const inventoryMarkup = `
  <div class="inventory-sources" role="group" aria-label="作品來源">
    <button type="button" id="inventory-shown" aria-controls="included-works">本展作品</button>
    <button type="button" id="inventory-available" aria-controls="available-works">可加入本展</button>
  </div>
  <div id="included-works"><p id="wall-progress"></p><div id="wall-list"></div></div>
  <div id="available-works" hidden>
    <label>搜尋可加入的作品<input id="available-query" type="search" placeholder="作品名、創作者或分類"></label>
    <div id="available-list"></div>
    <p id="available-empty" role="status" hidden></p>
  </div>`;

export function bindInventory(panel, library, show, browser, onAdd, onSourceChange) {
  const get = selector => panel.querySelector(selector);
  const members = new Set(show.ids);
  const available = library.filter(work => !members.has(work.id)).reverse();
  const preferred = available.findIndex(work => work.id === browser.preferred);
  if (preferred > 0) available.unshift(available.splice(preferred, 1)[0]);
  const shownButton = get("#inventory-shown"), availableButton = get("#inventory-available");
  shownButton.textContent = "本展作品（" + members.size + "）";
  availableButton.textContent = "可加入本展（" + available.length + "）";
  const query = get("#available-query"), list = get("#available-list");
  query.value = browser.query;
  function drawAvailable() {
    const term = browser.query.trim().toLocaleLowerCase();
    const matches = available.filter(work =>
      [work.title, work.artist, work.category].join(" ").toLocaleLowerCase().includes(term)
    );
    artworkList(list, matches, null, onAdd, work =>
      [work.artist, work.type, work.category].filter(Boolean).join(" · ")
    );
    for (const [index, button] of Array.from(list.children).entries()) {
      button.removeAttribute("aria-current");
      button.setAttribute("aria-label", "將《" + matches[index].title + "》加入本展");
      const label = document.createElement("span");
      label.className = "inventory-add";
      label.textContent = "加入";
      button.append(label);
    }
    const empty = get("#available-empty");
    empty.hidden = matches.length > 0;
    empty.textContent = matches.length ? "" : available.length ? "沒有符合搜尋的作品。" :
      library.length ? "作品庫中的作品都已加入本展。" : "請先到作品資料庫上傳或新增作品。";
  }
  function switchSource(availableOpen) {
    browser.available = availableOpen;
    shownButton.setAttribute("aria-pressed", String(!availableOpen));
    availableButton.setAttribute("aria-pressed", String(availableOpen));
    get("#included-works").hidden = availableOpen;
    get("#available-works").hidden = !availableOpen;
    if (availableOpen) drawAvailable();
    else list.replaceChildren();
  }
  shownButton.onclick = () => { switchSource(false); onSourceChange(); };
  availableButton.onclick = () => { switchSource(true); onSourceChange(); };
  query.oninput = () => { browser.query = query.value; drawAvailable(); };
  switchSource(browser.available);
}
