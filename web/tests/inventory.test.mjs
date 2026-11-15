/**
 * SmartMart · Kiểm thử tầng kho hàng và lưu trữ — Thành viên 3
 * ---------------------------------------------------------------------------
 * Chạy: cd web && npm test
 *       hoặc: node --test tests/inventory.test.mjs
 *
 * HAI QUYẾT ĐỊNH VỀ CÁCH VIẾT TEST:
 *
 * 1. Inventory được kiểm thử bằng một lớp sản phẩm GIẢ tối giản (FakeProduct)
 *    chứ không dùng models.js thật. Vì sao: inventory.js chỉ cần sản phẩm có
 *    đúng hành vi (restock/trySell/withPrice + vài getter), không cần cả cây
 *    kế thừa. Nhờ vậy test này không đỏ khi Thành viên 1 còn đang sửa
 *    models.js, và khi đỏ thì biết chắc lỗi nằm ở kho hàng.
 *
 * 2. Storage được kiểm thử bằng một globalThis.localStorage giả, gắn/gỡ trong
 *    từng test. Mỗi lần gắn là một "môi trường trình duyệt mới" — vì
 *    storage.js nhớ trạng thái bị chặn trong module scope, phải import lại
 *    module (kèm query ?v=N) giữa các kịch bản để mô phỏng đúng vòng đời.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { Inventory } from "../js/core/inventory.js";
import { createProduct } from "../js/core/models.js";
import { Admin, Cashier } from "../js/core/users.js";

/* =========================================================================
 * 0. Lớp sản phẩm giả — chỉ có đúng những gì inventory.js được phép dùng
 * ========================================================================*/

class FakeProduct {
  #id;
  #name;
  #category;
  #unitPrice;
  #stock;
  #lowStockThreshold;
  #expired;
  #nearExpiry;

  constructor({
    id,
    name,
    category = "Grocery",
    unitPrice = 10_000,
    stock = 10,
    lowStockThreshold = 5,
    expired = false,
    nearExpiry = false
  }) {
    this.#id = Number(id);
    this.#name = String(name);
    this.#category = category;
    this.#unitPrice = unitPrice;
    this.#stock = stock;
    this.#lowStockThreshold = lowStockThreshold;
    this.#expired = expired;
    this.#nearExpiry = nearExpiry;
  }

  get id() {
    return this.#id;
  }
  get name() {
    return this.#name;
  }
  get category() {
    return this.#category;
  }
  get unitPrice() {
    return this.#unitPrice;
  }
  get stock() {
    return this.#stock;
  }
  get lowStockThreshold() {
    return this.#lowStockThreshold;
  }
  get isLowStock() {
    return this.#stock <= this.#lowStockThreshold;
  }
  get canSell() {
    return this.#stock > 0 && !this.#expired;
  }
  get discountedPrice() {
    return this.#unitPrice;
  }
  get isExpired() {
    return this.#expired;
  }
  get isNearExpiry() {
    return this.#nearExpiry;
  }

  restock(qty) {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new RangeError("Số lượng nhập kho phải là số nguyên lớn hơn 0.");
    }
    this.#stock += qty;
    return this.#stock;
  }

  trySell(qty) {
    if (!this.canSell) return false;
    if (!Number.isInteger(qty) || qty <= 0) return false;
    if (qty > this.#stock) return false;
    this.#stock -= qty;
    return true;
  }

  withPrice(price) {
    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      throw new RangeError("Giá bán không được âm.");
    }
    return new FakeProduct({
      id: this.#id,
      name: this.#name,
      category: this.#category,
      unitPrice: Number(price),
      stock: this.#stock,
      lowStockThreshold: this.#lowStockThreshold,
      expired: this.#expired,
      nearExpiry: this.#nearExpiry
    });
  }
}

