/**
 * SmartMart · Giỏ hàng
 * ---------------------------------------------------------------------------
 * Quan hệ giữa ShoppingCart và CartLine là COMPOSITION ("có một"), KHÔNG phải
 * kế thừa ("là một"). Giỏ hàng không phải một dòng hàng: nó SỞ HỮU danh sách
 * dòng hàng, chịu trách nhiệm cộng tổng, giữ tồn kho luôn hợp lệ và chốt thành
 * hóa đơn. Vì sao tách hai lớp: một dòng hàng tự biết tiền của nó, còn giỏ hàng
 * chỉ biết cách cộng nhiều dòng lại — thêm loại hàng mới không phải sửa công
 * thức tổng ở nhiều nơi, và mọi phép cộng tiền chỉ tồn tại một chỗ.
 *
 * Mọi con số tiền đều đi qua roundAmount() (bọc roundMoney của format.js) nên
 * luôn là số nguyên đồng, không có phần lẻ.
 */

import { PaymentMethod } from "./constants.js";
import { PaymentDetails, SaleLine, Transaction, roundAmount } from "./transaction.js";

const DEFAULT_QUANTITY = 1;

/**
 * Lỗi nghiệp vụ của giỏ hàng. Vẫn là Error (bắt bằng try/catch thông thường),
 * nhưng có tên riêng để giao diện phân biệt "người dùng thao tác sai" với lỗi
 * lập trình.
 */
export class ShoppingCartError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShoppingCartError";
  }
}

/* ============================================================
   CartLine — một dòng trong giỏ
   ============================================================ */

export class CartLine {
  #product;
  #quantity;

  constructor(product, quantity = DEFAULT_QUANTITY) {
    assertProduct(product);
    assertPositiveIntegerQuantity(quantity);
    this.#product = product;
    this.#quantity = quantity;
  }

  get product() {
    return this.#product;
  }

  /** Số lượng trong giỏ, luôn là số nguyên > 0 (dòng 0 bị xoá khỏi giỏ). */
  get quantity() {
    return this.#quantity;
  }

