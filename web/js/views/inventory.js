/**
 * SmartMart · Màn hình Kho hàng
 * ---------------------------------------------------------------------------
 * Bố cục: thẻ số liệu → thanh công cụ (tìm kiếm / lọc) → bảng mặt hàng.
 * Chọn một dòng thì thanh hành động hiện ra, thao tác trên đúng mặt hàng đó.
 *
 * Mọi thay đổi dữ liệu đều đi qua store (store.restock, store.withdraw,
 * store.setPrice, store.removeProduct) để một nơi duy nhất lo việc lưu xuống
 * máy và phát sự kiện cho các màn hình khác.
 */

import { el, clear, debounce, parseNumberInput } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog, openModal, promptDialog } from "../ui/modal.js";
import { CATEGORY_ORDER, ProductKind } from "../core/constants.js";
import { categoryLabel, kindLabel, kindDescription, matchesAll, tokenize } from "../core/vietnamese.js";
import {
  formatMoney,
  formatNumber,
  formatDate,
  describeExpiry,
  roundMoney,
  toNumber
} from "../core/format.js";
import { createProduct } from "../core/models.js";

// ===========================================================================
// PHẦN THUẦN — lọc và phân loại trạng thái, kiểm thử được không cần DOM
// ===========================================================================

/** Mức độ cần chú ý của một mặt hàng, theo thứ tự ưu tiên hiển thị. */
export const ALERT_NONE = "none";
export const ALERT_LOW = "low";
export const ALERT_NEAR_EXPIRY = "nearExpiry";
export const ALERT_EXPIRED = "expired";
export const ALERT_OUT = "out";

/**
 * Trạng thái của một mặt hàng.
 * Ưu tiên: hết hàng/hết hạn (coral) trước, rồi sắp hết hàng/sắp hết hạn (amber).
 * Lý do thứ tự này: "đã hết" là việc phải xử lý ngay, còn "sắp hết" là việc
 * cần lên kế hoạch.
 *
 * @returns {"none"|"out"|"expired"|"low"|"nearExpiry"}
 */
export function alertStateOf(product) {
  if (toNumber(product?.stock) <= 0) return ALERT_OUT;
  if (product?.isExpired) return ALERT_EXPIRED;
  if (product?.isLowStock) return ALERT_LOW;
  if (product?.isNearExpiry) return ALERT_NEAR_EXPIRY;
  return ALERT_NONE;
}

/** Màu tô cả dòng: coral cho việc gấp, amber cho việc cần để ý. */
export function rowToneOf(product) {
  const state = alertStateOf(product);
  if (state === ALERT_OUT || state === ALERT_EXPIRED) return "coral";
  if (state === ALERT_LOW || state === ALERT_NEAR_EXPIRY) return "amber";
  return null;
}

/** Cần chú ý hay không — dùng cho ô "Chỉ hiện hàng cần chú ý". */
export function needsAttention(product) {
  return alertStateOf(product) !== ALERT_NONE;
}

/** Nhãn ngắn của trạng thái, hiện trong .badge của bảng. */
export function alertLabelOf(product) {
  switch (alertStateOf(product)) {
    case ALERT_OUT:
      return "Hết hàng";
    case ALERT_EXPIRED:
      return "Hết hạn";
    case ALERT_LOW:
      return "Sắp hết";
    case ALERT_NEAR_EXPIRY:
      return describeExpiry(product?.expiryDate);
    default:
      return "Bình thường";
  }
}

/** Lớp màu cho .badge tương ứng trạng thái. */
export function alertBadgeToneOf(product) {
  const state = alertStateOf(product);
  if (state === ALERT_OUT || state === ALERT_EXPIRED) return "badge--coral";
  if (state === ALERT_LOW || state === ALERT_NEAR_EXPIRY) return "badge--amber";
  return "badge--brand";
}

