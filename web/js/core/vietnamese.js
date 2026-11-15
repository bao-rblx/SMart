/**
 * SmartMart · Tiếng Việt
 * ---------------------------------------------------------------------------
 * Nhãn hiển thị cho enum và tìm kiếm không dấu.
 * Tách riêng để phần nghiệp vụ không phải bận tâm tới chữ nghĩa.
 */

import { Category, PaymentMethod, UserRole, SCREENS, CatalogSort, ProductKind } from "./constants.js";

const CATEGORY_LABELS = Object.freeze({
  [Category.Grocery]: "Thực phẩm",
  [Category.Produce]: "Rau củ",
  [Category.Dairy]: "Sữa & bơ",
  [Category.Electronics]: "Điện tử",
  [Category.Household]: "Gia dụng",
  [Category.Beverages]: "Đồ uống",
  [Category.Snacks]: "Bánh kẹo",
  [Category.PersonalCare]: "Cá nhân",
  [Category.General]: "Khác"
});

const ROLE_LABELS = Object.freeze({
  [UserRole.Cashier]: "Thu ngân",
  [UserRole.Manager]: "Quản lý",
  [UserRole.Admin]: "Quản trị viên"
});

const PAYMENT_LABELS = Object.freeze({
  [PaymentMethod.Cash]: "Tiền mặt",
  [PaymentMethod.Card]: "Thẻ ngân hàng",
  [PaymentMethod.EWallet]: "Ví điện tử"
});

const SCREEN_LABELS = Object.freeze({
  [SCREENS.Checkout]: "Bán hàng",
  [SCREENS.Inventory]: "Kho hàng",
  [SCREENS.Reports]: "Doanh thu",
  [SCREENS.Users]: "Nhân sự"
});

const SORT_LABELS = Object.freeze({
  [CatalogSort.Featured]: "Gợi ý hôm nay",
  [CatalogSort.Name]: "Tên A → Z",
  [CatalogSort.PriceAscending]: "Giá thấp → cao",
  [CatalogSort.PriceDescending]: "Giá cao → thấp"
});

const KIND_LABELS = Object.freeze({
  [ProductKind.Perishable]: "Hàng tươi",
  [ProductKind.Electronic]: "Điện tử",
  [ProductKind.General]: "Thông thường"
});

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] ?? "Khác";
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? "Nhân viên";
}

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] ?? "Khác";
}

export function screenLabel(screen) {
  return SCREEN_LABELS[screen] ?? screen;
}

export function sortLabel(sort) {
  return SORT_LABELS[sort] ?? SORT_LABELS[CatalogSort.Featured];
}

export function kindLabel(kind) {
  return KIND_LABELS[kind] ?? KIND_LABELS[ProductKind.General];
}

/** Bỏ dấu tiếng Việt và hạ chữ thường để so khớp tìm kiếm. */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/**
 * So khớp không dấu, không phân biệt hoa thường.
 * "sua tuoi" khớp "Sữa tươi"; "ca phe" khớp "Cà phê rang xay".
 */
export function matches(value, query) {
  const needle = normalize(query);
  if (!needle) return true;
  return normalize(value).includes(needle);
}

/** Tách từ khoá tìm kiếm theo khoảng trắng để so khớp rời. */
export function tokenize(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/** Mọi từ khoá đều phải xuất hiện trong văn bản (thứ tự tuỳ ý). */
export function matchesAll(text, tokens) {
  if (!tokens || tokens.length === 0) return true;
  const haystack = normalize(text);
  return tokens.every((token) => haystack.includes(token));
}

/** Gợi ý mô tả ngắn cho loại sản phẩm, dùng trong biểu mẫu. */
export function kindDescription(kind) {
  switch (kind) {
    case ProductKind.Perishable:
      return "Có hạn dùng. Ưu đãi tăng dần khi gần hết hạn.";
    case ProductKind.Electronic:
      return "Có bảo hành. Ưu đãi điện tử cố định 10%.";
    default:
      return "Không có hạn dùng. Ưu đãi thông thường 5%.";
  }
}
