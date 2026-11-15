/**
 * SmartMart · Màn hình Doanh thu
 * ---------------------------------------------------------------------------
 * Ba phần: bộ lọc thời gian → thẻ số liệu + biểu đồ → bảng hóa đơn.
 *
 * Phần tính toán (tổng hợp, lọc theo khoảng, gom theo nhóm hàng, dựng dữ liệu
 * biểu đồ, tạo CSV) được viết thành hàm THUẦN ở nửa đầu tệp. Lý do: trình duyệt
 * không có trong môi trường kiểm thử, nhưng số liệu doanh thu thì phải đúng —
 * tách khỏi DOM để kiểm thử được bằng node:test mà không cần jsdom.
 */

import { el, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { CATEGORY_ORDER } from "../core/constants.js";
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatDateTime,
  formatDate,
  toNumber,
  roundMoney
} from "../core/format.js";
import { categoryLabel, paymentLabel } from "../core/vietnamese.js";
import { barChart, donutChart, sparkline, prepareBarItems, emptyChart, seriesColor } from "../ui/charts.js";
import { generateInvoice } from "../core/transaction.js";
import { openModal } from "../ui/modal.js";

// ===========================================================================
// PHẦN THUẦN — không chạm vào DOM, dùng được trong kiểm thử
// ===========================================================================

/** Ba khoảng thời gian của màn hình doanh thu. */
export const RANGE_TODAY = "today";
export const RANGE_WEEK = "week";
export const RANGE_ALL = "all";

export const RANGE_OPTIONS = Object.freeze([
  { key: RANGE_TODAY, label: "Hôm nay" },
  { key: RANGE_WEEK, label: "7 ngày qua" },
  { key: RANGE_ALL, label: "Toàn bộ" }
]);