/** Nhóm hàng có mặt trong kho, theo thứ tự cố định — dùng cho ô chọn lọc. */
export function categoriesPresent(products) {
  const present = new Set((Array.isArray(products) ? products : []).map((product) => product?.category));
  const ordered = CATEGORY_ORDER.filter((category) => present.has(category));
  const extra = [...present].filter((category) => category && !CATEGORY_ORDER.includes(category)).sort();
  return [...ordered, ...extra];
}

/**
 * Lọc danh sách mặt hàng cho bảng.
 * Tìm không dấu trên tên, mã hàng và mã vạch — người bán gõ "sua tuoi" vẫn ra.
 *
 * @param {Array} products
 * @param {{query?: string, category?: string|null, attentionOnly?: boolean}} filters
 */
export function filterInventory(products, filters = {}) {
  const { query = "", category = null, attentionOnly = false } = filters;
  const tokens = tokenize(query);

  return (Array.isArray(products) ? products : []).filter((product) => {
    if (category && product?.category !== category) return false;
    if (attentionOnly && !needsAttention(product)) return false;
    if (tokens.length === 0) return true;
    const haystack = [
      product?.name,
      product?.barcode,
      product?.id,
      product?.serialNumber,
      kindLabel(product?.kind)
    ].join(" ");
    return matchesAll(haystack, tokens);
  });
}

/** Tỉ lệ đầy của thanh tồn kho (0..1), dựa trên mức cao nhất trong danh sách. */
export function stockRatio(stock, peak) {
  const top = Math.max(1, toNumber(peak, 1));
  return Math.min(1, Math.max(0, toNumber(stock) / top));
}

/** Giá trị tồn kho = tổng (giá bán × số lượng) — chưa trừ ưu đãi. */
export function inventoryValueOf(products) {
  return roundMoney(
    (Array.isArray(products) ? products : []).reduce(
      (sum, product) => sum + toNumber(product?.unitPrice ?? product?.price) * toNumber(product?.stock),
      0
    )
  );
}

/** Đếm nhanh các con số trên thẻ số liệu. */
export function inventorySummary(products) {
  const list = Array.isArray(products) ? products : [];
  return {
    count: list.length,
    lowStock: list.filter((product) => product?.isLowStock || toNumber(product?.stock) <= 0).length,
    expiring: list.filter((product) => product?.isExpired || product?.isNearExpiry).length,
    value: inventoryValueOf(list)
  };
}

/**
 * Kiểm tra dữ liệu biểu mẫu "Thêm mặt hàng".
 * Trả về object lỗi theo từng trường (rỗng nghĩa là hợp lệ) — nhờ vậy giao diện
 * hiện lỗi ngay dưới đúng ô nhập thay vì một thông báo chung chung.
 *
 * @param {{name:string, category:string, kind:string, price:string|number,
 *          stock:string|number, expiryDate?:string, warrantyMonths?:string|number}} form
 * @param {Array} existing Danh sách hiện có, để chặn trùng tên.
 * @returns {Record<string,string>}
 */
export function validateProductForm(form, existing = []) {
  const errors = {};
  const name = String(form?.name ?? "").trim();

  if (!name) errors.name = "Hãy nhập tên mặt hàng.";
  else if (name.length < 3) errors.name = "Tên mặt hàng phải có ít nhất 3 ký tự.";
  else {
    const needle = name.toLowerCase();
    const duplicate = (Array.isArray(existing) ? existing : []).some(
      (product) => String(product?.name ?? "").trim().toLowerCase() === needle
    );
    if (duplicate) errors.name = "Đã có mặt hàng trùng tên. Hãy đặt tên khác.";
  }

  if (!form?.category || !CATEGORY_ORDER.includes(form.category)) {
    errors.category = "Hãy chọn nhóm hàng.";
  }

  const price = parseNumberInput(form?.price);
  if (price === null) errors.price = "Hãy nhập giá bán.";
  else if (price < 0) errors.price = "Giá bán không được âm.";

  const stock = parseNumberInput(form?.stock);
  if (stock === null) errors.stock = "Hãy nhập tồn kho ban đầu.";
  else if (stock < 0) errors.stock = "Tồn kho không được âm.";
  else if (!Number.isInteger(stock)) errors.stock = "Tồn kho phải là số nguyên.";

  if (form?.kind === ProductKind.Perishable) {
    const date = String(form?.expiryDate ?? "").trim();
    if (!date) errors.expiryDate = "Hàng tươi cần có hạn dùng.";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.expiryDate = "Hạn dùng phải theo dạng năm-tháng-ngày.";
    else if (Number.isNaN(new Date(date).getTime())) errors.expiryDate = "Hạn dùng không hợp lệ.";
  }

  if (form?.kind === ProductKind.Electronic) {
    const months = parseNumberInput(form?.warrantyMonths);
    if (months === null) errors.warrantyMonths = "Hãy nhập số tháng bảo hành (0 nếu không bảo hành).";
    else if (months < 0) errors.warrantyMonths = "Số tháng bảo hành không được âm.";
  }

  return errors;
}