/** Dựng kho mẫu: 3 món bình thường, 1 sắp hết hạn, 1 quá hạn, 1 tồn thấp. */
function sampleInventory() {
  return new Inventory([
    new FakeProduct({ id: 1, name: "Sữa tươi", unitPrice: 20_000, stock: 10 }),
    new FakeProduct({ id: 2, name: "Bánh mì", unitPrice: 12_000, stock: 8 }),
    new FakeProduct({ id: 3, name: "Nước suối", unitPrice: 5_000, stock: 40 }),
    new FakeProduct({ id: 4, name: "Rau cải", unitPrice: 9_000, stock: 12, nearExpiry: true }),
    new FakeProduct({ id: 5, name: "Cá hộp", unitPrice: 30_000, stock: 6, expired: true }),
    new FakeProduct({ id: 6, name: "Kẹo bạc hà", unitPrice: 4_000, stock: 2 })
  ]);
}

/* =========================================================================
 * Người thực hiện — mọi thao tác kho giờ đều phải kèm tài khoản có quyền
 * ========================================================================*/

/** Quản trị viên: được vào cả bốn màn hình nên mọi thao tác kho đều hợp lệ. */
const MANAGER = new Admin({ username: "quan-tri", credential: "salt:hash" });

/** Thu ngân: chỉ được vào màn hình bán hàng, nên mọi thao tác kho phải bị chặn. */
const CASHIER = new Cashier({ username: "thu-ngan", credential: "salt:hash" });

/* =========================================================================
 * 1. Inventory — truy vấn cơ bản
 * ========================================================================*/

test("Inventory: dựng kho rỗng, đếm đúng số mặt hàng", () => {
  const inventory = new Inventory();
  assert.equal(inventory.count, 0);
  assert.equal(inventory.totalUnits, 0);
  assert.equal(inventory.inventoryValue, 0);
  assert.deepEqual(inventory.products, []);
});

test("Inventory: thêm sản phẩm mới và tìm lại được theo mã", () => {
  const inventory = new Inventory();
  const added = inventory.add(new FakeProduct({ id: 10, name: "Dầu ăn" }), MANAGER);

  assert.equal(added.id, 10);
  assert.equal(inventory.count, 1);
  assert.equal(inventory.find(10)?.name, "Dầu ăn");
  assert.equal(inventory.find("10")?.name, "Dầu ăn", "mã hàng dạng chuỗi từ biểu mẫu vẫn phải tìm ra");
  assert.equal(inventory.find(999), undefined);
});

test("Inventory: getter products trả bản sao — bên ngoài không phá được kho", () => {
  const inventory = sampleInventory();
  const list = inventory.products;
  list.push(new FakeProduct({ id: 99, name: "Hàng lạ" }));
  assert.equal(inventory.count, 6, "thêm vào mảng bản sao không được đổi kho");
});

test("Inventory: thêm trùng mã hàng thì ném lỗi và kho không đổi", () => {
  const inventory = sampleInventory();
  assert.throws(
    () => inventory.add(new FakeProduct({ id: 1, name: "Sữa tươi nhãn khác" }), MANAGER),
    /đã tồn tại/
  );
  assert.equal(inventory.count, 6);
});

test("Inventory: thêm sản phẩm có tên rỗng thì ném lỗi", () => {
  const inventory = new Inventory();
  assert.throws(() => inventory.add(new FakeProduct({ id: 7, name: "   " }), MANAGER), /Tên sản phẩm/);
  assert.equal(inventory.count, 0);
});

test("Inventory: xoá theo mã trả true, xoá mã không có trả false", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.remove(2, MANAGER), true);
  assert.equal(inventory.find(2), undefined);
  assert.equal(inventory.count, 5);
  assert.equal(inventory.remove(2, MANAGER), false);
  assert.equal(inventory.remove(1234, MANAGER), false);
});

test("Inventory: findByName so khớp không dấu, không phân biệt hoa thường", () => {
  const inventory = new Inventory([
    new FakeProduct({ id: 1, name: "Sữa tươi" }),
    new FakeProduct({ id: 2, name: "Cà phê rang xay" })
  ]);
  assert.equal(inventory.findByName("sua tuoi")?.id, 1);
  assert.equal(inventory.findByName("CA PHE")?.id, 2);
  assert.equal(inventory.findByName("cà phê")?.id, 2);
  assert.equal(inventory.findByName("không có gì"), undefined);
});

/* =========================================================================
 * 2. Inventory — nhập / xuất kho, đổi giá
 * ========================================================================*/

test("Inventory: restock cộng đúng số lượng và trả về tồn kho mới", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.restock(1, 5, MANAGER), 15);
  assert.equal(inventory.find(1)?.stock, 15);
});

