/**
 * SmartMart · Kiểm thử màn hình Doanh thu + bộ biểu đồ
 * ---------------------------------------------------------------------------
 * Chạy: cd web && npm test
 *
 * Vì sao kiểm thử theo lối này: môi trường CI không có trình duyệt. Phần tính
 * toán (tổng hợp, lọc thời gian, gom nhóm, CSV, dữ liệu biểu đồ) đã được tách
 * thành hàm thuần trong views/reports.js nên kiểm thử được trực tiếp — đó mới
 * là chỗ dễ sai và cũng là chỗ ảnh hưởng tới con số người dùng nhìn thấy.
 *
 * Riêng Việc "render có trả về Node không" cần DOM, nên tệp này dựng một lớp
 * DOM tối giản (không cài jsdom): chỉ đủ những gì el()/icon()/querySelectorAll
 * dùng tới.
 */

import test from "node:test";
import assert from "node:assert/strict";

/* ===========================================================================
 * 1. DOM tối giản — chỉ đủ để dựng view, không mô phỏng trình duyệt
 * ======================================================================== */

class FakeEventTarget {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(name, handler) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(handler);
  }

  removeEventListener(name, handler) {
    this._listeners.get(name)?.delete(handler);
  }

  dispatchEvent(event) {
    for (const handler of this._listeners.get(event?.type) ?? []) handler.call(this, event);
    return true;
  }
}

