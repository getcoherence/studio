import { BrowserWindow as P, screen as O, ipcMain as c, desktopCapturer as M, shell as W, app as p, nativeImage as L, Tray as V, Menu as U } from "electron";
import { fileURLToPath as E } from "node:url";
import t from "node:path";
import m from "node:fs/promises";
import { uIOhook as w } from "uiohook-napi";
const S = t.dirname(E(import.meta.url)), A = t.join(S, ".."), y = process.env.VITE_DEV_SERVER_URL, x = t.join(A, "dist");
function C() {
  const e = new P({
    width: 250,
    height: 80,
    minWidth: 250,
    maxWidth: 250,
    minHeight: 80,
    maxHeight: 80,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: t.join(S, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), y ? e.loadURL(y + "?windowType=hud-overlay") : e.loadFile(t.join(x, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function N() {
  const e = new P({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    transparent: !1,
    resizable: !0,
    alwaysOnTop: !1,
    skipTaskbar: !1,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: t.join(S, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1
    }
  });
  return e.maximize(), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), y ? e.loadURL(y + "?windowType=editor") : e.loadFile(t.join(x, "index.html"), {
    query: { windowType: "editor" }
  }), e;
}
function H() {
  const { width: e, height: n } = O.getPrimaryDisplay().workAreaSize, i = new P({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((e - 620) / 2),
    y: Math.round((n - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: t.join(S, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return y ? i.loadURL(y + "?windowType=source-selector") : i.loadFile(t.join(x, "index.html"), {
    query: { windowType: "source-selector" }
  }), i;
}
let u = !1, _ = !1, d = 0, f = [];
function z() {
  if (u)
    return { success: !1, message: "Already tracking" };
  if (u = !0, d = performance.now(), f = [], _)
    return { success: !0, message: "Mouse tracking resumed", startTime: d };
  q();
  try {
    return w.start(), _ = !0, { success: !0, message: "Mouse tracking started", startTime: d };
  } catch (e) {
    return console.error("Failed to start mouse tracking:", e), u = !1, { success: !1, message: "Failed to start hook", error: e };
  }
}
function B() {
  if (!u)
    return { success: !1, message: "Not currently tracking" };
  u = !1;
  const e = performance.now() - d;
  return {
    success: !0,
    message: "Mouse tracking stopped",
    data: {
      startTime: d,
      events: f,
      duration: e
    }
  };
}
function q() {
  w.on("mousemove", (e) => {
    if (u) {
      const i = {
        type: "move",
        timestamp: performance.now() - d,
        x: e.x,
        y: e.y
      };
      f.push(i);
    }
  }), w.on("mousedown", (e) => {
    if (u) {
      const i = {
        type: "down",
        timestamp: performance.now() - d,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      };
      f.push(i);
    }
  }), w.on("mouseup", (e) => {
    if (u) {
      const i = {
        type: "up",
        timestamp: performance.now() - d,
        x: e.x,
        y: e.y,
        button: e.button
      };
      f.push(i);
    }
  }), w.on("click", (e) => {
    if (u) {
      const i = {
        type: "click",
        timestamp: performance.now() - d,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      };
      f.push(i);
    }
  });
}
function $() {
  return [...f];
}
function G() {
  if (_)
    try {
      w.stop(), _ = !1, u = !1, f = [];
    } catch (e) {
      console.error("Error cleaning up mouse tracking:", e);
    }
}
let b = null;
function J(e, n, i, v, T) {
  c.handle("get-sources", async (o, a) => (await M.getSources(a)).map((r) => ({
    id: r.id,
    name: r.name,
    display_id: r.display_id,
    thumbnail: r.thumbnail ? r.thumbnail.toDataURL() : null,
    appIcon: r.appIcon ? r.appIcon.toDataURL() : null
  }))), c.handle("select-source", (o, a) => {
    b = a;
    const s = v();
    return s && s.close(), b;
  }), c.handle("get-selected-source", () => b), c.handle("open-source-selector", () => {
    const o = v();
    if (o) {
      o.focus();
      return;
    }
    n();
  }), c.handle("switch-to-editor", () => {
    const o = i();
    o && o.close(), e();
  }), c.handle("start-mouse-tracking", () => z()), c.handle("stop-mouse-tracking", () => B()), c.handle("store-recorded-video", async (o, a, s) => {
    try {
      const r = t.join(h, s);
      return await m.writeFile(r, Buffer.from(a)), {
        success: !0,
        path: r,
        message: "Video stored successfully"
      };
    } catch (r) {
      return console.error("Failed to store video:", r), {
        success: !1,
        message: "Failed to store video",
        error: String(r)
      };
    }
  }), c.handle("store-mouse-tracking-data", async (o, a) => {
    try {
      const s = $();
      if (s.length === 0)
        return { success: !1, message: "No tracking data to save" };
      const r = t.join(h, a);
      return await m.writeFile(r, JSON.stringify(s, null, 2), "utf-8"), {
        success: !0,
        path: r,
        eventCount: s.length,
        message: "Mouse tracking data stored successfully"
      };
    } catch (s) {
      return console.error("Failed to store mouse tracking data:", s), {
        success: !1,
        message: "Failed to store mouse tracking data",
        error: String(s)
      };
    }
  }), c.handle("get-recorded-video-path", async () => {
    try {
      const a = (await m.readdir(h)).filter((R) => R.endsWith(".webm"));
      if (a.length === 0)
        return { success: !1, message: "No recorded video found" };
      const s = a.sort().reverse()[0];
      return { success: !0, path: t.join(h, s) };
    } catch (o) {
      return console.error("Failed to get video path:", o), { success: !1, message: "Failed to get video path", error: String(o) };
    }
  }), c.handle("set-recording-state", (o, a) => {
    T && T(a, (b || { name: "Screen" }).name);
  }), c.handle("open-external-url", async (o, a) => {
    try {
      return await W.openExternal(a), { success: !0 };
    } catch (s) {
      return console.error("Failed to open URL:", s), { success: !1, error: String(s) };
    }
  }), c.handle("get-asset-base-path", () => {
    try {
      return p.isPackaged ? t.join(process.resourcesPath, "assets") : t.join(p.getAppPath(), "public", "assets");
    } catch (o) {
      return console.error("Failed to resolve asset base path:", o), null;
    }
  }), c.handle("save-exported-video", async (o, a, s) => {
    try {
      const r = p.getPath("downloads"), R = t.join(r, s);
      return await m.writeFile(R, Buffer.from(a)), {
        success: !0,
        path: R,
        message: "Video exported successfully"
      };
    } catch (r) {
      return console.error("Failed to save exported video:", r), {
        success: !1,
        message: "Failed to save exported video",
        error: String(r)
      };
    }
  });
}
const K = t.dirname(E(import.meta.url)), h = t.join(p.getPath("userData"), "recordings");
async function Q() {
  try {
    const e = await m.readdir(h), n = Date.now(), i = 1 * 24 * 60 * 60 * 1e3;
    for (const v of e) {
      const T = t.join(h, v), o = await m.stat(T);
      n - o.mtimeMs > i && (await m.unlink(T), console.log(`Deleted old recording: ${v}`));
    }
  } catch (e) {
    console.error("Failed to cleanup old recordings:", e);
  }
}
async function X() {
  try {
    await m.mkdir(h, { recursive: !0 }), console.log("Recordings directory ready:", h);
  } catch (e) {
    console.error("Failed to create recordings directory:", e);
  }
}
process.env.APP_ROOT = t.join(K, "..");
const Y = process.env.VITE_DEV_SERVER_URL, ie = t.join(process.env.APP_ROOT, "dist-electron"), I = t.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Y ? t.join(process.env.APP_ROOT, "public") : I;
let l = null, k = null, g = null, j = "";
function D() {
  l = C();
}
function Z() {
  const e = t.join(process.env.VITE_PUBLIC || I, "rec-button.png");
  let n = L.createFromPath(e);
  n = n.resize({ width: 24, height: 24, quality: "best" }), g = new V(n), F();
}
function F() {
  if (!g) return;
  const e = [
    {
      label: "Stop Recording",
      click: () => {
        l && !l.isDestroyed() && l.webContents.send("stop-recording-from-tray");
      }
    }
  ], n = U.buildFromTemplate(e);
  g.setContextMenu(n), g.setToolTip(`Recording: ${j}`);
}
function ee() {
  l && (l.close(), l = null), l = N();
}
function te() {
  return k = H(), k.on("closed", () => {
    k = null;
  }), k;
}
p.on("window-all-closed", () => {
});
p.on("activate", () => {
  P.getAllWindows().length === 0 && D();
});
p.on("before-quit", async (e) => {
  e.preventDefault(), G(), await Q(), p.exit(0);
});
p.whenReady().then(async () => {
  await X(), J(
    ee,
    te,
    () => l,
    () => k,
    (e, n) => {
      j = n, e ? (g || Z(), F(), l && l.minimize()) : (g && (g.destroy(), g = null), l && l.restore());
    }
  ), D();
});
export {
  ie as MAIN_DIST,
  h as RECORDINGS_DIR,
  I as RENDERER_DIST,
  Y as VITE_DEV_SERVER_URL
};
