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
  const a = latest.split(".").map(n => parseInt(n, 10));
  const b = current.split(".").map(n => parseInt(n, 10));
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
      headers: { "User-Agent": `${GITHUB_OWNER}-${GITHUB_REPO}` }
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
        detail: `You have: ${current}\n\nClick Download to open GitHub releases.`
      });

      if (choice.response === 0) shell.openExternal(DOWNLOAD_PAGE);
    }
  } catch {
    // ignore
  }
}

function loadErrorPage(win, err) {
  const msg = encodeURIComponent(String(err || "Unknown error"));
  win.loadFile(path.join(__dirname, "error.html"), { query: { msg } }).catch(() => {});
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    // SHOW IMMEDIATELY so it doesn’t feel “frozen”
    show: true,

    autoHideMenuBar: true,
    title: APP_NAME,
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    backgroundColor: "#0b0f14",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  lockTitle(win);

  // Show an instant local loading UI (fast)
  await win.loadFile(path.join(__dirname, "loading.html"));
  lockTitle(win);

  // Update check in the background (doesn’t block page load)
  checkForUpdate(win);

  // Load the site
  win.loadURL(START_URL).catch((e) => loadErrorPage(win, e));

  // If main frame fails, show error page
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    loadErrorPage(win, `${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  // Keep OAuth/popups working: allow popups inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    // If you want *everything* external, switch this to shell.openExternal + deny.
    return { action: "allow" };
  });

  // Allow your site + Discord. Open everything else externally.
  win.webContents.on("will-navigate", (event, url) => {
    const allow =
      url.startsWith(START_URL) ||
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
