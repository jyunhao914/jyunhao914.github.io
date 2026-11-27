export const publicationLabels = {
  checking: "正在核對正式站",
  draft: "未發布",
  archived: "已典藏",
  live: "正式站已更新",
  changed: "有未發布變更",
  submitting: "正在送出發布",
  deploying: "等待正式站更新",
  withdrawing: "等待正式站撤展",
  error: "發布失敗",
  unknown: "無法核對正式站",
};

export function publicationTitle(model) {
  if (model.operation === "end" && model.state === "submitting") return "正在送出撤展";
  if (model.operation === "end" && model.state === "error") return "撤展失敗";
  if (model.state === "live" && model.scheduled === "future") return "已上線，尚未開展";
  if (model.state === "live" && model.scheduled === "ended") return "展期已結束";
  return publicationLabels[model.state] || publicationLabels.unknown;
}

const taipeiDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" });
const checkedTime = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const checkedClock = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function dateRange(start, end) {
  if (start && end) return start + " 至 " + end;
  if (start) return start + " 起";
  if (end) return "至 " + end;
  return "常設";
}

function draftBlocker(show) {
  if (!show.ids.length) return "先加入至少一件展出作品，即可發布。";
  if (show.start && show.end && show.start > show.end) return "請將結束日調整為開展日當天或之後。";
  const today = taipeiDate.format(new Date());
  if (show.start && today < show.start) return "可從 " + show.start + " 開展當天發布。";
  if (show.end && today > show.end) return "草稿展期已過，請先調整展覽檔期。";
  return "";
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function summaryRows(show, model) {
  const count = show.ids.length + " 件";
  const fields = [
    ["展覽名稱", model.liveTitle, show.title],
    ["展出作品", Number.isInteger(model.liveCount) ? model.liveCount + " 件" : "—", count],
    ["展期", dateRange(model.liveStart, model.liveEnd), dateRange(show.start, show.end)],
  ];
  return fields.map(([label, live, next]) => {
    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    row.append(th);
    if (model.hasLive) {
      const old = row.insertCell();
      old.textContent = live ?? "—";
      if (live !== next) row.classList.add("pub-difference");
    }
    row.insertCell().textContent = next;
    return row;
  });
}

export function createPublicationControls({host, show, onConfirm, onRefresh}) {
  const bar = document.createElement("section");
  bar.className = "publication-bar";
  bar.dataset.publicationBar = "";
  bar.setAttribute("aria-label", "展覽發布");
  bar.innerHTML = `
    <div class="pub-main">
      <strong data-publication-label role="status"></strong>
      <div class="pub-actions">
        <button type="button" data-act="refresh-publication" aria-label="重新核對正式站" title="重新核對正式站"><span aria-hidden="true">↻</span></button>
        <a data-act="view-live" target="_blank" rel="noopener noreferrer" hidden>查看公開展覽</a>
        <button type="button" data-act="publish" disabled>發布展覽</button>
      </div>
    </div>
    <div class="pub-facts"><span data-publication-draft></span><time data-publication-checked hidden></time></div>
    <p class="pub-detail" data-publication-detail hidden></p>`;
  const dialog = document.createElement("dialog");
  dialog.className = "publication-review";
  dialog.dataset.publicationReview = "";
  dialog.setAttribute("aria-label", "發布前核對");
  dialog.innerHTML = `
    <h2>發布前核對</h2>
    <p data-review-unknown hidden>目前無法核對正式站。確認後會送出下列展覽內容。</p>
    <table aria-label="展覽發布內容">
      <thead><tr><th scope="col">項目</th><th scope="col" data-public-column>正式站目前</th><th scope="col">本次發布</th></tr></thead>
      <tbody></tbody>
    </table>
    <section class="pub-changes" hidden>
      <h3>本次變更</h3>
      <ul data-publication-changes></ul>
    </section>
    <p>發布後，訪客可看到本展的作品、佈展與影音設定。</p>
    <div class="pub-review-actions">
      <button type="button" data-act="cancel-publish" autofocus>取消</button>
      <button type="button" data-act="confirm-publish">確認發布</button>
    </div>`;
  host.replaceChildren(bar, dialog);
  const status = bar.querySelector("[data-publication-label]");
  const draft = bar.querySelector("[data-publication-draft]");
  const checked = bar.querySelector("[data-publication-checked]");
  const detail = bar.querySelector("[data-publication-detail]");
  const refresh = bar.querySelector("[data-act=refresh-publication]");
  const publish = bar.querySelector("[data-act=publish]");
  const visit = bar.querySelector("[data-act=view-live]");
  const confirm = dialog.querySelector("[data-act=confirm-publish]");
  let model, approvedSource, submitting = false, disposed = false;

  function renderReview(opening = false) {
    dialog.querySelector("[data-review-unknown]").hidden = model.state !== "unknown";
    dialog.querySelector("[data-public-column]").hidden = !model.hasLive;
    dialog.querySelector("tbody").replaceChildren(...summaryRows(show, model));
    setText(confirm, model.hasSource || model.hasLive ? "確認更新" : "確認發布");
    confirm.disabled = publish.disabled;
    if (opening) {
      const list = dialog.querySelector("[data-publication-changes]");
      const changes = model.getChanges?.() || [];
      list.replaceChildren(...changes.map(change => {
        const item = document.createElement("li");
        item.textContent = change;
        return item;
      }));
      list.parentNode.hidden = changes.length === 0;
    }
  }
  function update(next) {
    if (disposed) return;
    model = next;
    const state = model.state;
    const blocked = draftBlocker(show);
    const ready = ["changed", "draft", "archived", "error"].includes(state);
    bar.dataset.state = state;
    setText(status, publicationTitle(model));
    setText(draft, model.draft || "");
    draft.hidden = !model.draft;
    let note = model.detail || "";
    if (!note && ready && blocked) note = blocked;
    if (!note && ["changed", "deploying", "withdrawing"].includes(state) && model.hasLive) {
      if (model.scheduled === "ended") note = "正式站目前的展期已結束。";
      else if (model.scheduled === "future") note = "正式站目前的展覽尚未開展。";
      else if (!model.liveUrl) note = "正式站目前顯示上一版展覽。";
    }
    setText(detail, note);
    detail.hidden = !note;
    setText(publish, model.hasSource || model.hasLive ? "發布變更" : "發布展覽");
    publish.hidden = state === "live" || (model.operation === "end" && state === "error");
    publish.disabled = blocked !== "" || !(model.canPublish ?? ready) || submitting;
    refresh.disabled = !(model.canRefresh ?? !["checking", "submitting"].includes(state)) || submitting;
    checked.hidden = !Number.isFinite(model.checkedAt);
    if (!checked.hidden) {
      const stamp = new Date(model.checkedAt);
      checked.dateTime = stamp.toISOString();
      checked.title = "上次核對正式站 " + checkedTime.format(stamp);
      const sameDay = taipeiDate.format(stamp) === taipeiDate.format(new Date());
      setText(checked, "核對於 " + (sameDay ? checkedClock.format(stamp) : checkedTime.format(stamp)));
    }
    refresh.title = checked.hidden ? "重新核對正式站" : checked.title + "，點擊重新核對";
    visit.hidden = !model.liveUrl;
    if (model.liveUrl) visit.href = model.liveUrl;
    else visit.removeAttribute("href");
    const previous = ["changed", "deploying", "withdrawing"].includes(state);
    setText(visit, previous ? "查看上一版" : "查看公開展覽");
    visit.title = Number.isInteger(model.liveCount) ? "查看正式站的 " + model.liveCount + " 件作品" : "查看公開展覽";
    if (dialog.open) renderReview();
  }
  publish.onclick = () => {
    if (publish.disabled || dialog.open) return;
    approvedSource = model.sourceAtCheck;
    renderReview(true);
    dialog.showModal();
  };
  dialog.querySelector("[data-act=cancel-publish]").onclick = () => dialog.close();
  confirm.onclick = async () => {
    if (confirm.disabled || submitting || !dialog.open) return;
    submitting = true;
    dialog.close();
    update(model);
    try { await onConfirm(approvedSource); }
    finally { submitting = false; update(model); }
  };
  refresh.onclick = onRefresh;
  update({state: "checking"});
  return {
    update,
    dispose() {
      disposed = true;
      if (dialog.open) dialog.close();
      bar.remove();
      dialog.remove();
    },
  };
}
