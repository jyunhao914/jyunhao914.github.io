import {cachedPublication, readPublication, publicationState, publicationChanges} from "./storage.js?v=publish69";
import {createPublicationControls, publicationTitle} from "./publication-ui.js?v=publish69";

const pending = state => state === "deploying" || state === "withdrawing";
const taipeiDate = new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Taipei"});

export function publicationController({database, revision, draftStatus, commit, updateList}) {
  const results = new WeakMap();
  let active, controls, editTimer, pollTimer;

  function comparison(show, snapshot) {
    const version = revision();
    const day = taipeiDate.format(new Date());
    const last = results.get(show);
    if (last?.version === version && last.checkedAt === snapshot.checkedAt && last.day === day) return last.value;
    const value = publicationState(database(), show, snapshot);
    results.set(show, {version, checkedAt:snapshot.checkedAt, day, value});
    return value;
  }
  function model(show) {
    const context = active?.show === show ? active : null;
    const snapshot = cachedPublication(show.id);
    const info = snapshot ? comparison(show, snapshot) : {state:"checking"};
    const state = context?.phase || info.state;
    const live = snapshot?.live;
    const today = taipeiDate.format(new Date());
    const open = live && (!live.start || live.start <= today) && (!live.end || live.end >= today);
    const eligible = show.ids.length > 0 && (!show.start || show.start <= today) && (!show.end || show.end >= today);
    return {
      ...info, state, operation:context?.operation, draft:draftStatus(), detail:context?.message || "",
      sourceAtCheck:snapshot ? snapshot.source : context?.approvedSource,
      getChanges:() => snapshot ? publicationChanges(database(), show, snapshot) : [],
      liveCount:live?.works?.length ?? null, liveTitle:live?.title, liveStart:live?.start, liveEnd:live?.end,
      liveUrl:open ? "../#" + encodeURIComponent(show.id) : null,
      canPublish:Boolean(eligible && !context?.uncertain && !["checking","live","submitting","deploying","withdrawing"].includes(state)),
      canRefresh:!context?.reading && state !== "submitting"
    };
  }
  function paint() {
    if (!active || !controls) return;
    controls.update(model(active.show));
    updateList(show => publicationTitle(model(show)));
  }
  function schedule(context, wait = context.delay) {
    clearTimeout(pollTimer);
    if (context !== active || document.hidden) return;
    pollTimer = setTimeout(() => check(context), wait);
  }
  async function check(context) {
    if (!context || context !== active || context.reading || context.phase === "submitting") return;
    clearTimeout(pollTimer);
    context.reading = true;
    paint();
    try {
      const snapshot = await readPublication(context.show.id);
      if (context !== active || context.phase === "submitting") return;
      context.phase = null;
      context.uncertain = false;
      context.message = context.warning || "";
      context.tracking = pending(comparison(context.show, snapshot).state);
      if (context.tracking) {
        schedule(context);
        context.delay = Math.min(context.delay * 2, 60000);
      }
    } catch (error) {
      if (context !== active || context.phase === "submitting") return;
      context.phase = "unknown";
      const detail = error.name === "TimeoutError" ? "連線逾時，可重新核對正式站。" : error.message;
      context.message = [context.warning, detail].filter(Boolean).join(" ");
      if (context.tracking) schedule(context, 30000);
    } finally {
      context.reading = false;
      if (context === active) paint();
    }
  }
  async function submit(op = "publish", approvedSource) {
    const context = active;
    if (!context || context.phase === "submitting") return;
    if (op === "publish" && !model(context.show).canPublish) return;
    // A read begun before submission must not finish verification for this write.
    if (op === "end") approvedSource = cachedPublication(context.show.id)?.source;
    active = {...context, operation:op, approvedSource, reading:false, phase:"submitting", message:"", warning:"", tracking:true, delay:5000};
    const next = active;
    clearTimeout(pollTimer);
    paint();
    try {
      await commit(op, next.show, approvedSource);
    } catch (error) {
      if (next !== active) return;
      if (error.publicUpdated) {
        next.warning = error.message;
      } else if(error.publicUncertain) {
        next.uncertain = true;
        next.warning = "送出時未收到完整回應，請依正式站核對結果確認。";
        next.phase = "unknown";
        next.message = next.warning;
        paint();
        await check(next);
        return;
      } else {
        next.phase = "error";
        next.message = error.message;
        next.uncertain = Boolean(error.reviewRequired);
        next.tracking = false;
        paint();
        return;
      }
    }
    if (next !== active) return;
    next.phase = op === "end" ? "withdrawing" : "deploying";
    paint();
    await check(next);
  }
  function mount(host, show) {
    controls?.dispose();
    controls = null;
    if (!host || !show) {
      active = null;
      clearTimeout(pollTimer);
      return;
    }
    const switched = active?.show !== show;
    if (switched) {
      clearTimeout(pollTimer);
      active = {show, reading:false, tracking:false, phase:null, message:"", warning:"", delay:5000};
    }
    controls = createPublicationControls({host, show, onConfirm:source => submit("publish", source), onRefresh:() => check(active)});
    paint();
    if (switched) check(active);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(pollTimer);
    else if (active) check(active);
  });
  return {
    mount, submit,
    changed() { clearTimeout(editTimer); editTimer = setTimeout(paint, 250); }
  };
}
