#!/usr/bin/env node
/**
 * Mở trang trong Edge headless, bắt toàn bộ lỗi console và lỗi mạng.
 * Dùng khi giao diện không hiện ra và cần biết vì sao.
 *
 * Chạy: node tools/debug-console.mjs [url] [waitMs]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

const url = process.argv[2] || "http://127.0.0.1:5173/";
const waitMs = Number(process.argv[3] || 4000);
const port = 9333 + Math.floor(Math.random() * 200);

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error("Không tìm thấy Edge/Chrome.");

const profile = resolve(".screenshots", ".dbg-" + Date.now());
const child = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  "about:blank"
], { stdio: ["ignore", "ignore", "ignore"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* chưa sẵn sàng */
    }
    await sleep(150);
  }
  throw new Error("Không kết nối được DevTools.");
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const logs = [];

function send(method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((done) => pending.set(messageId, done));
}

ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data.result);
    pending.delete(data.id);
    return;
  }
  if (data.method === "Runtime.consoleAPICalled") {
    const text = data.params.args.map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
    logs.push(`[${data.params.type}] ${text}`);
  }
  if (data.method === "Runtime.exceptionThrown") {
    const d = data.params.exceptionDetails;
    logs.push(`[exception] ${d.exception?.description ?? d.text}`);
  }
  if (data.method === "Log.entryAdded") {
    const e = data.params.entry;
    logs.push(`[log:${e.level}] ${e.text}${e.url ? " — " + e.url : ""}`);
  }
  if (data.method === "Network.loadingFailed") {
    logs.push(`[network-fail] ${data.params.errorText}`);
  }
});

await new Promise((done) => ws.addEventListener("open", done));
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(waitMs);

const bodyText = await send("Runtime.evaluate", {
  expression: "document.getElementById('app')?.innerText?.slice(0, 400) ?? 'NO #app'",
  returnByValue: true
});

const shot = await send("Page.captureScreenshot", { format: "png" });
if (shot?.data) {
  const { promises: fs } = await import("node:fs");
  await fs.writeFile(resolve(".screenshots", "debug.png"), Buffer.from(shot.data, "base64"));
}

console.log("=== NỘI DUNG #app ===");
console.log(bodyText?.result?.value ?? "(rỗng)");
console.log("\n=== CONSOLE / LỖI ===");
console.log(logs.length ? logs.join("\n") : "(không có)");

ws.close();
child.kill();
