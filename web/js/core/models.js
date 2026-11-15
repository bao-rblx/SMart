/**
 * SmartMart · Tầng lớp sản phẩm (Product hierarchy)
 * ---------------------------------------------------------------------------
 * ĐÂY LÀ TRÁI TIM HƯỚNG ĐỐI TƯỢNG CỦA ĐỒ ÁN. Bốn trụ cột được cài đặt ở:
 *
 * 1. TRỪU TƯỢNG (abstraction)
 *    · "Product" là lớp CƠ SỞ TRỪU TƯỢNG: "new Product(...)" ném TypeError,
 *      vì một "sản phẩm chung chung" không có cách tính ưu đãi nào cả.
 *    · "applyDiscount()" và "displayInfo()" là PHƯƠNG THỨC TRỪU TƯỢNG: lớp cơ
 *      sở ném lỗi, buộc lớp con ghi đè. Constructor còn kiểm tra sớm nên lập
 *      trình viên phát hiện thiếu ghi đè ngay lúc tạo đối tượng, không phải lúc
 *      bấm thanh toán.
 *
 * 2. KẾ THỪA (inheritance)
 *    · PerishableProduct / ElectronicProduct / GeneralProduct "extends Product"
 *      và thừa hưởng toàn bộ phần dùng chung: mã hàng, tên, giá, tồn kho,
 *      restock(), trySell(), renamed(), withPrice(), toJSON()...
 *    · Chỉ phần ĐẶC THÙ mới phải viết lại. Đó là lý do lớp con ngắn hơn lớp cơ sở.
 *
 * 3. ĐA HÌNH (polymorphism)
 *    · Cùng một lời gọi "product.applyDiscount()" cho ra 30% / 10% / 5% tuỳ
 *      vào LỚP THỰC TẾ của đối tượng, không cần if/else ở nơi gọi.
 *    · "trySell()" ở lớp cơ sở gọi "this.canSell" — hàng tươi hết hạn tự động
 *      không bán được dù lớp cơ sở không hề biết "hạn dùng" là gì. Đây là
 *      đa hình qua ghi đè getter.
 *    · "calculateTax()" cũng đa hình: điện tử 12%, còn lại 10%.
 *
 * 4. ĐÓNG GÓI (encapsulation)
 *    · Toàn bộ trạng thái nằm trong PRIVATE FIELD (#id, #name, #unitPrice,
 *      #stock...). Bên ngoài không thể đọc trực tiếp, không thể gán bừa
 *      "product.stock = -5" — chỉ đọc được qua getter, chỉ đổi được qua
 *      phương thức nghiệp vụ có kiểm tra (restock, trySell).
 *    · "get expiryDate()" trả BẢN SAO của Date để người ngoài không sửa được
 *      hạn dùng từ xa.
 *
 * Sơ đồ lớp:
 *
 *                       ┌───────────────────────────────────────┐
 *                       │  Product  «abstract»                  │
 *                       │  #id #name #unitPrice #stock ...      │
 *                       │  ─────────────────────────────────    │
 *                       │  applyDiscount()  ← TRỪU TƯỢNG        │
 *                       │  displayInfo()    ← TRỪU TƯỢNG        │
 *                       │  calculateTax()   ← mặc định 10%      │
 *                       │  restock() trySell() renamed() ...    │
 *                       └───────────────────┬───────────────────┘
 *              ┌────────────────────────────┼────────────────────────────┐
 *              ▼                            ▼                            ▼
 *   PerishableProduct             ElectronicProduct              GeneralProduct
 *   + expiryDate                  + warrantyMonths               + supplier
 *   + shelfLifeDays               + serialNumber
 *   + isExpired, isNearExpiry     thuế 12%
 *   giảm 30% (cận hạn) / 5%       giảm 10%                       giảm 5%
 *
 * LƯU Ý TÍCH HỢP: vì trạng thái là private field, đừng dùng "{ ...product }"
 * hay "Object.keys(product)" — hãy dùng "product.toJSON()" khi cần plain object.
 */