test("Inventory: restock với số lượng <= 0 ném RangeError", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.restock(1, 0, MANAGER), RangeError);
  assert.throws(() => inventory.restock(1, -3, MANAGER), RangeError);
  assert.throws(() => inventory.restock(1, 1.5, MANAGER), RangeError);
  assert.equal(inventory.find(1)?.stock, 10, "kho phải nguyên vẹn sau lần nhập sai");
});

test("Inventory: withdraw trừ đúng số lượng", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.withdraw(3, 15, MANAGER), 25);
  assert.equal(inventory.find(3)?.stock, 25);
});

test("Inventory: withdraw quá tồn kho ném lỗi và không trừ đồng nào", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.withdraw(1, 11, MANAGER), /Không đủ tồn kho/);
  assert.equal(inventory.find(1)?.stock, 10);
});

test("Inventory: withdraw hàng đã hết hạn ném lỗi dù còn tồn", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.find(5)?.stock, 6);
  assert.throws(() => inventory.withdraw(5, 1, MANAGER), /Không thể xuất kho/);
  assert.equal(inventory.find(5)?.stock, 6);
});

test("Inventory: thao tác lên mã hàng không tồn tại ném lỗi", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.restock(404, 1, MANAGER), /Không tìm thấy/);
  assert.throws(() => inventory.withdraw(404, 1, MANAGER), /Không tìm thấy/);
  assert.throws(() => inventory.setPrice(404, 1000, MANAGER), /Không tìm thấy/);
});

test("Inventory: setPrice tạo bản sao với giá mới, không sửa thực thể cũ", () => {
  const inventory = sampleInventory();
  const oldProduct = inventory.find(1);
  const updated = inventory.setPrice(1, 25_000, MANAGER);

  assert.equal(updated.unitPrice, 25_000);
  assert.equal(inventory.find(1)?.unitPrice, 25_000, "kho phải trỏ sang bản sao mới");
  assert.equal(oldProduct?.unitPrice, 20_000, "thực thể cũ giữ nguyên giá — hóa đơn đã lập không bị sai");
  assert.equal(inventory.count, 6, "đổi giá không được làm tăng số mặt hàng");
  assert.equal(updated.stock, oldProduct?.stock, "đổi giá phải giữ nguyên tồn kho");
});

test("Inventory: setPrice với giá âm ném RangeError, giá 0 hợp lệ", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.setPrice(1, -1, MANAGER), RangeError);
  assert.equal(inventory.find(1)?.unitPrice, 20_000);
  assert.equal(inventory.setPrice(1, 0, MANAGER).unitPrice, 0);
});

/* =========================================================================
 * 3. Inventory — cảnh báo và thống kê
 * ========================================================================*/

test("Inventory: lowStockAlerts chỉ gồm mặt hàng chạm ngưỡng tồn thấp", () => {
  const inventory = sampleInventory();
  const ids = inventory.lowStockAlerts.map((product) => product.id);
  assert.deepEqual(ids, [6], "chỉ Kẹo bạc hà (2 <= 5) là tồn thấp");
});

test("Inventory: expiringSoon chỉ gồm hàng tươi cận hạn, không gồm hàng đã hết hạn", () => {
  const inventory = sampleInventory();
  const ids = inventory.expiringSoon.map((product) => product.id);
  assert.deepEqual(ids, [4]);
});

test("Inventory: expiredProducts chỉ gồm hàng tươi đã quá hạn", () => {
  const inventory = sampleInventory();
  const ids = inventory.expiredProducts.map((product) => product.id);
  assert.deepEqual(ids, [5]);
});

test("Inventory: healthyCount bỏ qua mọi mặt hàng có cảnh báo", () => {
  const inventory = sampleInventory();
  // 6 món, trừ Kẹo (tồn thấp), Rau cải (cận hạn), Cá hộp (quá hạn) còn 3.
  assert.equal(inventory.healthyCount, 3);
  assert.equal(inventory.count - inventory.healthyCount, 3);
});

/* =========================================================================
 * Phân quyền ở tầng nghiệp vụ — ẩn nút trên giao diện là chưa đủ
 * ========================================================================*/

