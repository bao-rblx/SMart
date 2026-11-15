/**
 * SmartMart · Hằng số dùng chung
 * ---------------------------------------------------------------------------
 * Nguồn sự thật duy nhất cho các "enum" của miền nghiệp vụ.
 * Mọi lớp ở tầng core đều import từ đây, không tự định nghĩa lại.
 */

/** Nhóm hàng của cửa hàng. */
export const Category = Object.freeze({
  Grocery: "Grocery",
  Produce: "Produce",
  Dairy: "Dairy",
  Electronics: "Electronics",
  Household: "Household",
  General: "General",
  Beverages: "Beverages",
  Snacks: "Snacks",
  PersonalCare: "PersonalCare"
});

/** Thứ tự hiển thị cố định cho bộ lọc và báo cáo. */
export const CATEGORY_ORDER = Object.freeze([
  Category.Grocery,
  Category.Beverages,
  Category.Snacks,
  Category.Produce,
  Category.Dairy,
  Category.PersonalCare,
  Category.Household,
  Category.Electronics,
  Category.General
]);

/** Phương thức thanh toán. */
export const PaymentMethod = Object.freeze({
  Cash: "Cash",
  Card: "Card",
  EWallet: "EWallet"
});

/** Vai trò người dùng. */
export const UserRole = Object.freeze({
  Cashier: "Cashier",
  Manager: "Manager",
  Admin: "Admin"
});

/** Màn hình mà từng vai trò được vào. */
export const SCREENS = Object.freeze({
  Checkout: "Checkout",
  Inventory: "Inventory",
  Reports: "Reports",
  Users: "Users"
});

/** Thứ tự sắp xếp danh mục. */
export const CatalogSort = Object.freeze({
  Featured: "Featured",
  Name: "Name",
  PriceAscending: "PriceAscending",
  PriceDescending: "PriceDescending"
});

/** Loại sản phẩm — quyết định lớp con khi khôi phục từ dữ liệu. */
export const ProductKind = Object.freeze({
  Perishable: "perishable",
  Electronic: "electronic",
  General: "general"
});

/** Phiên bản lược đồ dữ liệu lưu trên máy. Tăng khi đổi cấu trúc lưu trữ. */
export const SCHEMA_VERSION = 3;

/** Ngưỡng cảnh báo hạn dùng mặc định (ngày). */
export const NEAR_EXPIRY_DAYS = 7;

/** Ngưỡng tồn kho thấp mặc định. */
export const LOW_STOCK_THRESHOLD = 5;

/** Khoá lưu trữ trong localStorage. */
export const STORAGE_KEY = "smartmart.state.v3";
export const PREF_KEY = "smartmart.prefs.v1";

export function valuesOf(enumObject) {
  return Object.values(enumObject);
}

export function isOneOf(enumObject, value) {
  return Object.prototype.hasOwnProperty.call(enumObject, value);
}