class FakeNode extends FakeEventTarget {
  constructor() {
    super();
    this.childNodes = [];
    this.parentNode = null;
    this._text = "";
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get isConnected() {
    return true;
  }

  get textContent() {
    if (this.childNodes.length === 0) return this._text;
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(value) {
    this.childNodes = [];
    this._text = value === null || value === undefined ? "" : String(value);
  }

  append(...children) {
    for (const child of children) {
      if (child === null || child === undefined) continue;
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  prepend(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.childNodes.unshift(child);
    }
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }
}

class FakeText extends FakeNode {
  constructor(text) {
    super();
    this.nodeType = 3;
    this._text = String(text);
  }
}

function matchesSelector(element, selector) {
  const match = /^([a-zA-Z0-9_-]+)?(?:\[([a-zA-Z0-9_-]+)\]|\.([a-zA-Z0-9_-]+))?$/.exec(selector.trim());
  if (!match) return false;
  const [, tag, attribute, className] = match;
  if (tag && String(element.tagName ?? "").toLowerCase() !== tag.toLowerCase()) return false;
  if (attribute && element.getAttribute(attribute) === null) return false;
  if (className && !element.classList.contains(className)) return false;
  return true;
}

class FakeElement extends FakeNode {
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.innerHTML = "";
    this.hidden = false;
    this.value = "";
    this.checked = false;
    this.disabled = false;
    const self = this;
    this.classList = {
      add(name) {
        const set = new Set(String(self.className).split(/\s+/).filter(Boolean));
        set.add(name);
        self.className = [...set].join(" ");
        self.attributes.set("class", self.className);
      },
      remove(name) {
        const set = new Set(String(self.className).split(/\s+/).filter(Boolean));
        set.delete(name);
        self.className = [...set].join(" ");
        self.attributes.set("class", self.className);
      },
      toggle(name, force) {
        const set = new Set(String(self.className).split(/\s+/).filter(Boolean));
        const shouldHave = force === undefined ? !set.has(name) : Boolean(force);
        if (shouldHave) set.add(name);
        else set.delete(name);
        self.className = [...set].join(" ");
        self.attributes.set("class", self.className);
        return shouldHave;
      },
      contains(name) {
        return String(self.className).split(/\s+/).includes(name);
      }
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.className = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
    if (name === "hidden") this.hidden = true;
  }

  getAttribute(name) {
    if (name === "class") return this.className || null;
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return this.dataset[key] ?? null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "class") this.className = "";
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node instanceof FakeElement && matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const selectors = String(selector).split(",").map((part) => part.trim()).filter(Boolean);
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child instanceof FakeElement) {
          if (selectors.some((part) => matchesSelector(child, part))) found.push(child);
          walk(child);
        }
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  focus() {}

  click() {}

  getBoundingClientRect() {
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  }
}

/** Gắn DOM giả vào globalThis để các module ui/ dùng được. */
function installFakeDom() {
  const body = new FakeElement("body");
  const documentElement = new FakeElement("html");
  const document = {
    body,
    documentElement,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_ns, tag) => new FakeElement(tag),
    createTextNode: (text) => new FakeText(text),
    getElementById: () => null,
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
    activeElement: null
  };
  globalThis.Node = FakeNode;
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.document = document;
  return { document, body };
}

const { document: fakeDocument } = installFakeDom();

// Import sau khi đã có DOM: modal.js gắn listener ngay lúc nạp module.
const reports = await import("../js/views/reports.js");
const charts = await import("../js/ui/charts.js");

/* ===========================================================================
 * 2. Dữ liệu mẫu
 * ======================================================================== */

/** Mốc "bây giờ" cố định để bài kiểm thử không phụ thuộc ngày chạy. */
const NOW = new Date(2026, 10, 12, 15, 30, 0); // 12/11/2026 15:30 giờ địa phương

function daysAgo(days, hour = 10) {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), hour, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

/** Hóa đơn giả dạng plain object — đúng hình dạng Transaction.toJSON(). */
function sale({ orderId, when, lines, subtotal, discountedTotal, tax, method = "Cash" }) {
  const grandTotal = Math.round((discountedTotal + tax));
  return {
    orderId,
    timestamp: when.toISOString(),
    lines,
    subtotal,
    discountedTotal,
    tax,
    grandTotal,
    payment: { method, amount: grandTotal }
  };
}

function line({ name = "Mặt hàng", category = "Grocery", quantity = 1, unitPrice = 10000, discountedUnitPrice = 10000, taxPerUnit = 1000 }) {
  return { productId: 1, name, category, quantity, unitPrice, discountedUnitPrice, taxPerUnit };
}

const SAMPLE_SALES = [
  // Hôm nay: 2 dòng, tổng 2*(9000+900) + 3*(4500+450) = 19800 + 14850 = 34650
  sale({
    orderId: "AAAA1111",
    when: daysAgo(0, 9),
    lines: [
      line({ name: "Sữa tươi", category: "Dairy", quantity: 2, unitPrice: 10000, discountedUnitPrice: 9000, taxPerUnit: 900 }),
      line({ name: "Mì gói", category: "Grocery", quantity: 3, unitPrice: 5000, discountedUnitPrice: 4500, taxPerUnit: 450 })
    ],
    subtotal: 35000,
    discountedTotal: 31500,
    tax: 3150
  }),
  // Hôm nay: 1 dòng, (12000+1200)*1 = 13200
  sale({
    orderId: "BBBB2222",
    when: daysAgo(0, 14),
    lines: [line({ name: "Nước mắm", category: "Grocery", quantity: 1, unitPrice: 13000, discountedUnitPrice: 12000, taxPerUnit: 1200 })],
    subtotal: 13000,
    discountedTotal: 12000,
    tax: 1200,
    method: "Card"
  }),
  // 3 ngày trước: 1 dòng, (20000+2000)*2 = 44000
  sale({
    orderId: "CCCC3333",
    when: daysAgo(3, 11),
    lines: [line({ name: "Tai nghe", category: "Electronics", quantity: 2, unitPrice: 22000, discountedUnitPrice: 20000, taxPerUnit: 2000 })],
    subtotal: 44000,
    discountedTotal: 40000,
    tax: 4000,
    method: "EWallet"
  }),
  // 6 ngày trước: 1 dòng, (3000+300)*5 = 16500 (vẫn trong 7 ngày qua)
  sale({
    orderId: "DDDD4444",
    when: daysAgo(6, 8),
    lines: [line({ name: "Bánh quy", category: "Snacks", quantity: 5, unitPrice: 3200, discountedUnitPrice: 3000, taxPerUnit: 300 })],
    subtotal: 16000,
    discountedTotal: 15000,
    tax: 1500
  }),
  // 20 ngày trước: ngoài khoảng 7 ngày, chỉ có trong "Toàn bộ"
  sale({
    orderId: "EEEE5555",
    when: daysAgo(20, 16),
    lines: [line({ name: "Chuột máy tính", category: "Electronics", quantity: 1, unitPrice: 150000, discountedUnitPrice: 135000, taxPerUnit: 16200 })],
    subtotal: 150000,
    discountedTotal: 135000,
    tax: 16200,
    method: "Card"
  })
];

/* ===========================================================================
 * 3. Tổng hợp doanh thu
 * ======================================================================== */

test("summarizeSales: danh sách rỗng trả về toàn số 0", () => {
  const summary = reports.summarizeSales([]);
  assert.deepEqual(summary, { revenue: 0, orderCount: 0, averageOrder: 0, itemCount: 0 });
});

test("summarizeSales: cộng đúng tổng doanh thu (đã gồm thuế)", () => {
  const summary = reports.summarizeSales(SAMPLE_SALES);
  // 34650 + 13200 + 44000 + 16500 + 151200
  assert.equal(summary.revenue, 259550);
});

test("summarizeSales: đếm đúng số đơn", () => {
  assert.equal(reports.summarizeSales(SAMPLE_SALES).orderCount, 5);
});

test("summarizeSales: trung bình mỗi đơn làm tròn tới đồng", () => {
  const summary = reports.summarizeSales(SAMPLE_SALES);
  assert.equal(summary.averageOrder, Math.round(259550 / 5));
  assert.ok(Number.isInteger(summary.averageOrder), "trung bình mỗi đơn phải là số nguyên đồng");
});

test("summarizeSales: số sản phẩm là tổng SỐ LƯỢNG chứ không phải số dòng", () => {
  // 2 + 3 + 1 + 2 + 5 + 1 = 14
  assert.equal(reports.summarizeSales(SAMPLE_SALES).itemCount, 14);
});

test("summarizeSales: chấp nhận hóa đơn thiếu trường (dữ liệu cũ) mà không ném lỗi", () => {
  const summary = reports.summarizeSales([{ orderId: "X", timestamp: NOW.toISOString() }]);
  assert.equal(summary.orderCount, 1);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.itemCount, 0);
});