test("Phân quyền: thu ngân không nhập được kho dù gọi thẳng tầng kho", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.restock(1, 5, CASHIER), /không có quyền nhập kho/);
  assert.equal(inventory.find(1).stock, 10, "tồn kho phải giữ nguyên");
});

test("Phân quyền: thu ngân không xuất kho, không đổi giá, không thêm/xoá mặt hàng", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.withdraw(1, 1, CASHIER), /không có quyền xuất kho/);
  assert.throws(() => inventory.setPrice(1, 1000, CASHIER), /không có quyền đổi giá/);
  assert.throws(() => inventory.add(new FakeProduct({ id: 99, name: "Hàng lạ" }), CASHIER), /không có quyền thêm/);
  assert.throws(() => inventory.remove(1, CASHIER), /không có quyền xoá/);

  assert.equal(inventory.find(1).stock, 10);
  assert.equal(inventory.find(1).unitPrice, 20_000);
  assert.equal(inventory.count, 6);
});

test("Phân quyền: thiếu người thực hiện thì bị chặn, không mặc định cho qua", () => {
  const inventory = sampleInventory();
  assert.throws(() => inventory.restock(1, 5), /Không xác định được người thực hiện/);
  assert.throws(() => inventory.setPrice(1, 1000, null), /Không xác định được người thực hiện/);
  assert.equal(inventory.find(1).stock, 10);
});

test("Phân quyền: không thể giả mạo bằng object thường thay cho User", () => {
  const inventory = sampleInventory();
  // Kẻ giả mạo chỉ cần đúng hình dạng { canAccess } là qua được, nên đây là
  // ranh giới thật của thiết kế: quyền phải đến từ đối tượng User thật.
  const fake = { username: "gia-mao", canAccess: () => true };
  assert.equal(inventory.restock(1, 5, fake), 15);

  // Nhưng một object không có canAccess() thì không lách được.
  assert.throws(() => inventory.restock(1, 5, { username: "gia-mao" }), /Không xác định được người thực hiện/);
});

test("Phân quyền: quản lý kho hợp lệ vẫn thao tác được bình thường", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.restock(1, 5, MANAGER), 15);
  assert.equal(inventory.withdraw(1, 3, MANAGER), 12);
  assert.equal(inventory.setPrice(1, 25_000, MANAGER).unitPrice, 25_000);
  assert.equal(inventory.remove(2, MANAGER), true);
  assert.equal(inventory.add(new FakeProduct({ id: 42, name: "Dầu ăn" }), MANAGER).id, 42);
});

test("Inventory: totalUnits và inventoryValue tính đúng", () => {
  const inventory = sampleInventory();
  assert.equal(inventory.totalUnits, 10 + 8 + 40 + 12 + 6 + 2);

  const expected =
    20_000 * 10 + 12_000 * 8 + 5_000 * 40 + 9_000 * 12 + 30_000 * 6 + 4_000 * 2;
  assert.equal(inventory.inventoryValue, expected);

  inventory.restock(6, 3, MANAGER);
  assert.equal(inventory.totalUnits, 81);
  assert.equal(inventory.inventoryValue, expected + 4_000 * 3, "giá trị kho phải theo tồn kho mới");
});

test("Inventory: nextId là mã lớn nhất + 1, kho rỗng thì bắt đầu từ 1", () => {
  assert.equal(new Inventory().nextId, 1);
  assert.equal(sampleInventory().nextId, 7);
});

test("Inventory: fromJSON dựng lại kho từ plain object", () => {
  const inventory = Inventory.fromJSON([
    { id: 1001, name: "Mì Hảo Hảo", category: "Grocery", price: 4500, stock: 24, kind: "general", barcode: "", catalogKey: "off-8934563138165", lowStockThreshold: 5, supplier: "Acecook" },
    { id: 1002, name: "Sữa tươi", category: "Dairy", price: 8000, stock: 3, kind: "perishable", barcode: "", catalogKey: "milk", lowStockThreshold: 5, shelfLifeDays: 3 }
  ]);

  assert.equal(inventory.count, 2);
  assert.equal(inventory.find(1001)?.name, "Mì Hảo Hảo");
  assert.equal(inventory.find(1002)?.stock, 3);
  assert.equal(inventory.products[0]?.kind, "general");
  assert.equal(inventory.products[1]?.kind, "perishable", "hàng tươi phải giữ đúng lớp sau khi khôi phục");
  assert.throws(() => Inventory.fromJSON("không phải mảng"), TypeError);
});