import {
  Category,
  LOW_STOCK_THRESHOLD,
  NEAR_EXPIRY_DAYS,
  ProductKind
} from "./constants.js";
import { daysUntil, formatDate, pad2, roundMoney, toDate, toNumber } from "./format.js";

/* =========================================================================
 * 0. Tỉ lệ nghiệp vụ — gom một chỗ cho dễ đối chiếu với CONTRACTS.md mục 3.1
 * ========================================================================*/

const RATE = Object.freeze({
  /** Hàng tươi còn xa hạn: ưu đãi nhẹ 5%. */
  perishable: 0.05,
  /** Hàng tươi cận kề ngày hết hạn: ưu đãi mạnh 30% để đẩy hàng. */
  nearExpiry: 0.3,
  /** Điện tử: luôn 10%. */
  electronic: 0.1,
  /** Hàng thông thường: 5%. */
  general: 0.05,
  /** Thuế mặc định của lớp cơ sở. */
  defaultTax: 0.1,
  /** Điện tử chịu thuế cao hơn. */
  electronicTax: 0.12
});

/* =========================================================================
 * 1. Hàm dựng dữ liệu — "cửa khẩu" kiểm tra đầu vào, dùng chung cho mọi lớp
 * ========================================================================*/

/** Đọc mã hàng: bắt buộc, phải quy ra được số hữu hạn. */
function readId(value) {
  if (value === null || value === undefined || value === "") {
    throw new TypeError("Sản phẩm phải có mã hàng (id).");
  }
  const id = Number(value);
  if (!Number.isFinite(id)) {
    throw new TypeError("Mã hàng không hợp lệ: " + String(value) + ".");
  }
  return id;
}

/** Chuỗi an toàn: bỏ khoảng trắng thừa, không bao giờ trả về undefined. */
function readText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

/**
 * Đọc một số đếm (tồn kho, ngưỡng cảnh báo, số tháng bảo hành).
 * Vì sao phải chặt: tồn kho âm hoặc lẻ làm hỏng mọi phép tính tiền phía sau,
 * nên chặn ngay tại biên thay vì để lỗi lan sang giỏ hàng và hóa đơn.
 */
function readCount(value, label) {
  const amount = toNumber(value, 0);
  if (!Number.isInteger(amount)) {
    throw new RangeError(label + " phải là số nguyên, nhận được: " + String(value) + ".");
  }
  if (amount < 0) {
    throw new RangeError(label + " không được âm, nhận được: " + amount + ".");
  }
  return amount;
}

/** Đọc giá: không âm, và làm tròn tới đồng NGAY khi gán (không đợi lúc tính tiền). */
function readPrice(value) {
  const amount = toNumber(value, 0);
  if (amount < 0) {
    throw new RangeError("Giá bán không được âm, nhận được: " + amount + ".");
  }
  return roundMoney(amount);
}

/** Đọc ngày ở dạng nửa đêm giờ địa phương — tránh lệch múi giờ khi so sánh hạn dùng. */
function parseDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Ngày hôm nay, đã cắt về nửa đêm. */
function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Cộng thêm số ngày vào một ngày. */
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Chuyển Date sang chuỗi ISO "yyyy-mm-dd" để lưu xuống máy. */
function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

/** Giá trị "kind" có nằm trong danh sách loại hàng hợp lệ không. */
function isProductKind(value) {
  return Object.values(ProductKind).includes(value);
}

/** Đọc "số ngày còn lại" ở dạng tuỳ chọn (có thể âm = đã quá hạn). */
function readOptionalDays(value) {
  if (value === null || value === undefined || value === "") return null;
  const days = Number(value);
  return Number.isFinite(days) ? Math.trunc(days) : null;
}

/* =========================================================================
 * 2. LỚP CƠ SỞ TRỪU TƯỢNG
 * ========================================================================*/

/**
 * Sản phẩm — lớp cơ sở trừu tượng của toàn bộ danh mục.
 *
 * Không ai tạo trực tiếp được lớp này: mỗi loại hàng có cách tính ưu đãi và
 * cách mô tả riêng, nên "sản phẩm chung chung" là một khái niệm vô nghĩa.
 */
