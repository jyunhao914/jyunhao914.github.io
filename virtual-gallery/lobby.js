import * as T from "./vendor/three.module.js";
import { mobileControls } from "./mobile-controls.js?v=lobby35";
import { buildLobby } from "./lobby-interior.js?v=lobby35";

const eyeHeight = 1.60;
const doorWidth = 2.1;
const doorHeight = 2.65;
const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"]);
const clamp = T.MathUtils.clamp;

function placeDoors(doors) {
  const halfWidth = 5.7;
  const sideRows = Math.ceil(Math.max(0, doors.length - 3) / 2);
  const rowSpacing = 4.5;
  const halfDepth = Math.max(5.9, (Math.max(0, sideRows - 1) * rowSpacing + 7.6) / 2);
  const placed = doors.map((door, index) => {
    let x, z, yaw;
    if (index < 3) {
      x = [0, -3.3, 3.3][index];
      z = -halfDepth;
      yaw = 0;
    } else {
      const west = (index - 3) % 2 === 0;
      x = west ? -halfWidth : halfWidth;
      z = -halfDepth + 3.8 + Math.floor((index - 3) / 2) * rowSpacing;
      yaw = west ? Math.PI / 2 : -Math.PI / 2;
    }
    return { ...door, index, x, z, yaw, width: doorWidth, height: doorHeight,
      nx: Math.sin(yaw), nz: Math.cos(yaw) };
  });
  return { doors: placed, halfWidth, halfDepth };
}

