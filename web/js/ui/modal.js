/**
 * SmartMart · Hộp thoại
 * ---------------------------------------------------------------------------
 * Một chỗ duy nhất quản lý lớp phủ, tiêu điểm bàn phím và phím Escape.
 * Mọi hàm trả Promise để nơi gọi viết được theo kiểu tuần tự.
 */

import { el, clear, focus, nextFrame } from "./dom.js";
import { icon } from "./icons.js";

let host = null;
let stack = [];

function root() {
  if (host && host.isConnected) return host;
  host = document.getElementById("modal-root");
  if (!host) {
    host = el("div", { id: "modal-root", class: "modal-root" });
    document.body.append(host);
  }
  return host;
}

/**
 * Mở một hộp thoại tuỳ biến.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {Node|Node[]} options.content
 * @param {Array<{label:string, kind?:string, onClick?:Function, close?:boolean}>} [options.actions]
 * @param {"sm"|"md"|"lg"|"xl"} [options.size]
 * @param {boolean} [options.dismissable]
 * @param {Function} [options.onOpen]
 * @returns {{close: (result?: any) => void, element: HTMLElement, result: Promise<any>}}
 */
export function openModal(options = {}) {
  const {
    title = "",
    content = null,
    actions = [],
    size = "md",
    dismissable = true,
    onOpen = null,
    iconName = null,
    tone = "default"
  } = options;

  const hostElement = root();
  let settle;
  const result = new Promise((resolve) => {
    settle = resolve;
  });

  const footer = actions.length
    ? el(
        "footer",
        { class: "modal__foot" },
        actions.map((action) =>
          el(
            "button",
            {
              type: "button",
              class: `btn ${action.kind === "primary" ? "btn--primary" : action.kind === "danger" ? "btn--danger" : action.kind === "ghost" ? "btn--ghost" : ""}`,
              onClick: async (event) => {
                const button = event.currentTarget;
                if (typeof action.onClick === "function") {
                  const keep = await action.onClick({ close: (value) => close(value), button });
                  if (keep === false) return;
                }
                if (action.close !== false) close(action.value);
              }
            },
            action.label
          )
        )
      )
    : null;

  const dialog = el(
    "div",
    {
      class: `modal modal--${size} modal--${tone}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title || "Hộp thoại"
    },
    el(
      "header",
      { class: "modal__head" },
      iconName ? el("span", { class: "modal__icon" }, icon(iconName, { size: 18 })) : null,
      el("h2", { class: "modal__title" }, title),
      dismissable
        ? el(
            "button",
            { type: "button", class: "btn btn--ghost btn--icon btn--sm modal__close", "aria-label": "Đóng", onClick: () => close() },
            icon("close", { size: 16 })
          )
        : null
    ),
    el("div", { class: "modal__body scroll-area" }, content),
    footer
  );

  const backdrop = el(
    "div",
    {
      class: "modal-backdrop",
      onMousedown: (event) => {
        if (dismissable && event.target === backdrop) close();
      }
    },
    dialog
  );

  const previousFocus = document.activeElement;
  hostElement.append(backdrop);
  document.body.dataset.modal = "open";

  function close(value) {
    const index = stack.indexOf(entry);
    if (index < 0) return;
    stack.splice(index, 1);
    backdrop.classList.add("modal-backdrop--out");
    const remove = () => backdrop.remove();
    backdrop.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, 300);
    if (stack.length === 0) delete document.body.dataset.modal;
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus({ preventScroll: true });
    settle(value);
  }

  const entry = {
    close,
    element: dialog,
    result,
    onEscape: () => (dismissable ? close() : null)
  };
  stack.push(entry);

  nextFrame().then(() => {
    backdrop.classList.add("modal-backdrop--in");
    const first = dialog.querySelector("[data-autofocus], input, select, textarea, button.btn--primary") || dialog;
    focus(first, { preventScroll: true });
    if (typeof onOpen === "function") onOpen({ close, element: dialog });
  });

  return entry;
}

/**
 * Hộp thoại xác nhận. Trả về true nếu người dùng đồng ý.
 */
export function confirmDialog(options = {}) {
  const {
    title = "Xác nhận",
    message = "",
    confirmLabel = "Đồng ý",
    cancelLabel = "Hủy",
    tone = "default"
  } = typeof options === "string" ? { message: options } : options;

  let settle;
  const answer = new Promise((resolve) => {
    settle = resolve;
  });

  const dialog = openModal({
    title,
    size: "sm",
    iconName: tone === "danger" ? "alert" : "info",
    tone,
    content: el("p", { class: "modal__message" }, message),
    actions: [
      { label: cancelLabel, kind: "ghost", value: false },
      { label: confirmLabel, kind: tone === "danger" ? "danger-solid" : "primary", value: true }
    ]
  });

  dialog.result.then((value) => settle(value === true));
  return answer;
}

/**
 * Hộp thoại nhập một giá trị văn bản hoặc số.
 * Trả về chuỗi đã nhập, hoặc null nếu huỷ.
 */
export function promptDialog(options = {}) {
  const {
    title = "Nhập thông tin",
    label = "",
    value = "",
    placeholder = "",
    type = "text",
    hint = "",
    confirmLabel = "Lưu",
    min,
    max,
    step
  } = options;

  const input = el("input", {
    class: "input",
    type,
    value: value === null || value === undefined ? "" : String(value),
    placeholder,
    "data-autofocus": "true",
    min: min ?? null,
    max: max ?? null,
    step: step ?? null
  });

  const error = el("p", { class: "field__error is-hidden" });
  const field = el(
    "label",
    { class: "field" },
    label ? el("span", { class: "field__label" }, label) : null,
    input,
    hint ? el("span", { class: "field__hint" }, hint) : null,
    error
  );

  let submitted = null;

  const dialog = openModal({
    title,
    size: "sm",
    content: el("form", { onSubmit: (event) => event.preventDefault() }, field),
    actions: [
      { label: "Hủy", kind: "ghost", value: null },
      {
        label: confirmLabel,
        kind: "primary",
        // Trả false để giữ hộp thoại mở khi dữ liệu chưa hợp lệ.
        onClick: () => {
          const raw = input.value.trim();
          if (type === "number") {
            const number = Number(raw);
            const message =
              raw === "" || Number.isNaN(number)
                ? "Hãy nhập một con số hợp lệ."
                : min !== undefined && number < min
                  ? `Giá trị nhỏ nhất là ${min}.`
                  : max !== undefined && number > max
                    ? `Giá trị lớn nhất là ${max}.`
                    : null;
            if (message) {
              error.textContent = message;
              error.classList.remove("is-hidden");
              input.focus();
              input.select();
              return false;
            }
            submitted = number;
            return true;
          }
          submitted = raw;
          return true;
        },
        value: true
      }
    ],
    onOpen: () => {
      input.focus();
      input.select();
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          dialog.element.querySelector(".modal__foot .btn--primary")?.click();
        }
      });
    }
  });

  // Hộp thoại trả true khi bấm nút xác nhận, null khi huỷ.
  return dialog.result.then((result) => (result === true ? submitted : null));
}

/** Đóng hộp thoại trên cùng. */
export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (top) top.onEscape();
  return Boolean(top);
}

/** Có hộp thoại nào đang mở không. */
export function hasOpenModal() {
  return stack.length > 0;
}

/** Bộ điều khiển dùng trong context của view. */
export const modal = {
  open: openModal,
  confirm: confirmDialog,
  prompt: promptDialog,
  closeTop: closeTopModal,
  get isOpen() {
    return hasOpenModal();
  }
};

// Phím Escape đóng hộp thoại trên cùng — gắn một lần cho cả ứng dụng.
if (typeof document !== "undefined") {
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && hasOpenModal()) {
        event.preventDefault();
        closeTopModal();
      }
    },
    true
  );
}

/** Xoá toàn bộ (dùng khi đăng xuất). */
export function closeAllModals() {
  while (stack.length > 0) stack[stack.length - 1].close();
  if (host) clear(host);
}