/** Sinh mã hàng kế tiếp: số lớn nhất + 1, tối thiểu 1001 để giống dữ liệu mẫu. */
export function nextProductId(products) {
  const ids = (Array.isArray(products) ? products : [])
    .map((product) => Number(product?.id))
    .filter((id) => Number.isFinite(id));
  return ids.length > 0 ? Math.max(1000, ...ids) + 1 : 1001;
}

/** Chuyển dữ liệu biểu mẫu thành plain object đúng mục 2.1 của CONTRACTS. */
export function draftFromForm(form, id) {
  const base = {
    id,
    name: String(form?.name ?? "").trim(),
    category: form.category,
    price: roundMoney(parseNumberInput(form?.price) ?? 0),
    stock: Math.max(0, Math.trunc(parseNumberInput(form?.stock) ?? 0)),
    kind: form.kind,
    barcode: String(form?.barcode ?? "").trim(),
    catalogKey: "",
    lowStockThreshold: 5
  };

  if (form.kind === ProductKind.Perishable) {
    base.expiryDate = String(form.expiryDate ?? "").trim();
  } else if (form.kind === ProductKind.Electronic) {
    base.warrantyMonths = Math.max(0, Math.trunc(parseNumberInput(form.warrantyMonths) ?? 0));
    base.serialNumber = "SM-" + id;
  } else {
    base.supplier = "Nhà phân phối trong nước";
  }
  return base;
}

// ===========================================================================
// PHẦN GIAO DIỆN
// ===========================================================================

/** Ảnh nhỏ 32px của mặt hàng; thiếu ảnh thì hiện biểu tượng thay thế. */
function productThumb(product) {
  const key = String(product?.catalogKey ?? "").trim();
  if (key) {
    return el(
      "span",
      { class: "iv-thumb" },
      el("img", { src: "assets/products/" + key + ".jpg", alt: "", loading: "lazy", width: 32, height: 32 })
    );
  }
  return el("span", { class: "iv-thumb iv-thumb--empty" }, icon("box", { size: 16 }));
}

/**
 * Một dòng của bảng.
 * Vì sao nhận handlers: hàm này ở phạm vi module, còn "chọn dòng" và "xem chi
 * tiết" là việc của từng lần vẽ màn hình — truyền vào tường minh để không phụ
 * thuộc vào biến bên trong renderInventory.
 */