export class Product {
  // ----- ĐÓNG GÓI: trạng thái chỉ nằm trong private field, không lộ ra ngoài.
  #id;
  #name;
  #category;
  #unitPrice;
  #stock;
  #lowStockThreshold;
  #barcode;
  #catalogKey;
  #kind;

  /**
   * @param {object} data Dữ liệu thô (xem CONTRACTS.md mục 2.1).
   */
  constructor(data = {}) {
    // TRỪU TƯỢNG: chặn khởi tạo lớp cơ sở. new.target là lớp thực sự được new.
    if (new.target === Product) {
      throw new TypeError(
        "Product là lớp trừu tượng, không khởi tạo trực tiếp. " +
          "Hãy dùng PerishableProduct, ElectronicProduct hoặc GeneralProduct."
      );
    }

    this.#id = readId(data.id);
    this.#name = readText(data.name);
    this.#category = readText(data.category, Category.General) || Category.General;
    this.#unitPrice = readPrice(data.price);
    this.#stock = readCount(data.stock, "Tồn kho");
    this.#lowStockThreshold = readCount(
      data.lowStockThreshold ?? LOW_STOCK_THRESHOLD,
      "Ngưỡng tồn kho thấp"
    );
    this.#barcode = readText(data.barcode);
    this.#catalogKey = readText(data.catalogKey ?? data.key);
    this.#kind = readText(data.kind, ProductKind.General) || ProductKind.General;

