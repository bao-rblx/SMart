/**
 * SmartMart · Tầng kho hàng
 * ---------------------------------------------------------------------------
 * Inventory KHÔNG phải một mảng biết tự sửa: nó là "người quản kho" giữ danh
 * sách sản phẩm, và MỌI thay đổi đều phải đi qua phương thức của Product.
 *
 * Vì sao phải đi qua Product: tồn kho và giá là private field (#stock,
 * #unitPrice) của models.js. Gán thẳng "product.stock = 5" sẽ ném TypeError vì
 * ES module luôn chạy ở chế độ strict. Nhờ vậy mọi thay đổi đều phải qua bước
 * kiểm tra của restock() / trySell() / withPrice() — đó chính là đóng gói.
 *
 * Vì sao getter "products" trả bản sao: nếu trả mảng thật, bên ngoài có thể
 * push/splice làm hỏng kho mà không qua một bước kiểm tra nào.
 */

import { NEAR_EXPIRY_DAYS, SCREENS } from "./constants.js";
import { roundMoney, toNumber } from "./format.js";
import { matches, normalize } from "./vietnamese.js";
import { createProduct } from "./models.js";

/* =========================================================================
 * Quyền hạn — chặn ở tầng nghiệp vụ, không chỉ ẩn nút trên giao diện
 * ========================================================================*/

/**
 * Màn hình mà một người phải được vào thì mới thao tác được trên kho.
 * Đây là "quyền ở tầng hàm", bổ sung cho việc ẩn menu: giao diện chỉ ẩn nút,
 * còn người gọi thẳng store.restock() từ console vẫn bị chặn ở đây.
 */
const INVENTORY_SCREEN = SCREENS.Inventory;

/**
 * Người thực hiện phải là tài khoản đăng nhập và được vào màn hình Kho hàng.
 * Cố tình KHÔNG nhận vai trò dạng chuỗi rời: muốn kiểm tra quyền thì phải có
 * đối tượng User thật, nhờ vậy không thể giả mạo bằng { role: "Admin" }.
 */
function assertCanManageInventory(actor, action) {
  if (!actor || typeof actor.canAccess !== "function") {
    throw new Error(
      "Không xác định được người thực hiện, nên không thể " + action + ". Hãy đăng nhập lại."
    );
  }
  if (!actor.canAccess(INVENTORY_SCREEN)) {
    throw new Error(
      "Tài khoản \"" + String(actor.username ?? "") + "\" không có quyền " + action + "."
    );
  }
  return actor;
}

/* =========================================================================
 * Hàm phụ trợ — kiểm tra đầu vào và nhận diện "hàng có hạn dùng"
 * ========================================================================*/

/** Bảo đảm đối tượng đưa vào kho thật sự là một sản phẩm dùng được. */
function assertProductLike(product) {
  if (!product || typeof product !== "object") {
    throw new TypeError("Kho hàng chỉ nhận đối tượng sản phẩm, nhận được: " + String(product) + ".");
  }
  const id = Number(product.id);
  if (!Number.isFinite(id)) {
    throw new TypeError("Sản phẩm phải có mã hàng (id) hợp lệ, nhận được: " + String(product.id) + ".");
  }
  // Tên rỗng làm mọi danh sách hiển thị thành một dòng trắng — chặn ngay tại cửa kho.
  if (!String(product.name ?? "").trim()) {
    throw new Error("Tên sản phẩm không được để trống (mã hàng " + id + ").");
  }
  return product;
}

/** Số lượng nhập/xuất kho: số nguyên lớn hơn 0, ngược lại là lỗi miền giá trị. */
function assertQuantity(qty, label) {
  const amount = Number(qty);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(label + " phải là số nguyên lớn hơn 0, nhận được: " + String(qty) + ".");
  }
  return amount;
}

/**
 * Nhận diện hàng có hạn dùng bằng "vịt gõ phím" (duck typing) thay vì
 * instanceof: inventory.js chỉ cần biết sản phẩm có hành vi hạn dùng hay
 * không, không cần biết nó thuộc lớp con nào. Nhờ vậy tầng kho không phụ
 * thuộc cứng vào cây kế thừa của models.js.
 */
function isPerishableLike(product) {
  if (!product || typeof product !== "object") return false;
  return (
    typeof product.isExpired === "boolean" ||
    typeof product.isNearExpiry === "boolean" ||
    typeof product.shelfLifeDays === "number"
  );
}