function productRow(product, peakStock, handlers) {
  const tone = rowToneOf(product);
  const ratio = stockRatio(product.stock, peakStock);
  const level = toNumber(product.stock) <= 0 ? "empty" : product.isLowStock ? "low" : "ok";
  const kindText = kindLabel(product.kind);

  return el(
    "tr",
    {
      dataset: { id: String(product.id), state: tone ?? "" },
      tabindex: "0",
      "aria-selected": "false",
      onClick: () => handlers.select(product),
      onKeydown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlers.select(product);
        }
      }
    },
    el("td", { class: "iv-cell-code" }, el("span", { class: "mono" }, String(product.id))),
    el(
      "td",
      {},
      el(
        "div",
        { class: "iv-product" },
        productThumb(product),
        el(
          "div",
          { class: "iv-product__meta" },
          el("span", { class: "iv-product__name" }, String(product.name ?? "")),
          el("span", { class: "iv-product__sub" }, kindText + (kindNote(product) ? " · " + kindNote(product) : ""))
        )
      )
    ),
    el("td", {}, el("span", { class: "badge badge--outline" }, categoryLabel(product.category))),
    el("td", { class: "num" }, formatMoney(product.unitPrice)),
    el(
      "td",
      {},
      el(
        "div",
        { class: "stock-bar" },
        el(
          "div",
          { class: "stock-bar__track" },
          el("div", {
            class: "stock-bar__fill",
            dataset: { level: level === "ok" ? "ok" : level },
            style: { width: String(Math.round(ratio * 100)) + "%" }
          })
        ),
        el("span", { class: "stock-bar__value" }, formatNumber(product.stock))
      )
    ),
    el(
      "td",
      {},
      el("span", { class: "badge " + alertBadgeToneOf(product) }, alertLabelOf(product))
    ),
    el(
      "td",
      { class: "cell-actions" },
      el(
        "button",
        {
          class: "btn btn--ghost btn--sm iv-detail",
          type: "button",
          onClick: (event) => {
            event.stopPropagation();
            handlers.detail(product);
          }
        },
        "Chi tiết"
      )
    )
  );
}

/** Thông tin phụ của loại hàng: hạn dùng hoặc bảo hành. */
function kindNote(product) {
  if (product?.kind === ProductKind.Perishable && product?.expiryDate) {
    return describeExpiry(product.expiryDate);
  }
  if (product?.kind === ProductKind.Electronic) return product.displayInfo?.() ?? "";
  return "";
}

/**
 * Vẽ màn hình kho hàng.
 *
 * @param {object} context { store, state, toast, confirm, refresh }
 * @returns {HTMLElement} Node bọc trong .view
 */