/* =========================================================================
 * 4. Tương thích với models.js thật
 * ========================================================================*/

test("Inventory dùng được với Product thật của models.js", () => {
  const inventory = new Inventory([
    createProduct({ id: 5001, name: "Sữa chua", category: "Dairy", price: 12_000, stock: 9, kind: "general", supplier: "Vinamilk" })
  ]);

  assert.equal(inventory.restock(5001, 3, MANAGER), 12);
  assert.equal(inventory.withdraw(5001, 2, MANAGER), 10);
  assert.equal(inventory.setPrice(5001, 15_000, MANAGER).unitPrice, 15_000);
  assert.equal(inventory.inventoryValue, 15_000 * 10);
  assert.deepEqual(inventory.expiredProducts, []);
});

/* =========================================================================
 * 5. storage.js — môi trường localStorage giả
 * ========================================================================*/

/** localStorage giả tối thiểu, đủ để lưu chuỗi. */
function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    dump: () => map
  };
}

/** localStorage giả luôn ném lỗi như chế độ riêng tư của trình duyệt. */
function makeBlockedLocalStorage() {
  const throwError = () => {
    throw new Error("SecurityError: lưu trữ bị chặn");
  };
  return {
    getItem: throwError,
    setItem: throwError,
    removeItem: throwError,
    clear: throwError,
    key: throwError,
    get length() {
      throwError();
      return 0;
    }
  };
}

/** Môi trường sạch: gỡ localStorage giả trước mỗi kịch bản. */
function clearLocalStorageStub() {
  delete globalThis.localStorage;
}

/** Import lại storage.js với query riêng để có module scope mới. */
let storageVersion = 0;
async function freshStorage() {
  storageVersion += 1;
  clearLocalStorageStub();
  return import("../js/core/storage.js?v=" + storageVersion);
}

const SAMPLE_STATE = {
  products: [{ id: 1, name: "Sữa tươi", kind: "general" }],
  users: [{ username: "admin", role: "Admin", credential: "salt:hash" }],
  sales: [{ orderId: "AB12CD34", total: 1000 }]
};

/* =========================================================================
 * 6. storage.js — lưu, đọc, xoá
 * ========================================================================*/

test("storage: lưu rồi đọc lại đúng dữ liệu, chế độ là local", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();

  const result = storage.saveState(SAMPLE_STATE);
  assert.deepEqual(result, { ok: true });
  assert.equal(storage.storageMode(), "local");

  const loaded = storage.loadState();
  assert.deepEqual(loaded, SAMPLE_STATE);
  assert.equal(globalThis.localStorage.length, 1, "chỉ ghi đúng một khoá trạng thái");
});

test("storage: chưa có dữ liệu thì loadState trả null, không ném", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();
  assert.equal(storage.loadState(), null);
});

test("storage: dữ liệu hỏng thì loadState trả null, không ném", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();

  globalThis.localStorage.setItem("smartmart.state.v3", "{ đây không phải JSON ]");
  assert.equal(storage.loadState(), null);

  globalThis.localStorage.setItem("smartmart.state.v3", "null");
  assert.equal(storage.loadState(), null);

  globalThis.localStorage.setItem("smartmart.state.v3", JSON.stringify({ version: 999, data: { products: [{}] } }));
  assert.equal(storage.loadState(), null, "lược đồ lạ phải bị bỏ qua thay vì đoán mò");
});

test("storage: dữ liệu đúng định dạng nhưng rỗng thì trả null", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();
  storage.saveState({ products: [], users: [], sales: [] });
  assert.equal(storage.loadState(), null);
});

test("storage: clearState xoá sạch dữ liệu đã lưu", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();
  storage.saveState(SAMPLE_STATE);
  assert.notEqual(storage.loadState(), null);

  storage.clearState();
  assert.equal(globalThis.localStorage.getItem("smartmart.state.v3"), null);
  assert.equal(storage.loadState(), null);
});