/** Cận hạn: ưu tiên getter của lớp con, chỉ khi thiếu mới tự suy từ số ngày còn lại. */
function isNearExpiry(product) {
  if (!isPerishableLike(product)) return false;
  if (typeof product.isNearExpiry === "boolean") return product.isNearExpiry;
  const days = toNumber(product.shelfLifeDays, NEAR_EXPIRY_DAYS + 1);
  return days >= 0 && days <= NEAR_EXPIRY_DAYS;
}

/** Đã quá hạn: cùng nguyên tắc với isNearExpiry(). */
function isExpired(product) {
  if (!isPerishableLike(product)) return false;
  if (typeof product.isExpired === "boolean") return product.isExpired;
  return toNumber(product.shelfLifeDays, 0) < 0;
}

/* =========================================================================
 * Lớp Inventory
 * ========================================================================*/

export class Inventory {
  #products = [];

  constructor(products = []) {
    if (!Array.isArray(products)) {
      throw new TypeError("Inventory cần một mảng sản phẩm, nhận được: " + String(products) + ".");
    }
    for (const product of products) {
      this.#adopt(assertProductLike(product));
    }
  }

  /* ---------------------------- Truy vấn ---------------------------- */

  /** Danh sách sản phẩm — trả bản sao để bên ngoài không sửa được kho. */
  get products() {
    return [...this.#products];
  }

  get count() {
    return this.#products.length;
  }

  /** Tổng số món trong kho — con số trên thẻ "Tồn kho" của màn hình quản lý. */
  get totalUnits() {
    return this.#products.reduce((sum, product) => sum + toNumber(product.stock, 0), 0);
  }

  find(id) {
    if (id === null || id === undefined) return undefined;
    // Mã hàng trong biểu mẫu luôn là chuỗi, còn id thật là số: so cả hai cách.
    const numeric = Number(id);
    if (Number.isFinite(numeric)) {
      const hit = this.#products.find((product) => Number(product.id) === numeric);
      if (hit) return hit;
    }
    return this.#products.find((product) => product.id === id);
  }

  /**
   * Tìm theo tên, không phân biệt dấu và hoa thường: "sua tuoi" khớp "Sữa tươi".
   * Ưu tiên khớp đúng tên trước, rồi mới tới khớp một phần — để người dùng gõ
   * đủ tên không bị nhảy sang mặt hàng khác chỉ vì nó đứng trước trong kho.
   */
  findByName(name) {
    const query = String(name ?? "").trim();
    if (!query) return undefined;
    const needle = normalize(query);
    const exact = this.#products.find((product) => normalize(product.name) === needle);
    return exact ?? this.#products.find((product) => matches(product.name, query));
  }

  /* --------------------------- Thay đổi kho -------------------------- */

  /** Thêm mặt hàng mới. Trùng mã hàng hoặc tên rỗng đều bị chặn. */
  add(product, actor) {
    assertCanManageInventory(actor, "thêm mặt hàng");
    const candidate = assertProductLike(product);
    if (this.find(candidate.id)) {
      throw new Error("Mã hàng " + candidate.id + " đã tồn tại trong kho.");
    }
    this.#products.push(candidate);
    return candidate;
  }

  /** Xoá theo mã hàng. Trả true nếu có xoá, false nếu không tìm thấy. */
  remove(id, actor) {
    assertCanManageInventory(actor, "xoá mặt hàng");
    const product = this.find(id);
    if (!product) return false;
    const index = this.#products.indexOf(product);
    if (index < 0) return false;
    this.#products.splice(index, 1);
    return true;
  }

  /** Nhập thêm hàng. Trả về tồn kho mới để giao diện cập nhật ngay. */
  restock(id, qty, actor) {
    assertCanManageInventory(actor, "nhập kho");
    const product = this.#require(id);
    const amount = assertQuantity(qty, "Số lượng nhập kho");
    product.restock(amount);
    return product.stock;
  }

  /**
   * Xuất kho (bán hoặc chuyển hàng đi).
   * Vì sao dùng trySell() thay vì tự trừ: trySell() của models.js là nơi duy
   * nhất biết "hàng hết hạn thì không bán được" — kho không cần biết luật đó.
   */
  withdraw(id, qty, actor) {
    assertCanManageInventory(actor, "xuất kho");
    const product = this.#require(id);
    const amount = assertQuantity(qty, "Số lượng xuất kho");
    if (toNumber(product.stock, 0) < amount) {
      throw new Error(
        "Không đủ tồn kho: \"" + product.name + "\" chỉ còn " + product.stock + ", cần xuất " + amount + "."
      );
    }
    if (!product.trySell(amount)) {
      throw new Error("Không thể xuất kho \"" + product.name + "\": mặt hàng đã hết hạn hoặc ngừng bán.");
    }
    return product.stock;
  }

  /**
   * Đổi giá bán.
   * Vì sao trả về sản phẩm mới: withPrice() của models.js tạo BẢN SAO thay vì
   * sửa tại chỗ, nên hóa đơn và giỏ hàng đang mở vẫn giữ giá cũ — đúng như
   * một cửa hàng thật, đổi giá không làm sai hóa đơn đã lập.
   */
  setPrice(id, price, actor) {
    assertCanManageInventory(actor, "đổi giá bán");
    const product = this.#require(id);
    const amount = Number(price);
    if (!Number.isFinite(amount)) {
      throw new TypeError("Giá bán không hợp lệ, nhận được: " + String(price) + ".");
    }
    if (amount < 0) {
      throw new RangeError("Giá bán không được âm, nhận được: " + amount + ".");
    }
    const updated = product.withPrice(amount);
    const index = this.#products.indexOf(product);
    this.#products[index] = updated;
    return updated;
  }

  /* ----------------------------- Cảnh báo ---------------------------- */

  /** Mặt hàng chạm ngưỡng tồn kho thấp. */
  get lowStockAlerts() {
    return this.#products.filter((product) => Boolean(product.isLowStock));
  }

  /** Hàng tươi sắp hết hạn (0..7 ngày) — chưa gồm hàng đã quá hạn. */
  get expiringSoon() {
    return this.#products.filter((product) => isPerishableLike(product) && isNearExpiry(product));
  }

  /** Hàng tươi đã quá hạn, cần dọn khỏi kệ. */
  get expiredProducts() {
    return this.#products.filter((product) => isPerishableLike(product) && isExpired(product));
  }

  /**
   * Số mặt hàng "khỏe": không tồn thấp, không cận hạn, không quá hạn.
   * Vì sao tính cả hạn dùng: một mặt hàng còn đầy kho nhưng hết hạn vẫn là
   * vấn đề của cửa hàng, không thể tính là bình thường.
   */
  get healthyCount() {
    return this.#products.filter(
      (product) => !product.isLowStock && !isNearExpiry(product) && !isExpired(product)
    ).length;
  }

