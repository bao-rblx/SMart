/**
 * SmartMart · Thẻ sản phẩm
 * ---------------------------------------------------------------------------
 * Thẻ dùng cho lưới danh mục ở màn hình bán hàng. Thiết kế hướng tới thao tác
 * nhanh tại quầy: ảnh thật trên nền nhạt theo nhóm hàng, huy hiệu ưu đãi / hạn
 * dùng, và cả tấm thẻ bấm được để thêm món.
 *
 * Vì sao tách các hàm thuần (productStockLabel, productBadges, ...): phần hiển
 * thị cần kiểm thử được mà không cần trình duyệt thật.
 */

import { el, append as appendChildren } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  daysUntil,
  formatDiscount,
  formatMoney,
  formatNumber,
  toNumber
} from "../core/format.js";
import { categoryLabel } from "../core/vietnamese.js";
import { NEAR_EXPIRY_DAYS, LOW_STOCK_THRESHOLD } from "../core/constants.js";

/** Đường dẫn ảnh sản phẩm — ảnh thật nằm sẵn trong assets/products. */
const IMAGE_BASE = "assets/products/";

/** Trạng thái bán của một mặt hàng, dùng chung cho nhãn chữ và lớp CSS. */
export const STOCK_STATE = Object.freeze({
  Available: "available",
  Low: "low",
  SoldOut: "soldout",
  Expired: "expired"
});

/** Giá niêm yết. Chịu được cả Product (getter unitPrice) lẫn plain object (price). */
export function basePriceOf(product) {
  return toNumber(product?.unitPrice ?? product?.price);
}

/** Giá sau ưu đãi; nếu thiếu dữ liệu thì rơi về giá niêm yết. */
export function salePriceOf(product) {
  const discounted = toNumber(product?.discountedPrice);
  return discounted > 0 ? discounted : basePriceOf(product);
}

/** Phần trăm giảm, làm tròn tới số nguyên. */
export function discountPercentOf(product) {
  const direct = toNumber(product?.discountPercent);
  if (direct > 0) return Math.round(direct);
  const base = basePriceOf(product);
  const sale = salePriceOf(product);
  if (base <= 0 || sale <= 0 || sale >= base) return 0;
  return Math.round((1 - sale / base) * 100);
}

/** Đã quá hạn sử dụng chưa. */
export function isExpired(product) {
  if (product?.isExpired === true) return true;
  if (typeof product?.shelfLifeDays === "number" && product.shelfLifeDays < 0) return true;
  if (product?.expiryDate) {
    const days = daysUntil(product.expiryDate);
    if (Number.isFinite(days)) return days < 0;
  }
  return false;
}

/** Sắp hết hàng (tồn kho dưới ngưỡng cảnh báo). */
export function isLowStock(product) {
  if (typeof product?.isLowStock === "boolean") return product.isLowStock;
  const stock = toNumber(product?.stock);
  const threshold = toNumber(product?.lowStockThreshold, LOW_STOCK_THRESHOLD);
  return stock > 0 && stock <= threshold;
}

/** Số ngày còn lại tới hạn dùng nếu đang ở vùng cảnh báo, ngược lại null. */
export function nearExpiryDays(product) {
  if (product?.expiryDate) {
    const days = daysUntil(product.expiryDate);
    if (Number.isFinite(days)) {
      return days >= 0 && days <= NEAR_EXPIRY_DAYS ? days : null;
    }
  }
  const shelf = typeof product?.shelfLifeDays === "number" ? product.shelfLifeDays : null;
  if (shelf !== null) {
    return shelf >= 0 && shelf <= NEAR_EXPIRY_DAYS ? shelf : null;
  }
  return null;
}

/** Trạng thái bán cô đọng cho một sản phẩm. */
export function productStockState(product) {
  if (isExpired(product)) return STOCK_STATE.Expired;
  if (toNumber(product?.stock) <= 0) return STOCK_STATE.SoldOut;
  if (isLowStock(product)) return STOCK_STATE.Low;
  return STOCK_STATE.Available;
}

