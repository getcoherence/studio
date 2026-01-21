import { ipcMain as s, screen as F, BrowserWindow as R, desktopCapturer as L, shell as C, app as d, dialog as E, nativeImage as U, Tray as M, Menu as A } from "electron";
import { fileURLToPath as j } from "node:url";
import o from "node:path";
import P from "node:fs/promises";
const _ = o.dirname(j(import.meta.url)), z = o.join(_, ".."), w = process.env.VITE_DEV_SERVER_URL, S = o.join(z, "dist");
let m = null;
s.on("hud-overlay-hide", () => {
  m && !m.isDestroyed() && m.minimize();
});
function H() {
  const n = F.getPrimaryDisplay(), { workArea: t } = n, c = 500, u = 100, y = Math.floor(t.x + (t.width - c) / 2), p = Math.floor(t.y + t.height - u - 5), e = new R({
    width: c,
    height: u,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 100,
    x: y,
    y: p,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), m = e, e.on("closed", () => {
    m === e && (m = null);
  }), w ? e.loadURL(w + "?windowType=hud-overlay") : e.loadFile(o.join(S, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), e;
}
function q() {
  const n = process.platform === "darwin", t = new R({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...n && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: !1,
    resizable: !0,
    alwaysOnTop: !1,
    skipTaskbar: !1,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1,
      backgroundThrottling: !1
    }
  });
  return t.maximize(), t.webContents.on("did-finish-load", () => {
    t == null || t.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), w ? t.loadURL(w + "?windowType=editor") : t.loadFile(o.join(S, "index.html"), {
    query: { windowType: "editor" }
  }), t;
}
function B() {
  const { width: n, height: t } = F.getPrimaryDisplay().workAreaSize, c = new R({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((n - 620) / 2),
    y: Math.round((t - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: o.join(_, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return w ? c.loadURL(w + "?windowType=source-selector") : c.loadFile(o.join(S, "index.html"), {
    query: { windowType: "source-selector" }
  }), c;
}
let T = null;
function N(n, t, c, u, y) {
  s.handle("get-sources", async (e, a) => (await L.getSources(a)).map((r) => ({
    id: r.id,
    name: r.name,
    display_id: r.display_id,
    thumbnail: r.thumbnail ? r.thumbnail.toDataURL() : null,
    appIcon: r.appIcon ? r.appIcon.toDataURL() : null
  }))), s.handle("select-source", (e, a) => {
    T = a;
    const l = u();
    return l && l.close(), T;
  }), s.handle("get-selected-source", () => T), s.handle("open-source-selector", () => {
    const e = u();
    if (e) {
      e.focus();
      return;
    }
    t();
  }), s.handle("switch-to-editor", () => {
    const e = c();
    e && e.close(), n();
  }), s.handle("store-recorded-video", async (e, a, l) => {
    try {
      const r = o.join(h, l);
      return await P.writeFile(r, Buffer.from(a)), p = r, {
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
  }), s.handle("get-recorded-video-path", async () => {
    try {
      const a = (await P.readdir(h)).filter((I) => I.endsWith(".webm"));
      if (a.length === 0)
        return { success: !1, message: "No recorded video found" };
      const l = a.sort().reverse()[0];
      return { success: !0, path: o.join(h, l) };
    } catch (e) {
      return console.error("Failed to get video path:", e), { success: !1, message: "Failed to get video path", error: String(e) };
    }
  }), s.handle("set-recording-state", (e, a) => {
    y && y(a, (T || { name: "Screen" }).name);
  }), s.handle("open-external-url", async (e, a) => {
    try {
      return await C.openExternal(a), { success: !0 };
    } catch (l) {
      return console.error("Failed to open URL:", l), { success: !1, error: String(l) };
    }
  }), s.handle("get-asset-base-path", () => {
    try {
      return d.isPackaged ? o.join(process.resourcesPath, "assets") : o.join(d.getAppPath(), "public", "assets");
    } catch (e) {
      return console.error("Failed to resolve asset base path:", e), null;
    }
  }), s.handle("save-exported-video", async (e, a, l) => {
    try {
      const r = l.toLowerCase().endsWith(".gif"), I = r ? [{ name: "GIF Image", extensions: ["gif"] }] : [{ name: "MP4 Video", extensions: ["mp4"] }], v = await E.showSaveDialog({
        title: r ? "Save Exported GIF" : "Save Exported Video",
        defaultPath: o.join(d.getPath("downloads"), l),
        filters: I,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return v.canceled || !v.filePath ? {
        success: !1,
        cancelled: !0,
        message: "Export cancelled"
      } : (await P.writeFile(v.filePath, Buffer.from(a)), {
        success: !0,
        path: v.filePath,
        message: "Video exported successfully"
      });
    } catch (r) {
      return console.error("Failed to save exported video:", r), {
        success: !1,
        message: "Failed to save exported video",
        error: String(r)
      };
    }
  }), s.handle("open-video-file-picker", async () => {
    try {
      const e = await E.showOpenDialog({
        title: "Select Video File",
        defaultPath: h,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      return e.canceled || e.filePaths.length === 0 ? { success: !1, cancelled: !0 } : {
        success: !0,
        path: e.filePaths[0]
      };
    } catch (e) {
      return console.error("Failed to open file picker:", e), {
        success: !1,
        message: "Failed to open file picker",
        error: String(e)
      };
    }
  });
  let p = null;
  s.handle("set-current-video-path", (e, a) => (p = a, { success: !0 })), s.handle("get-current-video-path", () => p ? { success: !0, path: p } : { success: !1 }), s.handle("clear-current-video-path", () => (p = null, { success: !0 })), s.handle("get-platform", () => process.platform);
}
const G = o.dirname(j(import.meta.url)), h = o.join(d.getPath("userData"), "recordings");
async function $() {
  try {
    await P.mkdir(h, { recursive: !0 }), console.log("RECORDINGS_DIR:", h), console.log("User Data Path:", d.getPath("userData"));
  } catch (n) {
    console.error("Failed to create recordings directory:", n);
  }
}
process.env.APP_ROOT = o.join(G, "..");
const Q = process.env.VITE_DEV_SERVER_URL, re = o.join(process.env.APP_ROOT, "dist-electron"), O = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Q ? o.join(process.env.APP_ROOT, "public") : O;
let i = null, g = null, f = null, V = "";
const W = k("openscreen.png"), J = k("rec-button.png");
function b() {
  i = H();
}
function D() {
  f = new M(W);
}
function k(n) {
  return U.createFromPath(o.join(process.env.VITE_PUBLIC || O, n)).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function x(n = !1) {
  if (!f) return;
  const t = n ? J : W, c = n ? `Recording: ${V}` : "OpenScreen", u = n ? [
    {
      label: "Stop Recording",
      click: () => {
        i && !i.isDestroyed() && i.webContents.send("stop-recording-from-tray");
      }
    }
  ] : [
    {
      label: "Open",
      click: () => {
        i && !i.isDestroyed() ? i.isMinimized() && i.restore() : b();
      }
    },
    {
      label: "Quit",
      click: () => {
        d.quit();
      }
    }
  ];
  f.setImage(t), f.setToolTip(c), f.setContextMenu(A.buildFromTemplate(u));
}
function K() {
  i && (i.close(), i = null), i = q();
}
function X() {
  return g = B(), g.on("closed", () => {
    g = null;
  }), g;
}
d.on("window-all-closed", () => {
});
d.on("activate", () => {
  R.getAllWindows().length === 0 && b();
});
d.whenReady().then(async () => {
  const { ipcMain: n } = await import("electron");
  n.on("hud-overlay-close", () => {
    d.quit();
  }), D(), x(), await $(), N(
    K,
    X,
    () => i,
    () => g,
    (t, c) => {
      V = c, f || D(), x(t), t || i && i.restore();
    }
  ), b();
});
export {
  re as MAIN_DIST,
  h as RECORDINGS_DIR,
  O as RENDERER_DIST,
  Q as VITE_DEV_SERVER_URL
};
