/**
 * SmartMart · Kiểm thử giỏ hàng, thanh toán và hóa đơn
 * ---------------------------------------------------------------------------
 * Bộ kiểm thử này CỐ TÌNH không import models.js: nó dùng một lớp sản phẩm giả
 * tối giản ngay bên dưới. Vì sao: giỏ hàng chỉ được phép biết đúng hợp đồng của
 * sản phẩm (id, name, unitPrice, discountedPrice, discountPercent,
 * calculateTax(), canSell, stock, trySell()). Nhờ lớp giả, kiểm thử này độc lập
 * với phần đang được viết song song và luôn chạy được.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ShoppingCart, CartLine, ShoppingCartError } from "../js/core/cart.js";
import {
  Transaction,
  SaleLine,
  PaymentDetails,
  generateInvoice,
  roundAmount
} from "../js/core/transaction.js";
import { PaymentMethod } from "../js/core/constants.js";
import { roundMoney, numberToVietnameseWords, formatMoney } from "../js/core/format.js";

/* ============================================================
   Lớp sản phẩm giả — chỉ bám đúng hợp đồng của Product
   ============================================================ */

class FakeProduct {
  #id;
  #name;
  #category;
  #price;
  #stock;
  #discountRate;
  #taxRate;
  #expired;

  constructor({ id, name, category = "Grocery", price, stock, discountRate = 0, taxRate = 0.1, expired = false }) {
    this.#id = id;
    this.#name = name;
    this.#category = category;
    this.#price = price;
    this.#stock = stock;
    this.#discountRate = discountRate;
    this.#taxRate = taxRate;
    this.#expired = expired;
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get category() { return this.#category; }
  get unitPrice() { return roundMoney(this.#price); }
  get discountedPrice() { return roundMoney(this.unitPrice * (1 - this.#discountRate)); }
  get discountPercent() {
    const base = this.unitPrice;
    return base === 0 ? 0 : Math.round((1 - this.discountedPrice / base) * 100);
  }
  get stock() { return this.#stock; }
  get canSell() { return this.#stock > 0 && !this.#expired; }
  get expired() { return this.#expired; }

  calculateTax() { return roundMoney(this.discountedPrice * this.#taxRate); }

  trySell(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) return false;
    if (!this.canSell || quantity > this.#stock) return false;
    this.#stock -= quantity;
    return true;
  }

  /** Mô phỏng giá đổi sau khi đã bán — hóa đơn cũ phải giữ nguyên. */
  setPrice(price) { this.#price = price; return this; }

  /** Mô phỏng người khác bán mất hàng giữa lúc thêm giỏ và lúc thanh toán. */
  setStock(stock) { this.#stock = stock; return this; }
}

/** Ba "loại hàng" khác nhau, mỗi loại ưu đãi và thuế một kiểu — để kiểm tra đa hình. */
function makePerishable() {
  // Gạo: 20.000 ₫, giảm 30% → 14.000 ₫, thuế 10% → 1.400 ₫/món.
  return new FakeProduct({
    id: 1001, name: "Gạo ST25 túi 5 kg", category: "Grocery",
    price: 20000, stock: 50, discountRate: 0.3, taxRate: 0.1
  });
}
function makeElectronic() {
  // Tai nghe: 500.000 ₫, giảm 10% → 450.000 ₫, thuế 12% → 54.000 ₫/món.
  return new FakeProduct({
    id: 2002, name: "Tai nghe Bluetooth chống ồn", category: "Electronics",
    price: 500000, stock: 10, discountRate: 0.1, taxRate: 0.12
  });
}
function makeGeneral() {
  // Xà phòng: 12.000 ₫, giảm 5% → 11.400 ₫, thuế 10% → 1.140 ₫/món.
  return new FakeProduct({
    id: 3003, name: "Xà phòng thảo mộc 90 g", category: "Household",
    price: 12000, stock: 100, discountRate: 0.05, taxRate: 0.1
  });
}

function makeEmptyProduct() {
  return new FakeProduct({
    id: 4004, name: "Nước mắm chai 500 ml", category: "Grocery",
    price: 30000, stock: 0
  });
}

function makeExpiredProduct() {
  return new FakeProduct({
    id: 5005, name: "Sữa chua hộp 100 g", category: "Dairy",
    price: 8000, stock: 20, discountRate: 0.3, taxRate: 0.1, expired: true
  });
}

/** Giỏ hàng hỗn hợp dùng lại ở nhiều test: 2 gạo + 1 tai nghe + 3 xà phòng. */
function fillMixedCart() {
  const rice = makePerishable();
  const headphones = makeElectronic();
  const soap = makeGeneral();
  const cart = new ShoppingCart();
  cart.addItem(rice, 2);
  cart.addItem(headphones, 1);
  cart.addItem(soap, 3);
  return { cart, rice, headphones, soap };
}

/* ============================================================
   CartLine
   ============================================================ */

test("CartLine tính thành tiền, thuế và tổng của một dòng", () => {
  const line = new CartLine(makeElectronic(), 3);
  assert.equal(line.lineTotal, 1_350_000);   // 450.000 × 3
  assert.equal(line.taxTotal, 162_000);      // 54.000 × 3
  assert.equal(line.grandTotal, 1_512_000);
  assert.equal(line.discountPercent, 10);
  assert.equal(line.quantity, 3);
});

test("CartLine.withQuantity trả dòng mới, không sửa dòng cũ", () => {
  const product = makeGeneral();
  const line = new CartLine(product, 1);
  const bigger = line.withQuantity(4);
  assert.equal(line.quantity, 1);
  assert.equal(bigger.quantity, 4);
  assert.equal(bigger.lineTotal, 45_600);
  assert.notEqual(bigger, line);
  assert.equal(bigger.product, product);
});

test("CartLine từ chối số lượng không nguyên hoặc không dương", () => {
  const product = makeGeneral();
  assert.throws(() => new CartLine(product, 0), ShoppingCartError);
  assert.throws(() => new CartLine(product, -2), ShoppingCartError);
  assert.throws(() => new CartLine(product, 1.5), ShoppingCartError);
});

/* ============================================================
   ShoppingCart — thêm, sửa, xoá
   ============================================================ */

test("Giỏ mới rỗng: không dòng nào, tổng bằng 0", () => {
  const cart = new ShoppingCart();
  assert.equal(cart.isEmpty, true);
  assert.equal(cart.count, 0);
  assert.deepEqual(cart.lines, []);
  assert.equal(cart.subtotal, 0);
  assert.equal(cart.discountedTotal, 0);
  assert.equal(cart.savings, 0);
  assert.equal(cart.tax, 0);
  assert.equal(cart.grandTotal, 0);
});

test("addItem không truyền số lượng thì thêm đúng 1", () => {
  const cart = new ShoppingCart();
  cart.addItem(makeGeneral());
  assert.equal(cart.count, 1);
  assert.equal(cart.isEmpty, false);
  assert.equal(cart.quantityOf(3003), 1);
});

test("addItem gộp vào dòng đã có thay vì tạo dòng thứ hai", () => {
  const cart = new ShoppingCart();
  const soap = makeGeneral();
  cart.addItem(soap, 2);
  cart.addItem(soap, 3);
  cart.addItem(soap);
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0].quantity, 6);
  assert.equal(cart.count, 6);
});

test("addItem ném lỗi tiếng Việt khi số lượng <= 0", () => {
  const cart = new ShoppingCart();
  const soap = makeGeneral();
  assert.throws(() => cart.addItem(soap, 0), /lớn hơn 0/);
  assert.throws(() => cart.addItem(soap, -3), /lớn hơn 0/);
  assert.equal(cart.isEmpty, true);
});

test("addItem không cho vượt tồn kho, kể cả khi gộp với dòng đã có", () => {
  const cart = new ShoppingCart();
  const headphones = makeElectronic(); // tồn 10
  cart.addItem(headphones, 9);
  assert.throws(() => cart.addItem(headphones, 2), /không đủ|chỉ còn/);
  assert.equal(cart.quantityOf(2002), 9);
  cart.addItem(headphones, 1); // vừa đủ 10 thì được
  assert.equal(cart.quantityOf(2002), 10);
});

test("addItem từ chối mặt hàng đã hết hàng hoặc quá hạn dùng", () => {
  const cart = new ShoppingCart();
  assert.throws(() => cart.addItem(makeEmptyProduct()), /không thể bán/);
  assert.throws(() => cart.addItem(makeExpiredProduct()), /không thể bán/);
  assert.equal(cart.isEmpty, true);
});

test("setQuantity đổi số lượng, setQuantity(0) xoá dòng", () => {
  const cart = new ShoppingCart();
  const soap = makeGeneral();
  cart.addItem(soap, 2);
  cart.setQuantity(soap, 5);
  assert.equal(cart.quantityOf(3003), 5);
  assert.equal(cart.count, 5);

  cart.setQuantity(soap, 0);
  assert.equal(cart.quantityOf(3003), 0);
  assert.equal(cart.isEmpty, true);
  assert.equal(cart.lines.length, 0);
});

test("setQuantity vượt tồn kho thì ném lỗi và giữ nguyên số lượng cũ", () => {
  const cart = new ShoppingCart();
  const headphones = makeElectronic(); // tồn 10
  cart.addItem(headphones, 1);
  assert.throws(() => cart.setQuantity(headphones, 11), /không đủ|chỉ còn/);
  assert.equal(cart.quantityOf(2002), 1);
});

test("removeItem xoá đúng mặt hàng, không đụng dòng khác", () => {
  const { cart } = fillMixedCart();
  assert.equal(cart.removeItem(2002), true);
  assert.equal(cart.quantityOf(2002), 0);
  assert.equal(cart.quantityOf(1001), 2);
  assert.equal(cart.quantityOf(3003), 3);
  assert.equal(cart.lines.length, 2);
  assert.equal(cart.removeItem(2002), false);
});

test("clear xoá sạch giỏ", () => {
  const { cart } = fillMixedCart();
  cart.clear();
  assert.equal(cart.isEmpty, true);
  assert.equal(cart.count, 0);
  assert.equal(cart.grandTotal, 0);
});

test("canAdd trả false đúng lúc sắp vượt tồn kho", () => {
  const cart = new ShoppingCart();
  const headphones = makeElectronic(); // tồn 10
  assert.equal(cart.canAdd(headphones, 10), true);
  assert.equal(cart.canAdd(headphones, 11), false);

  cart.addItem(headphones, 8);
  assert.equal(cart.canAdd(headphones, 2), true);
  assert.equal(cart.canAdd(headphones, 3), false);
  assert.equal(cart.canAdd(makeEmptyProduct(), 1), false);
  assert.equal(cart.canAdd(makeExpiredProduct(), 1), false);
  assert.equal(cart.canAdd(headphones, 0), false);
});

test("getter lines trả bản sao, bên ngoài không sửa được giỏ", () => {
  const { cart } = fillMixedCart();
  const snapshot = cart.lines;
  snapshot.push(new CartLine(makeGeneral(), 1));
  assert.equal(cart.lines.length, 3);
  assert.notEqual(cart.lines, snapshot);
});

/* ============================================================
   Tổng tiền của giỏ hỗn hợp — kiểm tra đa hình
   ============================================================ */

test("Giỏ hỗn hợp 3 loại hàng: tổng ưu đãi bằng tổng từng dòng", () => {
  const { cart, rice, headphones, soap } = fillMixedCart();

  // Cộng tay từng dòng để chắc chắn giỏ không "tự chế" công thức riêng.
  const expectedDiscounted =
    roundAmount(rice.discountedPrice * 2) +
    roundAmount(headphones.discountedPrice * 1) +
    roundAmount(soap.discountedPrice * 3);
  const expectedTax =
    roundAmount(rice.calculateTax() * 2) +
    roundAmount(headphones.calculateTax() * 1) +
    roundAmount(soap.calculateTax() * 3);

  assert.equal(cart.discountedTotal, expectedDiscounted);
  assert.equal(cart.discountedTotal, 512_200);   // 28.000 + 450.000 + 34.200
  assert.equal(cart.tax, expectedTax);
  assert.equal(cart.tax, 60_220);                // 2.800 + 54.000 + 3.420
  assert.equal(cart.grandTotal, 572_420);
  assert.equal(cart.subtotal, 576_000);          // 40.000 + 500.000 + 36.000
  assert.equal(cart.savings, 63_800);
  assert.equal(cart.count, 6);                   // 2 + 1 + 3
});

test("Tổng của giỏ đúng bằng tổng các CartLine (đa hình)", () => {
  const { cart } = fillMixedCart();
  const lines = cart.lines;
  const sumLine = (pick) => roundAmount(lines.reduce((total, line) => total + pick(line), 0));
  assert.equal(cart.discountedTotal, sumLine((line) => line.lineTotal));
  assert.equal(cart.tax, sumLine((line) => line.taxTotal));
  assert.equal(cart.grandTotal, sumLine((line) => line.grandTotal));
});

test("Mọi con số tiền của giỏ đều là số nguyên đồng", () => {
  const cart = new ShoppingCart();
  // Giá lẻ để phép nhân ưu đãi sinh phần thập phân — vẫn phải làm tròn về đồng.
  cart.addItem(new FakeProduct({ id: 9001, name: "Kẹo que", price: 3333, stock: 20, discountRate: 0.05 }), 3);
  cart.addItem(makePerishable(), 1);

  const amounts = [cart.subtotal, cart.discountedTotal, cart.savings, cart.tax, cart.grandTotal];
  for (const amount of amounts) assert.ok(Number.isInteger(amount), `${amount} phải là số nguyên`);
  for (const line of cart.lines) {
    assert.ok(Number.isInteger(line.lineTotal));
    assert.ok(Number.isInteger(line.taxTotal));
    assert.ok(Number.isInteger(line.grandTotal));
  }
});

/* ============================================================
   checkout
   ============================================================ */

test("checkout giỏ trống ném Error", () => {
  const cart = new ShoppingCart();
  assert.throws(() => cart.checkout(), /trống/);
  assert.throws(() => cart.checkout(PaymentMethod.Card), Error);
});

test("checkout thiếu hàng ở MỘT dòng thì KHÔNG dòng nào bị trừ kho", () => {
  const cart = new ShoppingCart();
  const rice = makePerishable();       // tồn 50
  const headphones = makeElectronic(); // tồn 10
  cart.addItem(rice, 2);
  cart.addItem(headphones, 2);

  // Người khác bán mất hàng sau khi khách đã bỏ vào giỏ.
  headphones.setStock(1);

  assert.throws(() => cart.checkout(PaymentMethod.Cash), /không đủ|chỉ còn|không thể bán/);
  assert.equal(rice.stock, 50, "dòng đứng trước không được trừ kho");
  assert.equal(headphones.stock, 1, "dòng thiếu hàng cũng không bị trừ");
  assert.equal(cart.count, 4, "giỏ phải giữ nguyên để khách sửa");
});

test("checkout thành công: trừ đúng tồn kho, xoá giỏ, trả Transaction", () => {
  const { cart, rice, headphones, soap } = fillMixedCart();
  const saved = generateInvoice; // giữ tham chiếu để tránh nhầm lẫn không cần thiết
  assert.equal(typeof saved, "function");

  const transaction = cart.checkout(PaymentMethod.Card);

  assert.ok(transaction instanceof Transaction);
  assert.equal(cart.isEmpty, true);
  assert.equal(cart.count, 0);
  assert.equal(rice.stock, 48);
  assert.equal(headphones.stock, 9);
  assert.equal(soap.stock, 97);
  assert.equal(transaction.itemCount, 6);
  assert.equal(transaction.grandTotal, 572_420);
});

test("checkout mặc định dùng tiền mặt và ghi đúng phương thức", () => {
  const cart = new ShoppingCart();
  cart.addItem(makeGeneral(), 1);
  const transaction = cart.checkout();
  assert.equal(transaction.payment.method, PaymentMethod.Cash);
  assert.equal(transaction.payment.amount, transaction.grandTotal);

  const second = new ShoppingCart();
  second.addItem(makeGeneral(), 1);
  const byWallet = second.checkout(PaymentMethod.EWallet);
  assert.equal(byWallet.payment.method, PaymentMethod.EWallet);
});

/* ============================================================
   Transaction
   ============================================================ */

test("Transaction: grandTotal = discountedTotal + tax, itemCount đúng", () => {
  const { cart } = fillMixedCart();
  const transaction = cart.checkout(PaymentMethod.Cash);
  assert.equal(transaction.grandTotal, transaction.discountedTotal + transaction.tax);
  assert.equal(transaction.grandTotal, 572_420);
  assert.equal(transaction.discountedTotal, 512_200);
  assert.equal(transaction.tax, 60_220);
  assert.equal(transaction.subtotal, 576_000);
  assert.equal(transaction.savings, 63_800);
  assert.equal(transaction.itemCount, 6);
});

test("Transaction có mã đơn 8 ký tự hoa, thời gian là Date, dòng hàng đủ", () => {
  const { cart } = fillMixedCart();
  const transaction = cart.checkout(PaymentMethod.Cash);

  assert.match(transaction.orderId, /^[A-Z0-9]{8}$/);
  assert.equal(transaction.orderId.length, 8);
  assert.ok(transaction.timestamp instanceof Date);
  assert.ok(!Number.isNaN(transaction.timestamp.getTime()));
  assert.equal(transaction.lines.length, 3);
  assert.ok(transaction.lines.every((line) => line instanceof SaleLine));
});

test("SaleLine là ảnh chụp: đổi giá sau khi bán không làm đổi hóa đơn", () => {
  const cart = new ShoppingCart();
  const headphones = makeElectronic();
  cart.addItem(headphones, 2);
  const transaction = cart.checkout(PaymentMethod.Cash);
  const invoiceBefore = generateInvoice(transaction);
  const totalBefore = transaction.grandTotal;

  // Giá niêm yết tăng gấp đôi sau khi khách đã trả tiền.
  headphones.setPrice(1_000_000);

  assert.equal(transaction.grandTotal, totalBefore);
  assert.equal(transaction.lines[0].discountedUnitPrice, 450_000);
  assert.equal(generateInvoice(transaction), invoiceBefore);
});

test("toJSON/fromJSON giữ nguyên hóa đơn và khôi phục Date thật", () => {
  const { cart } = fillMixedCart();
  const original = cart.checkout(PaymentMethod.EWallet);
  const stored = JSON.parse(JSON.stringify(original.toJSON()));
  const restored = Transaction.fromJSON(stored);

  assert.ok(restored instanceof Transaction);
  assert.equal(restored.orderId, original.orderId);
  assert.ok(restored.timestamp instanceof Date);
  assert.equal(restored.timestamp.getTime(), original.timestamp.getTime());
  assert.equal(restored.grandTotal, original.grandTotal);
  assert.equal(restored.discountedTotal, original.discountedTotal);
  assert.equal(restored.tax, original.tax);
  assert.equal(restored.subtotal, original.subtotal);
  assert.equal(restored.itemCount, original.itemCount);
  assert.equal(restored.payment.method, PaymentMethod.EWallet);
  assert.equal(restored.payment.amount, original.payment.amount);
  assert.equal(restored.lines.length, original.lines.length);
  assert.equal(restored.lines[1].name, original.lines[1].name);
  assert.equal(restored.lines[2].discountedUnitPrice, original.lines[2].discountedUnitPrice);
  assert.equal(generateInvoice(restored), generateInvoice(original));
});

test("Transaction dựng lại từ plain object đã lưu vẫn in được hóa đơn", () => {
  const { cart } = fillMixedCart();
  const stored = cart.checkout(PaymentMethod.Cash).toJSON();
  const invoice = generateInvoice(stored);
  assert.ok(invoice.includes(stored.orderId));
  assert.ok(invoice.includes("TỔNG CỘNG"));
});

/* ============================================================
   PaymentDetails
   ============================================================ */

test("PaymentDetails ném RangeError khi số tiền âm", () => {
  assert.throws(() => new PaymentDetails(PaymentMethod.Cash, -1), RangeError);
  assert.throws(() => new PaymentDetails(PaymentMethod.Card, -500_000), RangeError);
  const valid = new PaymentDetails(PaymentMethod.Cash, 100_000);
  assert.equal(valid.amount, 100_000);
  assert.equal(valid.method, PaymentMethod.Cash);
});

/* ============================================================
   generateInvoice
   ============================================================ */

test("generateInvoice có mã đơn, tên món, tổng cộng, phương thức và số tiền bằng chữ", () => {
  const { cart, rice, headphones, soap } = fillMixedCart();
  const transaction = cart.checkout(PaymentMethod.Card);
  const invoice = generateInvoice(transaction);
  const flat = invoice.replace(/\s+/g, " ");

  assert.ok(invoice.includes(transaction.orderId), "phải có mã đơn");
  assert.ok(invoice.includes(rice.name), "phải có tên món hàng tươi");
  assert.ok(invoice.includes(headphones.name), "phải có tên hàng điện tử");
  assert.ok(invoice.includes(soap.name), "phải có tên hàng thường");
  assert.ok(invoice.includes("TỔNG CỘNG"));
  assert.ok(invoice.includes(formatMoney(transaction.grandTotal)));
  assert.ok(invoice.includes("Thẻ ngân hàng"), "phải có nhãn phương thức thanh toán");
  assert.ok(invoice.includes("Số tiền bằng chữ:"));
  assert.ok(
    flat.includes(numberToVietnameseWords(transaction.grandTotal)),
    "số tiền bằng chữ phải khớp tổng cộng"
  );
  assert.ok(invoice.includes("Cảm ơn quý khách"), "phải có lời cảm ơn");
  assert.ok(invoice.includes("SMARTMART"), "phải có tên cửa hàng");
  assert.ok(invoice.includes("Mã đơn"), "phải có nhãn mã đơn");
  assert.ok(invoice.includes(formatMoney(transaction.savings * -1)), "phải có dòng tiết kiệm");
});

test("generateInvoice canh cột đẹp: mọi dòng không quá 44 ký tự, đường kẻ đúng khổ", () => {
  const { cart } = fillMixedCart();
  const invoice = generateInvoice(cart.checkout(PaymentMethod.Cash));
  const rows = invoice.split("\n");

  for (const row of rows) {
    assert.ok(row.length <= 44, `dòng quá dài (${row.length}): "${row}"`);
  }
  for (const row of rows.filter((line) => /^[=\-]+$/.test(line))) {
    assert.equal(row.length, 44, "đường kẻ phải phủ đúng bề ngang tờ giấy");
  }
  // Các dòng tiền của cột phải (thụt lề bằng khoảng trắng là dòng phụ của mặt
  // hàng) phải kết thúc đúng ở cột 44 để cột số tiền thẳng hàng khi in.
  const moneyRows = rows.filter((row) => row.includes("₫") && !row.startsWith("  "));
  assert.ok(moneyRows.length >= 4);
  for (const row of moneyRows) {
    assert.equal(row.length, 44, `dòng tiền phải kết thúc ở cột 44: "${row}"`);
    assert.ok(row.endsWith("₫"));
  }
});

test("generateInvoice ngắt tên hàng dài mà không tràn khổ giấy", () => {
  const cart = new ShoppingCart();
  cart.addItem(
    new FakeProduct({
      id: 7777,
      name: "Nước rửa chén hương chanh sả dịu nhẹ dành cho da nhạy cảm chai 3,6 lít",
      price: 129000, stock: 5, discountRate: 0.15
    }),
    2
  );
  const invoice = generateInvoice(cart.checkout(PaymentMethod.Cash));
  for (const row of invoice.split("\n")) assert.ok(row.length <= 44);
  assert.ok(invoice.includes("Nước rửa chén"));
});

test("generateInvoice của giỏ một món vẫn đủ mặt các dòng tổng", () => {
  const cart = new ShoppingCart();
  cart.addItem(makePerishable(), 1);
  const invoice = generateInvoice(cart.checkout(PaymentMethod.Cash));
  assert.ok(invoice.includes("Tạm tính"));
  assert.ok(invoice.includes("Tiết kiệm"));
  assert.ok(invoice.includes("Thuế"));
  assert.ok(invoice.includes("TỔNG CỘNG"));
  assert.ok(invoice.includes("Phương thức thanh toán"));
  assert.ok(invoice.includes("Tiền mặt"));
});

/* ============================================================
   Đồng bộ với kho: models.js không có setter, đổi giá tạo BẢN SAO
   ============================================================ */

test("syncProducts gắn lại dòng hàng vào instance mới sau khi đổi giá", () => {
  const cart = new ShoppingCart();
  const oldHeadphones = makeElectronic(); // 500.000 ₫
  cart.addItem(oldHeadphones, 2);

  // Inventory.setPrice() của dự án tạo bản sao rồi thay vào mảng — mô phỏng đúng vậy.
  const newHeadphones = new FakeProduct({
    id: 2002, name: "Tai nghe Bluetooth chống ồn", category: "Electronics",
    price: 600000, stock: 10, discountRate: 0.1, taxRate: 0.12
  });
  const shelf = [newHeadphones];

  assert.equal(cart.syncProducts(shelf), true);
  assert.equal(cart.lines[0].product, newHeadphones, "dòng phải trỏ vào bản mới");
  assert.equal(cart.discountedTotal, 1_080_000); // 540.000 × 2 theo giá mới
});

test("constructor nhận resolveProduct: checkout trừ kho trên instance hiện hành", () => {
  const oldHeadphones = makeElectronic();
  // Giỏ được tạo trước, kho đổi giá sau (thay instance) — đúng thứ tự thao tác thật.
  const cart = new ShoppingCart({ resolveProduct: (id) => (String(id) === "2002" ? current : undefined) });
  cart.addItem(oldHeadphones, 2);

  const current = new FakeProduct({
    id: 2002, name: "Tai nghe Bluetooth chống ồn", category: "Electronics",
    price: 600000, stock: 10, discountRate: 0.1, taxRate: 0.12
  });

  const transaction = cart.checkout(PaymentMethod.Cash);
  assert.equal(oldHeadphones.stock, 10, "bản cũ không được đụng tới");
  assert.equal(current.stock, 8, "bản đang bày bán mới là bản bị trừ");
  assert.equal(transaction.lines[0].discountedUnitPrice, 540_000);
  assert.equal(cart.isEmpty, true);
});

test("syncProducts bỏ qua mặt hàng đã bị xoá khỏi kho thay vì xoá trộm dòng", () => {
  const { cart } = fillMixedCart();
  const remaining = [makePerishable()]; // chỉ còn mã 1001
  assert.equal(cart.syncProducts(remaining), true);
  assert.equal(cart.lines.length, 3, "không được tự xoá dòng của khách");
  assert.equal(cart.quantityOf(2002), 1);
});

/* ============================================================
   Lỗi giữ nguyên kiểu Error
   ============================================================ */

test("Lỗi nghiệp vụ của giỏ vẫn là Error để view bắt chung", () => {
  const cart = new ShoppingCart();
  try {
    cart.checkout();
    assert.fail("phải ném lỗi");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "ShoppingCartError");
    assert.match(error.message, /trống/);
  }
});
