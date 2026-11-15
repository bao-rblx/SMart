/**
 * SmartMart · Hóa đơn
 * ---------------------------------------------------------------------------
 * Một Transaction là BẢN CHỤP BẤT BIẾN của một lần bán. Mọi con số trên hóa đơn
 * (đơn giá, ưu đãi, thuế) được chốt vào SaleLine ngay lúc bán; sửa giá hay sửa
 * ưu đãi của sản phẩm sau đó KHÔNG làm đổi hóa đơn cũ. Vì sao: hóa đơn là chứng
 * từ — nó phải kể đúng câu chuyện của lúc khách trả tiền, không phải của hôm nay.
 *
 * Tiền luôn là số nguyên đồng, mọi phép tính đi qua roundAmount().
 */

import { PaymentMethod } from "./constants.js";
import {
  formatDateTime,
  formatDiscount,
  formatMoney,
  formatNumber,
  numberToVietnameseWords,
  roundMoney,
  truncate
} from "./format.js";
import { paymentLabel } from "./vietnamese.js";

/** Độ rộng cố định của tờ hóa đơn in bằng văn bản thuần (ký tự). */
export const INVOICE_WIDTH = 44;

export const STORE_NAME = "SMARTMART";
export const STORE_SLOGAN = "Mua sắm tiện lợi, giá tốt mỗi ngày";

const ORDER_ID_LENGTH = 8;
/** Bỏ I và O để mã đơn in ra giấy không bị đọc nhầm thành 1 và 0. */
const ORDER_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Giữ các mã vừa phát để hai hóa đơn liên tiếp không trùng số hiệu. */
const issuedOrderIds = new Set();

/* ============================================================
   Tiện ích dùng chung trong tệp này và cart.js
   ============================================================ */

/**
 * Làm tròn tới đồng, đồng thời triệt tiêu -0 (Intl in ra "-0 ₫" trông như lỗi in).
 * Bọc roundMoney của format.js để chỉ có MỘT quy tắc làm tròn trong cả ứng dụng.
 */
