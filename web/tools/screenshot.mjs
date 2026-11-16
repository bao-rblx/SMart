#!/usr/bin/env node
/**
 * Chụp ảnh giao diện bằng Edge/Chrome headless.
 * Dùng để tự kiểm tra giao diện mà không cần mở trình duyệt bằng tay.
 *
 * Chạy:  node tools/screenshot.mjs [url] [outfile] [width] [height] [waitMs]
 * Ví dụ: node tools/screenshot.mjs http://127.0.0.1:5173/ .screenshots/login.png 1440 900 900
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];

function findBrowser() {
  for (const candidate of CANDIDATES) if (existsSync(candidate)) return candidate;
  throw new Error("Không tìm thấy Edge hoặc Chrome để chụp ảnh.");
}

const url = process.argv[2] || "http://127.0.0.1:5173/";
const outArg = process.argv[3] || ".screenshots/screen.png";
const width = Number(process.argv[4] || 1440);
const height = Number(process.argv[5] || 900);
const waitMs = Number(process.argv[6] || 1200);
// "light" hoặc "dark": ép trình duyệt dùng đúng chế độ màu để ảnh chụp ổn định.
const scheme = process.env.SCHEME === "dark" ? "dark" : "light";

const outFile = resolve(ROOT, outArg);
await fs.mkdir(dirname(outFile), { recursive: true });
if (existsSync(outFile)) await fs.unlink(outFile);

const browser = findBrowser();
const profile = resolve(ROOT, ".screenshots", ".profile-" + Date.now());
// Cổng gỡ lỗi riêng để điều khiển trình duyệt qua CDP.
const port = 9400 + Math.floor(Math.random() * 400);

const args = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--force-device-scale-factor=1",
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  `--remote-debugging-port=${port}`,
  "about:blank"
];

const child = spawn(browser, args, { stdio: ["ignore", "ignore", "ignore"] });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Chờ DevTools sẵn sàng rồi trả về WebSocket của tab. */
async function connect() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* DevTools chưa mở cổng — thử lại */
    }
    await sleep(150);
  }
  throw new Error("Không kết nối được DevTools của trình duyệt.");
}

const socket = new WebSocket(await connect());
const pending = new Map();
let messageId = 0;

function send(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((done) => pending.set(id, done));
}

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data.result);
    pending.delete(data.id);
  }
});

await new Promise((done) => socket.addEventListener("open", done));
await send("Page.enable");
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: scheme }]
});
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false
});
await send("Page.navigate", { url });

// Chờ giao diện dựng xong: #app phải có nội dung thật, không chỉ có màn hình chờ.
const deadline = Date.now() + waitMs;
while (Date.now() < deadline) {
  await sleep(200);
  const probe = await send("Runtime.evaluate", {
    expression: "Boolean(document.querySelector('#app .boot') === null && document.getElementById('app').children.length > 0)",
    returnByValue: true
  });
  if (probe?.result?.value === true) break;
}
await sleep(400);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
socket.close();
child.kill();

if (!shot?.data) {
  console.error("Không chụp được ảnh.");
  process.exit(1);
}

await fs.writeFile(outFile, Buffer.from(shot.data, "base64"));

try {
  await fs.rm(profile, { recursive: true, force: true });
} catch {
  /* thư mục tạm bị khoá — bỏ qua */
}

const stat = await fs.stat(outFile);
console.log(`Đã lưu ${outArg} (${Math.round(stat.size / 1024)} KB, ${width}×${height})`);