/* ===========================================================================
 * 4. Lọc theo khoảng thời gian
 * ======================================================================== */

test("filterSalesByRange: 'hôm nay' chỉ lấy hóa đơn trong ngày", () => {
  const today = reports.filterSalesByRange(SAMPLE_SALES, reports.RANGE_TODAY, NOW);
  assert.equal(today.length, 2);
  assert.deepEqual(today.map((item) => item.orderId).sort(), ["AAAA1111", "BBBB2222"]);
});

test("filterSalesByRange: '7 ngày qua' gồm cả hôm nay và mốc 6 ngày trước", () => {
  const week = reports.filterSalesByRange(SAMPLE_SALES, reports.RANGE_WEEK, NOW);
  assert.equal(week.length, 4);
  assert.ok(week.some((item) => item.orderId === "DDDD4444"), "hóa đơn 6 ngày trước vẫn nằm trong 7 ngày qua");
  assert.ok(!week.some((item) => item.orderId === "EEEE5555"), "hóa đơn 20 ngày trước phải bị loại");
});

test("filterSalesByRange: 'toàn bộ' giữ mọi hóa đơn và sắp mới nhất trước", () => {
  const all = reports.filterSalesByRange(SAMPLE_SALES, reports.RANGE_ALL, NOW);
  assert.equal(all.length, 5);
  const times = all.map((item) => new Date(item.timestamp).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "phải sắp xếp mới nhất trước");
});

test("filterSalesByRange: bỏ qua hóa đơn có mốc thời gian hỏng", () => {
  const broken = [...SAMPLE_SALES, { orderId: "ZZZZ", timestamp: "không phải ngày", lines: [] }];
  const all = reports.filterSalesByRange(broken, reports.RANGE_ALL, NOW);
  assert.equal(all.length, 5);
});

test("rangeStart: mốc bắt đầu của 'hôm nay' là 00:00 và của 'toàn bộ' là null", () => {
  const start = reports.rangeStart(reports.RANGE_TODAY, NOW);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getDate(), NOW.getDate());
  assert.equal(reports.rangeStart(reports.RANGE_ALL, NOW), null);
});

/* ===========================================================================
 * 5. Doanh thu theo nhóm hàng
 * ======================================================================== */

test("revenueByCategory: gom đúng doanh thu (đã gồm thuế) theo nhóm", () => {
  const rows = reports.revenueByCategory(SAMPLE_SALES);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  // Grocery: (4500+450)*3 + (12000+1200)*1 = 14850 + 13200 = 28050
  assert.equal(byKey.Grocery, 28050);
  // Dairy: (9000+900)*2 = 19800
  assert.equal(byKey.Dairy, 19800);
  // Snacks: (3000+300)*5 = 16500
  assert.equal(byKey.Snacks, 16500);
  // Electronics: 44000 (3 ngày trước) + 151200 (20 ngày trước) = 195200
  assert.equal(byKey.Electronics, 195200);
});

test("revenueByCategory: giữ thứ tự nhóm cố định của cửa hàng", () => {
  const rows = reports.revenueByCategory(SAMPLE_SALES);
  // CATEGORY_ORDER: Grocery, Beverages, Snacks, Produce, Dairy, PersonalCare, Household, Electronics, General
  assert.deepEqual(rows.map((row) => row.key), ["Grocery", "Snacks", "Dairy", "Electronics"]);
});

test("revenueByCategory: tổng các nhóm bằng tổng doanh thu", () => {
  const total = reports.revenueByCategory(SAMPLE_SALES).reduce((sum, row) => sum + row.value, 0);
  assert.equal(total, reports.summarizeSales(SAMPLE_SALES).revenue);
});

test("revenueByCategory: bỏ nhóm không phát sinh doanh thu và nhóm rỗng trả mảng rỗng", () => {
  assert.deepEqual(reports.revenueByCategory([]), []);
  const rows = reports.revenueByCategory(SAMPLE_SALES);
  assert.ok(rows.every((row) => row.value > 0));
});

/* ===========================================================================
 * 6. Dữ liệu cho biểu đồ cột
 * ======================================================================== */

test("prepareBarItems: tự tính max bằng giá trị lớn nhất", () => {
  const prepared = charts.prepareBarItems([
    { label: "A", value: 120 },
    { label: "B", value: 480 },
    { label: "C", value: 260 }
  ]);
  assert.equal(prepared.max, 480);
  assert.equal(prepared.items[0].value, 480);
});

