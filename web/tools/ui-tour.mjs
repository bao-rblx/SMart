#!/usr/bin/env node
/**
 * Đăng nhập bằng tài khoản mẫu rồi chụp ảnh từng màn hình.
 * Dùng để kiểm tra giao diện mà không cần mở trình duyệt bằng tay.
 *
 * Chạy: node tools/ui-tour.mjs [thư mục ảnh]
 */

import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { resolve } from "node:path";

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173/";
const OUT_DIR = resolve(process.argv[2] || ".screenshots");
const WIDTH = Number(process.env.WIDTH || 1440);
const HEIGHT = Number(process.env.HEIGHT || 900);
const SCHEME = process.env.SCHEME === "dark" ? "dark" : "light";

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error("Không tìm thấy Edge/Chrome.");

const port = 9500 + Math.floor(Math.random() * 300);
const profile = resolve(OUT_DIR, ".tour-" + Date.now());

const child = spawn(browser, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-background-networking",
  "--force-device-scale-factor=1",
  `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`,
  `--remote-debugging-port=${port}`, "about:blank"
], { stdio: ["ignore", "ignore", "ignore"] });

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chưa sẵn sàng */ }
    await sleep(150);
  }
  throw new Error("Không kết nối được DevTools.");
}

const socket = new WebSocket(await wsUrl());
const pending = new Map();
const problems = [];
let id = 0;

function send(method, params = {}) {
  const messageId = ++id;
  socket.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((done) => pending.set(messageId, done));
}

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data.result);
    pending.delete(data.id);
    return;
  }
  if (data.method === "Runtime.exceptionThrown") {
    const d = data.params.exceptionDetails;
    problems.push("EXCEPTION: " + (d.exception?.description ?? d.text));
  }
  if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") {
    problems.push("CONSOLE ERROR: " + data.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
  if (data.method === "Log.entryAdded" && data.params.entry.level === "error") {
    problems.push("LOG ERROR: " + data.params.entry.text + " — " + (data.params.entry.url || ""));
  }
});

await new Promise((done) => socket.addEventListener("open", done));
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: SCHEME }] });
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result?.exceptionDetails) {
    problems.push("EVAL: " + (result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
  }
  return result?.result?.value;
}

async function shot(name) {
  await sleep(500);
  const data = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  if (!data?.data) {
    problems.push("Không chụp được " + name);
    return;
  }
  const file = resolve(OUT_DIR, name + ".png");
  await fs.writeFile(file, Buffer.from(data.data, "base64"));
  const stat = await fs.stat(file);
  console.log(`  ✓ ${name}.png (${Math.round(stat.size / 1024)} KB)`);
}

async function waitFor(expression, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await sleep(180);
  }
  problems.push("HẾT THỜI GIAN chờ: " + label);
  return false;
}

/** Đăng nhập bằng cách gõ vào ô như người dùng thật. */
async function signIn(username, password) {
  await evaluate(`
    (() => {
      const inputs = [...document.querySelectorAll('input')];
      const user = inputs.find((i) => i.type === 'text' || i.type === 'email' || i.name === 'username' || i.getAttribute('autocomplete') === 'username');
      const pass = inputs.find((i) => i.type === 'password');
      if (!user || !pass) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(user, ${JSON.stringify(username)});
      user.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(pass, ${JSON.stringify(password)});
      pass.dispatchEvent(new Event('input', { bubbles: true }));
      const button = [...document.querySelectorAll('button')].find((b) => /vào cửa hàng|đăng nhập/i.test(b.textContent));
      if (button) button.click();
      return true;
    })()
  `);
}

console.log("\nSmartMart · kiểm tra giao diện (" + SCHEME + ", " + WIDTH + "×" + HEIGHT + ")");

await send("Page.navigate", { url: BASE });
await waitFor("Boolean(document.querySelector('.auth'))", "màn hình đăng nhập");
await shot("01-login");

await signIn("admin", "admin");
if (await waitFor("Boolean(document.querySelector('.rail'))", "khung ứng dụng sau đăng nhập")) {
  await sleep(900);
  await shot("02-checkout");

  const screens = [
    ["Kho hàng", "03-inventory"],
    ["Doanh thu", "04-reports"],
    ["Nhân sự", "05-users"]
  ];
  for (const [label, file] of screens) {
    await evaluate(`
      (() => {
        const link = [...document.querySelectorAll('.rail__link')].find((b) => b.textContent.includes(${JSON.stringify(label)}));
        if (link) link.click();
        return Boolean(link);
      })()
    `);
    await waitFor("Boolean(document.querySelector('#workspace .view'))", label);
    await sleep(700);
    await shot(file);
  }

  // Thêm một món vào giỏ rồi mở hộp thoại thanh toán.
  await evaluate(`
    (() => {
      const link = [...document.querySelectorAll('.rail__link')].find((b) => b.textContent.includes('Bán hàng'));
      if (link) link.click();
      return true;
    })()
  `);
  await sleep(600);
  // Phải bấm đúng nút "+" trên thẻ, không phải cả thẻ (nút thêm nằm riêng).
  const added = await evaluate(`
    (() => {
      const button = document.querySelector('.ct-card__add') || document.querySelector('[class*="ct-card"] [class*="add"]');
      if (!button) return false;
      button.click();
      return true;
    })()
  `);
  if (added) {
    await sleep(700);
    await shot("06-cart-filled");
    await evaluate(`
      (() => {
        const button = [...document.querySelectorAll('button')].find(
          (b) => /thanh toán/i.test(b.textContent) && !b.disabled
        );
        if (button) button.click();
        return Boolean(button);
      })()
    `);
    if (await waitFor("Boolean(document.querySelector('.modal'))", "hộp thoại thanh toán")) {
      await shot("07-payment");
      await evaluate("document.querySelector('.modal__foot .btn--primary')?.click()");
      await waitFor("Boolean(document.querySelector('.modal'))", "hóa đơn");
      await shot("08-receipt");
    }
  }

  // Mở hộp cài đặt.
  await evaluate("document.querySelector('[title*=\"Cài đặt\"]')?.click()");
  if (await waitFor("Boolean(document.querySelector('.modal'))", "hộp cài đặt")) await shot("09-settings");
}

// Kiểm tra chế độ tối ở màn hình bán hàng.
await evaluate("document.querySelectorAll('.modal__close').forEach((b) => b.click())");
await sleep(400);
await evaluate(`
  (() => {
    document.documentElement.dataset.theme = ${JSON.stringify(SCHEME === "dark" ? "dark" : "dark")};
    return true;
  })()
`);
await sleep(700);
await shot("10-dark-mode");

socket.close();
child.kill();
try { await fs.rm(profile, { recursive: true, force: true }); } catch { /* bỏ qua */ }

console.log("\n=== VẤN ĐỀ PHÁT HIỆN ===");
console.log(problems.length ? problems.join("\n") : "(không có lỗi)");