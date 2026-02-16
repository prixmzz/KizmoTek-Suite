const { app, BrowserWindow, shell, session, dialog } = require("electron");

const { app, dialog, shell } = require("electron");

const GITHUB_OWNER = "YourUser"; 
const GITHUB_REPO  = "YourRepo"; 
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DOWNLOAD_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

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
        detail: `You have: ${current}\n\nClick Download to open the GitHub releases page.`
      });

      if (choice.response === 0) {
        shell.openExternal(DOWNLOAD_PAGE);
      }
    }
  } catch {
    
  }
}

module.exports = { checkForUpdate };

const APP_NAME = "KizmoTek Suite";
const START_URL = "https://ktek.on-nocom.net"; 
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: __dirname + "/../assets/icon.ico",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },

  });
 checkForUpdate(win)
 
  win.loadURL(START_URL);

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith("https://discord.com/");
    if (!allowed) {
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
