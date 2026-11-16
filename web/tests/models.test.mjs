/**
 * SmartMart · Kiểm thử tầng lớp sản phẩm
 * ---------------------------------------------------------------------------
 * Bộ kiểm thử này là "bằng chứng" cho phần điểm hướng đối tượng của đồ án:
 *   · TRỪU TƯỢNG  — không tạo được lớp cơ sở, không bỏ qua phương thức trừu tượng
 *   · KẾ THỪA     — ba lớp con dùng lại toàn bộ hành vi chung của Product
 *   · ĐA HÌNH     — cùng một lời gọi cho ra kết quả khác nhau theo lớp thật
 *   · ĐÓNG GÓI    — trạng thái chỉ đổi được qua phương thức nghiệp vụ
 *
 * Chạy riêng: node --test tests/models.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  Product,
  PerishableProduct,
  ElectronicProduct,
  GeneralProduct,
  createProduct,
  productKindOf
} from "../js/core/models.js";

/* =========================================================================
 * Tiện ích dựng dữ liệu
 * ========================================================================*/

/** Ngày ISO (yyyy-mm-dd) cách hôm nay một số ngày — để test không phụ thuộc lịch. */
function isoDate(daysFromToday) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
  const pad = (value) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

/** Dữ liệu chung cho mọi loại hàng; giá 100.000 ₫ cho dễ nhẩm. */
function baseData(overrides = {}) {
  return {
    id: 1001,
    name: "Sản phẩm thử",
    category: "Grocery",
    price: 100_000,
    stock: 20,
    barcode: "8934563138165",
    catalogKey: "off-8934563138165",
    lowStockThreshold: 5,
    ...overrides
  };
}

function perishable(overrides = {}) {
  return new PerishableProduct(baseData({ expiryDate: isoDate(20), ...overrides }));
}

function electronic(overrides = {}) {
  return new ElectronicProduct(baseData({ warrantyMonths: 12, serialNumber: "SM-1001", ...overrides }));
}

function general(overrides = {}) {
  return new GeneralProduct(baseData({ supplier: "CleanCo", ...overrides }));
}

/* =========================================================================
 * 1. TRỪU TƯỢNG — lớp cơ sở không được khởi tạo trực tiếp
 * ========================================================================*/

test("Product là lớp trừu tượng: new Product() ném TypeError", () => {
  assert.throws(() => new Product(baseData()), TypeError);
  assert.throws(() => new Product(), TypeError);
});

test("lớp con quên ghi đè applyDiscount() thì không tạo được đối tượng", () => {
  class Incomplete extends Product {
    displayInfo() {
      return "chỉ có mô tả";
    }
  }
  assert.throws(() => new Incomplete(baseData()), TypeError);
});

test("lớp con quên ghi đè displayInfo() thì không tạo được đối tượng", () => {
  class HalfDone extends Product {
    applyDiscount() {
      return this.unitPrice;
    }
  }
  assert.throws(() => new HalfDone(baseData()), TypeError);
});

test("gọi thẳng phương thức trừu tượng trên lớp cơ sở đều ném TypeError", () => {
  const fake = { constructor: { name: "Fake" } };
  assert.throws(() => Product.prototype.applyDiscount.call(fake), TypeError);
  assert.throws(() => Product.prototype.displayInfo.call(fake), TypeError);
});

/* =========================================================================
 * 2. KẾ THỪA — ba lớp con đều là Product và dùng lại hành vi chung
 * ========================================================================*/

test("ba lớp con đều kế thừa từ Product", () => {
  for (const product of [perishable(), electronic(), general()]) {
    assert.ok(product instanceof Product, "phải là thực thể của lớp cơ sở");
    assert.equal(typeof product.restock, "function");
    assert.equal(typeof product.trySell, "function");
    assert.equal(typeof product.toJSON, "function");
  }
});

test("mã hàng, tên, giá, tồn kho, mã vạch giữ nguyên qua lớp con", () => {
  const product = perishable({ stock: 7, lowStockThreshold: 3 });
  assert.equal(product.id, 1001);
  assert.equal(product.name, "Sản phẩm thử");
  assert.equal(product.category, "Grocery");
  assert.equal(product.unitPrice, 100_000);
  assert.equal(product.stock, 7);
  assert.equal(product.lowStockThreshold, 3);
  assert.equal(product.barcode, "8934563138165");
  assert.equal(product.catalogKey, "off-8934563138165");
});

