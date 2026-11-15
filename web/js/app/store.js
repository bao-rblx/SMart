/**
 * SmartMart · Kho trạng thái ứng dụng
 * ---------------------------------------------------------------------------
 * Một nơi duy nhất giữ dữ liệu của phiên làm việc: sản phẩm, người dùng,
 * hóa đơn và giỏ hàng đang mở. Mọi view đọc qua đây, mọi thay đổi đi qua đây.
 *
 * Ghi chú thiết kế: không dùng thư viện quản lý trạng thái. Khi dữ liệu đổi,
 * store phát sự kiện qua app/events.js và các view tự vẽ lại phần của mình.
 */

import { SCREENS } from "../core/constants.js";
import { Inventory } from "../core/inventory.js";
import { ShoppingCart } from "../core/cart.js";
import { Transaction } from "../core/transaction.js";
import { AuthService } from "../core/auth.js";
import { loadState, saveState, storageMode } from "../core/storage.js";
import { seedProducts, seedUsersAsync } from "../core/seed.js";
import { userFromJSON } from "../core/users.js";
import { Events, emit } from "./events.js";

export class Store {
  constructor() {
    this.state = {
      products: [],
      users: [],
      sales: [],
      currentUser: null,
      storage: { mode: "memory", warning: null, notice: null }
    };
    // Giỏ hàng phải tra lại sản phẩm theo id trước mỗi lần thanh toán.
    // Lý do: Product là bất biến (không có setter), nên khi quản lý đổi giá hoặc nhập thêm hàng,
    // Inventory thay bằng một INSTANCE MỚI. Dòng trong giỏ nếu giữ instance cũ sẽ trừ kho
    // trên bản sao và tồn kho thật không giảm. Resolver bám luôn vào instance đang sống.
    this.cart = new ShoppingCart({ resolveProduct: (id) => this.inventory.find(id) });
    this.inventory = new Inventory([]);
    this.auth = new AuthService([]);
    this.listeners = new Set();
    this.ready = false;
  }

  /**
   * Nạp dữ liệu khi mở ứng dụng.
   * Thứ tự: dữ liệu đã lưu → dữ liệu mẫu. Không bao giờ để ứng dụng trắng trang.
   */
  async init() {
    const saved = loadState();
    this.state.storage.mode = storageMode();

    if (saved && Array.isArray(saved.products) && saved.products.length > 0) {
      this.inventory = Inventory.fromJSON(saved.products);
      // Hóa đơn đọc từ máy là plain object; dựng lại thành Transaction để các getter
      // dẫn xuất (grandTotal, itemCount, savings) dùng được ở mọi màn hình.
      this.state.sales = hydrateSales(saved.sales);
      this.state.users = Array.isArray(saved.users) ? saved.users.map(userFromJSON) : await seedUsersAsync();
      this.state.storage.notice = "Đã mở dữ liệu lưu trên máy.";
    } else {
      this.inventory = new Inventory(await seedProducts());
      this.state.users = await seedUsersAsync();
      this.state.sales = [];
      this.state.storage.notice = "Đã nạp danh mục mẫu 72 mặt hàng.";
      this.persist();
    }

    this.state.products = [...this.inventory.products];
    this.auth.setUsers(this.state.users);
    this.ready = true;
    this.notify();
    return this;
  }

  // ------------------------------------------------------------------
  // Truy vấn
  // ------------------------------------------------------------------
  getProducts() {
    return this.inventory.products;
  }

  getSales() {
    return this.state.sales;
  }

  getUsers() {
    return this.state.users;
  }

  get currentUser() {
    return this.state.currentUser;
  }

  /** Hóa đơn trong khoảng thời gian, mới nhất trước. */
  salesSince(date) {
    const from = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return this.state.sales
      .filter((sale) => new Date(sale.timestamp).getTime() >= from)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  salesToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.salesSince(start);
  }

  // ------------------------------------------------------------------
  // Phiên đăng nhập
  // ------------------------------------------------------------------
  signIn(user) {
    this.state.currentUser = user;
    this.cart.clear();
    emit(Events.SessionChanged, { user });
    this.notify();
  }

  signOut() {
    const previous = this.state.currentUser;
    this.state.currentUser = null;
    this.cart.clear();
    emit(Events.SessionChanged, { user: null, previous });
    this.notify();
  }

  /** Màn hình mặc định của người dùng hiện tại. */
  homeScreen() {
    const screens = this.state.currentUser?.allowedScreens?.() ?? [];
    return screens[0] ?? SCREENS.Checkout;
  }

  // ------------------------------------------------------------------
  // Bán hàng
  // ------------------------------------------------------------------
  /** Ghi một hóa đơn đã hoàn tất và lưu xuống máy. */
  commitSale(transaction) {
    this.state.sales.unshift(transaction);
    this.state.products = [...this.inventory.products];
    const saved = this.persist();
    emit(Events.SaleCompleted, { transaction });
    emit(Events.StockChanged, { products: this.state.products });
    this.notify();
    return saved;
  }