/** Đầu ngày của một mốc thời gian (00:00 giờ địa phương). */
export function startOfDay(date = new Date()) {
  const start = new Date(date.getTime());
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Mốc bắt đầu của một khoảng lọc.
 * Dùng giờ địa phương vì người bán nhìn đồng hồ treo tường, không nhìn UTC.
 *
 * @returns {Date|null} null nghĩa là không lọc (toàn bộ).
 */
export function rangeStart(range, now = new Date()) {
  switch (range) {
    case RANGE_TODAY:
      return startOfDay(now);
    case RANGE_WEEK:
      // 7 ngày qua tính cả hôm nay: lùi 6 ngày rồi lấy đầu ngày.
      return new Date(startOfDay(now).getTime() - 6 * 86_400_000);
    default:
      return null;
  }
}

/** Nhãn phụ mô tả khoảng đang chọn, hiện dưới thẻ số liệu. */
export function rangeLabel(range, now = new Date()) {
  switch (range) {
    case RANGE_TODAY:
      return "Hôm nay, " + formatDate(now);
    case RANGE_WEEK:
      return "7 ngày gần nhất (" + formatDate(rangeStart(range, now)) + " – " + formatDate(now) + ")";
    case RANGE_ALL:
      return "Toàn bộ hóa đơn đã ghi";
    default:
      return "";
  }
}

/** Đọc mốc thời gian của hóa đơn: nhận Date, chuỗi ISO hoặc số mili giây. */
export function saleTime(sale) {
  const raw = sale && (sale.timestamp ?? sale.time);
  if (raw instanceof Date) return raw.getTime();
  const value = raw === undefined || raw === null ? new Date(NaN) : new Date(raw);
  return value.getTime();
}

/**
 * Lọc hóa đơn theo khoảng thời gian, mới nhất trước.
 *
 * @param {Array} sales
 * @param {string} range RANGE_TODAY | RANGE_WEEK | RANGE_ALL
 * @param {Date} [now]  Mốc "hiện tại" — tham số hoá để kiểm thử tất định.
 */
export function filterSalesByRange(sales, range = RANGE_ALL, now = new Date()) {
  const start = rangeStart(range, now);
  const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY;
  return (Array.isArray(sales) ? sales : [])
    .filter((sale) => {
      const time = saleTime(sale);
      return Number.isFinite(time) && time >= startTime;
    })
    .sort((left, right) => saleTime(right) - saleTime(left));
}

/**
 * Bốn con số tiền của một hóa đơn.
 *
 * Vì sao phải tự tính "Tổng cộng": Transaction.toJSON() không lưu grandTotal
 * (đó là getter dẫn xuất), nên hóa đơn khôi phục từ localStorage là plain
 * object không có trường này. Đọc thẳng sale.grandTotal sẽ ra 0 đồng.
 */
export function saleMoney(sale) {
  const subtotal = roundMoney(sale?.subtotal ?? 0);
  const discountedRaw = sale?.discountedTotal;
  const discounted = discountedRaw === undefined || discountedRaw === null ? null : roundMoney(discountedRaw);
  const tax = roundMoney(sale?.tax ?? 0);
  const explicitTotal = Number(sale?.grandTotal);
  const total = Number.isFinite(explicitTotal) && sale?.grandTotal !== null ? roundMoney(explicitTotal) : roundMoney((discounted ?? subtotal) + tax);

  return {
    subtotal,
    discount: Math.max(0, roundMoney(subtotal - (discounted ?? subtotal))),
    tax,
    total
  };
}

/** Tổng số lượng món của một hóa đơn. */
export function saleItemCount(sale) {
  if (Number.isFinite(Number(sale?.itemCount))) return Math.max(0, Math.trunc(Number(sale.itemCount)));
  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  return lines.reduce((sum, line) => sum + Math.max(0, Math.trunc(toNumber(line?.quantity))), 0);
}

/**
 * Tổng hợp số liệu của một danh sách hóa đơn. Không sửa mảng đầu vào.
 *
 * @returns {{revenue:number, orderCount:number, averageOrder:number, itemCount:number}}
 */
export function summarizeSales(sales) {
  const list = Array.isArray(sales) ? sales : [];
  let revenue = 0;
  let itemCount = 0;

  for (const sale of list) {
    revenue += saleMoney(sale).total;
    itemCount += saleItemCount(sale);
  }

  const orderCount = list.length;
  return {
    revenue: roundMoney(revenue),
    orderCount,
    averageOrder: orderCount > 0 ? roundMoney(revenue / orderCount) : 0,
    itemCount
  };
}

/**
 * Doanh thu (đã gồm thuế) theo từng nhóm hàng, xếp theo thứ tự nhóm cố định
 * của cửa hàng để hai biểu đồ và bảng luôn cùng một thứ tự.
 *
 * @returns {Array<{key:string, label:string, value:number, share:number}>}
 */
export function revenueByCategory(sales) {
  const totals = new Map();
  for (const sale of Array.isArray(sales) ? sales : []) {
    const lines = Array.isArray(sale?.lines) ? sale.lines : [];
    for (const line of lines) {
      const key = line?.category;
      if (!key) continue;
      const unit = toNumber(line.discountedUnitPrice ?? line.unitPrice);
      const quantity = Math.max(0, toNumber(line.quantity));
      const amount = roundMoney((unit + toNumber(line.taxPerUnit)) * quantity);
      totals.set(key, (totals.get(key) ?? 0) + amount);
    }
  }

  const order = CATEGORY_ORDER;
  const keys = [...totals.keys()];
  const known = keys.filter((key) => order.includes(key)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const unknown = keys.filter((key) => !order.includes(key)).sort();
  const grand = keys.reduce((sum, key) => sum + totals.get(key), 0);

  return [...known, ...unknown]
    .map((key) => {
      const value = roundMoney(totals.get(key));
      return { key, label: categoryLabel(key), value, share: grand > 0 ? value / grand : 0 };
    })
    .filter((entry) => entry.value > 0);
}

/**
 * Dựng dữ liệu cho barChart từ kết quả revenueByCategory.
 * Màu gắn theo vị trí nhóm trong CATEGORY_ORDER, nhờ vậy biểu đồ cột và biểu
 * đồ vành khuyên luôn tô cùng một màu cho cùng một nhóm hàng.
 *
 * @returns {{items:Array<{label:string,value:number,color:string}>, max:number}}
 */
export function buildCategoryChartData(rows, options = {}) {
  const { limit = 8 } = options;
  const coloured = (Array.isArray(rows) ? rows : []).map((row) => ({
    label: row.label,
    value: row.value,
    color: seriesColor(Math.max(0, CATEGORY_ORDER.indexOf(row.key)))
  }));

  // sort: false — giữ thứ tự nhóm hàng cố định thay vì xếp theo doanh thu.
  const prepared = prepareBarItems(coloured, { sort: false, limit });
  return { items: prepared.items, max: prepared.max };
}

/** Chuỗi ngày của N ngày gần nhất, cũ nhất trước. */
export function lastDays(count, now = new Date()) {
  const days = Math.max(1, Math.trunc(toNumber(count, 7)));
  const base = startOfDay(now).getTime();
  const result = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    result.push(new Date(base - index * 86_400_000));
  }
  return result;
}

function dayKey(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

/** Doanh thu từng ngày của 7 ngày gần nhất — đầu vào cho sparkline. */
export function dailyRevenueSeries(sales, days = 7, now = new Date()) {
  const buckets = lastDays(days, now).map((date) => ({ key: dayKey(date), value: 0 }));
  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const sale of Array.isArray(sales) ? sales : []) {
    const time = saleTime(sale);
    if (!Number.isFinite(time)) continue;
    const bucket = index.get(dayKey(new Date(time)));
    if (bucket) bucket.value = roundMoney(bucket.value + saleMoney(sale).total);
  }

  return buckets.map((bucket) => bucket.value);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export const CSV_HEADERS = Object.freeze([
  "Mã đơn",
  "Thời gian",
  "Thanh toán",
  "Số món",
  "Tạm tính",
  "Giảm giá",
  "Thuế",
  "Tổng cộng"
]);

/**
 * Thoát một ô CSV theo RFC 4180: bọc ngoặc kép khi có dấu phẩy, ngoặc kép hoặc
 * xuống dòng; ngoặc kép bên trong nhân đôi. Excel đọc tệp theo dấu phẩy nên
 * nếu không theo đúng chuẩn này các cột sẽ lệch nhau.
 */
export function escapeCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

/** Ghép ma trận thành văn bản CSV, mỗi dòng cách nhau bằng CRLF (chuẩn RFC 4180). */
export function toCsvText(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/**
 * Nội dung CSV doanh thu: BOM + tiêu đề + từng hóa đơn.
 * BOM (\uFEFF) là bắt buộc để Excel nhận ra UTF-8 và không làm hỏng dấu tiếng Việt.
 *
 * @param {Array} sales
 * @returns {string}
 */
export function buildSalesCsv(sales) {
  const rows = [CSV_HEADERS];
  for (const sale of Array.isArray(sales) ? sales : []) {
    const money = saleMoney(sale);
    rows.push([
      sale?.orderId ?? "",
      formatDateTime(sale?.timestamp),
      paymentLabel(sale?.payment?.method ?? sale?.paymentMethod),
      saleItemCount(sale),
      money.subtotal,
      money.discount,
      money.tax,
      money.total
    ]);
  }
  return "\uFEFF" + toCsvText(rows);
}

/** Tên tệp CSV theo ngày xuất, ví dụ SmartMart-doanh-thu-2026-11-12.csv */
export function csvFileName(now = new Date()) {
  return "SmartMart-doanh-thu-" + dayKey(now) + ".csv";
}

/**
 * Tải một chuỗi văn bản thành tệp bằng Blob + URL.createObjectURL.
 * Tách riêng để phần vẽ giao diện không phải biết tới Blob/URL và để kiểm thử
 * không cần trình duyệt.
 *
 * @returns {boolean} true nếu đã kích hoạt tải xuống.
 */
export function downloadTextFile(text, fileName, mime = "text/csv;charset=utf-8") {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: fileName, class: "visually-hidden" });
  document.body.append(link);
  link.click();
  link.remove();
  // Thu hồi URL sau khi trình duyệt kịp đọc xong nội dung tệp.
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return true;
}

// ===========================================================================
// PHẦN GIAO DIỆN
// ===========================================================================

/** Thẻ số liệu — dùng lại .metric của thư viện thành phần, chỉ thêm màu nhấn. */
function metricCard({ label, value, note, iconName, tone }) {
  return el(
    "article",
    { class: "metric" + (tone ? " metric--" + tone : "") },
    el("p", { class: "metric__label" }, icon(iconName, { size: 14 }), label),
    el("p", { class: "metric__value" }, value),
    note ? el("p", { class: "metric__note" }, note) : null
  );
}

/** Hộp thoại xem lại hóa đơn văn bản thuần (không dựng HTML từ dữ liệu người dùng). */
function showInvoiceModal(sale, handlers = {}) {
  const text = generateInvoice(sale);
  const pre = el("pre", { class: "rp-invoice" }, text);

  const dialog = openModal({
    title: "Hóa đơn " + String(sale?.orderId ?? ""),
    size: "md",
    iconName: "receipt",
    content: pre,
    actions: [
      { label: "Đóng", kind: "ghost" },
      {
        label: "In hóa đơn",
        kind: "primary",
        // close: false để hộp thoại vẫn mở sau khi mở cửa sổ in.
        close: false,
        onClick: () => handlers.onPrint?.(text)
      }
    ]
  });
  return dialog;
}

/** Mở cửa sổ in chỉ chứa hóa đơn — không in cả giao diện quản trị. */
function printInvoiceText(text, sale, toast) {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "width=460,height=680");
  if (!win) {
    toast?.error?.("Trình duyệt đã chặn cửa sổ in. Hãy cho phép rồi thử lại.");
    return false;
  }
  const doc = win.document;
  doc.title = "Hóa đơn " + String(sale?.orderId ?? "");
  const style = doc.createElement("style");
  style.textContent =
    "body{font-family:Consolas,'Courier New',monospace;font-size:12px;white-space:pre;padding:12px;}";
  const pre = doc.createElement("pre");
  pre.textContent = text;
  doc.head.append(style);
  doc.body.append(pre);
  win.focus();
  win.print();
  return true;
}