export function createLobby(host, doors, onEnter, options = {}) {
  const plan = placeDoors(doors);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(61, 1, .06, Math.max(65, 4 * Math.hypot(plan.halfDepth, plan.halfWidth) + 20));
  camera.rotation.order = "YXZ";
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "展場大廳");
  canvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight W A S D Enter R");
  const listeners = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, {signal: listeners.signal});
  const keys = new Map();
  const raycaster = new T.Raycaster(), point = new T.Vector2();
  let interior, stick, observer;
  let disposed = false, paused = false, entering = false, space = false;
  let drag = null, nearest, dirty = true, frame = 0, last = 0;

  function invalidate() {
    dirty = true;
    if (!frame && !disposed && !paused && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function clearInput() {
    keys.clear();
    space = false;
    stick?.release();
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    canvas.style.cursor = "grab";
  }
  function setPaused(value) {
    if (disposed) return;
    clearInput();
    paused = Boolean(value);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!paused) invalidate();
  }
  function notifyNearest() {
    const fx = -Math.sin(camera.rotation.y), fz = -Math.cos(camera.rotation.y);
    let choice = null, shortest = Infinity;
    for (const door of plan.doors) {
      const dx = door.x - camera.position.x, dz = door.z - camera.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 2.35 && distance < shortest && fx * dx + fz * dz > .30 * distance) {
        choice = door.index;
        shortest = distance;
      }
    }
    if (choice !== nearest) {
      nearest = choice;
      options.onNearest?.(choice);
    }
  }
  function enter(index) {
    if (disposed || paused || entering || !plan.doors[index]) return false;
    entering = true;
    clearInput();
    // The route may replace this controller synchronously or after loading its scene.
    try {
      Promise.resolve(onEnter(index)).finally(() => { entering = false; });
    } catch (error) {
      entering = false;
      throw error;
    }
    return true;
  }
  function enterNearest() {
    notifyNearest();
    return nearest != null && enter(nearest);
  }
  function faceDoorReturn(index) {
    const door = plan.doors[index];
    if (!door) {
      camera.position.set(0, eyeHeight, plan.halfDepth - 1.35);
      camera.rotation.set(0, 0, 0, "YXZ");
    } else {
      camera.position.set(door.x + 1.65 * door.nx, eyeHeight, door.z + 1.65 * door.nz);
      camera.rotation.set(0, door.yaw + Math.PI, 0, "YXZ");
    }
    camera.updateMatrixWorld();
    notifyNearest();
    invalidate();
  }
  function home() {
    if (disposed) return;
    clearInput();
    faceDoorReturn();
    canvas.focus({preventScroll: true});
  }
  function turn(yaw, pitch) {
    if (paused || disposed) return;
    camera.rotation.y += yaw;
    camera.rotation.x = clamp(camera.rotation.x + pitch, -1.13, 1.13);
    camera.updateMatrixWorld();
    invalidate();
  }
  function walk(side, forward) {
    const pos = camera.position, yaw = camera.rotation.y;
    const dx = Math.cos(yaw) * side - Math.sin(yaw) * forward;
    const dz = -Math.sin(yaw) * side - Math.cos(yaw) * forward;
    const x = pos.x + dx, z = pos.z + dz;
    // Cross a portal only through the actual opening while walking out of the hall.
    for (const door of plan.doors) {
      const before = (pos.x - door.x) * door.nx + (pos.z - door.z) * door.nz;
      const after = (x - door.x) * door.nx + (z - door.z) * door.nz;
      if (before >= .32999 && after < .33) {
        const along = (x - door.x) * door.nz - (z - door.z) * door.nx;
        if (Math.abs(along) < door.width / 2 - .12 && enter(door.index)) return;
      }
    }
    pos.x = clamp(x, -plan.halfWidth + .33, plan.halfWidth - .33);
    pos.z = clamp(z, -plan.halfDepth + .33, plan.halfDepth - .33);
    invalidate();
  }
  function direction(code) {
    if (code === "ArrowUp" || code === "KeyW") return [0, 1];
    if (code === "ArrowDown" || code === "KeyS") return [0, -1];
    return code === "ArrowLeft" || code === "KeyA" ? [-1, 0] : [1, 0];
  }
  function moveOrTurn(side, forward, amount, rotate) {
    if (rotate) turn(-side * amount, forward * amount);
    else walk(side * amount, forward * amount);
  }
  function tick(now) {
    // A nonzero frame ID suppresses duplicate requests from input applied in this tick.
    if (disposed || paused || document.hidden) { frame = 0; return; }
    const dt = Math.min(.045, Math.max(0, (now - last) / 1000));
    last = now;
    let side = 0, forward = 0;
    for (const [code, key] of keys) {
      const axis = direction(code);
      const speed = code.startsWith("Arrow") ? .47 : 1.45;
      const amount = dt * (space ? .78 : speed);
      side += axis[0] * amount;
      forward += axis[1] * amount;
      key.travel += amount;
      if (key.turn !== space) key.mixed = true;
    }
    const joy = stick?.vector;
    if (joy) {
      const amount = dt * (space ? .78 : 1.45);
      side += joy.x * amount;
      forward -= joy.y * amount;
    }
    const length = Math.hypot(side, forward);
    if (length) {
      const limit = Math.min(1, dt * (space ? .78 : 1.45) / length);
      moveOrTurn(side, forward, limit, space);
    }
    if (disposed || paused) { frame = 0; return; }
    if (dirty) {
      dirty = false;
      camera.updateMatrixWorld();
      notifyNearest();
      if (!disposed) renderer.render(scene, camera);
    }
    frame = !disposed && !paused && (keys.size || joy?.lengthSq()) ? requestAnimationFrame(tick) : 0;
  }
  function keydown(e) {
    if (paused || disposed || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    const active = e.target.closest?.("input,select,textarea,button,a,summary,[contenteditable=true]");
    if (active && !active.closest(".walk-stick") && active.getClientRects().length) return;
    const rect=host.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom<=0 || rect.top>=innerHeight) return;
    if (e.code === "Space") {
      e.preventDefault();
      space = true;
    } else if (movementKeys.has(e.code)) {
      e.preventDefault();
      if (!keys.has(e.code)) keys.set(e.code, {start: performance.now(), travel: 0, turn: space, mixed: false});
      invalidate();
    } else if (!e.repeat && e.code === "Enter" && enterNearest()) e.preventDefault();
    else if (!e.repeat && e.code === "KeyR") { e.preventDefault(); home(); }
  }
  function keyup(e) {
    if (e.code === "Space") { space = false; return; }
    const key = keys.get(e.code);
    if (!key) return;
    keys.delete(e.code);
    if (!key.mixed && key.turn === space && performance.now() - key.start < 175) {
      const [side, forward] = direction(e.code);
      moveOrTurn(side, forward, Math.max(0, (space ? .078 : .14) - key.travel), space);
    }
  }
  function pick(e) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    point.set(2 * (e.clientX - bounds.left) / bounds.width - 1, 1 - 2 * (e.clientY - bounds.top) / bounds.height);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(interior.hits, true)[0];
    let object = hit?.object;
    while (object) {
      if (Number.isInteger(object.userData.doorIndex)) return object.userData.doorIndex;
      object = object.parent;
    }
    return null;
  }
  function pointerdown(e) {
    if (paused || disposed || e.button !== 0 || !e.isPrimary) {
      if (drag) drag.moved = true;
      return;
    }
    canvas.focus({preventScroll: true});
    canvas.setPointerCapture(e.pointerId);
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false};
  }
  function pointermove(e) {
    if (e.pointerId !== drag?.id || paused) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    canvas.style.cursor = "grabbing";
    turn(-(e.clientX - drag.x) * .0034, -(e.clientY - drag.y) * .0034);
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function pointerend(e) {
    if (e.pointerId !== drag?.id) return;
    const tap = e.type === "pointerup" && !drag.moved && !paused;
    drag = null;
    canvas.style.cursor = "grab";
    if (!tap) return;
    const index = pick(e);
    if (index == null) host.dispatchEvent(new Event("lobbyblanktap"));
    else enter(index);
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!(width && height)) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInput();
    listeners.abort();
    observer?.disconnect();
    cancelAnimationFrame(frame);
    stick?.dispose();
    interior?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  try {
    interior = buildLobby(T, scene, plan.doors, {...plan, invalidate});
    host.append(canvas);
    stick = mobileControls(host, turn, () => paused || disposed, {
      toggle: document.getElementById("lobbyGyro"),
      status: document.getElementById("lobbyGyroStatus")
    });
    function earlyInput(input) {
      if (input.type === "entrylook") {
        if (Number.isFinite(input.dx) && Number.isFinite(input.dy)) turn(-input.dx * .0034, -input.dy * .0034);
      } else if (input.type === "keydown" || input.type === "keyup") {
        const event = {code:input.code, target:canvas, preventDefault(){}};
        if (input.type === "keydown") keydown(event);
        else keyup(event);
      }
    }
    listen(host, "entrylook", e => earlyInput(e.detail));
    listen(canvas, "pointerdown", pointerdown);
    listen(canvas, "pointermove", pointermove);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(canvas, type, pointerend);
    listen(host, "pointerdown", invalidate);
    listen(host, "pointermove", e => { if (e.target.closest(".walk-stick") && e.buttons) invalidate(); });
    listen(window, "keydown", keydown);
    listen(window, "keyup", keyup);
    listen(window, "blur", clearInput);
    listen(document, "visibilitychange", () => {
      clearInput();
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else invalidate();
    });
    listen(canvas, "webglcontextrestored", invalidate);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    faceDoorReturn(options.returnDoorIndex);
    host.dispatchEvent(new CustomEvent("viewerready", {detail:earlyInput}));
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose, setPaused, enterNearest, home };
}