/* =========================================================================
 * 3. ĐA HÌNH — cùng một giá gốc, ba mức ưu đãi khác nhau
 * ========================================================================*/

test("ĐA HÌNH: ba loại hàng cho ba mức ưu đãi khác nhau trên cùng giá 100.000 ₫", () => {
  const fresh = perishable(); // còn 20 ngày → 5%
  const device = electronic(); // 10%
  const common = general(); // 5%

  assert.equal(fresh.discountedPrice, 95_000);
  assert.equal(device.discountedPrice, 90_000);
  assert.equal(common.discountedPrice, 95_000);

  // Cùng một lời gọi applyDiscount() nhưng kết quả do lớp thật quyết định.
  assert.equal(device.applyDiscount(), 90_000);
  assert.notEqual(fresh.applyDiscount(), device.applyDiscount());
});

test("ĐA HÌNH: hàng tươi cận hạn bán rẻ hơn hàng tươi còn xa hạn", () => {
  const near = perishable({ expiryDate: isoDate(3) }); // 30%
  const far = perishable({ expiryDate: isoDate(20) }); // 5%
  assert.equal(near.discountedPrice, 70_000);
  assert.equal(far.discountedPrice, 95_000);
  assert.ok(near.discountedPrice < far.discountedPrice);
});

test("discountPercent tính đúng theo từng lớp: 30 / 10 / 5", () => {
  assert.equal(perishable({ expiryDate: isoDate(3) }).discountPercent, 30);
  assert.equal(electronic().discountPercent, 10);
  assert.equal(general().discountPercent, 5);
});

test("discountPercent bằng 0 khi giá bằng 0 (không chia cho 0)", () => {
  assert.equal(general({ price: 0 }).discountPercent, 0);
});

/* =========================================================================
 * 4. HÀNG TƯƠI — hạn dùng quyết định ưu đãi và khả năng bán
 * ========================================================================*/

test("hàng tươi còn 3 ngày: giảm 30% (cận hạn)", () => {
  const product = perishable({ expiryDate: isoDate(3) });
  assert.equal(product.shelfLifeDays, 3);
  assert.equal(product.isNearExpiry, true);
  assert.equal(product.isExpired, false);
  assert.equal(product.applyDiscount(), 70_000);
});

test("hàng tươi còn 20 ngày: giảm 5%", () => {
  const product = perishable({ expiryDate: isoDate(20) });
  assert.equal(product.shelfLifeDays, 20);
  assert.equal(product.isNearExpiry, false);
  assert.equal(product.applyDiscount(), 95_000);
});

test("hàng tươi: biên 7 ngày là cận hạn, 8 ngày thì không", () => {
  assert.equal(perishable({ expiryDate: isoDate(7) }).isNearExpiry, true);
  assert.equal(perishable({ expiryDate: isoDate(7) }).applyDiscount(), 70_000);
  assert.equal(perishable({ expiryDate: isoDate(8) }).isNearExpiry, false);
  assert.equal(perishable({ expiryDate: isoDate(8) }).applyDiscount(), 95_000);
});

test("hàng tươi hết hạn: isExpired true, canSell false, trySell trả false", () => {
  const product = perishable({ expiryDate: isoDate(-2), stock: 10 });
  assert.equal(product.isExpired, true);
  assert.equal(product.canSell, false);
  assert.equal(product.trySell(1), false);
  assert.equal(product.stock, 10, "không được trừ kho khi không bán được");
});

test("hàng tươi hôm nay hết hạn: chưa coi là quá hạn nhưng có thể bán nốt", () => {
  const product = perishable({ expiryDate: isoDate(0) });
  assert.equal(product.shelfLifeDays, 0);
  assert.equal(product.isExpired, false);
  assert.equal(product.isNearExpiry, true);
  assert.equal(product.canSell, true);
});

test("displayInfo hàng tươi là 'Hạn dùng: dd/mm/yyyy'", () => {
  assert.equal(perishable({ expiryDate: "2026-11-20" }).displayInfo(), "Hạn dùng: 20/11/2026");
  assert.equal(perishable({ expiryDate: "2026-01-05" }).displayInfo(), "Hạn dùng: 05/01/2026");
});