export function roundAmount(value) {
  const rounded = roundMoney(value);
  return rounded === 0 ? 0 : rounded;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/** Nhận Date, chuỗi ISO, mốc mili giây; luôn trả về Date hợp lệ (bản mới, không chia sẻ). */
function normalizeTimestamp(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Sinh mã đơn 8 ký tự hoa. Không dùng cho mục đích bảo mật, chỉ để tra cứu. */
function createOrderId() {
  let orderId = "";
  do {
    orderId = "";
    for (let index = 0; index < ORDER_ID_LENGTH; index += 1) {
      const position = Math.floor(Math.random() * ORDER_ID_ALPHABET.length);
      orderId += ORDER_ID_ALPHABET[position];
    }
  } while (issuedOrderIds.has(orderId));
  if (issuedOrderIds.size > 5000) issuedOrderIds.clear();
  issuedOrderIds.add(orderId);
  return orderId;
}

/** Mã đơn do bên ngoài đưa vào (khôi phục từ kho) được giữ nguyên nếu đúng chuẩn. */
function normalizeOrderId(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text.length === ORDER_ID_LENGTH && /^[A-Z0-9]+$/.test(text)) {
    issuedOrderIds.add(text);
    return text;
  }
  return createOrderId();
}

/** Lấy số nếu hợp lệ, ngược lại dùng giá trị tính được từ các dòng hàng. */
function pickAmount(value, fallback) {
  return Number.isFinite(value) ? roundAmount(value) : roundAmount(fallback);
}

function sumLineAmount(lines, pick) {
  return lines.reduce((total, line) => total + pick(line), 0);
}

/* ============================================================
   PaymentDetails
   ============================================================ */

export class PaymentDetails {
  #method;
  #amount;

  constructor(method, amount = 0) {
    const value = roundAmount(amount);
    if (!Number.isFinite(value)) {
      throw new RangeError("Số tiền thanh toán phải là một số hợp lệ.");
    }
    if (value < 0) {
      throw new RangeError("Số tiền thanh toán không được âm.");
    }
    this.#method = normalizePaymentMethod(method);
    this.#amount = value;
  }

  get method() {
    return this.#method;
  }

  /** Số tiền khách đưa, nguyên đồng, không âm. */
  get amount() {
    return this.#amount;
  }

  toJSON() {
    return { method: this.#method, amount: this.#amount };
  }

  static fromJSON(data) {
    if (data instanceof PaymentDetails) return data;
    return new PaymentDetails(data?.method, data?.amount ?? 0);
  }
}

/** Phương thức lạ vẫn được giữ nguyên: nhãn hiển thị sẽ tự rơi về "Khác". */
function normalizePaymentMethod(method) {
  const text = String(method ?? "").trim();
  return text || PaymentMethod.Cash;
}

/* ============================================================
   SaleLine — ảnh chụp một dòng hàng
   ============================================================ */

export class SaleLine {
  #productId;
  #name;
  #category;
  #quantity;
  #unitPrice;
  #discountedUnitPrice;
  #taxPerUnit;

  constructor({ productId, name, category, quantity, unitPrice, discountedUnitPrice, taxPerUnit }) {
    if (!isPositiveInteger(quantity)) {
      throw new RangeError("Số lượng trên hóa đơn phải là số nguyên lớn hơn 0.");
    }
    this.#productId = productId;
    this.#name = String(name ?? "Mặt hàng");
    this.#category = String(category ?? "");
    this.#quantity = quantity;
    this.#unitPrice = roundAmount(unitPrice);
    this.#discountedUnitPrice = roundAmount(discountedUnitPrice);
    this.#taxPerUnit = roundAmount(taxPerUnit);
  }

  /** Chụp lại một sản phẩm đang sống thành dòng hóa đơn độc lập. */
  static fromProduct(product, quantity) {
    return new SaleLine({
      productId: product.id,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: product.unitPrice,
      discountedUnitPrice: product.discountedPrice,
      taxPerUnit: product.calculateTax()
    });
  }

  get productId() {
    return this.#productId;
  }

  get name() {
    return this.#name;
  }

  get category() {
    return this.#category;
  }

  get quantity() {
    return this.#quantity;
  }

  /** Giá niêm yết tại lúc bán (trước ưu đãi). */
  get unitPrice() {
    return this.#unitPrice;
  }

  /** Giá thực thu tại lúc bán (sau ưu đãi) — đã đóng băng. */
  get discountedUnitPrice() {
    return this.#discountedUnitPrice;
  }

  get taxPerUnit() {
    return this.#taxPerUnit;
  }

  get discountPercent() {
    if (!this.#unitPrice) return 0;
    return Math.round((1 - this.#discountedUnitPrice / this.#unitPrice) * 100);
  }

  get lineTotal() {
    return roundAmount(this.#discountedUnitPrice * this.#quantity);
  }

  get taxTotal() {
    return roundAmount(this.#taxPerUnit * this.#quantity);
  }

  get grandTotal() {
    return roundAmount(this.lineTotal + this.taxTotal);
  }

  toJSON() {
    return {
      productId: this.#productId,
      name: this.#name,
      category: this.#category,
      quantity: this.#quantity,
      unitPrice: this.#unitPrice,
      discountedUnitPrice: this.#discountedUnitPrice,
      taxPerUnit: this.#taxPerUnit
    };
  }

  static fromJSON(data) {
    if (data instanceof SaleLine) return data;
    return new SaleLine(data ?? {});
  }
}

/* ============================================================
   Transaction
   ============================================================ */

export class Transaction {
  #orderId;
  #timestamp;
  #lines;
  #subtotal;
  #discountedTotal;
  #tax;
  #payment;

  constructor({ orderId, timestamp, lines, subtotal, discountedTotal, tax, payment } = {}) {
    const saleLines = (Array.isArray(lines) ? lines : []).map(toSaleLine);
    this.#orderId = normalizeOrderId(orderId);
    this.#timestamp = normalizeTimestamp(timestamp);
    this.#lines = Object.freeze(saleLines);
    this.#subtotal = pickAmount(subtotal, sumLineAmount(saleLines, (line) => line.unitPrice * line.quantity));
    this.#discountedTotal = pickAmount(discountedTotal, sumLineAmount(saleLines, (line) => line.lineTotal));
    this.#tax = pickAmount(tax, sumLineAmount(saleLines, (line) => line.taxTotal));
    this.#payment = resolvePayment(payment, this.grandTotal);
  }

  /** Mã đơn 8 ký tự hoa, in trên hóa đơn để tra cứu. */
  get orderId() {
    return this.#orderId;
  }

  /** Trả bản sao để bên ngoài không setTime() làm sai lệch chứng từ. */
  get timestamp() {
    return new Date(this.#timestamp.getTime());
  }

  get lines() {
    return this.#lines;
  }

  get subtotal() {
    return this.#subtotal;
  }

  get discountedTotal() {
    return this.#discountedTotal;
  }

  get savings() {
    return roundAmount(this.#subtotal - this.#discountedTotal);
  }

  get tax() {
    return this.#tax;
  }

  get grandTotal() {
    return roundAmount(this.#discountedTotal + this.#tax);
  }

  get itemCount() {
    return this.#lines.reduce((total, line) => total + line.quantity, 0);
  }

  get payment() {
    return this.#payment;
  }

  toJSON() {
    return {
      orderId: this.#orderId,
      timestamp: this.#timestamp.toISOString(),
      lines: this.#lines.map((line) => line.toJSON()),
      subtotal: this.#subtotal,
      discountedTotal: this.#discountedTotal,
      tax: this.#tax,
      payment: this.#payment.toJSON()
    };
  }

  static fromJSON(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Dữ liệu hóa đơn không hợp lệ.");
    }
    return new Transaction({
      orderId: data.orderId,
      timestamp: data.timestamp,
      lines: Array.isArray(data.lines) ? data.lines.map(toSaleLine) : [],
      subtotal: data.subtotal,
      discountedTotal: data.discountedTotal,
      tax: data.tax,
      payment: data.payment
    });
  }
}

function toSaleLine(value) {
  return value instanceof SaleLine ? value : SaleLine.fromJSON(value);
}

/** payment có thể là PaymentDetails, { method, amount } hoặc chỉ tên phương thức. */
function resolvePayment(payment, fallbackAmount) {
  if (payment instanceof PaymentDetails) return payment;
  if (payment && typeof payment === "object") {
    return new PaymentDetails(payment.method, Number.isFinite(payment.amount) ? payment.amount : fallbackAmount);
  }
  return new PaymentDetails(payment, fallbackAmount);
}

/* ============================================================
   Hóa đơn văn bản thuần
   ============================================================ */

function fit(text, width) {
  const value = String(text ?? "");
  return value.length <= width ? value : truncate(value, width);
}

function padRightTo(text, width) {
  const value = fit(text, width);
  return value + " ".repeat(Math.max(0, width - value.length));
}

function centered(text, width = INVOICE_WIDTH) {
  const value = fit(text, width);
  return " ".repeat(Math.max(0, Math.floor((width - value.length) / 2))) + value;
}

/** Một dòng hai cột: nhãn bên trái, số tiền canh phải theo đúng độ rộng tờ giấy. */
function twoColumns(left, right, width = INVOICE_WIDTH) {
  const rightText = fit(right, width);
  const room = Math.max(1, width - rightText.length - 1);
  const leftText = fit(left, room);
  return leftText + " ".repeat(Math.max(1, room - leftText.length + 1)) + rightText;
}

function rule(char = "-", width = INVOICE_WIDTH) {
  return char.repeat(width);
}

/** Ngắt câu theo từ cho vừa bề ngang tờ giấy. */
function wrapText(text, width) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const rows = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += " " + word;
    else {
      rows.push(fit(current, width));
      current = word;
    }
  }
  if (current) rows.push(fit(current, width));
  return rows.length > 0 ? rows : [""];
}

/**
 * Tên hàng dài thì xuống dòng, tối đa hai dòng rồi cắt đuôi — giữ chỗ cho tiền.
 * Dòng nối thụt vào 2 cột để mắt thấy ngay nó thuộc về mặt hàng phía trên.
 */
function nameRowsOf(line) {
  const wrapped = wrapText(line.name, INVOICE_WIDTH - 2);
  if (wrapped.length <= 2) return [wrapped[0], ...wrapped.slice(1).map((text) => "  " + text)];
  return [wrapped[0], "  " + truncate(wrapped.slice(1).join(" "), INVOICE_WIDTH - 2)];
}

/** Khối của một dòng hàng: tên + thành tiền, rồi "SL × đơn giá" bên dưới. */
function itemRowsOf(line) {
  const rows = nameRowsOf(line);
  rows[0] = twoColumns(rows[0], formatMoney(line.lineTotal));
  const percent = Math.round(line.discountPercent);
  const detail =
    `  ${formatNumber(line.quantity)} × ${formatMoney(line.discountedUnitPrice)}` +
    (percent > 0 ? `  ${formatDiscount(percent)}` : "");
  rows.push(padRightTo(detail, INVOICE_WIDTH));
  return rows;
}

/** Nhóm tổng tiền cuối hóa đơn, luôn đủ mặt dù bằng 0 để phiếu in có bố cục ổn định. */
function totalsRowsOf(sale) {
  return [
    twoColumns("Tạm tính (giá gốc)", formatMoney(sale.subtotal)),
    twoColumns("Tiết kiệm (ưu đãi)", sale.savings > 0 ? formatMoney(-sale.savings) : formatMoney(0)),
    twoColumns("Thuế", formatMoney(sale.tax)),
    rule("="),
    twoColumns("TỔNG CỘNG", formatMoney(sale.grandTotal)),
    rule("=")
  ];
}

function paymentRowsOf(sale) {
  const rows = [twoColumns("Phương thức thanh toán", paymentLabel(sale.payment.method))];
  const paid = sale.payment.amount;
  if (paid > sale.grandTotal) {
    rows.push(twoColumns("Tiền khách đưa", formatMoney(paid)));
    rows.push(twoColumns("Tiền thừa", formatMoney(paid - sale.grandTotal)));
  }
  return rows;
}

/** Số tiền bằng chữ: nhãn một dòng, câu chữ ngắt dòng ở bề ngang đầy đủ cho dễ đọc. */
function wordsRowsOf(total) {
  return ["Số tiền bằng chữ:", ...wrapText(numberToVietnameseWords(total), INVOICE_WIDTH)];
}

function metaRowsOf(sale) {
  return [
    padRightTo("Mã đơn", 10) + ": " + fit(sale.orderId, INVOICE_WIDTH - 12),
    padRightTo("Ngày giờ", 10) + ": " + fit(formatDateTime(sale.timestamp), INVOICE_WIDTH - 12)
  ];
}

/**
 * Dựng hóa đơn văn bản thuần (xuống dòng bằng \n), khổ 44 ký tự — vừa máy in
 * hóa đơn khổ 80 mm (54 ký tự) và in A5.
 */
export function generateInvoice(transaction) {
  const sale = asTransaction(transaction);
  const rows = [
    rule("="),
    centered(STORE_NAME),
    centered(STORE_SLOGAN),
    rule("="),
    ...metaRowsOf(sale),
    rule("-"),
    twoColumns("Tên hàng", "Thành tiền"),
    rule("-")
  ];
  for (const line of sale.lines) rows.push(...itemRowsOf(line));
  rows.push(rule("-"));
  rows.push(...totalsRowsOf(sale));
  rows.push(...paymentRowsOf(sale));
  rows.push(rule("-"));
  rows.push(...wordsRowsOf(sale.grandTotal));
  rows.push(rule("-"));
  rows.push(centered("Cảm ơn quý khách và hẹn gặp lại!"));
  rows.push(rule("="));
  return rows.join("\n");
}

/** Nhận Transaction hoặc plain object đã lưu để in lại hóa đơn cũ. */
function asTransaction(value) {
  if (value instanceof Transaction) return value;
  if (value && typeof value === "object" && Array.isArray(value.lines)) {
    return Transaction.fromJSON(value);
  }
  throw new Error("generateInvoice cần một Transaction hợp lệ.");
}
