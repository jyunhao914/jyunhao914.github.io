function preview(a, large) {
  const src = a.src?.startsWith("media/") ? "../" + a.src : a.src;
  let el;
  if (
    src &&
    (a.type === "圖片" ||
      (a.type === "動態" && /^(data:image)|\.gif$/i.test(src)))
  ) {
    el = document.createElement("img");
    el.loading = large ? "eager" : "lazy";
    el.alt = large ? a.title : "";
    el.src = src;
  } else if (src && ["影片", "動態"].includes(a.type)) {
    el = document.createElement("video");
    el.playsInline = true;
    el.controls = large;
    el.muted = !large;
    el.preload = "metadata";
    el.src = src;
    if (a.src === "media/motion.mp4") el.poster = "../media/motion.webp";
    else if (!large)
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (el.duration > 0) el.currentTime = Math.min(0.12, el.duration / 2);
        },
        { once: true },
      );
  } else if (src && a.type === "語音" && large) {
    el = document.createElement("audio");
    el.controls = true;
    el.src = src;
  } else {
    el = document.createElement("span");
    el.textContent =
      a.type === "語音"
        ? "♫"
        : (a.description || a.title || "文字").slice(0, large ? 500 : 12);
  }
  el.className = large ? "art-large" : "art-thumb";
  return el;
}
export function artworkList(host, items, selected, select, describe) {
  host.className = "art-library";
  host.replaceChildren(
    ...items.map((a) => {
      let b = document.createElement("button");
      b.setAttribute("aria-current", String(a.id === selected));
      b.setAttribute("aria-label", a.title);
      b.append(preview(a, false));
      let caption = document.createElement("span"),
        title = document.createElement("strong"),
        meta = document.createElement("small");
      title.textContent = a.title;
      meta.textContent = describe ? describe(a) : [a.type, a.category].filter(Boolean).join(" · ");
      caption.append(title, meta);
      b.append(caption);
      b.onclick = () => select(a.id);
      return b;
    }),
  );
}
export function artworkDetail(host, a) {
  host.replaceChildren(preview(a, true));
}