test("prepareBarItems: mặc định sắp xếp giảm dần theo giá trị", () => {
  const prepared = charts.prepareBarItems([
    { label: "A", value: 10 },
    { label: "B", value: 90 },
    { label: "C", value: 40 }
  ]);
  assert.deepEqual(prepared.items.map((item) => item.label), ["B", "C", "A"]);
});

test("prepareBarItems: sort:false giữ nguyên thứ tự đầu vào (dùng cho nhóm hàng)", () => {
  const prepared = charts.prepareBarItems(
    [
      { label: "Grocery", value: 10 },
      { label: "Electronics", value: 900 }
    ],
    { sort: false }
  );
  assert.deepEqual(prepared.items.map((item) => item.label), ["Grocery", "Electronics"]);
});

test("prepareBarItems: bỏ giá trị âm, gán màu theo bảng màu và tính ratio", () => {
  const prepared = charts.prepareBarItems([
    { label: "A", value: 50 },
    { label: "B", value: -20 }
  ]);
  assert.equal(prepared.items.length, 1);
  assert.equal(prepared.items[0].ratio, 1);
  assert.equal(prepared.items[0].color, charts.seriesColor(0));
});

test("buildCategoryChartData: max bằng nhóm lớn nhất và không sắp xếp lại nhóm", () => {
  const rows = reports.revenueByCategory(SAMPLE_SALES);
  const data = reports.buildCategoryChartData(rows);
  assert.equal(data.max, 195200);
  assert.deepEqual(data.items.map((item) => item.label), ["Thực phẩm", "Bánh kẹo", "Sữa & bơ", "Điện tử"]);
  assert.ok(data.items.every((item) => String(item.color).startsWith("var(--")), "màu phải là biến CSS");
});

/* ===========================================================================
 * 7. CSV
 * ======================================================================== */

test("buildSalesCsv: bắt đầu bằng BOM UTF-8", () => {
  const csv = reports.buildSalesCsv(SAMPLE_SALES);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.startsWith("\uFEFF"));
});

test("buildSalesCsv: dòng tiêu đề đúng thứ tự cột", () => {
  const csv = reports.buildSalesCsv([]);
  const header = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
  assert.equal(header, "Mã đơn,Thời gian,Thanh toán,Số món,Tạm tính,Giảm giá,Thuế,Tổng cộng");
});

test("buildSalesCsv: số dòng = 1 tiêu đề + số hóa đơn", () => {
  const csv = reports.buildSalesCsv(SAMPLE_SALES);
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines.length, SAMPLE_SALES.length + 1);
});

test("buildSalesCsv: nội dung từng cột khớp với hóa đơn", () => {
  const csv = reports.buildSalesCsv([SAMPLE_SALES[1]]);
  const row = csv.replace(/^\uFEFF/, "").split("\r\n")[1].split(",");
  assert.equal(row[0], "BBBB2222");
  assert.equal(row[2], "Thẻ ngân hàng");
  assert.equal(row[3], "1");
  assert.equal(row[4], "13000");
  assert.equal(row[5], "1000");
  assert.equal(row[6], "1200");
  assert.equal(row[7], "13200");
});

test("escapeCsvCell: bọc ngoặc kép khi có dấu phẩy", () => {
  assert.equal(reports.escapeCsvCell("Sữa, bơ"), '"Sữa, bơ"');
});

test("escapeCsvCell: nhân đôi ngoặc kép bên trong", () => {
  assert.equal(reports.escapeCsvCell('Mì "Hảo Hảo"'), '"Mì ""Hảo Hảo"""');
});

test("escapeCsvCell: giữ nguyên ô bình thường và ô rỗng", () => {
  assert.equal(reports.escapeCsvCell("Bình thường"), "Bình thường");
  assert.equal(reports.escapeCsvCell(null), "");
  assert.equal(reports.escapeCsvCell(1234), "1234");
});

test("toCsvText: nối các dòng bằng CRLF theo chuẩn RFC 4180", () => {
  const text = reports.toCsvText([
    ["a", "b"],
    ["c", "d"]
  ]);
  assert.equal(text, "a,b\r\nc,d");
});

test("csvFileName: đúng mẫu SmartMart-doanh-thu-YYYY-MM-DD.csv", () => {
  assert.equal(reports.csvFileName(new Date(2026, 10, 12)), "SmartMart-doanh-thu-2026-11-12.csv");
  assert.match(reports.csvFileName(new Date(2026, 0, 5)), /^SmartMart-doanh-thu-2026-01-05\.csv$/);
});

/* ===========================================================================
 * 8. Biểu đồ dựng được SVG thật (trong DOM giả)
 * ======================================================================== */