    // TRỪU TƯỢNG (kiểm tra sớm): lớp con quên ghi đè thì báo lỗi ngay tại đây,
    // thay vì để sự cố nổ ra giữa lúc tính tiền cho khách.
    this.assertConcrete();
  }

  /** Bảo đảm lớp con đã ghi đè đủ hai phương thức trừu tượng. */
  assertConcrete() {
    const className = this.constructor.name;

    // So sánh danh tính hàm: nếu vẫn trỏ về bản của Product nghĩa là chưa ghi đè.
    if (this.applyDiscount === Product.prototype.applyDiscount) {
      throw new TypeError(className + " chưa ghi đè applyDiscount() — phương thức trừu tượng của Product.");
    }
    if (this.displayInfo === Product.prototype.displayInfo) {
      throw new TypeError(className + " chưa ghi đè displayInfo() — phương thức trừu tượng của Product.");
    }
  }

  // ----- Getter chỉ đọc: cách duy nhất để bên ngoài nhìn vào trạng thái -----
  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  get category() {
    return this.#category;
  }

  /** Giá gốc, luôn là số nguyên đồng. */
  get unitPrice() {
    return this.#unitPrice;
  }

  get stock() {
    return this.#stock;
  }

  get lowStockThreshold() {
    return this.#lowStockThreshold;
  }

  get barcode() {
    return this.#barcode;
  }

  get catalogKey() {
    return this.#catalogKey;
  }

  /** Loại hàng: "perishable" | "electronic" | "general". */
  get kind() {
    return this.#kind;
  }

  // ----- Thuộc tính dẫn xuất (không lưu trữ, tính từ trạng thái) -----

  /** Tồn kho đã chạm ngưỡng cảnh báo. */
  get isLowStock() {
    return this.#stock <= this.#lowStockThreshold;
  }

  /** Còn bán được không. Lớp con ghi đè để thêm điều kiện riêng (hạn dùng). */
  get canSell() {
    return this.#stock > 0;
  }

  /** Giá sau ưu đãi — ĐA HÌNH: gọi xuống applyDiscount() của lớp con. */
  get discountedPrice() {
    return this.applyDiscount();
  }

  /** Mức ưu đãi thực tế, tính ngược từ giá đã giảm. */
  get discountPercent() {
    const base = this.#unitPrice;
    if (base <= 0) return 0; // chia cho 0 là vô nghĩa, hàng miễn phí thì không giảm giá
    return Math.round((1 - this.discountedPrice / base) * 100);
  }

  // ----- Phương thức trừu tượng: lớp con BẮT BUỘC ghi đè -----

  /**
   * Giá sau khi áp dụng ưu đãi của loại hàng.
   * @abstract
   */
  applyDiscount() {
    throw new TypeError(
      this.constructor.name + ": applyDiscount() là phương thức trừu tượng, lớp con phải ghi đè."
    );
  }

  /**
   * Chuỗi mô tả riêng của loại hàng (dùng cho thẻ sản phẩm).
   * @abstract
   */
  displayInfo() {
    throw new TypeError(
      this.constructor.name + ": displayInfo() là phương thức trừu tượng, lớp con phải ghi đè."
    );
  }

  // ----- Phương thức nghiệp vụ dùng chung (KẾ THỪA cho mọi lớp con) -----

  /**
   * Thuế trên giá đã ưu đãi. Mặc định 10%; ElectronicProduct ghi đè thành 12%.
   * Tính trên discountedPrice (không phải giá gốc) — thuế đánh theo tiền khách trả.
   */
  calculateTax() {
    return roundMoney(this.discountedPrice * RATE.defaultTax);
  }

  /**
   * Nhập thêm hàng vào kho.
   * @param {number} qty Số nguyên lớn hơn 0.
   * @returns {number} Tồn kho mới (tiện cho giao diện cập nhật ngay).
   */
  restock(qty) {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new RangeError("Số lượng nhập kho phải là số nguyên lớn hơn 0, nhận được: " + String(qty) + ".");
    }
    this.#stock += qty;
    return this.#stock;
  }

  /**
   * Bán hàng: trừ kho nếu đủ điều kiện.
   * Trả false thay vì ném lỗi ở mọi trường hợp không bán được, vì đây là câu hỏi
   * "có bán được không" chứ không phải lỗi lập trình.
   *
   * ĐA HÌNH: "this.canSell" ở đây tự động là phiên bản của lớp con — hàng hết hạn
   * trả false dù dòng mã này không hề nhắc tới hạn dùng.
   */
  trySell(qty) {
    if (!this.canSell) return false;
    if (!Number.isInteger(qty) || qty <= 0) return false;
    if (qty > this.#stock) return false;
    this.#stock -= qty;
    return true;
  }

  /**
   * Bản sao cùng loại với tên mới — KHÔNG sửa đối tượng gốc.
   * Vì sao cần: danh mục là dữ liệu dùng chung; sửa tại chỗ sẽ làm hỏng giỏ hàng
   * và hóa đơn đã in. "new this.constructor(...)" giữ đúng lớp con thật của đối
   * tượng, kể cả khi sau này có lớp con của lớp con.
   */
  renamed(name) {
    const nextName = readText(name);
    if (!nextName) {
      throw new TypeError("Tên sản phẩm mới không được để trống.");
    }
    return new this.constructor({ ...this.toJSON(), name: nextName });
  }

  /** Bản sao cùng loại với giá mới — giá sẽ được làm tròn tới đồng như lúc tạo. */
  withPrice(price) {
    return new this.constructor({ ...this.toJSON(), price });
  }

  /**
   * Xuất ra plain object đúng định dạng lưu trữ (CONTRACTS.md mục 2.1).
   * Đây là ranh giới giữa thế giới hướng đối tượng và JSON — trả về object mới
   * nên người ngoài có sửa cũng không ảnh hưởng tới thực thể.
   */
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      category: this.#category,
      price: this.#unitPrice,
      stock: this.#stock,
      kind: this.#kind,
      barcode: this.#barcode,
      catalogKey: this.#catalogKey,
      lowStockThreshold: this.#lowStockThreshold
    };
  }

  /**
   * Khôi phục từ dữ liệu đã lưu.
   * Gọi createProduct để chọn đúng lớp con — nhờ vậy đọc từ localStorage lên
   * vẫn giữ được hành vi đa hình (hàng tươi vẫn biết mình sắp hết hạn).
   */
  static fromJSON(data) {
    if (data instanceof Product) return createProduct(data.toJSON());
    return createProduct(data);
  }
}

/* =========================================================================
 * 3. LỚP CON 1 — HÀNG TƯƠI
 * ========================================================================*/