/**
 * Vẽ màn hình doanh thu.
 *
 * @param {object} context { store, state, toast, confirm, refresh, navigate, now }
 * @param {Date} [context.now] Mốc "hiện tại". Tham số hoá giống các hàm thuần phía
 *   trên để kiểm thử tất định: bộ lọc "Hôm nay" và chuỗi 7 ngày đều tính từ mốc
 *   này, nên nếu đọc thẳng đồng hồ hệ thống thì cùng một bộ dữ liệu mẫu sẽ cho
 *   kết quả khác nhau tuỳ ngày chạy.
 * @returns {HTMLElement} Node bọc trong .view
 */
export function renderReports(context = {}) {
  const { store = null, state = null, toast = null, navigate = null, now: currentMoment = null } = context;
  const appState = state ?? store?.state ?? {};
  const now = currentMoment instanceof Date && !Number.isNaN(currentMoment.getTime()) ? currentMoment : new Date();
  const ui = { range: RANGE_TODAY, selectedId: null };

  const root = el("div", { class: "view rp-view" });

  // --- Đầu trang ---------------------------------------------------------
  const exportButton = el(
    "button",
    { class: "btn", type: "button", onClick: () => exportCsv() },
    icon("download", { size: 16 }),
    "Xuất CSV"
  );

  root.append(
    el(
      "div",
      { class: "page-head" },
      el(
        "div",
        { class: "page-head__text" },
        el("h1", {}, "Doanh thu"),
        el("p", {}, "Nhìn lại từng đơn hàng để hiểu khách hàng của mình hơn.")
      ),
      el("div", { class: "page-head__actions" }, exportButton)
    )
  );

  // --- Bộ lọc thời gian --------------------------------------------------
  const tabs = el("div", { class: "tabs rp-range", role: "tablist", "aria-label": "Khoảng thời gian" });
  const rangeButtons = RANGE_OPTIONS.map((option) =>
    el(
      "button",
      {
        class: "tabs__tab",
        type: "button",
        role: "tab",
        dataset: { range: option.key },
        "aria-selected": String(option.key === ui.range),
        onClick: () => {
          if (ui.range === option.key) return;
          ui.range = option.key;
          ui.selectedId = null;
          paint();
        }
      },
      option.label
    )
  );
  tabs.append(...rangeButtons);
  root.append(el("div", { class: "rp-toolbar" }, tabs));

  // --- Các vùng động -----------------------------------------------------
  const metricsHost = el("div", { class: "metric-grid" });
  const chartsHost = el("div", { class: "rp-charts" });
  const selectionBar = el("div", { class: "rp-selection", hidden: true });
  const tableWrap = el("div", { class: "table-wrap rp-table-wrap" });
  const countLabel = el("span", { class: "rp-hint" }, "");
  const tableCard = el(
    "section",
    { class: "card rp-table-card" },
    el("div", { class: "card__head" }, el("h2", {}, "Hóa đơn"), countLabel),
    selectionBar,
    tableWrap
  );
  root.append(metricsHost, chartsHost, tableCard);

  function allSales() {
    return appState.sales ?? store?.getSales?.() ?? [];
  }

  function visibleSales() {
    return filterSalesByRange(allSales(), ui.range, now);
  }

  function selectedSale() {
    return visibleSales().find((sale) => String(sale?.orderId) === String(ui.selectedId)) ?? null;
  }

  // --- Chọn dòng ---------------------------------------------------------
  function selectSale(sale) {
    const id = String(sale?.orderId ?? "");
    ui.selectedId = ui.selectedId === id ? null : id;
    paintSelection();
  }

  function paintSelection() {
    tableWrap.querySelectorAll("tr[data-order-id]").forEach((row) => {
      const active = row.dataset.orderId === String(ui.selectedId);
      row.classList.toggle("is-selected", active);
      row.setAttribute("aria-selected", String(active));
    });

    clear(selectionBar);
    const sale = selectedSale();
    if (!sale) {
      selectionBar.hidden = true;
      return;
    }

    selectionBar.hidden = false;
    selectionBar.append(
      el("span", { class: "rp-selection__label" }, "Đơn " + String(sale.orderId ?? "")),
      el(
        "div",
        { class: "rp-selection__actions" },
        el(
          "button",
          { class: "btn btn--soft btn--sm", type: "button", onClick: () => viewInvoice(sale) },
          icon("receipt", { size: 14 }),
          "Xem hóa đơn"
        ),
        el(
          "button",
          { class: "btn btn--ghost btn--sm", type: "button", onClick: () => printSale(sale) },
          icon("printer", { size: 14 }),
          "In"
        )
      )
    );
  }

  function viewInvoice(sale) {
    try {
      showInvoiceModal(sale, { onPrint: (text) => printInvoiceText(text, sale, toast) });
    } catch (error) {
      toast?.error?.("Không dựng được hóa đơn: " + String(error?.message ?? error));
    }
  }

  function printSale(sale) {
    try {
      printInvoiceText(generateInvoice(sale), sale, toast);
    } catch (error) {
      toast?.error?.("Không in được hóa đơn: " + String(error?.message ?? error));
    }
  }

  function exportCsv() {
    const sales = visibleSales();
    if (sales.length === 0) {
      toast?.info?.("Chưa có hóa đơn nào trong khoảng thời gian này để xuất.");
      return;
    }
    const ok = downloadTextFile(buildSalesCsv(sales), csvFileName(now));
    if (ok) toast?.success?.("Đã tải " + sales.length + " hóa đơn ra tệp CSV.");
    else toast?.error?.("Trình duyệt không cho phép tải tệp. Hãy thử lại.");
  }

  // --- Bảng hóa đơn ------------------------------------------------------
  function buildTable(sales) {
    const body = el("tbody");
    for (const sale of sales) {
      const money = saleMoney(sale);
      body.append(
        el(
          "tr",
          {
            dataset: { orderId: String(sale?.orderId ?? "") },
            tabindex: "0",
            "aria-selected": "false",
            onClick: () => selectSale(sale),
            onKeydown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectSale(sale);
              }
            }
          },
          el("td", { class: "rp-cell-code" }, el("span", { class: "mono" }, String(sale?.orderId ?? "—"))),
          el("td", { class: "rp-cell-time" }, formatDateTime(sale?.timestamp)),
          el("td", { class: "num" }, formatNumber(saleItemCount(sale))),
          el(
            "td",
            {},
            el(
              "span",
              { class: "badge badge--outline" },
              paymentLabel(sale?.payment?.method ?? sale?.paymentMethod)
            )
          ),
          el("td", { class: "num rp-cell-total" }, formatMoney(money.total))
        )
      );
    }

    return el(
      "table",
      { class: "table table--compact rp-table" },
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", {}, "Mã đơn"),
          el("th", {}, "Thời gian"),
          el("th", { class: "num" }, "Số món"),
          el("th", {}, "Thanh toán"),
          el("th", { class: "num" }, "Tổng cộng")
        )
      ),
      body
    );
  }

  // --- Vẽ toàn bộ --------------------------------------------------------
  function paint() {
    for (const button of rangeButtons) {
      button.setAttribute("aria-selected", String(button.dataset.range === ui.range));
    }

    const sales = visibleSales();
    const summary = summarizeSales(sales);
    const categoryRows = revenueByCategory(sales);

    clear(metricsHost);
    metricsHost.append(
      metricCard({
        label: "Tổng doanh thu",
        value: formatMoney(summary.revenue),
        note: rangeLabel(ui.range, now),
        iconName: "coins",
        tone: "brand"
      }),
      metricCard({
        label: "Số đơn",
        value: formatNumber(summary.orderCount),
        note: summary.orderCount > 0 ? "Đơn đã thanh toán trong kỳ" : "Chưa có đơn nào",
        iconName: "receipt",
        tone: "sky"
      }),
      metricCard({
        label: "Trung bình mỗi đơn",
        value: formatMoney(summary.averageOrder),
        note: "Doanh thu chia cho số đơn",
        iconName: "scale",
        tone: "violet"
      }),
      metricCard({
        label: "Sản phẩm đã bán",
        value: formatNumber(summary.itemCount),
        note: "Tổng số lượng món trong các đơn",
        iconName: "package",
        tone: "amber"
      })
    );

    clear(chartsHost);
    clear(tableWrap);

    if (summary.orderCount === 0) {
      chartsHost.append(
        el(
          "div",
          { class: "card rp-empty-card" },
          el(
            "div",
            { class: "empty" },
            el("span", { class: "empty__icon" }, icon("chart", { size: 26 })),
            el("h3", {}, "Chưa có hóa đơn trong khoảng này"),
            el("p", {}, "Khi bạn bán được hàng, biểu đồ doanh thu và bảng hóa đơn sẽ hiện ở đây."),
            navigate
              ? el(
                  "button",
                  { class: "btn btn--primary btn--sm", type: "button", onClick: () => navigate("Checkout") },
                  icon("cart", { size: 14 }),
                  "Sang màn hình bán hàng"
                )
              : null
          )
        )
      );
      tableWrap.append(el("div", { class: "table__empty" }, "Chưa có đơn nào để hiển thị."));
      countLabel.textContent = "0 đơn";
      paintSelection();
      return;
    }

    const chartData = buildCategoryChartData(categoryRows, { limit: 8 });

    chartsHost.append(
      el(
        "section",
        { class: "card rp-chart-card" },
        el(
          "div",
          { class: "card__head" },
          el("h2", {}, "Doanh thu theo nhóm hàng"),
          el("span", { class: "rp-hint" }, "Đơn vị: đồng")
        ),
        el(
          "div",
          { class: "card__body rp-chart-body" },
          chartData.items.length > 0
            ? barChart({
                items: chartData.items,
                max: chartData.max,
                formatValue: formatMoneyCompact,
                height: 268
              })
            : emptyChart("Chưa có dòng hàng nào để tính doanh thu theo nhóm.")
        )
      ),
      el(
        "section",
        { class: "card rp-chart-card" },
        el(
          "div",
          { class: "card__head" },
          el("h2", {}, "Cơ cấu doanh thu"),
          el("span", { class: "rp-hint" }, "Tỉ trọng theo nhóm")
        ),
        el(
          "div",
          { class: "card__body rp-chart-body" },
          categoryRows.length > 0
            ? donutChart({
                items: categoryRows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: seriesColor(Math.max(0, CATEGORY_ORDER.indexOf(row.key)))
                })),
                size: 198,
                thickness: 24,
                centerLabel: "Tổng",
                centerValue: formatMoneyCompact(summary.revenue)
              })
            : emptyChart("Chưa có số liệu cơ cấu doanh thu.")
        )
      )
    );

    // Xu hướng 7 ngày luôn có mặt: nó trả lời câu "đang lên hay đang xuống?"
    // mà ba biểu đồ kia không trả lời được.
    // Dùng TOÀN BỘ hóa đơn chứ không dùng danh sách đã lọc: xu hướng 7 ngày là
    // bức tranh riêng, không đổi theo khoảng lọc người dùng đang chọn.
    const trend = dailyRevenueSeries(allSales(), 7, now);
    const trendTotal = trend.reduce((sum, value) => sum + value, 0);
    chartsHost.append(
      el(
        "section",
        { class: "card rp-chart-card rp-trend-card" },
        el(
          "div",
          { class: "card__head" },
          el("h2", {}, "Xu hướng 7 ngày"),
          el("span", { class: "rp-hint" }, formatMoneyCompact(trendTotal))
        ),
        el(
          "div",
          { class: "card__body rp-chart-body" },
          trendTotal > 0 ? sparkline({ values: trend, width: 520, height: 56 }) : emptyChart("Chưa có doanh thu trong 7 ngày qua.")
        )
      )
    );

    tableWrap.append(buildTable(sales));
    countLabel.textContent = sales.length + " đơn · " + rangeLabel(ui.range, now);

    // Bảng vừa được dựng lại nên dòng đang chọn có thể đã biến mất khỏi kỳ lọc.
    if (ui.selectedId && !selectedSale()) ui.selectedId = null;
    paintSelection();
  }

  paint();
  return root;
}
