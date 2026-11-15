/**
 * SmartMart · Bộ biểu tượng
 * ---------------------------------------------------------------------------
 * SVG nội tuyến, nét 1.8, kích thước 24. Không tải từ mạng — chạy offline.
 */

import { el } from "./dom.js";

const PATHS = {
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2.5 3.5h2.6l2.4 11.2h11l2-8.2H6"/>',
  box: '<path d="M21 8.5v7a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4a2 2 0 0 1-1-1.7v-7a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7Z"/><path d="m3.3 7.4 8.7 5 8.7-5"/><path d="M12 12.4V21"/>',
  chart: '<path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21"/><path d="M7.5 15.5 11 11l3.5 3 4.5-6"/>',
  users: '<path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.6"/><path d="M22 20v-1.6a4 4 0 0 0-3-3.86"/><path d="M16.5 3.5a3.6 3.6 0 0 1 0 7"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5v-1.2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1.2"/>',
  search: '<circle cx="10.8" cy="10.8" r="7.2"/><path d="m20.5 20.5-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  logout: '<path d="M9.5 21H5.5A2 2 0 0 1 3.5 19V5a2 2 0 0 1 2-2h4"/><path d="m16 16 4.5-4L16 8"/><path d="M20.5 12H9"/>',
  moon: '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  alert: '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 1.9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.4"/><path d="M8 3v4M16 3v4M3 10.5h18"/>',
  trash: '<path d="M3.5 6.5h17"/><path d="M8.5 6.5V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7"/><path d="M5.8 6.5 6.9 20a1.8 1.8 0 0 0 1.8 1.6h6.6a1.8 1.8 0 0 0 1.8-1.6l1.1-13.5"/><path d="M10 11v5.5M14 11v5.5"/>',
  edit: '<path d="M11 4.5H5.5A2 2 0 0 0 3.5 6.5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V13"/><path d="M16.6 3.1a2.1 2.1 0 0 1 3 3L11.5 14.2l-3.9.9.9-3.9Z"/>',
  download: '<path d="M12 3.5v11.5"/><path d="m7.5 11 4.5 4.5L16.5 11"/><path d="M4 20.5h16"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.5L10 21l-2.5-1.6L5 21Z"/><path d="M9 8h6M9 12.2h6M9 16.4h3.5"/>',
  tag: '<path d="M20.6 12.6 12.4 20.8a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2h8.4a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 3.2Z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  sparkle: '<path d="m12 3 2.1 5.5L19.5 10l-5.4 1.5L12 17l-2.1-5.5L4.5 10l5.4-1.5Z"/><path d="M18.5 16.5 19.4 19l2.1.7-2.1.8-.9 2.5-.9-2.5-2.1-.8 2.1-.7Z"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4v5h-5"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 8v6l-4 2v-8Z"/>',
  sort: '<path d="M7 4.5v15M7 19.5 3.5 16M17 19.5v-15M17 4.5 20.5 8"/>',
  wallet: '<path d="M20.5 8.5V7a2 2 0 0 0-2-2H5.5a2 2 0 0 0 0 4h15a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20.5 18h-15a2 2 0 0 1-2-2V7"/><circle cx="16.5" cy="12.5" r="1.1"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.6"/><path d="M2.5 10h19"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.4"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  printer: '<path d="M6.5 9V3.5h11V9"/><path d="M6.5 18H4.5A1.5 1.5 0 0 1 3 16.5v-5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-2"/><rect x="6.5" y="14" width="11" height="6.5" rx="1"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.4"/><path d="M7.6 10.5V7.4a4.4 4.4 0 0 1 8.8 0v3.1"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.4"/><path d="m3 6.5 9 6.5 9-6.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6a9.9 9.9 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.4 3.2"/><path d="M6.5 7.7A17 17 0 0 0 2.5 12S6 18.1 12 18.1a9.6 9.6 0 0 0 3.3-.6"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.2"/><path d="M12 7.9h.01"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.4"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="m3.5 17.5 5-5 4.5 4.5 3-3 4.5 4.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  coins: '<circle cx="9" cy="9" r="5.5"/><path d="M14.5 6.2A5.5 5.5 0 1 1 14 17.5"/><path d="M9 6.8v4.4M7.4 9h3.2"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".9"/>',
  zap: '<path d="M13 2.5 4 14h6.5L11 21.5 20 10h-6.5Z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  shield: '<path d="M12 2.8 20 6v6.2c0 5-3.4 8.3-8 9.8-4.6-1.5-8-4.8-8-9.8V6Z"/><path d="m8.6 12 2.4 2.4 4.4-4.5"/>',
  bell: '<path d="M18 8.6a6 6 0 0 0-12 0c0 6-2.4 7.6-2.4 7.6h16.8S18 14.6 18 8.6Z"/><path d="M13.8 20.4a2 2 0 0 1-3.6 0"/>',
  trendUp: '<path d="m3 16.5 5.5-5.5 3.5 3.5L21 6"/><path d="M15.5 6H21v5.5"/>',
  store: '<path d="M3.5 9.5V20h17V9.5"/><path d="M2.5 9.5 5 3.5h14l2.5 6a3 3 0 0 1-5.6 1.4 3 3 0 0 1-5.6 0 3 3 0 0 1-5.6 0A3 3 0 0 1 2.5 9.5Z"/><path d="M9.5 20v-5.5h5V20"/>',
  barcode: '<path d="M4 5v14M7.5 5v14M11 5v9M14.5 5v14M18 5v14M20.5 5v9"/>',
  package: '<path d="M12 2.8 3.5 7v10L12 21.2 20.5 17V7Z"/><path d="M3.5 7 12 11.4 20.5 7"/><path d="M12 11.4v9.8"/>',
  scale: '<path d="M12 3.5v17M6 7.5h12"/><path d="m6 7.5-3.5 7h7Z"/><path d="m18 7.5-3.5 7h7Z"/><path d="M8 20.5h8"/>'
};

/**
 * Tạo một biểu tượng SVG.
 *
 * @param {string} name   Tên trong bộ biểu tượng, ví dụ "cart".
 * @param {object} [options]
 * @param {number} [options.size]  Kích thước cạnh (px). Mặc định theo CSS.
 * @param {number} [options.stroke] Độ dày nét. Mặc định 1.8.
 * @param {string} [options.class] Lớp CSS bổ sung.
 * @param {string} [options.label] Nhãn trợ năng; nếu bỏ trống thì ẩn với trình đọc màn hình.
 */
export function icon(name, options = {}) {
  const path = PATHS[name] ?? PATHS.info;
  const { size, stroke = 1.8, class: className, label } = options;
  const svg = el("svg:svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": stroke,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: className,
    html: path
  });
  if (size) {
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
  }
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = label;
    svg.prepend(title);
  } else {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
  }
  return svg;
}

/** Kiểm tra tên biểu tượng có tồn tại (dùng trong kiểm thử). */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

/** Danh sách tên biểu tượng đang có. */
export function iconNames() {
  return Object.keys(PATHS);
}