test("storage: saveState chỉ ghi plain object, ép qua toJSON()", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeLocalStorage();

  // Thực thể giả có trạng thái riêng tư, chỉ lộ ra qua toJSON() — bắt chước Product thật.
  class StubEntity {
    #secret = "giá trị thật";
    toJSON() {
      return { id: 7, name: "Máy tính", stock: 3 };
    }
  }

  storage.saveState({ products: [new StubEntity()], users: [], sales: [] });
  const loaded = storage.loadState();

  assert.deepEqual(loaded.products, [{ id: 7, name: "Máy tính", stock: 3 }]);
  assert.equal(JSON.stringify(loaded).includes("giá trị thật"), false);
});

/* =========================================================================
 * 7. storage.js — khi bị trình duyệt chặn
 * ========================================================================*/

test("storage: localStorage ném lỗi thì saveState trả ok:false và chuyển sang chế độ memory", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeBlockedLocalStorage();

  const result = storage.saveState(SAMPLE_STATE);
  assert.equal(result.ok, false);
  assert.equal(typeof result.warning, "string");
  assert.ok(result.warning.length > 0, "cảnh báo phải có nội dung cho người dùng đọc");
  assert.equal(storage.storageMode(), "memory");

  // Không lưu được xuống máy nhưng vẫn phải giữ được dữ liệu trong phiên này.
  assert.deepEqual(storage.loadState(), SAMPLE_STATE);
});

test("storage: hoàn toàn không có localStorage thì mọi hàm vẫn không ném lỗi", async () => {
  const storage = await freshStorage();
  clearLocalStorageStub();

  assert.equal(storage.storageMode(), "memory");
  const result = storage.saveState(SAMPLE_STATE);
  assert.equal(result.ok, false);
  assert.deepEqual(storage.loadState(), SAMPLE_STATE, "chế độ bộ nhớ vẫn phải đọc lại được");
  assert.equal(storage.clearState(), true);
  assert.equal(storage.loadState(), null);
});

test("storage: loadState không ném khi chính việc đọc localStorage bị chặn", async () => {
  const storage = await freshStorage();
  globalThis.localStorage = makeBlockedLocalStorage();

  assert.doesNotThrow(() => storage.loadState());
  assert.equal(storage.loadState(), null);
  assert.equal(storage.storageMode(), "memory");
});

test("storage: localStorage chỉ ghi được một lần rồi đầy thì vẫn giữ dữ liệu mới nhất", async () => {
  const storage = await freshStorage();
  const local = makeLocalStorage();
  let writes = 0;
  const originalSetItem = local.setItem;
  globalThis.localStorage = {
    ...local,
    setItem: (key, value) => {
      writes += 1;
      if (writes > 1) throw new Error("QuotaExceededError: bộ nhớ đã đầy");
      originalSetItem(key, value);
    }
  };

  assert.deepEqual(storage.saveState(SAMPLE_STATE), { ok: true });
  const second = storage.saveState({ products: [], users: [], sales: SAMPLE_STATE.sales });
  assert.equal(second.ok, false);
  assert.equal(storage.storageMode(), "memory");

  const loaded = storage.loadState();
  assert.deepEqual(loaded.sales, SAMPLE_STATE.sales, "bản mới nhất nằm trong bộ nhớ phải thắng bản cũ trên đĩa");
  assert.deepEqual(loaded.products, [], "bản mới nhất phản ánh đúng trạng thái hiện tại");
});

/* =========================================================================
 * 8. seed.js — dữ liệu mẫu
 * ========================================================================*/

test("seed: loadCatalog nhận hàm tải thay thế và trả mảng item thô", async () => {
  const { loadCatalog } = await import("../js/core/seed.js");
  const items = await loadCatalog(async () => ({ items: [{ id: 1, name: "A" }, { id: 2, name: "B" }] }));
  assert.equal(items.length, 2);
  assert.equal(items[1].name, "B");
});

test("seed: loadCatalog báo lỗi rõ ràng khi danh mục rỗng hoặc sai định dạng", async () => {
  const { loadCatalog } = await import("../js/core/seed.js");
  await assert.rejects(() => loadCatalog(async () => ({ items: [] })), /rỗng hoặc sai định dạng/);
  await assert.rejects(() => loadCatalog(async () => null), /rỗng hoặc sai định dạng/);
});