test("hàng tươi dựng từ shelfLifeDays (kiểu dữ liệu data/catalog.json)", () => {
  const product = createProduct({
    ...baseData(),
    kind: "perishable",
    shelfLifeDays: 3,
    expiryDate: undefined
  });
  assert.ok(product instanceof PerishableProduct);
  assert.equal(product.shelfLifeDays, 3);
  assert.equal(product.isNearExpiry, true);
  assert.equal(product.discountedPrice, 70_000);
});

test("expiryDate trả bản sao: sửa Date bên ngoài không đổi hạn dùng", () => {
  const product = perishable({ expiryDate: isoDate(10) });
  const before = product.shelfLifeDays;
  const leak = product.expiryDate;
  leak.setFullYear(1990);
  assert.equal(product.shelfLifeDays, before);
});

/* =========================================================================
 * 5. THUẾ — đa hình qua calculateTax()
 * ========================================================================*/

test("hàng điện tử chịu thuế 12% trên giá đã ưu đãi", () => {
  const product = electronic();
  assert.equal(product.discountedPrice, 90_000);
  assert.equal(product.calculateTax(), 10_800);
});

test("hàng thông thường chịu thuế 10% trên giá đã ưu đãi", () => {
  const product = general();
  assert.equal(product.discountedPrice, 95_000);
  assert.equal(product.calculateTax(), 9_500);
});

test("hàng tươi dùng thuế mặc định 10% của lớp cơ sở", () => {
  assert.equal(perishable().calculateTax(), 9_500);
  assert.equal(perishable({ expiryDate: isoDate(3) }).calculateTax(), 7_000);
});

/* =========================================================================
 * 6. ĐÓNG GÓI + tồn kho — không âm, không lẻ, không gán bừa
 * ========================================================================*/

test("không thể tạo sản phẩm với tồn kho âm", () => {
  assert.throws(() => general({ stock: -1 }), RangeError);
  assert.throws(() => perishable({ stock: -5 }), RangeError);
  assert.throws(() => electronic({ stock: -0.5 }), RangeError);
});

test("không thể tạo sản phẩm với tồn kho lẻ", () => {
  assert.throws(() => general({ stock: 1.5 }), RangeError);
});

test("không thể tạo sản phẩm với giá âm", () => {
  assert.throws(() => general({ price: -1 }), RangeError);
});

test("ĐÓNG GÓI: không gán được thuộc tính chỉ đọc từ bên ngoài", () => {
  const product = general();
  assert.throws(() => {
    product.stock = 999;
  }, TypeError);
  assert.throws(() => {
    product.unitPrice = 1;
  }, TypeError);
  assert.equal(product.stock, 20);
  assert.equal(product.unitPrice, 100_000);
});

test("ĐÓNG GÓI: trạng thái là private field nên không lộ qua Object.keys", () => {
  const product = general();
  assert.deepEqual(Object.keys(product), []);
  assert.deepEqual({ ...product }, {});
});

test("trySell vượt tồn kho trả false và không đổi tồn kho", () => {
  const product = general({ stock: 4 });
  assert.equal(product.trySell(5), false);
  assert.equal(product.stock, 4);
  assert.equal(product.trySell(100), false);
  assert.equal(product.stock, 4);
});

test("trySell hợp lệ trả true và trừ đúng số lượng", () => {
  const product = general({ stock: 4 });
  assert.equal(product.trySell(4), true);
  assert.equal(product.stock, 0);
});

test("trySell với số lượng không hợp lệ trả false", () => {
  const product = general({ stock: 10 });
  for (const qty of [0, -1, 1.5, Number.NaN]) {
    assert.equal(product.trySell(qty), false, "qty = " + String(qty));
  }
  assert.equal(product.stock, 10);
});

test("restock cộng kho và trả tồn kho mới", () => {
  const product = general({ stock: 2 });
  assert.equal(product.restock(8), 10);
  assert.equal(product.stock, 10);
});

test("restock với 0 hoặc số âm ném RangeError", () => {
  const product = general();
  assert.throws(() => product.restock(0), RangeError);
  assert.throws(() => product.restock(-3), RangeError);
  assert.equal(product.stock, 20, "tồn kho không đổi khi lệnh sai");
});

test("restock với số lẻ ném RangeError", () => {
  const product = general();
  assert.throws(() => product.restock(2.5), RangeError);
  assert.throws(() => product.restock("3"), RangeError);
});

