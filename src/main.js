const { app, BrowserWindow, shell, dialog, nativeTheme } = require("electron");
const path = require("path");

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
app.commandLine.appendSwitch(
	"enable-features",
	"VaapiVideoDecoder,CanvasOopRasterization,CalculateNativeWinOcclusion"
);

const APP_NAME = "KizmoTek Suite";
const START_URL = "https://ktek.on-nocom.net";
const GITHUB_OWNER = "prixmzz";
const GITHUB_REPO = "KizmoTek-Suite";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DOWNLOAD_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let mainWindow = null;
let isQuitting = false;

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
				cancelId: 1,
				title: "Update available",
				message: `Update available: ${latest}`,
				detail: `Current version: ${current}`,
				noLink: true,
			});

			if (choice.response === 0) shell.openExternal(DOWNLOAD_PAGE);
		}
	} catch { }
}

function loadLocalError(win, message) {
	if (win.__showingLocalError) return;
	win.__showingLocalError = true;
	try {
		win.webContents.stop();
	} catch { }
	const msg = encodeURIComponent(String(message || "Service unavailable"));
	win.loadFile(path.join(__dirname, "error.html"), { query: { msg } }).catch(() => { });
	lockTitle(win);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		show: false,
		autoHideMenuBar: true,
		title: APP_NAME,
		icon: path.join(__dirname, "..", "assets", "icon.ico"),
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0f14" : "#ffffff",
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			backgroundThrottling: true,
			spellcheck: false,
			enableBlinkFeatures: "CSSBackdropFilter,Accelerated2dCanvas",
		},
	});

	lockTitle(mainWindow);

	mainWindow.once("ready-to-show", () => {
		if (!mainWindow) return;
		mainWindow.show();
		mainWindow.focus();
	});

	mainWindow.on("close", (e) => {
		if (!isQuitting) {
			e.preventDefault();
			mainWindow.hide();
		}
	});

	mainWindow.on("blur", () => {
		if (mainWindow) mainWindow.webContents.setBackgroundThrottling(true);
	});

	mainWindow.on("focus", () => {
		if (mainWindow) mainWindow.webContents.setBackgroundThrottling(false);
	});

	mainWindow.webContents.on("render-process-gone", () => {
		if (!mainWindow) return;
		mainWindow.reload();
	});

	mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

	mainWindow.webContents.on("will-navigate", (event, url) => {
		const allow =
			url.startsWith("https://ktek.on-nocom.net") ||
			url.startsWith("https://discord.com") ||
			url.startsWith("https://discordapp.com");
		if (!allow) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});

	mainWindow.webContents.session.webRequest.onBeforeRequest(
		{ urls: ["*://*/*"] },
		(details, callback) => {
			if (["media", "object"].includes(details.resourceType)) {
				return callback({ cancel: true });
			}
			callback({});
		}
	);

	mainWindow.webContents.session.webRequest.onCompleted(
		{ urls: ["https://ktek.on-nocom.net/*"] },
		(details) => {
			if (
				!mainWindow ||
				mainWindow.isDestroyed() ||
				mainWindow.__showingLocalError ||
				details.resourceType !== "mainFrame"
			)
				return;

			const code = details.statusCode || 0;
			if ([502, 503, 504, 520, 521, 522, 523, 524].includes(code)) {
				loadLocalError(
					mainWindow,
					`KizmoTek Suite is temporarily unavailable (HTTP ${code}).`
				);
			}
		}
	);

	mainWindow.webContents.on(
		"did-fail-load",
		(event, errorCode, errorDescription, validatedURL, isMainFrame) => {
			if (!isMainFrame || mainWindow.__showingLocalError) return;
			loadLocalError(
				mainWindow,
				`${errorCode}: ${errorDescription}\n${validatedURL || START_URL}`
			);
		}
	);

	mainWindow.loadURL(START_URL).catch((e) => loadLocalError(mainWindow, e));

	checkForUpdate(mainWindow);

	return mainWindow;
}

app.whenReady().then(() => {
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("browser-window-created", (_, window) => {
	const pid = window.webContents.getOSProcessId();
	try {
		process.setPriority(pid, process.PRIORITY_BELOW_NORMAL);
	} catch { }
});

app.on("before-quit", () => {
	isQuitting = true;
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});