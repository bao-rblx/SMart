/**
 * SmartMart · Biểu đồ SVG
 * ---------------------------------------------------------------------------
 * Vẽ biểu đồ bằng SVG thuần: không thư viện, in được, chạy offline và tự co
 * giãn theo bề rộng thẻ. Toàn bộ màu đi qua token CSS (var(--...)) nên biểu đồ
 * tự đổi màu khi chuyển sáng/tối mà không phải vẽ lại.
 *
 * Vì sao tách riêng file: ba màn hình khác nhau (doanh thu, kho, tổng quan) đều
 * cần cùng một "ngôn ngữ" biểu đồ; đặt một chỗ để nét vẽ, nhãn và tooltip
 * không bị lệch nhau.
 */

import { el } from "./dom.js";
import { icon } from "./icons.js";
import { formatNumber, toNumber } from "../core/format.js";

/**
 * Bảng màu cho chuỗi số liệu.
 * Chỉ là các biến trong tokens.css — không có mã màu thô nào ở đây.
 */
export const SERIES_COLORS = Object.freeze([
  "var(--brand-500)",
  "var(--sky-500)",
  "var(--amber-500)",
  "var(--violet-500)",
  "var(--lime-500)",
  "var(--coral-500)",
  "var(--brand-600)",
  "var(--muted-2)"
]);

/** Màu thứ index trong bảng màu (quay vòng khi vượt quá độ dài). */
export function seriesColor(index) {
  const value = Number.isFinite(index) ? Math.trunc(index) : 0;
  const length = SERIES_COLORS.length;
  return SERIES_COLORS[((value % length) + length) % length];
}

/** Làm tròn toạ độ cho gọn mã SVG — số quá dài làm tệp phình vô ích. */
function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
}

function clamp(value, min, max, fallback) {
  const number = toNumber(value, fallback);
  return Math.min(max, Math.max(min, number));
}

function formatPercentOf(part, total) {
  if (!total) return "0%";
  const percent = Math.round((part / total) * 100);
  return percent + "%";
}

/**
 * Chuẩn hoá dữ liệu đầu vào cho biểu đồ cột.
 *
 * Vì sao cần: dữ liệu doanh thu đến từ hóa đơn thật có thể lẫn số âm, chuỗi
 * rỗng hoặc nhãn trùng. Chuẩn hoá một lần ở đây để phần vẽ chỉ việc vẽ.
 * Hàm thuần — kiểm thử được mà không cần DOM.
 *
 * @param {Array<{label: string, value: number, color?: string}>} items
 * @param {object} [options]
 * @param {number|null} [options.max]   Mốc trục tung; bỏ trống thì tự tính.
 * @param {boolean} [options.sort]      Sắp xếp giảm dần theo giá trị (mặc định true).
 * @param {number} [options.limit]      Chỉ giữ N mục lớn nhất (0 = tất cả).
 * @returns {{items: Array, max: number}} items đã có thêm color và ratio.
 */
export function prepareBarItems(items, options = {}) {
  const { max = null, sort = true, limit = 0 } = options;
  const list = (Array.isArray(items) ? items : [])
    .filter((item) => item && item.label !== null && item.label !== undefined)
    // Bỏ mục 0/âm: một cột cao 0px không nói lên điều gì mà lại chiếm chỗ trên trục.
    .map((item) => ({
      label: String(item.label),
      value: Math.max(0, toNumber(item.value)),
      color: typeof item.color === "string" && item.color ? item.color : null
    }))
    .filter((item) => item.value > 0);

  if (sort) {
    list.sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "vi"));
  }

  const visible = limit > 0 ? list.slice(0, limit) : list;
  const highest = visible.reduce((peak, item) => Math.max(peak, item.value), 0);
  const axisMax = max !== null && max !== undefined && toNumber(max) > 0 ? toNumber(max) : highest;
  const safeMax = axisMax > 0 ? axisMax : 1;

  return {
    items: visible.map((item, index) => ({
      ...item,
      color: item.color ?? seriesColor(index),
      ratio: item.value / safeMax
    })),
    max: safeMax
  };
}

/**
 * Biểu đồ cột dọc có trục, lưới, nhãn giá trị trên đầu cột và tooltip.
 *
 * @param {object} options
 * @param {Array<{label:string, value:number, color?:string}>} options.items
 * @param {number} [options.max]
 * @param {(value:number)=>string} [options.formatValue]
 * @param {number} [options.height]
 * @returns {SVGElement|HTMLElement} SVG, hoặc khối rỗng khi không có số liệu.
 */