/** Nhãn tồn kho bằng tiếng Việt: "Còn 24", "Hết hàng", "Ngừng bán". */
export function productStockLabel(product) {
  const state = productStockState(product);
  if (state === STOCK_STATE.Expired) return "Ngừng bán";
  if (state === STOCK_STATE.SoldOut) return "Hết hàng";
  return "Còn " + formatNumber(toNumber(product?.stock));
}

/** Dòng phụ dưới tên: "Còn 24 · Thực phẩm". */
export function productMetaLine(product) {
  return productStockLabel(product) + " · " + categoryLabel(product?.category);
}

/** Đường dẫn ảnh thật; trả null khi sản phẩm không có catalogKey. */
export function productImageSrc(product) {
  const key = product?.catalogKey;
  if (typeof key !== "string" || key.trim() === "") return null;
  return IMAGE_BASE + key.trim() + ".jpg";
}

/**
 * Danh sách huy hiệu trên ảnh: ưu đãi (thương hiệu) và cận hạn (hổ phách).
 * Trả mảng rỗng nếu không có gì đáng nhấn mạnh.
 */
export function productBadges(product) {
  const badges = [];
  const percent = discountPercentOf(product);
  if (percent > 0) {
    badges.push({
      key: "sale",
      tone: "sale",
      text: formatDiscount(percent),
      label: "Giảm giá " + percent + "%"
    });
  }
  const days = nearExpiryDays(product);
  if (days !== null) {
    const text = days <= 0 ? "Hết hạn hôm nay" : "Còn " + days + " ngày";
    badges.push({ key: "expiry", tone: "expiry", text, label: "Hạn dùng " + text.toLowerCase() });
  }
  return badges;
}

/** Ghi chú nhỏ dưới giá — chỉ hiện khi có điều gì cần lưu ý. */
export function productNote(product) {
  const state = productStockState(product);
  if (state === STOCK_STATE.Expired) return "Đã hết hạn sử dụng";
  if (state === STOCK_STATE.SoldOut) return "Tạm hết hàng trong kho";
  if (nearExpiryDays(product) !== null) return "Ưu đãi vì gần hạn dùng";
  if (state === STOCK_STATE.Low) return "Sắp hết — nên nhập thêm";
  return null;
}

/** Sản phẩm còn bán được không (dùng cho khoá nút thêm). */
export function isSellable(product) {
  if (typeof product?.canSell === "boolean") return product.canSell;
  return productStockState(product) !== STOCK_STATE.Expired && productStockState(product) !== STOCK_STATE.SoldOut;
}

/**
 * Dựng một thẻ sản phẩm.
 *
 * @param {object} product  Product hoặc plain object cùng hình dạng.
 * @param {object} [options]
 * @param {(product: object) => void} [options.onAdd]  Bấm thẻ hoặc nút "+".
 * @param {(product: object) => void} [options.onOpen] Bấm nút xem chi tiết.
 * @param {number} [options.quantity] Số lượng đã có trong giỏ.
 * @returns {HTMLElement}
 */
export function createProductCard(product, options = {}) {
  const item = product ?? {};
  const settings = options ?? {};
  const quantity = Math.max(0, Math.trunc(toNumber(settings.quantity)));
  const state = productStockState(item);
  const sellable = isSellable(item);
  const name = String(item.name ?? "Mặt hàng chưa đặt tên");

  const card = el("article", {
    class: "ct-card",
    "data-id": item.id ?? "",
    "data-state": state,
    "data-category": item.category ?? "General"
  });
  if (quantity > 0) card.classList.add("is-in-cart");

  const media = buildMedia(item, state, sellable);
  const body = buildBody(item, state);
  const overlay = buildOverlay(name, sellable, productStockLabel(item), item, settings.onAdd);
  const info = buildInfoButton(name, settings.onOpen, item);
  const addButton = buildAddButton(name, quantity, sellable, item, settings.onAdd);

  appendChildren(card, [media, body, overlay, info, addButton]);
  return card;
}

// ---------------------------------------------------------------------------
// Các mảnh của thẻ — tách nhỏ để hàm chính đọc được trong một màn hình.
// ---------------------------------------------------------------------------

