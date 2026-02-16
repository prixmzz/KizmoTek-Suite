const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");

const APP_NAME = "KizmoTek Suite";
const START_URL = "https://ktek.on-nocom.net";

const GITHUB_OWNER = "prixmzz";
const GITHUB_REPO = "KizmoTek-Suite";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DOWNLOAD_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

function lockTitle(win) {
  win.setTitle(APP_NAME);
  win.on("page-title-updated", (e) => {
    e.preventDefault();
    win.setTitle(APP_NAME);
  });
}

function isNewer(latest, current) {
  const a = latest.split(".").map((n) => parseInt(n, 10));
  const b = current.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

async function checkForUpdate(win) {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { "User-Agent": `${GITHUB_OWNER}-${GITHUB_REPO}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const latest = String(data.tag_name || "").replace(/^v/i, "");
    const current = app.getVersion();

    if (latest && isNewer(latest, current)) {
      const choice = await dialog.showMessageBox(win, {
        type: "info",
        buttons: ["Download update", "Later"],
        defaultId: 0,
        title: "Update available",
        message: `Update available: ${latest}`,
        detail: `You have: ${current}\n\nClick Download to open GitHub releases.`,
      });

      if (choice.response === 0) shell.openExternal(DOWNLOAD_PAGE);
    }
  } catch {
  }
}

function loadLocalError(win, message) {
  if (win.__showingLocalError) return;
  win.__showingLocalError = true;

  try {
    win.webContents.stop();
  } catch {}

  const msg = encodeURIComponent(String(message || "Service unavailable"));
  win
    .loadFile(path.join(__dirname, "error.html"), { query: { msg } })
    .catch(() => {});
  lockTitle(win);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    show: true,

    autoHideMenuBar: true,
    title: APP_NAME,
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    backgroundColor: "#0b0f14",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  lockTitle(win);

  await win.loadFile(path.join(__dirname, "loading.html"));
  lockTitle(win);

  checkForUpdate(win);

  win.webContents.session.webRequest.onCompleted(
    { urls: ["https://ktek.on-nocom.net/*"] },
    (details) => {
      if (win.isDestroyed()) return;
      if (win.__showingLocalError) return;

      if (details.resourceType !== "mainFrame") return;

      const code = details.statusCode || 0;
      if ([502, 503, 504, 520, 521, 522, 523, 524].includes(code)) {
        loadLocalError(
          win,
          `KizmoTek Suite is temporarily down (HTTP ${code}).\n\n${details.url}`
        );
      }
    }
  );

  win.loadURL(START_URL).catch((e) => loadLocalError(win, e));

  win.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      if (win.__showingLocalError) return;
      loadLocalError(
        win,
        `${errorCode}: ${errorDescription}\n\n${validatedURL || START_URL}`
      );
    }
  );

  win.webContents.setWindowOpenHandler(() => ({ action: "allow" }));

  win.webContents.on("will-navigate", (event, url) => {
    const allow =
      url.startsWith("https://ktek.on-nocom.net") ||
      url.startsWith("https://discord.com") ||
      url.startsWith("https://discordapp.com");

    if (!allow) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