  /** Tổng giá trị hàng tồn theo giá gốc — con số trên thẻ "Giá trị kho". */
  get inventoryValue() {
    const total = this.#products.reduce(
      (sum, product) => sum + toNumber(product.unitPrice, 0) * toNumber(product.stock, 0),
      0
    );
    return roundMoney(total);
  }

  /** Mã hàng gợi ý cho mặt hàng mới: lớn nhất + 1 (kho rỗng thì bắt đầu từ 1). */
  get nextId() {
    const maxId = this.#products.reduce(
      (max, product) => Math.max(max, toNumber(product.id, 0)),
      0
    );
    return maxId + 1;
  }

  /* ---------------------------- Khôi phục ---------------------------- */

  /**
   * Dựng kho từ dữ liệu đã lưu (mảng plain object lấy từ storage.js).
   * createProduct() chọn đúng lớp con nên hàng tươi vẫn biết hạn dùng của mình
   * sau khi mở lại ứng dụng — hành vi đa hình không bị mất khi qua JSON.
   */
  static fromJSON(list) {
    if (!Array.isArray(list)) {
      throw new TypeError("Inventory.fromJSON cần một mảng plain object, nhận được: " + String(list) + ".");
    }
    const products = list.map((item) =>
      item && typeof item.toJSON === "function" ? item : createProduct(item)
    );
    return new Inventory(products);
  }

  /* ------------------------ Nội bộ ------------------------ */

  #adopt(product) {
    if (this.find(product.id)) {
      throw new Error("Mã hàng " + product.id + " bị trùng trong danh sách sản phẩm.");
    }
    this.#products.push(product);
    return product;
  }

  #require(id) {
    const product = this.find(id);
    if (!product) {
      throw new Error("Không tìm thấy mặt hàng có mã " + String(id) + " trong kho.");
    }
    return product;
  }
}

export default Inventory;