function buildMedia(item, state, sellable) {
  const fallback = el(
    "span",
    { class: "ct-card__fallback", "aria-hidden": "true" },
    icon("image", { size: 26 })
  );
  const media = el("div", { class: "ct-card__media" }, fallback);
  const src = productImageSrc(item);

  if (src) {
    const image = el("img", {
      class: "ct-card__img",
      src,
      alt: "",
      loading: "lazy",
      decoding: "async",
      // Ảnh hỏng (thiếu file) thì ẩn đi để lộ nền nhạt + biểu tượng thay thế,
      // nhờ vậy lưới không bao giờ hiện khung ảnh vỡ.
      onError: (event) => {
        const target = event?.currentTarget ?? event?.target;
        if (target) target.hidden = true;
        fallback.classList.add("is-shown");
      }
    });
    media.append(image);
  } else {
    fallback.classList.add("is-shown");
  }

  const badges = productBadges(item);
  if (badges.length > 0) {
    media.append(
      el(
        "div",
        { class: "ct-card__badges" },
        badges.map((badge) =>
          el(
            "span",
            { class: "ct-badge ct-badge--" + badge.tone, "aria-label": badge.label },
            badge.text
          )
        )
      )
    );
  }

  if (!sellable) {
    const label = state === STOCK_STATE.Expired ? "Ngừng bán" : "Hết hàng";
    media.append(
      el(
        "div",
        { class: "ct-card__veil", "aria-hidden": "true" },
        el("span", { class: "ct-card__veil-label" }, label)
      )
    );
  }

  return media;
}

function buildBody(item, state) {
  const name = String(item?.name ?? "Mặt hàng chưa đặt tên");
  const percent = discountPercentOf(item);
  const note = productNote(item);

  return el(
    "div",
    { class: "ct-card__body" },
    el("h3", { class: "ct-card__name", title: name }, name),
    el("p", { class: "ct-card__meta" }, productMetaLine(item)),
    el(
      "div",
      { class: "ct-card__prices" },
      el("strong", { class: "ct-card__price" }, formatMoney(salePriceOf(item))),
      percent > 0
        ? el("span", { class: "ct-card__price-was" }, formatMoney(basePriceOf(item)))
        : null
    ),
    note ? el("p", { class: "ct-card__note", "data-state": state }, note) : null
  );
}

function buildOverlay(name, sellable, stockLabel, item, onAdd) {
  return el("button", {
    type: "button",
    class: "ct-card__overlay",
    disabled: !sellable,
    "aria-label": sellable ? "Thêm " + name + " vào giỏ" : name + ": " + stockLabel,
    onClick: () => {
      if (sellable) onAdd?.(item);
    }
  });
}

function buildInfoButton(name, onOpen, item) {
  if (typeof onOpen !== "function") return null;
  return el(
    "button",
    {
      type: "button",
      class: "ct-card__info",
      "aria-label": "Xem chi tiết " + name,
      title: "Xem chi tiết",
      onClick: (event) => {
        event?.stopPropagation?.();
        onOpen(item);
      }
    },
    icon("info", { size: 15 })
  );
}

function buildAddButton(name, quantity, sellable, item, onAdd) {
  const button = el(
    "button",
    {
      type: "button",
      class: "ct-card__add",
      disabled: !sellable,
      "aria-label":
        quantity > 0
          ? name + ": đang có " + quantity + " trong giỏ, bấm để thêm một"
          : "Thêm " + name + " vào giỏ",
      title: "Thêm vào giỏ",
      onClick: (event) => {
        // Nút nằm trên lớp phủ bấm-cả-thẻ nên phải chặn nổi bọt để không thêm hai lần.
        event?.stopPropagation?.();
        if (sellable) onAdd?.(item);
      }
    },
    quantity > 0
      ? el("span", { class: "ct-card__qty" }, formatNumber(quantity))
      : icon("plus", { size: 18 })
  );
  if (quantity > 0) button.classList.add("is-selected");
  return button;
}
