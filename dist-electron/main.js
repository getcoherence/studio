import { BrowserWindow as _, screen as D, ipcMain as c, desktopCapturer as j, shell as x, app as l, nativeImage as F, Tray as O, Menu as W } from "electron";
import { fileURLToPath as P } from "node:url";
import t from "node:path";
import p from "node:fs/promises";
const v = t.dirname(P(import.meta.url)), V = t.join(v, ".."), f = process.env.VITE_DEV_SERVER_URL, T = t.join(V, "dist");
function L() {
  const e = new _({
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
      preload: t.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), f ? e.loadURL(f + "?windowType=hud-overlay") : e.loadFile(t.join(T, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function U() {
  const e = new _({
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
      preload: t.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1
    }
  });
  return e.maximize(), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), f ? e.loadURL(f + "?windowType=editor") : e.loadFile(t.join(T, "index.html"), {
    query: { windowType: "editor" }
  }), e;
}
function k() {
  const { width: e, height: s } = D.getPrimaryDisplay().workAreaSize, u = new _({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((e - 620) / 2),
    y: Math.round((s - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: t.join(v, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return f ? u.loadURL(f + "?windowType=source-selector") : u.loadFile(t.join(T, "index.html"), {
    query: { windowType: "source-selector" }
  }), u;
}
let R = null;
function C(e, s, u, m, w) {
  c.handle("get-sources", async (o, n) => (await j.getSources(n)).map((r) => ({
    id: r.id,
    name: r.name,
    display_id: r.display_id,
    thumbnail: r.thumbnail ? r.thumbnail.toDataURL() : null,
    appIcon: r.appIcon ? r.appIcon.toDataURL() : null
  }))), c.handle("select-source", (o, n) => {
    R = n;
    const a = m();
    return a && a.close(), R;
  }), c.handle("get-selected-source", () => R), c.handle("open-source-selector", () => {
    const o = m();
    if (o) {
      o.focus();
      return;
    }
    s();
  }), c.handle("switch-to-editor", () => {
    const o = u();
    o && o.close(), e();
  }), c.handle("store-recorded-video", async (o, n, a) => {
    try {
      const r = t.join(h, a);
      return await p.writeFile(r, Buffer.from(n)), {
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
  }), c.handle("get-recorded-video-path", async () => {
    try {
      const n = (await p.readdir(h)).filter((y) => y.endsWith(".webm"));
      if (n.length === 0)
        return { success: !1, message: "No recorded video found" };
      const a = n.sort().reverse()[0];
      return { success: !0, path: t.join(h, a) };
    } catch (o) {
      return console.error("Failed to get video path:", o), { success: !1, message: "Failed to get video path", error: String(o) };
    }
  }), c.handle("set-recording-state", (o, n) => {
    w && w(n, (R || { name: "Screen" }).name);
  }), c.handle("open-external-url", async (o, n) => {
    try {
      return await x.openExternal(n), { success: !0 };
    } catch (a) {
      return console.error("Failed to open URL:", a), { success: !1, error: String(a) };
    }
  }), c.handle("get-asset-base-path", () => {
    try {
      return l.isPackaged ? t.join(process.resourcesPath, "assets") : t.join(l.getAppPath(), "public", "assets");
    } catch (o) {
      return console.error("Failed to resolve asset base path:", o), null;
    }
  }), c.handle("save-exported-video", async (o, n, a) => {
    try {
      const r = l.getPath("downloads"), y = t.join(r, a);
      return await p.writeFile(y, Buffer.from(n)), {
        success: !0,
        path: y,
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
const A = t.dirname(P(import.meta.url)), h = t.join(l.getPath("userData"), "recordings");
async function M() {
  try {
    const e = await p.readdir(h), s = Date.now(), u = 1 * 24 * 60 * 60 * 1e3;
    for (const m of e) {
      const w = t.join(h, m), o = await p.stat(w);
      s - o.mtimeMs > u && (await p.unlink(w), console.log(`Deleted old recording: ${m}`));
    }
  } catch (e) {
    console.error("Failed to cleanup old recordings:", e);
  }
}
async function z() {
  try {
    await p.mkdir(h, { recursive: !0 }), console.log("RECORDINGS_DIR:", h), console.log("User Data Path:", l.getPath("userData"));
  } catch (e) {
    console.error("Failed to create recordings directory:", e);
  }
}
process.env.APP_ROOT = t.join(A, "..");
const H = process.env.VITE_DEV_SERVER_URL, Q = t.join(process.env.APP_ROOT, "dist-electron"), b = t.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = H ? t.join(process.env.APP_ROOT, "public") : b;
let i = null, g = null, d = null, E = "";
function S() {
  i = L();
}
function N() {
  const e = t.join(process.env.VITE_PUBLIC || b, "rec-button.png");
  let s = F.createFromPath(e);
  s = s.resize({ width: 24, height: 24, quality: "best" }), d = new O(s), I();
}
function I() {
  if (!d) return;
  const e = [
    {
      label: "Stop Recording",
      click: () => {
        i && !i.isDestroyed() && i.webContents.send("stop-recording-from-tray");
      }
    }
  ], s = W.buildFromTemplate(e);
  d.setContextMenu(s), d.setToolTip(`Recording: ${E}`);
}
function B() {
  i && (i.close(), i = null), i = U();
}
function q() {
  return g = k(), g.on("closed", () => {
    g = null;
  }), g;
}
l.on("window-all-closed", () => {
});
l.on("activate", () => {
  _.getAllWindows().length === 0 && S();
});
l.on("before-quit", async (e) => {
  e.preventDefault(), await M(), l.exit(0);
});
l.whenReady().then(async () => {
  await z(), C(
    B,
    q,
    () => i,
    () => g,
    (e, s) => {
      E = s, e ? (d || N(), I(), i && i.minimize()) : (d && (d.destroy(), d = null), i && i.restore());
    }
  ), S();
});
export {
  Q as MAIN_DIST,
  h as RECORDINGS_DIR,
  b as RENDERER_DIST,
  H as VITE_DEV_SERVER_URL
};