test("barChart: trả về phần tử SVG có cột và nhãn giá trị", () => {
  const svg = charts.barChart({
    items: [
      { label: "Thực phẩm", value: 100 },
      { label: "Điện tử", value: 400 }
    ],
    formatValue: (value) => String(value),
    height: 240
  });
  assert.equal(svg.tagName, "SVG");
  const bars = svg.querySelectorAll("rect");
  assert.equal(bars.length, 2, "mỗi mục là một cột");
  const texts = svg.querySelectorAll("text");
  assert.ok(texts.length >= 2, "phải có nhãn giá trị / nhãn trục");
});

test("barChart: danh sách rỗng trả về khối .chart-empty thay vì SVG", () => {
  const node = charts.barChart({ items: [] });
  assert.notEqual(node.tagName, "SVG");
  assert.match(node.className, /chart-empty/);
});

test("donutChart: mỗi nhóm là một cung và tổng tỉ lệ hiển thị 100%", () => {
  const svg = charts.donutChart({
    items: [
      { label: "A", value: 3 },
      { label: "B", value: 1 }
    ],
    size: 180,
    thickness: 22,
    centerLabel: "Tổng",
    centerValue: "4"
  });
  assert.equal(svg.querySelectorAll("circle").length, 2, "3:1 thì có 2 cung");
  const legend = svg.querySelectorAll("text").map((node) => node.textContent);
  assert.ok(legend.includes("75%"));
  assert.ok(legend.includes("25%"));
});

test("donutChart: toàn số 0 trả về khối rỗng", () => {
  const node = charts.donutChart({ items: [{ label: "A", value: 0 }] });
  assert.match(node.className, /chart-empty/);
});

test("sparkline: vẽ được đường khi có ít nhất 2 điểm", () => {
  const svg = charts.sparkline({ values: [1, 4, 2, 8] });
  assert.equal(svg.tagName, "SVG");
  assert.equal(svg.querySelectorAll("path").length, 2, "một vùng nền và một đường");
});

/* ===========================================================================
 * 9. renderReports trả về Node bọc trong .view
 * ======================================================================== */

test("renderReports: trả về một phần tử .view chứa thẻ số liệu và bảng", () => {
  const node = reports.renderReports({
    state: { sales: SAMPLE_SALES, products: [], users: [], currentUser: null },
    toast: null,
    confirm: null,
    refresh: null,
    // Truyền mốc thời gian cố định: SAMPLE_SALES dựng quanh NOW, nên nếu view đọc
    // đồng hồ hệ thống thì bộ lọc "Hôm nay" sẽ ra rỗng vào bất kỳ ngày nào khác NOW.
    now: NOW
  });

  assert.ok(node instanceof globalThis.Node, "phải trả về Node");
  assert.match(node.className, /(^|\s)view(\s|$)/, "phải bọc trong .view");

  const metrics = node.querySelectorAll(".metric");
  assert.equal(metrics.length, 4, "bốn thẻ số liệu");

  const headings = node.querySelectorAll("h2").map((element) => element.textContent);
  assert.ok(headings.includes("Hóa đơn"));
  assert.ok(headings.includes("Doanh thu theo nhóm hàng"));
});

test("renderReports: bộ lọc 'Hôm nay' chỉ tính hóa đơn trong ngày của mốc now", () => {
  const node = reports.renderReports({
    state: { sales: SAMPLE_SALES, products: [], users: [], currentUser: null },
    toast: null,
    confirm: null,
    refresh: null,
    now: NOW
  });

  // SAMPLE_SALES chỉ có 2 hóa đơn trong ngày NOW; 3 hóa đơn còn lại là của những
  // ngày trước đó nên không được tính vào số đơn của bộ lọc "Hôm nay".
  const orderMetric = node.querySelectorAll(".metric")[1];
  assert.equal(
    orderMetric.querySelector(".metric__value").textContent,
    "2",
    "chỉ đếm 2 đơn của ngày NOW"
  );
});

test("renderReports: mốc now không hợp lệ thì quay về đồng hồ hệ thống thay vì vỡ", () => {
  const node = reports.renderReports({
    state: { sales: SAMPLE_SALES, products: [], users: [], currentUser: null },
    toast: null,
    confirm: null,
    refresh: null,
    now: new Date("không phải ngày")
  });

  assert.match(node.className, /(^|\s)view(\s|$)/);
  assert.equal(node.querySelectorAll(".metric").length, 4);
});

test("renderReports: khi chưa có hóa đơn thì hiện trạng thái rỗng thân thiện", () => {
  const node = reports.renderReports({
    state: { sales: [], products: [], users: [], currentUser: null },
    toast: null,
    confirm: null,
    refresh: null,
    now: NOW
  });

  const empty = node.querySelectorAll(".empty");
  assert.ok(empty.length >= 1, "phải có khối .empty");
  const text = empty.map((element) => element.textContent).join(" ");
  assert.match(text, /Chưa có hóa đơn/);
});
/* ===========================================================================
 * 10. Màn hình Kho hàng — trạng thái cảnh báo và lọc
 * ======================================================================== */