/**
 * Hàng tươi sống: có hạn dùng.
 *
 * KẾ THỪA: chỉ thêm phần liên quan tới hạn dùng, mọi thứ khác dùng lại của Product.
 * ĐA HÌNH: ghi đè applyDiscount() (ưu đãi tăng khi gần hạn), canSell (hết hạn thì
 * không bán) và displayInfo().
 */
export class PerishableProduct extends Product {
  // ĐÓNG GÓI: hạn dùng là private field; getter trả bản sao Date.
  #expiryDate;

  constructor(data = {}) {
    // KẾ THỪA: giao phần dùng chung cho lớp cha, chỉ giữ lại "kind" của mình.
    super({ ...data, kind: ProductKind.Perishable });

    // Ưu tiên mốc ngày tuyệt đối (chính xác qua thời gian); chỉ khi thiếu mới
    // suy ra từ "còn bao nhiêu ngày" của dữ liệu mẫu.
    const explicitDate = parseDateOnly(data.expiryDate);
    const remaining = readOptionalDays(data.shelfLifeDays);
    this.#expiryDate = explicitDate ?? (remaining === null ? today() : addDays(today(), remaining));
  }

  /** Hạn dùng, luôn ở nửa đêm giờ địa phương. */
  get expiryDate() {
    // Trả bản sao: Date là object tham chiếu, trả thẳng là mở cửa cho người ngoài sửa.
    return new Date(this.#expiryDate.getTime());
  }

  /** Số ngày còn lại tới hạn dùng (âm nghĩa là đã quá hạn). */
  get shelfLifeDays() {
    return daysUntil(this.#expiryDate);
  }

  /** Đã quá hạn sử dụng. */
  get isExpired() {
    return this.shelfLifeDays < 0;
  }

  /** Còn trong khoảng cảnh báo cận hạn (0..7 ngày) — chưa tính hàng đã hết hạn. */
  get isNearExpiry() {
    const days = this.shelfLifeDays;
    return days >= 0 && days <= NEAR_EXPIRY_DAYS;
  }

  /**
   * ĐA HÌNH (ghi đè getter): hàng hết hạn thì không bán được nữa, dù còn trong kho.
   * "super.canSell" gọi lại điều kiện gốc (còn tồn kho) rồi mới thêm điều kiện riêng.
   */
  get canSell() {
    return super.canSell && !this.isExpired;
  }

  /**
   * ĐA HÌNH: cận hạn thì giảm 30% để đẩy hàng, còn xa thì giảm nhẹ 5%.
   * Hàng đã hết hạn không còn là "cận hạn" nên rơi về mức 5% — nhưng loại này
   * cũng không bán được (canSell = false) nên con số chỉ để hiển thị.
   */
  applyDiscount() {
    const rate = this.isNearExpiry ? RATE.nearExpiry : RATE.perishable;
    return roundMoney(this.unitPrice * (1 - rate));
  }

  /** "Hạn dùng: dd/mm/yyyy" */
  displayInfo() {
    return "Hạn dùng: " + formatDate(this.#expiryDate);
  }

  /** KẾ THỪA + mở rộng: lấy phần chung của lớp cha rồi bổ sung trường riêng. */
  toJSON() {
    return {
      ...super.toJSON(),
      expiryDate: toISODate(this.#expiryDate),
      shelfLifeDays: this.shelfLifeDays
    };
  }
}

/* =========================================================================
 * 4. LỚP CON 2 — HÀNG ĐIỆN TỬ
 * ========================================================================*/

/**
 * Hàng điện tử: có bảo hành và số sê-ri.
 *
 * KẾ THỪA: dùng lại toàn bộ phần tồn kho/giá của Product.
 * ĐA HÌNH: ghi đè applyDiscount() (10%), calculateTax() (12%) và displayInfo().
 */
export class ElectronicProduct extends Product {
  #warrantyMonths;
  #serialNumber;

  constructor(data = {}) {
    super({ ...data, kind: ProductKind.Electronic });
    this.#warrantyMonths = readCount(data.warrantyMonths ?? 0, "Số tháng bảo hành");
    // Nhận cả "serial" vì dữ liệu mẫu trong data/catalog.json dùng tên ngắn đó.
    this.#serialNumber = readText(data.serialNumber ?? data.serial);
  }

  get warrantyMonths() {
    return this.#warrantyMonths;
  }

  get serialNumber() {
    return this.#serialNumber;
  }

  /** ĐA HÌNH: điện tử luôn giảm 10%, không phụ thuộc thời gian. */
  applyDiscount() {
    return roundMoney(this.unitPrice * (1 - RATE.electronic));
  }

  /** ĐA HÌNH (ghi đè): mặt hàng điện tử chịu thuế 12% thay vì 10%. */
  calculateTax() {
    return roundMoney(this.discountedPrice * RATE.electronicTax);
  }

  /** "Bảo hành 12 tháng" */
  displayInfo() {
    if (this.#warrantyMonths <= 0) return "Không bảo hành";
    return "Bảo hành " + this.#warrantyMonths + " tháng";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      warrantyMonths: this.#warrantyMonths,
      serialNumber: this.#serialNumber
    };
  }
}

/* =========================================================================
 * 5. LỚP CON 3 — HÀNG THÔNG THƯỜNG
 * ========================================================================*/

/**
 * Hàng thông thường: không hạn dùng, không bảo hành, chỉ có nhà cung cấp.
 *
 * KẾ THỪA: lớp con ngắn nhất — chứng minh lớp cơ sở đã gánh đủ phần chung.
 * ĐA HÌNH: chỉ cần ghi đè applyDiscount() (5%) và displayInfo().
 */
export class GeneralProduct extends Product {
  #supplier;

  constructor(data = {}) {
    super({ ...data, kind: ProductKind.General });
    this.#supplier = readText(data.supplier);
  }

  get supplier() {
    return this.#supplier;
  }

  /** ĐA HÌNH: hàng thông thường giảm 5%. */
  applyDiscount() {
    return roundMoney(this.unitPrice * (1 - RATE.general));
  }

  /** "Nhà cung cấp: CleanCo" */
  displayInfo() {
    return "Nhà cung cấp: " + (this.#supplier || "Chưa xác định");
  }

  toJSON() {
    return {
      ...super.toJSON(),
      supplier: this.#supplier
    };
  }
}

/* =========================================================================
 * 6. NHÀ MÁY + NHẬN DIỆN LOẠI HÀNG
 * ========================================================================*/

/**
 * Tạo đúng lớp con theo data.kind.
 * Đây là "factory": nơi duy nhất trong ứng dụng được phép biết đủ ba lớp con,
 * nhờ vậy phần còn lại của mã nguồn chỉ làm việc với Product và gọi đa hình.
 *
 * @param {object} data Dữ liệu thô theo CONTRACTS.md mục 2.1.
 * @returns {Product}
 */
export function createProduct(data = {}) {
  const kind = readText(data?.kind, ProductKind.General) || ProductKind.General;
  switch (kind) {
    case ProductKind.Perishable:
      return new PerishableProduct(data);
    case ProductKind.Electronic:
      return new ElectronicProduct(data);
    case ProductKind.General:
      return new GeneralProduct(data);
    default:
      throw new TypeError(
        "Loại sản phẩm không hợp lệ: " + kind + ". Chỉ chấp nhận perishable, electronic, general."
      );
  }
}

/**
 * Trả về chuỗi loại của một sản phẩm.
 * Dùng instanceof để nhận diện theo LỚP THẬT (đúng tinh thần đa hình), chỉ khi
 * gặp plain object (dữ liệu thô) mới đọc trường "kind".
 */
export function productKindOf(product) {
  if (product === null || product === undefined) {
    throw new TypeError("productKindOf() cần một sản phẩm.");
  }
  if (product instanceof PerishableProduct) return ProductKind.Perishable;
  if (product instanceof ElectronicProduct) return ProductKind.Electronic;
  if (product instanceof GeneralProduct) return ProductKind.General;
  return isProductKind(product.kind) ? product.kind : ProductKind.General;
}
