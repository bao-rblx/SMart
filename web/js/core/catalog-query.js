/**
 * SmartMart · Truy vấn danh mục
 * ---------------------------------------------------------------------------
 * Tìm kiếm, lọc và sắp xếp sản phẩm. Hàm thuần: chỉ nhận dữ liệu vào và trả
 * về mảng mới, không sửa mảng gốc — nhờ vậy dễ kiểm thử.
 */

import { CatalogSort } from "./constants.js";
import { matchesAll, tokenize } from "./vietnamese.js";

/** Thứ tự "gợi ý hôm nay": sản phẩm quen thuộc hiện trước, còn lại giữ thứ tự gốc. */
export const FEATURED_IDS = Object.freeze([1001, 1011, 1003, 1029, 1039, 1005, 1041, 1043, 1059]);

/**
 * Lọc danh mục sản phẩm.
 *
 * @param {Array} products        Danh sách sản phẩm gốc.
 * @param {object} [options]
 * @param {string} [options.query]         Từ khoá tên / mã hàng / mã vạch.
 * @param {string|null} [options.category] Nhóm hàng cần lọc.
 * @param {boolean} [options.availableOnly] Chỉ lấy hàng còn bán được.
 * @param {string} [options.sort]          Một giá trị trong CatalogSort.
 * @returns {Array} Mảng sản phẩm mới đã lọc và sắp xếp.
 */
export function findProducts(products, options = {}) {
  const { query = "", category = null, availableOnly = false, sort = CatalogSort.Featured } = options;
  const tokens = tokenize(query);
  const keyword = String(query ?? "").trim();

  const filtered = (products ?? []).filter((product) => {
    if (category && product.category !== category) return false;
    if (availableOnly && !product.canSell) return false;
    if (tokens.length === 0) return true;
    if (product.id != null && String(product.id) === keyword) return true;
    if (product.barcode && product.barcode === keyword) return true;
    const haystack = `${product.name} ${product.supplier ?? ""} ${product.serialNumber ?? ""}`;
    return matchesAll(haystack, tokens);
  });

  return sorted(filtered, sort);
}

function sorted(products, sort) {
  const list = [...products];
  const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
  switch (sort) {
    case CatalogSort.Name:
      return list.sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
    case CatalogSort.PriceAscending:
      return list.sort((a, b) => a.discountedPrice - b.discountedPrice || a.id - b.id);
    case CatalogSort.PriceDescending:
      return list.sort((a, b) => b.discountedPrice - a.discountedPrice || a.id - b.id);
    default:
      return list.sort((a, b) => featuredRank(a.id) - featuredRank(b.id) || a.id - b.id);
  }
}

function featuredRank(id) {
  const rank = FEATURED_IDS.indexOf(id);
  return rank < 0 ? 1000 : rank;
}

/** Chia danh sách thành các trang, trả về trang hiện tại và thông tin phân trang. */
export function paginate(items, page = 0, pageSize = 12) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min((current + 1) * pageSize, total)
  };
}

/** Đếm số sản phẩm theo từng nhóm hàng — dùng cho chip lọc. */
export function countByCategory(products) {
  const counts = new Map();
  for (const product of products ?? []) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return counts;
}