const inventoryView = await import("../js/views/inventory.js");

/** Sản phẩm giả tối giản: chỉ cần những getter mà view đọc tới. */
function fakeProduct(overrides = {}) {
  const base = {
    id: 1001,
    name: "Mì Hảo Hảo",
    category: "Grocery",
    unitPrice: 4500,
    discountedPrice: 4275,
    discountPercent: 5,
    stock: 24,
    lowStockThreshold: 5,
    kind: "general",
    barcode: "8934563138165",
    catalogKey: "",
    isLowStock: false,
    isExpired: false,
    isNearExpiry: false,
    expiryDate: null,
    serialNumber: "",
    calculateTax: () => 450,
    displayInfo: () => "Nhà cung cấp: CleanCo"
  };
  return { ...base, ...overrides };
}

test("alertStateOf: phân loại đúng hết hàng, sắp hết, cận hạn, hết hạn", () => {
  assert.equal(inventoryView.alertStateOf(fakeProduct({ stock: 0 })), inventoryView.ALERT_OUT);
  assert.equal(inventoryView.alertStateOf(fakeProduct({ stock: 3, isLowStock: true })), inventoryView.ALERT_LOW);
  assert.equal(inventoryView.alertStateOf(fakeProduct({ isNearExpiry: true, kind: "perishable" })), inventoryView.ALERT_NEAR_EXPIRY);
  assert.equal(inventoryView.alertStateOf(fakeProduct({ isExpired: true, kind: "perishable" })), inventoryView.ALERT_EXPIRED);
  assert.equal(inventoryView.alertStateOf(fakeProduct()), inventoryView.ALERT_NONE);
});

test("rowToneOf: việc gấp tô coral, việc cần để ý tô amber, còn lại không tô", () => {
  assert.equal(inventoryView.rowToneOf(fakeProduct({ stock: 0 })), "coral");
  assert.equal(inventoryView.rowToneOf(fakeProduct({ isExpired: true })), "coral");
  assert.equal(inventoryView.rowToneOf(fakeProduct({ isLowStock: true, stock: 2 })), "amber");
  assert.equal(inventoryView.rowToneOf(fakeProduct({ isNearExpiry: true })), "amber");
  assert.equal(inventoryView.rowToneOf(fakeProduct()), null);
});

test("filterInventory: tìm không dấu vẫn ra đúng mặt hàng", () => {
  const products = [fakeProduct({ id: 1, name: "Sữa tươi Vinamilk" }), fakeProduct({ id: 2, name: "Bánh quy bơ" })];
  const found = inventoryView.filterInventory(products, { query: "sua tuoi" });
  assert.deepEqual(found.map((product) => product.id), [1]);
});

test("filterInventory: lọc theo nhóm hàng và theo hàng cần chú ý", () => {
  const products = [
    fakeProduct({ id: 1, category: "Grocery" }),
    fakeProduct({ id: 2, category: "Dairy", isLowStock: true, stock: 1 }),
    fakeProduct({ id: 3, category: "Dairy" })
  ];
  assert.deepEqual(inventoryView.filterInventory(products, { category: "Dairy" }).map((p) => p.id), [2, 3]);
  assert.deepEqual(inventoryView.filterInventory(products, { attentionOnly: true }).map((p) => p.id), [2]);
});

test("validateProductForm: báo lỗi tiếng Việt cho từng trường sai", () => {
  const errors = inventoryView.validateProductForm(
    { name: "", category: "Grocery", kind: "general", price: "", stock: "" },
    []
  );
  assert.ok(errors.name);
  assert.ok(errors.price);
  assert.ok(errors.stock);
  assert.match(errors.name, /tên mặt hàng/i);
});

test("validateProductForm: chặn trùng tên và chặn hạn dùng sai định dạng", () => {
  const existing = [fakeProduct({ name: "Sữa tươi" })];
  const errors = inventoryView.validateProductForm(
    { name: "sữa tươi", category: "Dairy", kind: "perishable", price: "10000", stock: "5", expiryDate: "31/12/2026" },
    existing
  );
  assert.match(errors.name, /trùng tên/);
  assert.match(errors.expiryDate, /năm-tháng-ngày/);
});

test("validateProductForm: dữ liệu hợp lệ thì không còn lỗi nào", () => {
  const errors = inventoryView.validateProductForm(
    { name: "Nước mắm Nam Ngư", category: "Grocery", kind: "general", price: "38000", stock: "12" },
    []
  );
  assert.deepEqual(errors, {});
});

