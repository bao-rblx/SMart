/**
 * SmartMart · Kiểm thử giao diện bán hàng (Thành viên 5)
 * ---------------------------------------------------------------------------
 * Không có trình duyệt trong môi trường kiểm thử, nên file này gồm hai phần:
 *
 *   1. Kiểm thử LOGIC THUẦN tách ra từ các view: tính tổng giỏ, lọc theo chip,
 *      nhãn trạng thái tồn kho, tên tệp hóa đơn… Đây là phần dễ hỏng nhất khi
 *      sửa giao diện nên cần được chốt bằng test.
 *   2. Kiểm thử "dựng được" của hàm render: một lớp DOM tối giản (bên dưới)
 *      thay cho trình duyệt để chắc rằng renderLogin / renderCheckout /
 *      createProductCard / createCartPanel trả về đúng kiểu Node và không ném.
 *
 * Vì sao tự viết lớp DOM thay vì cài jsdom: đồ án không dùng thư viện ngoài,
 * và bộ kiểm thử cũng phải chạy được bằng "npm test" trên máy trống.
 */

import test from "node:test";
import assert from "node:assert/strict";

/* ==========================================================================
   Lớp DOM tối giản — chỉ đủ cho dom.js dùng
   ========================================================================== */

class FakeNode {
  constructor(documentRef) {
    this.ownerDocument = documentRef;
    this.childNodes = [];
    this.parentElement = null;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get isConnected() {
    let node = this;
    while (node) {
      if (node === this.ownerDocument) return true;
      node = node.parentElement;
    }
    return false;
  }

  /** Ghi lại listener để test tự kích hoạt sự kiện (không cần trình duyệt). */
  addEventListener(name, handler) {
    this.listeners ??= new Map();
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(handler);
  }

  removeEventListener() {}

  /** Kích hoạt mọi listener của một loại sự kiện — dùng trong test. */
  dispatch(name, event = {}) {
    for (const handler of this.listeners?.get(name) ?? []) handler(event);
  }

  prepend(node) {
    this.childNodes.unshift(node);
    node.parentElement = this;
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node === null || node === undefined) continue;
      const child = node instanceof FakeNode ? node : this.ownerDocument.createTextNode(String(node));
      child.parentElement = this;
      this.childNodes.push(child);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    return node;
  }

  replaceChildren(...nodes) {
    this.childNodes = [];
    this.append(...nodes);
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  dispatchEvent() {
    return true;
  }
}

class FakeTextNode extends FakeNode {
  constructor(documentRef, text) {
    super(documentRef);
    this.text = String(text);
  }

  get textContent() {
    return this.text;
  }