test("isLowStock và canSell phản ánh đúng trạng thái", () => {
  assert.equal(general({ stock: 5, lowStockThreshold: 5 }).isLowStock, true);
  assert.equal(general({ stock: 6, lowStockThreshold: 5 }).isLowStock, false);
  assert.equal(general({ stock: 0 }).canSell, false);
  assert.equal(general({ stock: 1 }).canSell, true);
  assert.equal(general({ stock: 0 }).isLowStock, true);
});

/* =========================================================================
 * 7. BẤT BIẾN — renamed() / withPrice() trả bản sao, không sửa gốc
 * ========================================================================*/

test("renamed() trả bản sao cùng lớp con, giữ nguyên đối tượng gốc", () => {
  const original = perishable({ stock: 9 });
  const copy = original.renamed("Tên mới");

  assert.equal(copy.name, "Tên mới");
  assert.equal(original.name, "Sản phẩm thử", "đối tượng gốc không đổi");
  assert.ok(copy instanceof PerishableProduct);
  assert.equal(copy.constructor, PerishableProduct);
  assert.equal(copy.id, original.id);
  assert.equal(copy.stock, 9);
  assert.equal(copy.expiryDate.getTime(), original.expiryDate.getTime());
  assert.notEqual(copy, original, "phải là đối tượng mới");
});

test("withPrice() trả bản sao cùng lớp con và làm tròn giá mới tới đồng", () => {
  const original = electronic();
  const copy = original.withPrice(89_999.6);

  assert.equal(copy.unitPrice, 90_000);
  assert.equal(original.unitPrice, 100_000, "đối tượng gốc không đổi");
  assert.ok(copy instanceof ElectronicProduct);
  assert.equal(copy.warrantyMonths, 12);
  assert.equal(copy.serialNumber, "SM-1001");
});

test("withPrice() từ chối giá âm", () => {
  assert.throws(() => general().withPrice(-1), RangeError);
});

/* =========================================================================
 * 8. GIÁ LUÔN LÀ SỐ NGUYÊN ĐỒNG
 * ========================================================================*/

test("giá được làm tròn tới đồng ngay khi khởi tạo", () => {
  assert.equal(general({ price: 4500.4 }).unitPrice, 4500);
  assert.equal(general({ price: "12.5" }).unitPrice, 13);
  assert.equal(general({ price: 161_250.5 }).unitPrice, 161_251);
});

test("mọi giá dẫn xuất đều là số nguyên đồng", () => {
  const products = [
    perishable({ price: 10_333, expiryDate: isoDate(3) }),
    perishable({ price: 10_333, expiryDate: isoDate(30) }),
    electronic({ price: 10_333 }),
    general({ price: 10_333 })
  ];
  for (const product of products) {
    assert.ok(Number.isInteger(product.unitPrice), "unitPrice nguyên");
    assert.ok(Number.isInteger(product.discountedPrice), "discountedPrice nguyên");
    assert.ok(Number.isInteger(product.calculateTax()), "tax nguyên");
  }
});

/* =========================================================================
 * 9. LƯU / KHÔI PHỤC — toJSON / fromJSON giữ đúng lớp con
 * ========================================================================*/

test("toJSON có đủ trường chung của mọi sản phẩm", () => {
  const json = general().toJSON();
  assert.deepEqual(Object.keys(json).sort(), [
    "barcode",
    "catalogKey",
    "category",
    "id",
    "kind",
    "lowStockThreshold",
    "name",
    "price",
    "stock",
    "supplier"
  ]);
  assert.equal(json.kind, "general");
  assert.equal(json.price, 100_000);
  assert.equal(json.stock, 20);
});

test("khôi phục hàng tươi giữ đúng lớp con, expiryDate và shelfLifeDays", () => {
  const original = perishable({ expiryDate: isoDate(3) });
  const restored = Product.fromJSON(original.toJSON());

  assert.ok(restored instanceof PerishableProduct);
  assert.equal(restored.id, original.id);
  assert.equal(restored.name, original.name);
  assert.equal(restored.expiryDate.getTime(), original.expiryDate.getTime());
  assert.equal(restored.shelfLifeDays, 3);
  assert.equal(restored.discountedPrice, 70_000, "đa hình vẫn hoạt động sau khi khôi phục");
});

