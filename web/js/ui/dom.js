/**
 * SmartMart · Tiện ích DOM
 * ---------------------------------------------------------------------------
 * Toàn bộ ứng dụng dựng giao diện bằng các hàm ở đây thay vì innerHTML.
 * Lý do: chặn XSS từ tên sản phẩm do người dùng nhập, và giữ code dễ đọc.
 *
 * Ký hiệu dùng trong toàn bộ tài liệu:
 *   el("div", { class: "card" }, "Xin chào")
 *   el("button", { class: "btn", onClick: () => save() }, icon("save"), "Lưu")
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Tạo một phần tử.
 *
 * @param {string} tag            Tên thẻ, ví dụ "div", "button", "svg:path".
 * @param {object} [props]        Thuộc tính: class, id, style, dataset, aria-*, on*.
 * @param {...any} children       Chuỗi, số, Node, hoặc mảng (lồng nhau tuỳ ý).
 * @returns {HTMLElement|SVGElement}
 */
export function el(tag, props = null, ...children) {
  const isSvg = tag.startsWith("svg:");
  const element = isSvg
    ? document.createElementNS(SVG_NS, tag.slice(4))
    : document.createElement(tag);

  if (props && typeof props === "object" && !(props instanceof Node)) {
    applyProps(element, props);
  } else if (props != null) {
    children.unshift(props);
  }

  append(element, children);
  return element;
}

/** Gắn thuộc tính, sự kiện và style vào phần tử. */
export function applyProps(element, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "class" || key === "className") {
      element.setAttribute("class", Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value));
    } else if (key === "style" && typeof value === "object") {
      Object.assign(element.style, value);
    } else if (key === "dataset" && typeof value === "object") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue !== null && dataValue !== undefined) element.dataset[dataKey] = String(dataValue);
      }
    } else if (key === "html") {
      // Chỉ dùng cho nội dung tin cậy (ví dụ khối SVG có sẵn trong mã nguồn).
      element.innerHTML = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else if (key === "value" && "value" in element) {
      element.value = value;
    } else if (key === "checked" || key === "selected" || key === "disabled" || key === "readOnly" || key === "multiple") {
      element[key] = Boolean(value);
    } else if (key === "ref" && typeof value === "function") {
      value(element);
    } else {
      element.setAttribute(key, String(value));
    }
  }
  return element;
}

/** Thêm con vào phần tử, tự làm phẳng mảng và bỏ qua giá trị rỗng. */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === "") continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Xoá sạch con của một phần tử. */
export function clear(element) {
  if (!element) return element;
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

/** Thay toàn bộ nội dung bằng các node mới. */
export function replace(element, ...children) {
  if (!element) return element;
  clear(element);
  append(element, children);
  return element;
}

/** Truy vấn một phần tử. */
export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

/** Truy vấn nhiều phần tử, trả về mảng thật. */
export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/** Gắn nhiều lớp CSS có điều kiện. */
export function classNames(...values) {
  return values
    .flat(Infinity)
    .filter(Boolean)
    .join(" ");
}

/**
 * Gắn sự kiện theo uỷ quyền: một listener cho cả danh sách động.
 * Trả về hàm huỷ gắn.
 */
export function delegate(root, eventName, selector, handler) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(eventName, listener);
  return () => root.removeEventListener(eventName, listener);
}

/** Gắn sự kiện và trả về hàm huỷ gắn. */
export function on(target, eventName, handler, options) {
  target.addEventListener(eventName, handler, options);
  return () => target.removeEventListener(eventName, handler, options);
}

/** Bật/tắt một lớp CSS. */
export function toggleClass(element, className, force) {
  if (!element) return element;
  element.classList.toggle(className, force);
  return element;
}

/** Đặt text an toàn (không hiểu HTML). */
export function setText(element, text) {
  if (element) element.textContent = text == null ? "" : String(text);
  return element;
}

/** Đặt thuộc tính aria. */
export function setAria(element, name, value) {
  if (!element) return element;
  if (value === null || value === undefined || value === false) element.removeAttribute("aria-" + name);
  else element.setAttribute("aria-" + name, String(value));
  return element;
}

/** Chờ khung hình kế tiếp — dùng trước khi đo kích thước. */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Trì hoãn gọi hàm tới khi người dùng ngừng thao tác. */
export function debounce(fn, delay = 180) {
  let timer = 0;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** Trì hoãn nhưng vẫn gọi đều đặn trong lúc thao tác (dùng cho ô tìm kiếm). */
export function throttle(fn, interval = 120) {
  let last = 0;
  let timer = 0;
  return (...args) => {
    const now = Date.now();
    const remaining = interval - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

/** Cuộn phần tử vào vùng nhìn thấy mà không làm nhảy cả trang. */
export function scrollIntoViewIfNeeded(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (!inView) element.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** Đặt tiêu điểm an toàn. */
export function focus(element, options) {
  if (element && typeof element.focus === "function") element.focus(options);
  return element;
}

/** Tạo phần tử từ chuỗi HTML — chỉ dùng cho khối SVG tin cậy trong mã nguồn. */
export function fromHTML(markup) {
  const template = document.createElement("template");
  template.innerHTML = String(markup).trim();
  return template.content.firstElementChild;
}

/** Chuyển đổi giá trị nhập thành số, trả về null nếu không hợp lệ. */
export function parseNumberInput(value) {
  const cleaned = String(value ?? "").replace(/[^\d-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}
