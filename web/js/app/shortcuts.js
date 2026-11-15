/**
 * SmartMart · Phím tắt
 * ---------------------------------------------------------------------------
 * Bảng phím tắt hiển thị trong hộp thoại "Phím tắt" (bấm ?).
 * Chỉ kích hoạt khi không gõ trong ô nhập và không có hộp thoại mở.
 */

import { el } from "../ui/dom.js";
import { icon } from "../ui/icons.js";

const registry = new Map();
let enabled = true;

/**
 * Đăng ký một phím tắt toàn cục.
 * @param {string} combo  Ví dụ "ctrl+k", "f9", "?", "/"
 * @param {string} label  Mô tả tiếng Việt
 * @param {Function} handler
 * @param {{when?: () => boolean}} [options]
 */
export function registerShortcut(combo, label, handler, options = {}) {
  registry.set(combo.toLowerCase(), { combo, label, handler, when: options.when ?? (() => true) });
  return () => registry.delete(combo.toLowerCase());
}

export function listShortcuts() {
  return [...registry.values()].map(({ combo, label }) => ({ combo, label }));
}

export function setShortcutsEnabled(value) {
  enabled = Boolean(value);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function normalizeEvent(event) {
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey && event.key.length > 1) parts.push("shift");
  const key = event.key === " " ? "space" : event.key.toLowerCase();
  parts.push(key);
  return parts.join("+");
}

/** Gắn bộ lắng nghe toàn cục. Gọi một lần lúc khởi động. */
export function installShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (!enabled) return;
    if (document.body.dataset.modal === "open") return;

    const combo = normalizeEvent(event);
    const entry = registry.get(combo);
    if (!entry) return;

    // Phím tắt có Ctrl/Alt/Meta luôn chạy được; phím đơn thì bỏ qua khi đang gõ.
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
    if (!hasModifier && isTypingTarget(event.target)) return;
    if (event.key === "Escape") return;
    if (!entry.when()) return;

    event.preventDefault();
    entry.handler(event);
  });
}

/** Nội dung hộp thoại phím tắt. */
export function shortcutsPanel() {
  const rows = listShortcuts().map(({ combo, label }) =>
    el(
      "div",
      { class: "shortcut-row" },
      el("span", { class: "shortcut-row__label" }, label),
      el(
        "span",
        { class: "shortcut-row__keys" },
        combo.split("+").map((key) =>
          el("kbd", { class: "kbd" }, key === "ctrl" ? "Ctrl" : key === "space" ? "Space" : key.toUpperCase())
        )
      )
    )
  );
  return el(
    "div",
    { class: "shortcut-list" },
    el(
      "p",
      { class: "shortcut-note" },
      icon("info", { size: 14 }),
      "Phím tắt chỉ hoạt động khi bạn không gõ trong ô nhập liệu."
    ),
    ...rows
  );
}