export function barChart({ items, max, formatValue, height } = {}) {
  const data = prepareBarItems(items, { max });
  if (data.items.length === 0) return emptyChart("Chưa có số liệu để vẽ biểu đồ.");

  const format = typeof formatValue === "function" ? formatValue : formatNumber;
  const chartHeight = clamp(height, 140, 640, 260);
  const width = 720;
  const padding = { top: 28, right: 16, bottom: 36, left: 66 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const count = data.items.length;
  const gap = count > 6 ? 10 : 18;
  const barWidth = Math.max(14, Math.min(58, (plotWidth - gap * (count - 1)) / count));
  const usedWidth = barWidth * count + gap * (count - 1);
  const originX = padding.left + Math.max(0, (plotWidth - usedWidth) / 2);
  const baselineY = padding.top + plotHeight;

  const svg = el("svg:svg", {
    class: "chart-svg chart-svg--bar",
    viewBox: "0 0 " + width + " " + chartHeight,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label": "Biểu đồ cột: " + data.items.map((item) => item.label + " " + format(item.value)).join(", ")
  });

  // Lưới ngang kèm nhãn trục tung — đọc nhanh độ lớn mà không cần dí chuột.
  const ticks = 4;
  for (let index = 0; index <= ticks; index += 1) {
    const y = baselineY - (plotHeight * index) / ticks;
    svg.append(
      el("svg:line", {
        class: index === 0 ? "chart-axis-line" : "chart-grid",
        x1: padding.left,
        x2: padding.left + plotWidth,
        y1: round(y),
        y2: round(y)
      })
    );
    svg.append(
      el(
        "svg:text",
        { class: "chart-axis-label", x: padding.left - 10, y: round(y + 4), "text-anchor": "end" },
        format((data.max * index) / ticks)
      )
    );
  }

  data.items.forEach((item, index) => {
    const x = originX + index * (barWidth + gap);
    const barHeight = Math.max(item.value > 0 ? 3 : 0, item.ratio * plotHeight);
    const y = baselineY - barHeight;
    const label = item.label.length > 12 ? item.label.slice(0, 11) + "…" : item.label;

    const bar = el(
      "svg:rect",
      {
        class: "chart-bar",
        x: round(x),
        y: round(y),
        width: round(barWidth),
        height: round(barHeight),
        rx: 7,
        ry: 7,
        fill: item.color
      },
      el("svg:title", {}, item.label + " — " + format(item.value))
    );
    svg.append(bar);

    if (item.value > 0) {
      svg.append(
        el(
          "svg:text",
          {
            class: "chart-value-label",
            x: round(x + barWidth / 2),
            y: round(y - 8),
            "text-anchor": "middle"
          },
          format(item.value)
        )
      );
    }

    svg.append(
      el(
        "svg:text",
        { class: "chart-x-label", x: round(x + barWidth / 2), y: baselineY + 21, "text-anchor": "middle" },
        label
      )
    );
  });

  return svg;
}

/**
 * Biểu đồ vành khuyên cho cơ cấu doanh thu, kèm chú giải vẽ ngay trong SVG
 * để khi in hoặc tải ảnh chú giải không bị mất.
 *
 * @param {object} options
 * @param {Array<{label:string, value:number, color?:string}>} options.items
 * @param {number} [options.size]        Đường kính vành khuyên (px).
 * @param {number} [options.thickness]   Độ dày vành.
 * @param {string} [options.centerLabel]
 * @param {string} [options.centerValue]
 * @returns {SVGElement|HTMLElement}
 */
export function donutChart({ items, size, thickness, centerLabel, centerValue } = {}) {
  const list = (Array.isArray(items) ? items : [])
    .filter((item) => item && item.label !== null && item.label !== undefined)
    .map((item, index) => ({
      label: String(item.label),
      value: Math.max(0, toNumber(item.value)),
      color: typeof item.color === "string" && item.color ? item.color : seriesColor(index)
    }))
    .filter((item) => item.value > 0);

  const total = list.reduce((sum, item) => sum + item.value, 0);
  if (list.length === 0 || total <= 0) return emptyChart("Chưa có số liệu để vẽ cơ cấu doanh thu.");

  const diameter = clamp(size, 120, 420, 220);
  const ring = clamp(thickness, 8, diameter / 2 - 6, 26);
  const radius = (diameter - ring) / 2;
  const center = diameter / 2;
  const circumference = 2 * Math.PI * radius;
  const legendWidth = 218;
  const width = diameter + legendWidth;
  const rowHeight = 26;
  const height = Math.max(diameter, list.length * rowHeight + 12);

  const svg = el("svg:svg", {
    class: "chart-svg chart-svg--donut",
    viewBox: "0 0 " + width + " " + height,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label":
      "Biểu đồ cơ cấu: " +
      list.map((item) => item.label + " " + formatPercentOf(item.value, total)).join(", ")
  });

  // Vẽ từng cung bằng stroke-dasharray trên một vòng tròn: ít phần tử SVG,
  // nét liền mạch và không bị răng cưa như khi ghép nhiều path.
  let offset = 0;
  const gapLength = list.length > 1 ? Math.min(6, circumference * 0.012) : 0;
  for (const item of list) {
    const length = (item.value / total) * circumference;
    const visible = Math.max(0.5, length - gapLength);
    svg.append(
      el(
        "svg:circle",
        {
          class: "chart-donut__segment",
          cx: round(center),
          cy: round(center),
          r: round(radius),
          fill: "none",
          stroke: item.color,
          "stroke-width": round(ring),
          "stroke-dasharray": round(visible) + " " + round(circumference - visible),
          "stroke-dashoffset": round(-offset),
          transform: "rotate(-90 " + round(center) + " " + round(center) + ")"
        },
        el("svg:title", {}, item.label + ": " + formatNumber(item.value) + " (" + formatPercentOf(item.value, total) + ")")
      )
    );
    offset += length;
  }

  if (centerLabel) {
    svg.append(
      el(
        "svg:text",
        { class: "chart-donut__label", x: round(center), y: round(center - 7), "text-anchor": "middle" },
        centerLabel
      )
    );
  }
  if (centerValue) {
    svg.append(
      el(
        "svg:text",
        { class: "chart-donut__value", x: round(center), y: round(center + 17), "text-anchor": "middle" },
        centerValue
      )
    );
  }

  // Chú giải: ô màu + tên nhóm + tỉ lệ.
  const legendX = diameter + 18;
  list.forEach((item, index) => {
    const y = 14 + index * rowHeight;
    svg.append(
      el("svg:rect", {
        class: "chart-legend__swatch",
        x: legendX,
        y: round(y - 8),
        width: 10,
        height: 10,
        rx: 3,
        fill: item.color
      })
    );
    svg.append(
      el(
        "svg:text",
        { class: "chart-legend__label", x: legendX + 18, y: round(y + 1) },
        item.label.length > 16 ? item.label.slice(0, 15) + "…" : item.label
      )
    );
    svg.append(
      el(
        "svg:text",
        { class: "chart-legend__value", x: width - 6, y: round(y + 1), "text-anchor": "end" },
        formatPercentOf(item.value, total)
      )
    );
  });

  return svg;
}

/**
 * Đường xu hướng nhỏ (sparkline) cho 7 ngày gần nhất.
 * Không trục, không nhãn: chỉ để mắt nhận ra chiều đi lên/xuống.
 *
 * @param {object} options
 * @param {number[]} options.values
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {string} [options.color]
 * @returns {SVGElement|HTMLElement}
 */
export function sparkline({ values, width, height, color = "var(--brand-500)" } = {}) {
  const list = (Array.isArray(values) ? values : []).map((value) => toNumber(value));
  if (list.length < 2) return emptyChart("Chưa đủ dữ liệu để vẽ xu hướng.");

  const boxWidth = clamp(width, 60, 640, 160);
  const boxHeight = clamp(height, 24, 200, 40);
  const padY = 4;
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min || 1;

  const points = list.map((value, index) => ({
    x: round((index / (list.length - 1)) * (boxWidth - 2) + 1),
    y: round(boxHeight - padY - ((value - min) / span) * (boxHeight - padY * 2))
  }));

  const linePath = points.map((point, index) => (index === 0 ? "M" : "L") + point.x + " " + point.y).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = linePath + " L" + last.x + " " + boxHeight + " L" + first.x + " " + boxHeight + " Z";

  const svg = el("svg:svg", {
    class: "chart-svg chart-svg--spark",
    viewBox: "0 0 " + boxWidth + " " + boxHeight,
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": "Xu hướng: " + list.join(", ")
  });

  svg.append(el("svg:path", { class: "chart-spark__area", d: areaPath, fill: "var(--brand-100)", stroke: "none" }));
  svg.append(
    el("svg:path", {
      class: "chart-spark__line",
      d: linePath,
      fill: "none",
      stroke: color,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke"
    })
  );
  svg.append(
    el("svg:circle", { class: "chart-spark__dot", cx: last.x, cy: last.y, r: 2.6, fill: color }, el("svg:title", {}, String(list[list.length - 1])))
  );

  return svg;
}

/** Khối thay thế khi chưa có số liệu — giữ chỗ để bố cục không nhảy. */
export function emptyChart(message = "Chưa có số liệu.") {
  return el(
    "div",
    { class: "chart-empty", role: "status" },
    el("span", { class: "chart-empty__icon" }, icon("chart", { size: 22 })),
    el("p", { class: "chart-empty__text" }, message)
  );
}