  // ------------------------------------------------------------------
  // Kho hàng
  // ------------------------------------------------------------------
  // Mọi thao tác dưới đây đều truyền người đang đăng nhập xuống tầng kho.
  // Không truyền actor thì Inventory sẽ từ chối — đây là chốt chặn thật, vì
  // giao diện chỉ ẩn nút chứ không ngăn được lệnh gọi trực tiếp.
  addProduct(product) {
    this.inventory.add(product, this.state.currentUser);
    this.afterInventoryChange(Events.ProductAdded, { product });
    return product;
  }

  removeProduct(id) {
    const removed = this.inventory.remove(id, this.state.currentUser);
    // Xoá khỏi kho thì phải bỏ luôn khỏi giỏ, nếu không giỏ sẽ trỏ vào mặt hàng không còn tồn tại.
    if (removed) this.cart.removeItem(id);
    this.afterInventoryChange(Events.ProductRemoved, { id, removed });
    return removed;
  }

  restock(id, qty) {
    this.inventory.restock(id, qty, this.state.currentUser);
    this.afterInventoryChange(Events.StockChanged, { id, qty });
  }

  withdraw(id, qty) {
    this.inventory.withdraw(id, qty, this.state.currentUser);
    this.afterInventoryChange(Events.StockChanged, { id, qty: -qty });
  }

  setPrice(id, price) {
    this.inventory.setPrice(id, price, this.state.currentUser);
    this.afterInventoryChange(Events.PriceChanged, { id, price });
  }

  afterInventoryChange(eventName, detail) {
    this.state.products = [...this.inventory.products];
    // Đồng bộ lại giỏ ngay sau khi kho đổi, để số lượng hiển thị và tổng tiền luôn khớp dữ liệu thật.
    this.cart.syncProducts(this.inventory.products);
    this.persist();
    emit(eventName, detail);
    this.notify();
  }

  // ------------------------------------------------------------------
  // Người dùng
  // ------------------------------------------------------------------
  async addUser(payload) {
    const result = await this.auth.addUser(payload, this.state.currentUser);
    if (result.user) this.syncUsers();
    return result;
  }

  changeRole(username, role) {
    const result = this.auth.changeRole(username, role, this.state.currentUser);
    if (result.user) this.syncUsers();
    return result;
  }

  removeUser(username) {
    const result = this.auth.removeUser(username, this.state.currentUser);
    if (result.ok) this.syncUsers();
    return result;
  }

  /** Đồng bộ danh sách người dùng và làm mới người đang đăng nhập (vai trò có thể vừa đổi). */
  syncUsers() {
    this.state.users = this.auth.users;
    const current = this.state.currentUser;
    if (current) {
      this.state.currentUser = this.state.users.find((user) => user.username === current.username) ?? current;
    }
    this.persist();
    emit(Events.UsersChanged, { users: this.state.users });
    this.notify();
  }

  // ------------------------------------------------------------------
  // Lưu trữ
  // ------------------------------------------------------------------
  /** Chuyển trạng thái sang plain object rồi ghi xuống máy. */
  persist() {
    const result = saveState({
      products: this.state.products.map((product) => product.toJSON()),
      users: this.state.users.map((user) => user.toJSON()),
      sales: this.state.sales.map((sale) => (typeof sale.toJSON === "function" ? sale.toJSON() : sale))
    });
    this.state.storage.mode = storageMode();
    if (!result.ok) {
      this.state.storage.warning = result.warning;
      emit(Events.StorageWarning, { warning: result.warning });
    } else {
      this.state.storage.warning = null;
      emit(Events.StateSaved, {});
    }
    return result;
  }

  save() {
    return this.persist();
  }

  // ------------------------------------------------------------------
  // Đăng ký theo dõi
  // ------------------------------------------------------------------
  /** Đăng ký nhận thông báo khi trạng thái đổi. Trả hàm huỷ đăng ký. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.state);
      } catch (error) {
        console.error("[SmartMart] Lỗi khi vẽ lại giao diện:", error);
      }
    }
  }

  emit(name, detail) {
    emit(name, detail);
  }
}

/**
 * Dựng lại danh sách hóa đơn thành thực thể Transaction.
 * Vì sao cần: Transaction.toJSON() chỉ lưu dữ liệu gốc, không lưu grandTotal (đây là getter
 * tính ra từ discountedTotal + tax). Nếu để nguyên plain object, màn hình nào đọc thẳng
 * sale.grandTotal sẽ ra 0 ₫. Bản ghi hỏng thì bỏ qua thay vì làm sập ứng dụng.
 */
function hydrateSales(saved) {
  if (!Array.isArray(saved)) return [];
  const sales = [];
  for (const item of saved) {
    try {
      sales.push(item instanceof Transaction ? item : Transaction.fromJSON(item));
    } catch (error) {
      console.warn("[SmartMart] Bỏ qua một hóa đơn không đọc được:", error?.message ?? error);
    }
  }
  return sales;
}

export const store = new Store();