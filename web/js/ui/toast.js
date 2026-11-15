/**
 * SmartMart · Thông báo nổi (toast)
 * ---------------------------------------------------------------------------
 * Thông báo ngắn, tự biến mất, xếp chồng ở góc dưới bên phải.
 * Hàm toast.* trả về id để có thể đóng sớm.
 */

import { el } from "./dom.js";
import { icon } from "./icons.js";

const ICONS = { success: "check", error: "alert", info: "info", warning: "alert" };
const MAX_VISIBLE = 4;
let container = null;

function root() {
  if (container && container.isConnected) return container;
  container = document.getElementById("toast-root");
  if (!container) {
    container = el("div", { id: "toast-root", class: "toast-root", role: "status", "aria-live": "polite" });
    document.body.append(container);
  }
  return container;
}

/**
 * Hiện một thông báo.
 *
 * @param {string} message  Nội dung tiếng Việt.
 * @param {object} [options]
 * @param {"success"|"error"|"info"|"warning"} [options.type]
 * @param {number} [options.duration]  Thời gian hiện (ms). 0 = phải tự đóng.
 * @param {string} [options.detail]    Dòng phụ nhỏ hơn.
 * @param {{label: string, onClick: Function}} [options.action] Nút hành động.
 * @returns {string} id của toast
 */
export function showToast(message, options = {}) {
  const { type = "info", duration = 3600, detail = "", action = null } = options;
  const host = root();
  const id = "toast-" + Math.random().toString(36).slice(2, 9);

  const node = el(
    "div",
    { class: `toast toast--${type}`, id, role: type === "error" ? "alert" : "status" },
    el("span", { class: "toast__icon" }, icon(ICONS[type] ?? "info", { size: 17 })),
    el(
      "div",
      { class: "toast__body" },
      el("p", { class: "toast__message" }, message),
      detail ? el("p", { class: "toast__detail" }, detail) : null
    ),
    action
      ? el(
          "button",
          {
            class: "toast__action",
            type: "button",
            onClick: () => {
              action.onClick();
              dismiss(id);
            }
          },
          action.label
        )
      : null,
    el(
      "button",
      { class: "toast__close", type: "button", "aria-label": "Đóng thông báo", onClick: () => dismiss(id) },
      icon("close", { size: 14 })
    )
  );

  host.append(node);
  trimOverflow();

  if (duration > 0) {
    node._timer = setTimeout(() => dismiss(id), duration);
    node.addEventListener("mouseenter", () => clearTimeout(node._timer));
    node.addEventListener("mouseleave", () => {
      node._timer = setTimeout(() => dismiss(id), 1400);
    });
  }

  return id;
}

/** Đóng một toast theo id. */
export function dismiss(id) {
  const node = document.getElementById(id);
  if (!node) return;
  clearTimeout(node._timer);
  node.classList.add("toast--out");
  const remove = () => node.remove();
  node.addEventListener("animationend", remove, { once: true });
  setTimeout(remove, 400);
}

/** Đóng toàn bộ toast đang hiện. */
export function dismissAll() {
  root()
    .querySelectorAll(".toast")
    .forEach((node) => dismiss(node.id));
}

function trimOverflow() {
  const host = root();
  const items = host.querySelectorAll(".toast:not(.toast--out)");
  if (items.length <= MAX_VISIBLE) return;
  for (let index = 0; index < items.length - MAX_VISIBLE; index += 1) {
    dismiss(items[index].id);
  }
}

/** Bộ hàm tiện dụng: toast.success("Đã lưu") */
export const toast = {
  success: (message, options) => showToast(message, { ...options, type: "success" }),
  error: (message, options) => showToast(message, { ...options, type: "error", duration: 5200 }),
  info: (message, options) => showToast(message, { ...options, type: "info" }),
  warning: (message, options) => showToast(message, { ...options, type: "warning", duration: 4600 })
};