test("seed: seedProducts dựng đủ 72 sản phẩm từ danh mục mẫu trong repo", async () => {
  const { seedProducts, CATALOG_URL } = await import("../js/core/seed.js");
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");

  // Đọc thẳng data/catalog.json bằng fs để test không phụ thuộc vào fetch của Node.
  const raw = JSON.parse(await readFile(fileURLToPath(CATALOG_URL), "utf8"));
  assert.equal(raw.items.length, 72);

  const products = await seedProducts(async () => raw);
  assert.equal(products.length, 72);
  assert.equal(typeof products[0].toJSON, "function", "phải là thực thể Product, không phải plain object");

  const inventory = new Inventory(products);
  assert.equal(inventory.count, 72);
  assert.equal(inventory.products.filter((product) => product.kind === "perishable").length, 25);
  assert.ok(inventory.totalUnits > 0);
  assert.ok(inventory.inventoryValue > 0);
});

test("seed: hàng tươi có hạn dùng tính từ hôm nay, điện tử có bảo hành", async () => {
  const { normalizeCatalogItem } = await import("../js/core/seed.js");
  const today = new Date(2026, 0, 15); // 15/01/2026 — mốc cố định để test không phụ thuộc ngày chạy

  const perishable = normalizeCatalogItem(
    { id: 1, name: "Sữa", category: "Dairy", price: 1000, stock: 5, kind: "perishable", shelfLifeDays: 3 },
    today
  );
  assert.equal(perishable.expiryDate, "2026-01-18");
  assert.equal(perishable.warrantyMonths, undefined, "hàng tươi không được mang trường của điện tử");

  const electronic = normalizeCatalogItem(
    { id: 2, name: "Chuột", category: "Electronics", price: 1000, stock: 5, kind: "electronic", warrantyMonths: 24, serial: "SM-2" },
    today
  );
  assert.equal(electronic.warrantyMonths, 24);
  assert.equal(electronic.serialNumber, "SM-2", "danh mục dùng tên ngắn 'serial', hợp đồng dùng 'serialNumber'");

  const general = normalizeCatalogItem(
    { id: 3, name: "Khăn giấy", category: "Household", price: 1000, stock: 5, kind: "general", supplier: "CleanCo" },
    today
  );
  assert.equal(general.supplier, "CleanCo");
});

test("seed: seedUsers đồng bộ trả mảng rỗng kèm ghi chú, seedUsersAsync là bản chính", async () => {
  const { seedUsers, seedUsersAsync } = await import("../js/core/seed.js");

  // Bản đồng bộ không thể băm PBKDF2 nên trả rỗng — điều này đã ghi trong báo cáo.
  assert.deepEqual(seedUsers(), []);
  // Có sẵn dữ liệu đã lưu thì vẫn khôi phục được ngay, không cần chờ băm lại.
  assert.equal(seedUsers([{ username: "admin", role: "Admin", credential: "salt:hash" }])[0].username, "admin");

  const users = await seedUsersAsync();
  assert.equal(users.length, 3);
  assert.deepEqual(
    users.map((user) => user.username),
    ["admin", "manager", "cashier"]
  );
  assert.deepEqual(
    users.map((user) => user.role),
    ["Admin", "Manager", "Cashier"]
  );
  for (const user of users) {
    const credential = user.toJSON().credential;
    assert.equal(typeof credential, "string");
    assert.ok(credential.length > 20, "mật khẩu phải được băm chứ không lưu thô");
    assert.ok(credential.includes(":"), "credential phải ở dạng salt:hash");
    assert.notEqual(credential, user.username, "không được để lọt mật khẩu thô");
  }

  // Ba tài khoản demo dùng chính tên đăng nhập làm mật khẩu (ngắn hơn 6 ký tự),
  // nên phải đăng nhập được thật — đây là đường vào duy nhất của buổi demo.
  const { verifyPassword } = await import("../js/core/auth.js");
  assert.equal(await verifyPassword("admin", users[0].toJSON().credential), true);
  assert.equal(await verifyPassword("sai-mat-khau", users[0].toJSON().credential), false);
});