  set textContent(value) {
    this.text = String(value ?? "");
  }
}

class FakeElement extends FakeNode {
  constructor(documentRef, tagName) {
    super(documentRef);
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.text_ = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  get classList() {
    const element = this;
    const read = () => (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    const write = (list) => element.setAttribute("class", list.join(" "));
    return {
      add: (...names) => write([...new Set([...read(), ...names.filter(Boolean)])]),
      remove: (...names) => write(read().filter((name) => !names.includes(name))),
      contains: (name) => read().includes(name),
      toggle(name, force) {
        const has = read().includes(name);
        const next = force === undefined ? !has : Boolean(force);
        if (next && !has) write([...read(), name]);
        if (!next && has) write(read().filter((item) => item !== name));
        return next;
      }
    };
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get textContent() {
    return this.text_ + this.childNodes.map((node) => node.textContent ?? "").join("");
  }

  set textContent(value) {
    this.childNodes = [];
    this.text_ = String(value ?? "");
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  select() {}

  setSelectionRange() {}

  click() {}

  getBoundingClientRect() {
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  /** Tiện cho test: gom mọi phần tử con (đệ quy) theo lớp CSS. */
  findAll(predicate, collected = []) {
    for (const node of this.childNodes) {
      if (node instanceof FakeElement) {
        if (predicate(node)) collected.push(node);
        node.findAll(predicate, collected);
      }
    }
    return collected;
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.documentElement = new FakeElement(this, "html");
    this.body = new FakeElement(this, "body");
    this.body.parentElement = this;
    this.head = new FakeElement(this, "head");
    this.activeElement = this.body;
    this.documentElement.append(this.head, this.body);
  }

  createElement(tag) {
    return new FakeElement(this, tag);
  }

  createElementNS(_namespace, tag) {
    return new FakeElement(this, tag);
  }

  createTextNode(text) {
    return new FakeTextNode(this, text);
  }

  getElementById() {
    return null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

// Cài đặt môi trường giả TRƯỚC khi nạp các module có đụng tới document.
const fakeDocument = new FakeDocument();
globalThis.document = fakeDocument;
globalThis.Node = FakeNode;
globalThis.Element = FakeElement;
globalThis.HTMLElement = FakeElement;
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  print() {},
  innerHeight: 900
};

/* ==========================================================================
   Nạp module cần kiểm thử (sau khi đã có DOM giả)
   ========================================================================== */

const card = await import("../js/ui/product-card.js");
const cartModule = await import("../js/views/cart-panel.js");
const checkoutModule = await import("../js/views/checkout.js");
const loginModule = await import("../js/views/login.js");
const { ShoppingCart } = await import("../js/core/cart.js");
const { Transaction } = await import("../js/core/transaction.js");
const { Category, PaymentMethod, CatalogSort } = await import("../js/core/constants.js");

/* ==========================================================================
   Dữ liệu mẫu
   ========================================================================== */

/** Sản phẩm giả lập cùng hình dạng với Product nhưng không cần tầng models. */
function stubProduct(overrides = {}) {
  const base = {
    id: 1001,
    name: "Mì Hảo Hảo tôm chua cay 75 g",
    category: Category.Grocery,
    unitPrice: 5000,
    discountedPrice: 3500,
    discountPercent: 30,
    stock: 24,
    lowStockThreshold: 5,
    canSell: true,
    catalogKey: "off-8934563138165",
    calculateTax: () => 420,
    ...overrides
  };
  return base;
}

function fakeCartWith(lines = []) {
  const cart = new ShoppingCart();
  for (const { product, quantity } of lines) cart.addItem(product, quantity);
  return cart;
}

/* ==========================================================================
   1. Thẻ sản phẩm
   ========================================================================== */

test("productImageSrc ghép đúng đường dẫn ảnh thật trong assets/products", () => {
  assert.equal(card.productImageSrc({ catalogKey: "banana" }), "assets/products/banana.jpg");
});

test("productImageSrc trả null khi sản phẩm thiếu catalogKey", () => {
  assert.equal(card.productImageSrc({}), null);
  assert.equal(card.productImageSrc({ catalogKey: "" }), null);
  assert.equal(card.productImageSrc(null), null);
});

test("createProductCard không ném khi sản phẩm thiếu ảnh và trả về một Node", () => {
  const node = card.createProductCard({ id: 9, name: "Hàng không ảnh", stock: 3 }, {});
  assert.ok(node instanceof FakeNode, "phải trả về Node");
  assert.ok(node.classList.contains("ct-card"));
  const images = node.findAll((element) => element.tagName === "IMG");
  assert.equal(images.length, 0, "không dựng thẻ img khi không có catalogKey");
});

test("createProductCard chịu được đầu vào rỗng và tham số tuỳ chọn bị bỏ trống", () => {
  assert.ok(card.createProductCard(null) instanceof FakeNode);
  assert.ok(card.createProductCard(undefined, undefined) instanceof FakeNode);
});

test("createProductCard dựng ảnh thật kèm onerror để ẩn ảnh hỏng", () => {
  const node = card.createProductCard(stubProduct(), { quantity: 2 });
  const images = node.findAll((element) => element.tagName === "IMG");
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute("src"), "assets/products/off-8934563138165.jpg");
  assert.equal(images[0].getAttribute("loading"), "lazy");
});

test("createProductCard hiện số lượng đã chọn trên nút cộng", () => {
  const node = card.createProductCard(stubProduct(), { quantity: 3 });
  const add = node.findAll((element) => element.classList.contains("ct-card__add"))[0];
  assert.ok(add, "phải có nút thêm");
  assert.ok(add.classList.contains("is-selected"));
  assert.equal(add.textContent.trim(), "3");
});

test("nút thêm bị khoá khi sản phẩm hết hàng", () => {
  const node = card.createProductCard(stubProduct({ stock: 0, canSell: false }), {});
  const add = node.findAll((element) => element.classList.contains("ct-card__add"))[0];
  assert.equal(add.disabled, true);
});

test("productStockLabel: còn hàng, hết hàng và ngừng bán dùng đúng câu tiếng Việt", () => {
  assert.equal(card.productStockLabel({ stock: 24 }), "Còn 24");
  assert.equal(card.productStockLabel({ stock: 0 }), "Hết hàng");
  assert.equal(card.productStockLabel({ stock: 8, isExpired: true }), "Ngừng bán");
});

test("productStockState phân biệt đủ hàng, sắp hết, hết hàng, quá hạn", () => {
  assert.equal(card.productStockState({ stock: 24, lowStockThreshold: 5 }), card.STOCK_STATE.Available);
  assert.equal(card.productStockState({ stock: 3, lowStockThreshold: 5 }), card.STOCK_STATE.Low);
  assert.equal(card.productStockState({ stock: 0 }), card.STOCK_STATE.SoldOut);
  assert.equal(card.productStockState({ stock: 5, isExpired: true }), card.STOCK_STATE.Expired);
});

test("productMetaLine ghép tồn kho với nhãn nhóm hàng", () => {
  assert.equal(card.productMetaLine(stubProduct({ stock: 24 })), "Còn 24 · Thực phẩm");
});

test("productBadges tạo huy hiệu giảm giá dạng −30%", () => {
  const badges = card.productBadges(stubProduct());
  assert.equal(badges.length, 1);
  assert.equal(badges[0].tone, "sale");
  assert.equal(badges[0].text, "−30%");
});

test("productBadges thêm huy hiệu hổ phách khi sắp hết hạn", () => {
  const soon = new Date(Date.now() + 3 * 86_400_000);
  const badges = card.productBadges(stubProduct({ expiryDate: soon, discountPercent: 0, discountedPrice: 5000 }));
  const expiry = badges.find((badge) => badge.tone === "expiry");
  assert.ok(expiry, "phải có huy hiệu hạn dùng");
  assert.match(expiry.text, /^Còn \d ngày$/);
});

test("isSellable tôn trọng canSell của tầng models", () => {
  assert.equal(card.isSellable({ stock: 5, canSell: true }), true);
  assert.equal(card.isSellable({ stock: 5, canSell: false }), false);
  assert.equal(card.isSellable({ stock: 0 }), false);
});

test("discountPercentOf tự tính khi object thô chỉ có giá", () => {
  assert.equal(card.discountPercentOf({ price: 10000, discountedPrice: 7500 }), 25);
  assert.equal(card.discountPercentOf({ price: 10000 }), 0);
});

/* ==========================================================================
   2. Giỏ hàng hiển thị
   ========================================================================== */

test("cartTotals trả cả số thô lẫn chuỗi đã định dạng tiếng Việt", () => {
  const cart = fakeCartWith([{ product: stubProduct(), quantity: 2 }]);
  const totals = cartModule.cartTotals(cart);
  assert.equal(totals.count, 2);
  assert.equal(totals.lineCount, 1);
  assert.equal(totals.subtotal, 10000);
  assert.equal(totals.grandTotal, cart.grandTotal);
  assert.match(totals.grandTotalText, /₫/);
  assert.equal(totals.countText, "2 món");
  assert.equal(totals.isEmpty, false);
});

test("cartTotals của giỏ trống báo isEmpty", () => {
  const totals = cartModule.cartTotals(new ShoppingCart());
  assert.equal(totals.isEmpty, true);
  assert.equal(totals.countText, "0 món");
});

test("cartSummaryRows gồm đủ 4 dòng và chỉ rõ dòng tổng", () => {
  const cart = fakeCartWith([{ product: stubProduct(), quantity: 1 }]);
  const rows = cartModule.cartSummaryRows(cart);
  assert.deepEqual(rows.map((row) => row.key), ["subtotal", "savings", "tax", "grandTotal"]);
  assert.equal(rows[3].tone, "total");
  assert.equal(rows[1].tone, "brand");
  assert.ok(rows[1].value.startsWith("−"), "tiết kiệm hiển thị dấu trừ");
});

test("cartLineView mô tả đúng khả năng tăng/giảm của một dòng", () => {
  const cart = fakeCartWith([{ product: stubProduct({ stock: 5 }), quantity: 5 }]);
  const view = cartModule.cartLineView(cart.lines[0]);
  assert.equal(view.quantity, 5);
  assert.equal(view.canIncrease, false, "đã chạm tồn kho thì khoá nút cộng");
  assert.equal(view.canDecrease, true);
  assert.equal(view.discountPercent, 30);
  assert.equal(view.lineTotal, cart.lines[0].lineTotal);
});

test("cartLineView của dòng số lượng 1 không cho giảm", () => {
  const cart = fakeCartWith([{ product: stubProduct(), quantity: 1 }]);
  const view = cartModule.cartLineView(cart.lines[0]);
  assert.equal(view.canDecrease, false);
  assert.equal(view.canIncrease, true);
});

test("paymentAmountLabel nêu số tiền phải trả", () => {
  const cart = fakeCartWith([{ product: stubProduct(), quantity: 2 }]);
  const label = cartModule.paymentAmountLabel(cart);
  assert.match(label, /Khách thanh toán/);
  assert.match(label, /2 món/);
});

test("PAYMENT_OPTIONS có đúng 3 phương thức với icon cash/card/wallet", () => {
  assert.equal(cartModule.PAYMENT_OPTIONS.length, 3);
  assert.deepEqual(
    cartModule.PAYMENT_OPTIONS.map((option) => option.icon),
    ["cash", "card", "wallet"]
  );
  assert.equal(cartModule.defaultPaymentMethod(), PaymentMethod.Cash);
  assert.equal(cartModule.isPaymentMethod(PaymentMethod.Card), true);
  assert.equal(cartModule.isPaymentMethod("Bitcoin"), false);
});

test("receiptFileName tạo tên tệp .txt an toàn từ mã đơn", () => {
  const name = cartModule.receiptFileName({
    orderId: "ABCDEFGH",
    timestamp: new Date(2026, 10, 12, 9, 5, 0)
  });
  assert.equal(name, "Hoa-don-ABCDEFGH-20261112-0905.txt");
});

test("receiptTitle gắn mã đơn vào tiêu đề hộp thoại", () => {
  assert.equal(cartModule.receiptTitle({ orderId: "ABCDEFGH" }), "Đơn ABCDEFGH đã thanh toán");
  assert.equal(cartModule.receiptTitle({}), "Đã thanh toán");
});

test("invoiceTextOf dùng generateInvoice của transaction.js", () => {
  const transaction = new Transaction({
    lines: [
      {
        productId: 1001,
        name: "Mì Hảo Hảo",
        category: Category.Grocery,
        quantity: 2,
        unitPrice: 5000,
        discountedUnitPrice: 3500,
        taxPerUnit: 350
      }
    ]
  });
  const text = cartModule.invoiceTextOf(transaction);
  assert.ok(text.includes("SMARTMART"));
  assert.ok(text.includes(transaction.orderId), "phiếu in phải có mã đơn");
  assert.ok(text.includes("\n"), "phiếu in là văn bản nhiều dòng");
});

test("invoiceTextOf không ném khi đầu vào hỏng, vẫn trả chuỗi dự phòng", () => {
  const text = cartModule.invoiceTextOf(null);
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0);
});

/* ==========================================================================
   3. Danh mục: lọc, chip, phân trang, thống kê
   ========================================================================== */

const CATALOG = [
  stubProduct({ id: 1, name: "Sữa tươi tiệt trùng", category: Category.Dairy, discountedPrice: 20000, discountPercent: 0 }),
  stubProduct({ id: 2, name: "Chuối tiêu chín", category: Category.Produce, discountedPrice: 15000, discountPercent: 0 }),
  stubProduct({ id: 3, name: "Cà phê rang xay", category: Category.Beverages, discountedPrice: 90000, discountPercent: 0 }),
  stubProduct({ id: 4, name: "Bánh quy bơ", category: Category.Snacks, discountedPrice: 30000, discountPercent: 0, stock: 0, canSell: false })
];

test("createCatalogFilter có giá trị mặc định đúng hợp đồng", () => {
  const filter = checkoutModule.createCatalogFilter();
  assert.equal(filter.query, "");
  assert.equal(filter.category, null);
  assert.equal(filter.availableOnly, false);
  assert.equal(filter.sort, CatalogSort.Featured);
  assert.equal(filter.page, 0);
});

test("filterCatalog khớp tiếng Việt không dấu", () => {
  const results = checkoutModule.filterCatalog(CATALOG, { query: "sua tuoi" });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Sữa tươi tiệt trùng");
});

test("filterCatalog lọc theo nhóm hàng và chỉ hàng còn bán", () => {
  const byCategory = checkoutModule.filterCatalog(CATALOG, { category: Category.Produce });
  assert.equal(byCategory.length, 1);
  const sellable = checkoutModule.filterCatalog(CATALOG, { availableOnly: true });
  assert.equal(sellable.length, 3);
});

test("filterCatalog sắp xếp theo giá tăng dần", () => {
  const sorted = checkoutModule.filterCatalog(CATALOG, { sort: CatalogSort.PriceAscending });
  const prices = sorted.map((product) => product.discountedPrice);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("buildCategoryChips đặt 'Tất cả' đầu tiên và đếm đúng", () => {
  const chips = checkoutModule.buildCategoryChips(CATALOG);
  assert.equal(chips[0].key, null);
  assert.equal(chips[0].label, "Tất cả");
  assert.equal(chips[0].count, CATALOG.length);
  const dairy = chips.find((chip) => chip.key === Category.Dairy);
  assert.equal(dairy.count, 1);
  assert.equal(dairy.label, "Sữa & bơ");
});

test("buildCategoryChips bỏ nhóm hàng không có mặt hàng nào", () => {
  const chips = checkoutModule.buildCategoryChips(CATALOG);
  assert.equal(chips.some((chip) => chip.key === Category.Electronics), false);
});

test("pageOf và rangeLabel dựng dòng '13–24 / 72 mặt hàng'", () => {
  const big = Array.from({ length: 72 }, (_, index) => stubProduct({ id: index + 1 }));
  const second = checkoutModule.pageOf(big, 1, 12);
  assert.equal(second.items.length, 12);
  assert.equal(checkoutModule.rangeLabel(second), "13–24 / 72 mặt hàng");
  const empty = checkoutModule.pageOf([], 0, 12);
  assert.equal(checkoutModule.rangeLabel(empty), "0 mặt hàng");
});

test("todaySummary chỉ tính hóa đơn trong hôm nay", () => {
  const now = new Date(2026, 10, 12, 15, 0, 0);
  const summary = checkoutModule.todaySummary(
    [
      { timestamp: new Date(2026, 10, 12, 9, 0, 0), grandTotal: 120000 },
      { timestamp: new Date(2026, 10, 12, 14, 0, 0), grandTotal: 80000 },
      { timestamp: new Date(2026, 10, 11, 20, 0, 0), grandTotal: 999000 }
    ],
    now
  );
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.revenue, 200000);
  assert.equal(summary.orderText, "2 đơn");
});

test("enterAction chỉ thêm khi còn đúng một kết quả", () => {
  assert.equal(checkoutModule.enterAction([]).type, "none");
  const single = checkoutModule.enterAction([CATALOG[0]]);
  assert.equal(single.type, "add");
  assert.equal(single.product.id, 1);
  assert.equal(checkoutModule.enterAction(CATALOG).type, "ambiguous");
});

test("emptyCatalogMessage nhắc lại từ khoá người dùng vừa gõ", () => {
  assert.match(checkoutModule.emptyCatalogMessage({ query: "trà sữa" }), /trà sữa/);
  assert.match(checkoutModule.emptyCatalogMessage({ category: Category.Dairy }), /Sữa & bơ/);
  assert.equal(typeof checkoutModule.emptyCatalogMessage({}), "string");
});

/* ==========================================================================
   4. Đăng nhập
   ========================================================================== */

test("DEMO_ACCOUNTS có đúng ba tài khoản dùng thử theo yêu cầu", () => {
  assert.deepEqual(
    loginModule.DEMO_ACCOUNTS.map((account) => account.username),
    ["admin", "manager", "cashier"]
  );
  for (const account of loginModule.DEMO_ACCOUNTS) {
    assert.equal(account.username, account.password, "mật khẩu trùng tên tài khoản");
  }
});

test("readCredentials cắt khoảng trắng ở tên đăng nhập, giữ nguyên mật khẩu", () => {
  const credentials = loginModule.readCredentials(
    { value: "  cashier  " },
    { value: " pass word " }
  );
  assert.deepEqual(credentials, { username: "cashier", password: " pass word " });
});

test("loginErrorMessage lấy câu tiếng Việt từ AuthService", () => {
  assert.equal(
    loginModule.loginErrorMessage({ error: "Tên đăng nhập hoặc mật khẩu chưa đúng." }),
    "Tên đăng nhập hoặc mật khẩu chưa đúng."
  );
  assert.match(loginModule.loginErrorMessage({}), /thử lại/);
  assert.match(loginModule.loginErrorMessage(null), /thử lại/);
});

test("renderLogin trả về Node hai cột có .auth__aside và .auth__panel", () => {
  const view = loginModule.renderLogin({
    store: { auth: { login: async () => ({ error: "x" }) }, signIn() {} },
    onSignedIn() {},
    toast: { success() {}, error() {}, info() {}, warning() {} },
    confirm: async () => false
  });
  assert.ok(view instanceof FakeNode);
  assert.ok(view.classList.contains("auth"));
  assert.equal(view.findAll((element) => element.classList.contains("auth__aside")).length, 1);
  assert.equal(view.findAll((element) => element.classList.contains("auth__panel")).length, 1);
  const password = view.findAll((element) => element.getAttribute("type") === "password");
  assert.equal(password.length, 1, "phải có đúng một ô mật khẩu");
  const submit = view.findAll((element) => element.classList.contains("lg-submit"));
  assert.equal(submit.length, 1);
  assert.equal(submit[0].getAttribute("type"), "submit");
});

test("renderLogin liệt kê đủ ba dòng tài khoản dùng thử bấm được", () => {
  const view = loginModule.renderLogin({ store: { auth: {}, signIn() {} }, onSignedIn() {} });
  const rows = view.findAll((element) => element.classList.contains("lg-demo__row"));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].getAttribute("type"), "button");
});

/* ==========================================================================
   5. Dựng view bán hàng và bảng giỏ
   ========================================================================== */

function fakeStore(cart) {
  return {
    cart,
    getProducts: () => CATALOG,
    getSales: () => [],
    state: { products: CATALOG, sales: [], users: [], currentUser: null },
    commitSale() {}
  };
}

test("createCartPanel trả về đúng bộ { element, refresh, focusSearch }", () => {
  const store = fakeStore(new ShoppingCart());
  const panel = cartModule.createCartPanel({ store, onChange() {} });
  assert.ok(panel.element instanceof FakeNode);
  assert.equal(typeof panel.refresh, "function");
  assert.equal(typeof panel.focusSearch, "function");
  assert.ok(panel.element.classList.contains("ctp"));
});

test("bảng giỏ hiện trạng thái rỗng với tiêu đề 'Lên đơn thôi nào'", () => {
  const panel = cartModule.createCartPanel({ store: fakeStore(new ShoppingCart()) });
  const empty = panel.element.findAll((element) => element.classList.contains("ctp-empty"));
  assert.equal(empty.length, 1);
  assert.match(empty[0].textContent, /Lên đơn thôi nào/);
});

test("bảng giỏ vẽ một dòng cho mỗi món và cộng đúng tổng", () => {
  const cart = fakeCartWith([
    { product: stubProduct({ id: 1, name: "Món A" }), quantity: 2 },
    { product: stubProduct({ id: 2, name: "Món B", unitPrice: 12000, discountedPrice: 12000, discountPercent: 0 }), quantity: 1 }
  ]);
  const panel = cartModule.createCartPanel({ store: fakeStore(cart) });
  const lines = panel.element.findAll((element) => element.classList.contains("ctp-line"));
  assert.equal(lines.length, 2);
  assert.equal(panel.element.findAll((element) => element.classList.contains("stepper")).length, 2);
  assert.match(panel.element.textContent, /Đơn hiện tại/);
});

test("renderCheckout trả về .view hai cột, có ô tìm kiếm data-catalog-search", () => {
  const store = fakeStore(new ShoppingCart());
  const view = checkoutModule.renderCheckout({
    store,
    navigate() {},
    toast: { success() {}, error() {}, info() {}, warning() {} },
    confirm: async () => false
  });
  assert.ok(view instanceof FakeNode);
  assert.ok(view.classList.contains("view"));
  assert.ok(view.classList.contains("co-view"));
  const search = view.findAll((element) => element.getAttribute("data-catalog-search") === "true");
  assert.equal(search.length, 1, "Lead cần đúng một ô tìm kiếm cho Ctrl+K");
  assert.match(search[0].getAttribute("placeholder"), /mã vạch/);
});

test("renderCheckout vẽ chip 'Tất cả' và lưới thẻ cho trang đầu", () => {
  const store = fakeStore(new ShoppingCart());
  const view = checkoutModule.renderCheckout({ store, toast: { success() {}, error() {}, info() {}, warning() {} } });
  const chips = view.findAll((element) => element.classList.contains("co-chip"));
  assert.equal(chips.length, 5, "Tất cả + 4 nhóm hàng có mặt trong dữ liệu mẫu");
  assert.equal(chips[0].getAttribute("aria-pressed"), "true");
  const cards = view.findAll((element) => element.classList.contains("ct-card"));
  assert.equal(cards.length, CATALOG.length);
});

test("renderCheckout hiện trạng thái rỗng khi bộ lọc không khớp gì", () => {
  const store = fakeStore(new ShoppingCart());
  const view = checkoutModule.renderCheckout({ store, toast: { success() {}, error() {}, info() {}, warning() {} } });
  const search = view.findAll((element) => element.getAttribute("data-catalog-search") === "true")[0];
  // Gõ từ khoá không tồn tại rồi chờ debounce (160 ms) chạy xong.
  search.value = "zzz khong ton tai";
  search.dispatch("input", { target: search });
  return new Promise((resolve) => {
    setTimeout(() => {
      const empty = view.findAll((element) => element.classList.contains("co-empty"));
      assert.equal(empty.length, 1);
      resolve();
    }, 300);
  });
});