  /** Thành tiền sau ưu đãi của cả dòng. */
  get lineTotal() {
    return roundAmount(this.#product.discountedPrice * this.#quantity);
  }

  get taxTotal() {
    return roundAmount(this.#product.calculateTax() * this.#quantity);
  }

  get grandTotal() {
    return roundAmount(this.lineTotal + this.taxTotal);
  }

  /**
   * Ưu đãi của dòng = ưu đãi của sản phẩm. Uỷ quyền xuống lớp sản phẩm để giữ
   * đa hình: hàng tươi, điện tử và hàng thường mỗi loại tự tính mức giảm của nó.
   */
  get discountPercent() {
    return this.#product.discountPercent;
  }

  /** Trả dòng MỚI thay vì sửa dòng cũ: giỏ hàng cập nhật bằng cách thay cả dòng. */
  withQuantity(quantity) {
    return new CartLine(this.#product, quantity);
  }

  toJSON() {
    return { productId: this.#product.id, quantity: this.#quantity };
  }
}

/* ============================================================
   ShoppingCart
   ============================================================ */

export class ShoppingCart {
  #lines;
  #resolveProduct;

  /**
   * options.resolveProduct — hàm (productId) => Product trả về instance HIỆN
   * HÀNH trong kho. Vì sao cần: models.js không có setter, nên
   * Inventory.setPrice() tạo BẢN SAO (withPrice) và thay vào mảng. Dòng hàng
   * vẫn giữ bản cũ; nếu thanh toán trên bản cũ thì kho thật không bị trừ và
   * tồn kho bị "nhân bản". Có resolver, checkout tự gắn lại dòng vào bản mới.
   * Không truyền resolver thì giỏ chạy y như hợp đồng gốc.
   */
  constructor(options = {}) {
    this.#lines = [];
    const resolver = typeof options === "function" ? options : options?.resolveProduct;
    this.#resolveProduct = typeof resolver === "function" ? resolver : null;
  }

  /** Bản sao danh sách dòng — bên ngoài không thể push/splice thẳng vào giỏ. */
  get lines() {
    return this.#lines.slice();
  }

  /** Tổng số món (cộng số lượng), dùng cho huy hiệu trên biểu tượng giỏ. */
  get count() {
    return this.#lines.reduce((total, line) => total + line.quantity, 0);
  }

  get isEmpty() {
    return this.#lines.length === 0;
  }

  /** Tổng giá gốc trước ưu đãi. */
  get subtotal() {
    const total = this.#lines.reduce(
      (sum, line) => sum + line.product.unitPrice * line.quantity,
      0
    );
    return roundAmount(total);
  }

  /** Tổng thực thu sau ưu đãi, chưa gồm thuế. */
  get discountedTotal() {
    return roundAmount(this.#lines.reduce((sum, line) => sum + line.lineTotal, 0));
  }

  get savings() {
    return roundAmount(this.subtotal - this.discountedTotal);
  }

  get tax() {
    return roundAmount(this.#lines.reduce((sum, line) => sum + line.taxTotal, 0));
  }

  get grandTotal() {
    return roundAmount(this.discountedTotal + this.tax);
  }

  /**
   * Gắn lại từng dòng vào instance sản phẩm hiện hành (xem chú thích ở
   * constructor). Nhận mảng sản phẩm hoặc hàm tra cứu theo id.
   * Trả true nếu có ít nhất một dòng được thay tham chiếu.
   */
  syncProducts(source) {
    const lookup =
      typeof source === "function"
        ? source
        : (id) => (Array.isArray(source) ? source : []).find((item) => String(item?.id) === String(id));

    let changed = false;
    this.#lines = this.#lines.map((line) => {
      const fresh = lookup(line.product.id);
      // Không tìm thấy nghĩa là mặt hàng đã bị xoá khỏi kho: giữ nguyên dòng cũ
      // để người dùng thấy nó và nhận thông báo, thay vì tự ý xoá mất.
      if (!fresh || fresh === line.product) return line;
      changed = true;
      return new CartLine(fresh, line.quantity);
    });
    return changed;
  }

  /**
   * Thêm hàng vào giỏ. Mặt hàng đã có trong giỏ thì GỘP vào dòng cũ thay vì tạo
   * dòng thứ hai — hóa đơn chỉ nên có đúng một dòng cho mỗi mặt hàng.
   */
  addItem(product, quantity = DEFAULT_QUANTITY) {
    assertProduct(product);
    const qty = toQuantity(quantity);
    if (!(qty > 0)) {
      throw new ShoppingCartError("Số lượng thêm vào giỏ phải lớn hơn 0.");
    }
    assertWholeQuantity(qty);

    const wanted = this.quantityOf(product.id) + qty;
    assertSellable(product);
    assertEnoughStock(product, wanted);

    const index = this.indexOf(product.id);
    if (index >= 0) {
      this.#lines[index] = this.#lines[index].withQuantity(wanted);
    } else {
      this.#lines.push(new CartLine(product, qty));
    }
    return this;
  }

  /**
   * Đặt lại số lượng của một dòng. qty = 0 nghĩa là bỏ món đó khỏi giỏ.
   * Ném lỗi khi vượt tồn kho để giỏ không bao giờ ở trạng thái "không thể
   * thanh toán" mà người dùng lại chỉ phát hiện ở bước cuối.
   */
  setQuantity(product, quantity) {
    const productId = productIdOf(product);
    const qty = toQuantity(quantity);
    if (Number.isNaN(qty) || qty < 0) {
      throw new ShoppingCartError("Số lượng không hợp lệ, phải là số nguyên không âm.");
    }
    const index = this.indexOf(productId);
    if (qty === 0) {
      if (index >= 0) this.#lines.splice(index, 1);
      return this;
    }
    assertWholeQuantity(qty);
    if (index < 0) {
      // Chưa có trong giỏ: coi như thêm mới, vẫn kiểm tra tồn kho và khả năng bán.
      return this.addItem(product, qty);
    }
    const line = this.#lines[index];
    assertSellable(line.product);
    assertEnoughStock(line.product, qty);
    this.#lines[index] = line.withQuantity(qty);
    return this;
  }

  /** Xoá một dòng theo id sản phẩm. Trả true nếu thực sự có dòng bị xoá. */
  removeItem(productId) {
    const index = this.indexOf(productIdOf(productId));
    if (index < 0) return false;
    this.#lines.splice(index, 1);
    return true;
  }

  clear() {
    this.#lines = [];
    return this;
  }

  /**
   * Giao diện dùng hàm này để khoá nút "+" TRƯỚC khi người dùng bấm vào lỗi.
   * Không bao giờ ném lỗi: chỉ trả lời được hay không.
   */
  canAdd(product, quantity = DEFAULT_QUANTITY) {
    if (!isValidProduct(product)) return false;
    const qty = toQuantity(quantity);
    if (!(qty > 0) || !Number.isInteger(qty)) return false;
    if (product.canSell !== true) return false;
    return this.quantityOf(product.id) + qty <= stockOf(product);
  }

  /** Số lượng của một mặt hàng trong giỏ; 0 nếu chưa có. */
  quantityOf(productId) {
    const line = this.#find(productId);
    return line ? line.quantity : 0;
  }

  /**
   * Chốt giỏ thành hóa đơn.
   *
   * Thứ tự rất quan trọng: kiểm tra TOÀN BỘ giỏ trước, chỉ khi mọi dòng đều đủ
   * hàng mới bắt đầu trừ kho. Nếu trừ lần lượt từng dòng rồi cuối cùng mới phát
   * hiện dòng sau thiếu hàng, kho đã bị trừ dở — loại lỗi không thể hoàn tác
   * trên quầy. Kiểm tra xong mới trừ, và chỉ xoá giỏ khi mọi thứ đã thành công.
   */
  checkout(method = PaymentMethod.Cash) {
    if (this.isEmpty) {
      throw new ShoppingCartError("Giỏ hàng đang trống, chưa thể thanh toán.");
    }
    // Đồng bộ trước khi kiểm tra để bán đúng giá và trừ đúng instance trong kho.
    if (this.#resolveProduct) this.syncProducts(this.#resolveProduct);
    this.#assertWholeCartSellable();

    const lines = this.#lines.map((line) => SaleLine.fromProduct(line.product, line.quantity));
    const transaction = new Transaction({
      lines,
      subtotal: this.subtotal,
      discountedTotal: this.discountedTotal,
      tax: this.tax,
      payment: new PaymentDetails(method, this.grandTotal)
    });

    this.#deductStock();
    this.clear();
    return transaction;
  }

  /** Mọi dòng phải bán được và đủ hàng, xét trên con số MỚI NHẤT của sản phẩm. */
  #assertWholeCartSellable() {
    for (const line of this.#lines) {
      assertSellable(line.product);
      assertEnoughStock(line.product, line.quantity);
    }
  }

  #deductStock() {
    for (const line of this.#lines) {
      // trySell trả false nếu kho vừa đổi trong lúc kiểm tra: dừng ngay để báo lỗi.
      if (!line.product.trySell(line.quantity)) {
        throw new ShoppingCartError(
          `Mặt hàng "${line.product.name}" vừa hết hàng, vui lòng kiểm tra lại giỏ.`
        );
      }
    }
  }

  #find(productId) {
    const index = this.indexOf(productId);
    return index >= 0 ? this.#lines[index] : undefined;
  }

  indexOf(productId) {
    const id = productIdOf(productId);
    return this.#lines.findIndex((line) => String(line.product.id) === String(id));
  }
}

/* ============================================================
   Kiểm tra đầu vào dùng chung
   ============================================================ */

function isValidProduct(product) {
  return Boolean(
    product &&
      typeof product === "object" &&
      product.id !== undefined &&
      typeof product.calculateTax === "function"
  );
}

function assertProduct(product) {
  if (!isValidProduct(product)) {
    throw new ShoppingCartError("Sản phẩm không hợp lệ, không thể thêm vào giỏ.");
  }
}

function assertSellable(product) {
  if (product.canSell !== true) {
    throw new ShoppingCartError(
      `"${product.name}" hiện không thể bán (đã hết hàng hoặc quá hạn dùng).`
    );
  }
}

function assertEnoughStock(product, wanted) {
  const stock = stockOf(product);
  if (wanted > stock) {
    throw new ShoppingCartError(
      `"${product.name}" chỉ còn ${stock} trong kho, không đủ ${wanted}.`
    );
  }
}

function assertWholeQuantity(quantity) {
  if (!Number.isInteger(quantity)) {
    throw new ShoppingCartError("Số lượng phải là số nguyên.");
  }
}

function assertPositiveIntegerQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ShoppingCartError("Số lượng phải là số nguyên lớn hơn 0.");
  }
}

/** Chuyển giá trị nhập (chuỗi từ ô input) thành số; NaN nếu không đọc được. */
function toQuantity(value) {
  if (value === undefined || value === null || value === "") return NaN;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function stockOf(product) {
  const stock = Number(product?.stock);
  return Number.isFinite(stock) ? stock : 0;
}

/** productIdOf nhận id hoặc chính sản phẩm, cho tiện ở mọi lời gọi. */
function productIdOf(value) {
  if (value && typeof value === "object") return value.id;
  return value;
}