test("draftFromForm: dựng plain object đúng hợp đồng cho từng loại hàng", () => {
  const perishable = inventoryView.draftFromForm(
    { name: "Rau muống", category: "Produce", kind: "perishable", price: "8000", stock: "20", expiryDate: "2026-11-20" },
    2001
  );
  assert.equal(perishable.id, 2001);
  assert.equal(perishable.price, 8000);
  assert.equal(perishable.stock, 20);
  assert.equal(perishable.expiryDate, "2026-11-20");
  assert.equal(perishable.kind, "perishable");

  const electronic = inventoryView.draftFromForm(
    { name: "Chuột không dây", category: "Electronics", kind: "electronic", price: "250000", stock: "4", warrantyMonths: "12" },
    2002
  );
  assert.equal(electronic.warrantyMonths, 12);
  assert.equal(electronic.serialNumber, "SM-2002");
});

test("inventorySummary: đếm đúng mặt hàng, sắp hết, cảnh báo hạn và giá trị tồn", () => {
  const products = [
    fakeProduct({ id: 1, unitPrice: 1000, stock: 10 }),
    fakeProduct({ id: 2, unitPrice: 2000, stock: 0 }),
    fakeProduct({ id: 3, unitPrice: 500, stock: 4, isLowStock: true }),
    fakeProduct({ id: 4, unitPrice: 9000, stock: 2, isLowStock: true, isNearExpiry: true })
  ];
  const summary = inventoryView.inventorySummary(products);
  assert.equal(summary.count, 4);
  assert.equal(summary.lowStock, 3, "một mặt hàng hết hàng cũng tính vào nhóm cần nhập");
  assert.equal(summary.expiring, 1);
  assert.equal(summary.value, 10000 + 0 + 2000 + 18000);
});

test("nextProductId: lấy số lớn nhất cộng một, tối thiểu 1001", () => {
  assert.equal(inventoryView.nextProductId([]), 1001);
  assert.equal(inventoryView.nextProductId([{ id: 1001 }, { id: 1072 }]), 1073);
});

test("renderInventory: trả về Node .view với bốn thẻ số liệu và bảng row-alert", () => {
  const node = inventoryView.renderInventory({
    state: {
      products: [fakeProduct(), fakeProduct({ id: 2, name: "Sữa tươi", stock: 0 })],
      users: [],
      sales: [],
      currentUser: null
    },
    toast: null,
    confirm: null,
    refresh: null
  });

  assert.ok(node instanceof globalThis.Node);
  assert.match(node.className, /(^|\s)view(\s|$)/);
  assert.equal(node.querySelectorAll(".metric").length, 4);
  assert.equal(node.querySelectorAll(".table--row-alert").length, 1);
});

test("renderInventory: kho trống thì hiện khối .empty thân thiện", () => {
  const node = inventoryView.renderInventory({
    state: { products: [], users: [], sales: [], currentUser: null },
    toast: null,
    confirm: null,
    refresh: null
  });
  const text = node.querySelectorAll(".empty").map((element) => element.textContent).join(" ");
  assert.match(text, /Kho hàng đang trống/);
});

/* ===========================================================================
 * 11. Màn hình Nhân sự — chốt an toàn tự thao tác trên chính mình
 * ======================================================================== */

const usersView = await import("../js/views/users.js");

test("selfGuardMessage: chặn thao tác lên chính mình, cho phép người khác", () => {
  const me = { username: "admin" };
  assert.match(usersView.selfGuardMessage({ username: "admin" }, me), /chính mình/);
  assert.match(usersView.selfGuardMessage({ username: " ADMIN " }, me), /chính mình/);
  assert.equal(usersView.selfGuardMessage({ username: "manager" }, me), null);
  assert.equal(usersView.selfGuardMessage(null, me), null);
});

test("validateUserForm: chặn tên trùng (không phân biệt hoa thường) và mật khẩu ngắn", () => {
  const existing = [{ username: "admin" }, { username: "cashier" }];
  const errors = usersView.validateUserForm({ username: "Admin", password: "123", role: "Cashier" }, existing);
  assert.match(errors.username, /đã có người dùng/);
  assert.match(errors.password, /ít nhất 6 ký tự/);
});

test("validateUserForm: dữ liệu hợp lệ thì không có lỗi", () => {
  const errors = usersView.validateUserForm({ username: "nhanvien2", password: "matkhau1", role: "Manager" }, []);
  assert.deepEqual(errors, {});
});

test("summarizeUsers: đếm tổng và số quản trị viên, kèm vai trò người đang đăng nhập", () => {
  const summary = usersView.summarizeUsers(
    [{ role: "Admin" }, { role: "Admin" }, { role: "Cashier" }],
    { role: "Manager" }
  );
  assert.deepEqual(summary, { total: 3, admins: 2, roleOfCurrent: "Manager" });
});

test("sortUsers: quản trị viên đứng trước, cùng vai trò xếp theo tên", () => {
  const sorted = usersView.sortUsers([
    { username: "cashier", role: "Cashier" },
    { username: "admin", role: "Admin" },
    { username: "manager", role: "Manager" }
  ]);
  assert.deepEqual(sorted.map((user) => user.username), ["admin", "manager", "cashier"]);
});