export function renderInventory(context = {}) {
  const { store = null, state = null, toast = null, confirm = null, refresh = null } = context;
  const appState = state ?? store?.state ?? {};
  const ui = { query: "", category: null, attentionOnly: false, selectedId: null };

  const root = el("div", { class: "view iv-view" });

  function products() {
    return appState.products ?? store?.getProducts?.() ?? [];
  }

  function selectedProduct() {
    return products().find((product) => String(product.id) === String(ui.selectedId)) ?? null;
  }

  function afterChange(message, tone = "success") {
    toast?.[tone]?.(message);
    if (typeof refresh === "function") refresh();
  }

  // --- Đầu trang ---------------------------------------------------------
  root.append(
    el(
      "div",
      { class: "page-head" },
      el(
        "div",
        { class: "page-head__text" },
        el("h1", {}, "Kho hàng"),
        el("p", {}, "Nắm rõ từng mặt hàng, chủ động mỗi ngày.")
      ),
      el(
        "div",
        { class: "page-head__actions" },
        el(
          "button",
          { class: "btn btn--primary", type: "button", onClick: () => openProductForm() },
          icon("plus", { size: 16 }),
          "Thêm mặt hàng"
        )
      )
    )
  );

  // --- Thẻ số liệu -------------------------------------------------------
  const metricsHost = el("div", { class: "metric-grid" });

  // --- Thanh công cụ -----------------------------------------------------
  const searchInput = el("input", {
    type: "search",
    class: "input",
    placeholder: "Tìm theo tên, mã hàng hoặc mã vạch…",
    "aria-label": "Tìm mặt hàng",
    onInput: debounce((event) => {
      ui.query = event.target.value;
      paintTable();
    }, 150)
  });

  const attentionCheck = el("input", {
    type: "checkbox",
    onChange: (event) => {
      ui.attentionOnly = event.target.checked;
      paintTable();
    }
  });

  const categorySelect = el(
    "select",
    {
      class: "select",
      "aria-label": "Lọc theo nhóm hàng",
      onChange: (event) => {
        ui.category = event.target.value || null;
        paintTable();
      }
    },
    el("option", { value: "" }, "Tất cả nhóm hàng"),
    CATEGORY_ORDER.map((category) => el("option", { value: category }, categoryLabel(category)))
  );

  root.append(
    el(
      "div",
      { class: "iv-toolbar card card--flat" },
      el("div", { class: "iv-toolbar__search" }, icon("search", { size: 16 }), searchInput),
      el("label", { class: "check iv-toolbar__check" }, attentionCheck, "Chỉ hiện hàng cần chú ý"),
      categorySelect
    )
  );

  // --- Bảng --------------------------------------------------------------
  const selectionBar = el("div", { class: "iv-selection", hidden: true });
  const tableWrap = el("div", { class: "table-wrap iv-table-wrap" });
  const countLabel = el("span", { class: "iv-hint" }, "");
  const tableCard = el(
    "section",
    { class: "card iv-card" },
    el("div", { class: "card__head" }, el("h2", {}, "Danh sách mặt hàng"), countLabel),
    selectionBar,
    tableWrap
  );

  root.append(metricsHost, tableCard);

  function selectProduct(product) {
    const id = String(product?.id ?? "");
    ui.selectedId = String(ui.selectedId) === id ? null : id;
    paintSelection();
  }

  function paintMetrics() {
    const summary = inventorySummary(products());
    clear(metricsHost);
    metricsHost.append(
      el(
        "article",
        { class: "metric metric--brand" },
        el("p", { class: "metric__label" }, icon("box", { size: 14 }), "Mặt hàng"),
        el("p", { class: "metric__value" }, formatNumber(summary.count)),
        el("p", { class: "metric__note" }, "Tổng số mặt hàng đang quản lý")
      ),
      el(
        "article",
        { class: "metric metric--amber" },
        el("p", { class: "metric__label" }, icon("alert", { size: 14 }), "Sắp hết hàng"),
        el("p", { class: "metric__value" }, formatNumber(summary.lowStock)),
        el("p", { class: "metric__note" }, "Tồn kho đã chạm ngưỡng cảnh báo")
      ),
      el(
        "article",
        { class: "metric metric--coral" },
        el("p", { class: "metric__label" }, icon("clock", { size: 14 }), "Cảnh báo hạn dùng"),
        el("p", { class: "metric__value" }, formatNumber(summary.expiring)),
        el("p", { class: "metric__note" }, "Đã hết hạn hoặc còn dưới 7 ngày")
      ),
      el(
        "article",
        { class: "metric metric--violet" },
        el("p", { class: "metric__label" }, icon("coins", { size: 14 }), "Giá trị tồn kho"),
        el("p", { class: "metric__value" }, formatMoney(summary.value)),
        el("p", { class: "metric__note" }, "Giá bán × số lượng đang có")
      )
    );
  }

  function paintSelection() {
    tableWrap.querySelectorAll("tr[data-id]").forEach((row) => {
      const active = row.dataset.id === String(ui.selectedId);
      row.classList.toggle("is-selected", active);
      row.setAttribute("aria-selected", String(active));
    });

    clear(selectionBar);
    const product = selectedProduct();
    if (!product) {
      selectionBar.hidden = true;
      return;
    }

    selectionBar.hidden = false;
    selectionBar.append(
      el("span", { class: "iv-selection__label" }, String(product.name ?? "")),
      el(
        "div",
        { class: "iv-selection__actions" },
        el(
          "button",
          { class: "btn btn--soft btn--sm", type: "button", onClick: () => doRestock(product) },
          icon("plus", { size: 14 }),
          "Nhập hàng"
        ),
        el(
          "button",
          { class: "btn btn--ghost btn--sm", type: "button", onClick: () => doWithdraw(product) },
          icon("minus", { size: 14 }),
          "Xuất kho"
        ),
        el(
          "button",
          { class: "btn btn--ghost btn--sm", type: "button", onClick: () => doSetPrice(product) },
          icon("tag", { size: 14 }),
          "Sửa giá bán"
        ),
        el(
          "button",
          { class: "btn btn--danger btn--sm", type: "button", onClick: () => doRemove(product) },
          icon("trash", { size: 14 }),
          "Xoá mặt hàng"
        )
      )
    );
  }

  function paintTable() {
    const all = products();
    const visible = filterInventory(all, ui);
    const peak = visible.reduce((top, product) => Math.max(top, toNumber(product.stock)), 1);

    clear(tableWrap);

    if (visible.length === 0) {
      tableWrap.append(
        el(
          "div",
          { class: "empty" },
          el("span", { class: "empty__icon" }, icon("box", { size: 26 })),
          el("h3", {}, all.length === 0 ? "Kho hàng đang trống" : "Không tìm thấy mặt hàng nào"),
          el(
            "p",
            {},
            all.length === 0
              ? "Thêm mặt hàng đầu tiên để bắt đầu quản lý tồn kho."
              : "Thử từ khoá khác, bỏ bộ lọc nhóm hàng hoặc tắt ô \"Chỉ hiện hàng cần chú ý\"."
          )
        )
      );
      countLabel.textContent = "0 mặt hàng";
      if (ui.selectedId && !selectedProduct()) ui.selectedId = null;
      paintSelection();
      return;
    }

    const body = el("tbody");
    for (const product of visible) {
      body.append(productRow(product, peak, { select: selectProduct, detail: showDetail }));
    }

    tableWrap.append(
      el(
        "table",
        { class: "table table--row-alert iv-table" },
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", {}, "Mã"),
            el("th", {}, "Sản phẩm"),
            el("th", {}, "Nhóm hàng"),
            el("th", { class: "num" }, "Giá bán"),
            el("th", {}, "Tồn kho"),
            el("th", {}, "Trạng thái"),
            el("th", { class: "cell-actions" }, "Chi tiết")
          )
        ),
        body
      )
    );

    countLabel.textContent = visible.length + "/" + all.length + " mặt hàng";
    if (ui.selectedId && !selectedProduct()) ui.selectedId = null;
    paintSelection();
  }

  // --- Hành động trên một mặt hàng ---------------------------------------
  async function doRestock(product) {
    const qty = await promptDialog({
      title: "Nhập hàng",
      label: "Số lượng nhập thêm cho \"" + product.name + "\"",
      type: "number",
      value: 10,
      min: 1,
      step: 1,
      confirmLabel: "Nhập kho"
    });
    if (qty === null) return;
    try {
      store.restock(product.id, qty);
      afterChange("Đã nhập " + formatNumber(qty) + " \"" + product.name + "\" vào kho.");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  async function doWithdraw(product) {
    const qty = await promptDialog({
      title: "Xuất kho",
      label: "Số lượng xuất kho (tối đa " + formatNumber(product.stock) + ")",
      type: "number",
      value: 1,
      min: 1,
      step: 1,
      confirmLabel: "Xuất kho"
    });
    if (qty === null) return;
    try {
      store.withdraw(product.id, qty);
      afterChange("Đã xuất " + formatNumber(qty) + " \"" + product.name + "\" khỏi kho.");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  async function doSetPrice(product) {
    const price = await promptDialog({
      title: "Sửa giá bán",
      label: "Giá bán mới cho \"" + product.name + "\" (đồng)",
      type: "number",
      value: product.unitPrice,
      min: 0,
      step: 100,
      confirmLabel: "Lưu giá"
    });
    if (price === null) return;
    try {
      store.setPrice(product.id, price);
      afterChange("Đã đổi giá \"" + product.name + "\" thành " + formatMoney(price) + ".");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  async function doRemove(product) {
    const asked = confirm
      ? await confirm({
          title: "Xoá mặt hàng",
          message: "Xoá \"" + product.name + "\" khỏi kho? Thao tác này không hoàn tác được.",
          confirmLabel: "Xoá",
          cancelLabel: "Giữ lại",
          tone: "danger"
        })
      : await confirmDialog({
          title: "Xoá mặt hàng",
          message: "Xoá \"" + product.name + "\" khỏi kho? Thao tác này không hoàn tác được.",
          confirmLabel: "Xoá",
          cancelLabel: "Giữ lại",
          tone: "danger"
        });
    if (!asked) return;
    try {
      store.removeProduct(product.id);
      ui.selectedId = null;
      afterChange("Đã xoá \"" + product.name + "\" khỏi kho.");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  // --- Hộp thoại chi tiết ------------------------------------------------
  function showDetail(product) {
    const rows = [
      ["Mã hàng", String(product.id)],
      ["Tên", String(product.name ?? "")],
      ["Nhóm hàng", categoryLabel(product.category)],
      ["Loại hàng", kindLabel(product.kind)],
      ["Giá niêm yết", formatMoney(product.unitPrice)],
      ["Giá sau ưu đãi", formatMoney(product.discountedPrice) + " (" + product.discountPercent + "%)"],
      ["Thuế mỗi món", formatMoney(product.calculateTax())],
      ["Tồn kho", formatNumber(product.stock)],
      ["Ngưỡng cảnh báo", formatNumber(product.lowStockThreshold)],
      ["Mã vạch", product.barcode || "—"],
      ["Mô tả", product.displayInfo?.() ?? "—"]
    ];

    if (product.kind === ProductKind.Perishable && product.expiryDate) {
      rows.push(["Hạn dùng", formatDate(product.expiryDate) + " (" + describeExpiry(product.expiryDate) + ")"]);
    }
    if (product.kind === ProductKind.Electronic) {
      rows.push(["Số sê-ri", product.serialNumber || "—"]);
    }

    openModal({
      title: "Chi tiết mặt hàng",
      size: "md",
      iconName: "box",
      content: el(
        "dl",
        { class: "iv-detail" },
        rows.map(([label, value]) =>
          el("div", { class: "iv-detail__row" }, el("dt", {}, label), el("dd", {}, value))
        )
      ),
      actions: [{ label: "Đóng", kind: "ghost" }]
    });
  }

  // --- Biểu mẫu thêm mặt hàng --------------------------------------------
  function openProductForm() {
    const form = { name: "", category: CATEGORY_ORDER[0], kind: ProductKind.General, price: "", stock: "", expiryDate: "", warrantyMonths: "12", barcode: "" };
    const errorNodes = {};

    const field = (key, label, control, hint) => {
      const errorNode = el("p", { class: "field__error is-hidden" });
      errorNodes[key] = errorNode;
      return el("label", { class: "field" }, el("span", { class: "field__label" }, label), control, hint ? el("span", { class: "field__hint" }, hint) : null, errorNode);
    };

    const nameInput = el("input", {
      class: "input",
      type: "text",
      placeholder: "Ví dụ: Sữa tươi Vinamilk 1 l",
      "data-autofocus": "true",
      onInput: (event) => {
        form.name = event.target.value;
      }
    });

    const categoryInput = el(
      "select",
      {
        class: "select",
        onChange: (event) => {
          form.category = event.target.value;
        }
      },
      CATEGORY_ORDER.map((category) => el("option", { value: category }, categoryLabel(category)))
    );

    const kindInput = el(
      "select",
      {
        class: "select",
        onChange: (event) => {
          form.kind = event.target.value;
          paintKindFields();
        }
      },
      Object.values(ProductKind).map((kind) => el("option", { value: kind }, kindLabel(kind)))
    );

    const priceInput = el("input", {
      class: "input",
      type: "number",
      inputmode: "numeric",
      min: 0,
      step: 100,
      placeholder: "4500",
      onInput: (event) => {
        form.price = event.target.value;
      }
    });

    const stockInput = el("input", {
      class: "input",
      type: "number",
      inputmode: "numeric",
      min: 0,
      step: 1,
      placeholder: "24",
      onInput: (event) => {
        form.stock = event.target.value;
      }
    });

    const barcodeInput = el("input", {
      class: "input",
      type: "text",
      placeholder: "Không bắt buộc",
      onInput: (event) => {
        form.barcode = event.target.value;
      }
    });

    const expiryInput = el("input", {
      class: "input",
      type: "date",
      onInput: (event) => {
        form.expiryDate = event.target.value;
      }
    });

    const warrantyInput = el("input", {
      class: "input",
      type: "number",
      inputmode: "numeric",
      min: 0,
      step: 1,
      value: "12",
      onInput: (event) => {
        form.warrantyMonths = event.target.value;
      }
    });

    const expiryField = field("expiryDate", "Hạn dùng", expiryInput, "Hàng tươi cận hạn được giảm 30% để đẩy hàng.");
    const warrantyField = field("warrantyMonths", "Bảo hành (tháng)", warrantyInput, "Điện tử chịu thuế 12% và giảm giá 10%.");

    const kindHint = el("p", { class: "iv-form__hint" }, kindDescription(ProductKind.General));

    function paintKindFields() {
      expiryField.hidden = form.kind !== ProductKind.Perishable;
      warrantyField.hidden = form.kind !== ProductKind.Electronic;
      kindHint.textContent = kindDescription(form.kind);
    }
    paintKindFields();

    const body = el(
      "form",
      { class: "iv-form", onSubmit: (event) => event.preventDefault() },
      field("name", "Tên mặt hàng", nameInput),
      el("div", { class: "iv-form__row" }, field("category", "Nhóm hàng", categoryInput), field("kind", "Loại hàng", kindInput)),
      kindHint,
      expiryField,
      warrantyField,
      el("div", { class: "iv-form__row" }, field("price", "Giá bán (đồng)", priceInput), field("stock", "Tồn kho ban đầu", stockInput)),
      field("barcode", "Mã vạch", barcodeInput, "Dùng để tra cứu nhanh khi bán hàng.")
    );

    const clearErrors = () => {
      for (const node of Object.values(errorNodes)) {
        node.textContent = "";
        node.classList.add("is-hidden");
      }
      for (const input of [nameInput, categoryInput, priceInput, stockInput, expiryInput, warrantyInput]) {
        input.removeAttribute("aria-invalid");
      }
    };

    const dialog = openModal({
      title: "Thêm mặt hàng",
      size: "lg",
      iconName: "plus",
      content: body,
      actions: [
        { label: "Hủy", kind: "ghost" },
        {
          label: "Lưu mặt hàng",
          kind: "primary",
          // Trả false để hộp thoại không đóng khi dữ liệu còn sai.
          onClick: () => {
            clearErrors();
            const errors = validateProductForm(form, products());
            const keys = Object.keys(errors);
            if (keys.length > 0) {
              for (const key of keys) {
                const node = errorNodes[key];
                if (node) {
                  node.textContent = errors[key];
                  node.classList.remove("is-hidden");
                }
              }
              const firstKey = keys[0];
              const firstInput = { name: nameInput, category: categoryInput, price: priceInput, stock: stockInput, expiryDate: expiryInput, warrantyMonths: warrantyInput }[firstKey];
              firstInput?.setAttribute("aria-invalid", "true");
              firstInput?.focus();
              return false;
            }

            try {
              const id = nextProductId(products());
              const product = createProduct(draftFromForm(form, id));
              store.addProduct(product);
              dialog.close(true);
              afterChange("Đã thêm \"" + product.name + "\" vào kho.");
            } catch (error) {
              toast?.error?.(String(error?.message ?? error));
              return false;
            }
            return true;
          }
        }
      ],
      onOpen: () => nameInput.focus()
    });

    return dialog;
  }

  // --- Vẽ lần đầu --------------------------------------------------------
  paintMetrics();
  paintTable();

  return root;
}
