#!/usr/bin/env node
/**
 * Máy chủ tĩnh tối giản cho SmartMart Web.
 * Chỉ dùng thư viện chuẩn của Node — không cần cài thêm gói nào.
 *
 * Chạy:  npm run dev    (hoặc)   node tools/serve.mjs
 * Mặc định: http://localhost:5173
 */

import { createServer } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

/** Chặn truy cập ra ngoài thư mục web/ */
function resolveSafe(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const target = normalize(join(ROOT, clean));
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep) && target !== ROOT.slice(0, -1)) {
    return null;
  }
  return target;
}

const server = createServer(async (req, res) => {
  try {
    let filePath = resolveSafe(req.url || "/");
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("403 — Đường dẫn không hợp lệ.");
      return;
    }

    let stat = await fs.stat(filePath).catch(() => null);
    if (stat?.isDirectory()) {
      filePath = join(filePath, "index.html");
      stat = await fs.stat(filePath).catch(() => null);
    }

    // Chỉ trả index.html cho đường dẫn điều hướng (không có phần mở rộng tệp).
    // Tệp thiếu phải trả 404 để lỗi CSS/JS hiện ra rõ ràng.
    const looksLikeAsset = extname(filePath) !== "";
    if (!stat && !looksLikeAsset) {
      filePath = join(ROOT, "index.html");
      stat = await fs.stat(filePath).catch(() => null);
      if (!stat) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 — Không tìm thấy trang.");
        return;
      }
    } else if (!stat) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — Không tìm thấy tệp: " + (req.url || ""));
      return;
    }

    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 — " + (error?.message || "Lỗi máy chủ."));
  }
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  SmartMart · máy chủ phát triển");
  console.log("  →  http://" + HOST + ":" + PORT);
  console.log("  Nhấn Ctrl+C để dừng.");
  console.log("");
});