test("roleBadgeClass: mỗi vai trò một lớp badge riêng", () => {
  assert.equal(usersView.roleBadgeClass("Admin"), "badge badge--violet");
  assert.equal(usersView.roleBadgeClass("Manager"), "badge badge--brand");
  assert.equal(usersView.roleBadgeClass("Cashier"), "badge badge--outline");
});

test("allowedScreenLabels: đọc đúng quyền của từng vai trò", () => {
  assert.deepEqual(
    usersView.allowedScreenLabels({ allowedScreens: () => ["Checkout", "Inventory", "Reports", "Users"] }),
    ["Bán hàng", "Kho hàng", "Doanh thu", "Nhân sự"]
  );
  assert.deepEqual(usersView.allowedScreenLabels({}), [], "thiếu phương thức thì trả mảng rỗng, không ném lỗi");
});

test("renderUsers: trả về Node .view với ba thẻ số liệu và bảng tài khoản", () => {
  const node = usersView.renderUsers({
    state: {
      users: [
        { username: "admin", role: "Admin", allowedScreens: () => ["Checkout", "Inventory", "Reports", "Users"] },
        { username: "cashier", role: "Cashier", allowedScreens: () => ["Checkout"] }
      ],
      currentUser: { username: "admin", role: "Admin", allowedScreens: () => ["Checkout", "Inventory", "Reports", "Users"] },
      products: [],
      sales: []
    },
    toast: null,
    confirm: null,
    refresh: null
  });

  assert.ok(node instanceof globalThis.Node);
  assert.match(node.className, /(^|\s)view(\s|$)/);
  assert.equal(node.querySelectorAll(".metric").length, 3);
  const names = node.querySelectorAll(".us-person__name").map((element) => element.textContent);
  assert.deepEqual(names, ["admin", "cashier"]);
});

/* ===========================================================================
 * 12. Quy ước màu của biểu đồ
 * ======================================================================== */

test("seriesColor: luôn trả về biến CSS, không có mã màu thô", () => {
  for (let index = 0; index < charts.SERIES_COLORS.length * 2; index += 1) {
    const color = charts.seriesColor(index);
    assert.ok(color.startsWith("var(--"), "màu phải là biến trong tokens.css: " + color);
  }
});

test("seriesColor: quay vòng khi vượt quá bảng màu", () => {
  const length = charts.SERIES_COLORS.length;
  assert.equal(charts.seriesColor(length), charts.seriesColor(0));
  assert.equal(charts.seriesColor(-1), charts.seriesColor(length - 1));
});
test("saleMoney: hóa đơn khôi phục từ JSON (không có grandTotal) vẫn ra tổng đúng", () => {
  // Transaction.toJSON() không lưu grandTotal — đây chính là cái bẫy hay gặp.
  const restored = {
    orderId: "FFFF6666",
    timestamp: NOW.toISOString(),
    lines: [line({ quantity: 2 })],
    subtotal: 40000,
    discountedTotal: 36000,
    tax: 3600,
    payment: { method: "Cash", amount: 39600 }
  };
  const money = reports.saleMoney(restored);
  assert.equal(money.subtotal, 40000);
  assert.equal(money.discount, 4000);
  assert.equal(money.tax, 3600);
  assert.equal(money.total, 39600, "tổng phải bằng discountedTotal + tax");
});

test("saleMoney: ưu tiên grandTotal khi có sẵn (Transaction thật)", () => {
  const money = reports.saleMoney({ subtotal: 1000, discountedTotal: 900, tax: 90, grandTotal: 990 });
  assert.equal(money.total, 990);
});

test("dailyRevenueSeries: trả đúng 7 phần tử, phần tử cuối là hôm nay", () => {
  const series = reports.dailyRevenueSeries(SAMPLE_SALES, 7, NOW);
  assert.equal(series.length, 7);
  assert.equal(series[6], 34650 + 13200, "hôm nay gồm hai hóa đơn");
  assert.equal(series[0], 16500, "ô đầu tiên là 6 ngày trước");
  assert.equal(series[1], 0, "ngày không bán được phải là 0");
  assert.equal(series[3], 44000, "hóa đơn 3 ngày trước nằm đúng ô");
});

test("dailyRevenueSeries: hóa đơn ngoài cửa sổ 7 ngày không được tính", () => {
  const series = reports.dailyRevenueSeries(SAMPLE_SALES, 7, NOW);
  const sum = series.reduce((total, value) => total + value, 0);
  // 34650 + 13200 + 44000 + 16500 (hóa đơn 20 ngày trước bị loại)
  assert.equal(sum, 108350);
});

test("dailyRevenueSeries: khoảng trống (ngày không bán được) là 0 chứ không phải undefined", () => {
  const series = reports.dailyRevenueSeries([], 7, NOW);
  assert.deepEqual(series, [0, 0, 0, 0, 0, 0, 0]);
});