test("khôi phục hàng điện tử giữ warrantyMonths và serialNumber", () => {
  const restored = Product.fromJSON(electronic({ warrantyMonths: 24, serialNumber: "SM-CHG-001" }).toJSON());
  assert.ok(restored instanceof ElectronicProduct);
  assert.equal(restored.warrantyMonths, 24);
  assert.equal(restored.serialNumber, "SM-CHG-001");
  assert.equal(restored.calculateTax(), 10_800);
});

test("khôi phục hàng thông thường giữ supplier", () => {
  const restored = Product.fromJSON(general({ supplier: "Everyday Essentials" }).toJSON());
  assert.ok(restored instanceof GeneralProduct);
  assert.equal(restored.supplier, "Everyday Essentials");
  assert.equal(restored.displayInfo(), "Nhà cung cấp: Everyday Essentials");
});

test("đi vòng qua JSON.stringify/parse vẫn giữ đúng lớp con", () => {
  const source = [perishable({ expiryDate: isoDate(5) }), electronic(), general()];
  const restored = source
    .map((product) => JSON.parse(JSON.stringify(product.toJSON())))
    .map((data) => Product.fromJSON(data));

  assert.ok(restored[0] instanceof PerishableProduct);
  assert.ok(restored[1] instanceof ElectronicProduct);
  assert.ok(restored[2] instanceof GeneralProduct);
  assert.deepEqual(restored.map((product) => product.kind), ["perishable", "electronic", "general"]);
});

test("Product.fromJSON nhận cả một thực thể Product", () => {
  const original = perishable();
  const restored = Product.fromJSON(original);
  assert.ok(restored instanceof PerishableProduct);
  assert.notEqual(restored, original);
  assert.equal(restored.id, original.id);
});

test("toJSON trả object mới: sửa bản JSON không ảnh hưởng sản phẩm", () => {
  const product = general();
  const json = product.toJSON();
  json.name = "Đã bị sửa";
  json.stock = 0;
  assert.equal(product.name, "Sản phẩm thử");
  assert.equal(product.stock, 20);
});

/* =========================================================================
 * 10. NHÀ MÁY createProduct + productKindOf
 * ========================================================================*/

test("createProduct chọn đúng lớp con theo data.kind", () => {
  const fresh = createProduct({ ...baseData(), kind: "perishable", shelfLifeDays: 4 });
  const device = createProduct({ ...baseData(), kind: "electronic", warrantyMonths: 12, serial: "SM-X" });
  const common = createProduct({ ...baseData(), kind: "general", supplier: "CleanCo" });

  assert.ok(fresh instanceof PerishableProduct);
  assert.ok(device instanceof ElectronicProduct);
  assert.ok(common instanceof GeneralProduct);
  assert.equal(device.serialNumber, "SM-X", "nhận cả khoá 'serial' ngắn của dữ liệu mẫu");
});

test("createProduct từ chối loại hàng không hợp lệ", () => {
  assert.throws(() => createProduct({ ...baseData(), kind: "đồ-cổ" }), TypeError);
});

test("productKindOf nhận diện theo lớp thật của đối tượng", () => {
  assert.equal(productKindOf(perishable()), "perishable");
  assert.equal(productKindOf(electronic()), "electronic");
  assert.equal(productKindOf(general()), "general");
});

test("productKindOf đọc được cả plain object (dữ liệu thô)", () => {
  assert.equal(productKindOf({ kind: "electronic" }), "electronic");
  assert.equal(productKindOf({ kind: "không-có" }), "general");
  assert.throws(() => productKindOf(null), TypeError);
});

test("kind luôn khớp với lớp con (nhà máy không để lẫn loại)", () => {
  assert.equal(perishable().kind, "perishable");
  assert.equal(electronic().kind, "electronic");
  assert.equal(general().kind, "general");
  assert.equal(new GeneralProduct(baseData({ kind: "perishable" })).kind, "general");
});

/* =========================================================================
 * 11. THÔNG TIN HIỂN THỊ RIÊNG CỦA TỪNG LỚP
 * ========================================================================*/

test("displayInfo của điện tử và thông thường đúng định dạng hợp đồng", () => {
  assert.equal(electronic({ warrantyMonths: 12 }).displayInfo(), "Bảo hành 12 tháng");
  assert.equal(electronic({ warrantyMonths: 24 }).displayInfo(), "Bảo hành 24 tháng");
  assert.equal(general({ supplier: "CleanCo" }).displayInfo(), "Nhà cung cấp: CleanCo");
});
