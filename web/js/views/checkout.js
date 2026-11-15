/**
 * SmartMart · Màn hình bán hàng
 * ---------------------------------------------------------------------------
 * Bố cục hai cột: bên trái là danh mục (tìm kiếm, lọc nhóm hàng, lưới thẻ sản
 * phẩm, phân trang), bên phải là bảng đơn hàng do cart-panel.js vẽ.
 *
 * Vì sao tách phần lọc thành hàm thuần: toàn bộ quy tắc "chip + từ khoá + chỉ
 * hàng còn bán + sắp xếp" phải kiểm thử được trong Node mà không cần DOM.
 */

import { el, clear, debounce, focus } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { toast as defaultToast } from "../ui/toast.js";
import { openModal, confirmDialog } from "../ui/modal.js";
import { createProductCard, isSellable } from "../ui/product-card.js";
import { createCartPanel } from "./cart-panel.js";
import { findProducts, paginate, countByCategory } from "../core/catalog-query.js";
import { CatalogSort, CATEGORY_ORDER } from "../core/constants.js";
import { categoryLabel, sortLabel } from "../core/vietnamese.js";
import { formatMoney, formatNumber } from "../core/format.js";

/** Số mặt hàng mỗi trang của lưới danh mục. */
export const PAGE_SIZE = 12;

const SORT_OPTIONS = Object.freeze([
  CatalogSort.Featured,
  CatalogSort.Name,
  CatalogSort.PriceAscending,
  CatalogSort.PriceDescending
]);

/* ============================================================
   Logic thuần — kiểm thử được mà không cần trình duyệt
   ============================================================ */

/** Trạng thái lọc của danh mục, kèm giá trị mặc định. */
export function createCatalogFilter(overrides = {}) {
  return {
    query: "",
    category: null,
    availableOnly: false,
    sort: CatalogSort.Featured,
    page: 0,
    ...overrides
  };
}

/** Lọc + sắp xếp sản phẩm theo trạng thái lọc (bọc findProducts của core). */
export function filterCatalog(products, filter = {}) {
  const settings = filter ?? {};
  return findProducts(products ?? [], {
    query: settings.query ?? "",
    category: settings.category ?? null,
    availableOnly: Boolean(settings.availableOnly),
    sort: settings.sort ?? CatalogSort.Featured
  });
}

/** Danh sách chip lọc: "Tất cả" trước, sau đó theo thứ tự nhóm hàng cố định. */
export function buildCategoryChips(products) {
  const counts = countByCategory(products ?? []);
  const total = (products ?? []).length;
  const chips = [{ key: null, label: "Tất cả", count: total }];
  for (const category of CATEGORY_ORDER) {
    const count = counts.get(category) ?? 0;
    // Nhóm hàng không có mặt hàng nào thì không hiện chip — đỡ nhiễu mắt.
    if (count === 0) continue;
    chips.push({ key: category, label: categoryLabel(category), count });
  }
  return chips;
}

/** Cắt trang cho lưới danh mục, ép trang hiện tại vào khoảng hợp lệ. */
export function pageOf(products, page = 0, pageSize = PAGE_SIZE) {
  return paginate(products ?? [], page, pageSize);
}

/** Dòng "13–24 / 72 mặt hàng" dưới lưới. */
export function rangeLabel(pagination) {
  const info = pagination ?? {};
  if (!info.total) return "0 mặt hàng";
  return formatNumber(info.from) + "–" + formatNumber(info.to) + " / " + formatNumber(info.total) + " mặt hàng";
}

/** Thống kê nhanh trong ngày cho phần đầu trang. */
export function todaySummary(sales, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const list = Array.isArray(sales) ? sales : [];
  const today = list.filter((sale) => {
    const stamp = sale?.timestamp ? new Date(sale.timestamp).getTime() : NaN;
    return Number.isFinite(stamp) && stamp >= start;
  });
  const revenue = today.reduce((total, sale) => total + (Number(sale?.grandTotal) || 0), 0);
  return {
    orderCount: today.length,
    revenue,
    revenueText: formatMoney(revenue),
    orderText: formatNumber(today.length) + " đơn"
  };
}

/** Tên tệp CSV của ảnh? Không — đây là nhãn nút "Nguồn ảnh". */
export function imageSourceNote() {
  return "Ảnh sản phẩm lấy từ Open Food Facts (CC BY-SA) và bộ ảnh minh hoạ của đồ án.";
}

/**
 * Quyết định thao tác khi bấm Enter ở ô tìm kiếm: chỉ thêm ngay khi còn đúng
 * một kết quả, tránh việc gõ dở mà món đầu tiên rơi vào giỏ.
 */
export function enterAction(results) {
  const list = Array.isArray(results) ? results : [];
  if (list.length === 0) return { type: "none" };
  if (list.length === 1) return { type: "add", product: list[0] };
  return { type: "ambiguous", count: list.length };
}

/** Thông điệp khi lưới không có kết quả nào. */
export function emptyCatalogMessage(filter = {}) {
  const query = String(filter.query ?? "").trim();
  if (query) return "Không tìm thấy mặt hàng nào khớp “" + query + "”. Thử từ khoá ngắn hơn hoặc bỏ dấu.";
  if (filter.category) return "Nhóm “" + categoryLabel(filter.category) + "” hiện không còn mặt hàng nào.";
  if (filter.availableOnly) return "Mọi mặt hàng đều đang hết hàng hoặc quá hạn. Bỏ dấu “Chỉ hàng còn bán” để xem tất cả.";
  return "Danh mục đang trống. Hãy thêm mặt hàng ở màn hình Kho hàng.";
}

/* ============================================================
   View
   ============================================================ */

/**
 * Dựng màn hình bán hàng.
 *
 * @param {object} context  Xem CONTRACTS.md mục 4.1.
 * @returns {HTMLElement}
 */
export function renderCheckout(context = {}) {
  const store = context.store;
  const toast = context.toast ?? defaultToast;
  const confirm = context.confirm ?? confirmDialog;
  const cart = store?.cart;

  const state = createCatalogFilter();
  let lastResults = [];

  const cartPanel = createCartPanel({
    store,
    toast,
    confirm,
    onChange: () => {
      // Giỏ đổi thì vẽ lại lưới thẻ (số lượng trên nút "+" thay đổi). Sau khi
      // thanh toán, dòng thống kê hôm nay cũng phải nhảy số nên vẽ lại luôn.
      paintSummary();
      paintGrid();
    }
  });

  /* ---------------- Phần đầu trang ---------------- */
  const summaryHost = el("div", { class: "co-summary" });

  const searchInput = el("input", {
    type: "search",
    class: "co-search__input",
    "data-catalog-search": "true",
    placeholder: "Tìm tên, mã hàng hoặc quét mã vạch…",
    "aria-label": "Tìm sản phẩm theo tên, mã hàng hoặc mã vạch",
    autocomplete: "off",
    spellcheck: "false",
    onInput: (event) => {
      state.query = event.target.value;
      state.page = 0;
      scheduleRepaint();
    },
    onKeydown: (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleEnterSearch();
    }
  });

  const searchClear = el(
    "button",
    {
      type: "button",
      class: "co-search__clear",
      "aria-label": "Xoá từ khoá tìm kiếm",
      title: "Xoá từ khoá",
      onClick: () => {
        searchInput.value = "";
        state.query = "";
        state.page = 0;
        paintAll();
        focus(searchInput);
      }
    },
    icon("close", { size: 15 })
  );

  const chipRow = el("div", { class: "chip-row co-chips", role: "group", "aria-label": "Lọc theo nhóm hàng" });
  const availableCheck = el("input", {
    type: "checkbox",
    checked: state.availableOnly,
    onChange: (event) => {
      state.availableOnly = event.target.checked;
      state.page = 0;
      paintAll();
    }
  });
  const sortSelect = el(
    "select",
    {
      class: "select co-sort",
      "aria-label": "Sắp xếp danh mục",
      onChange: (event) => {
        state.sort = SORT_OPTIONS.includes(event.target.value) ? event.target.value : CatalogSort.Featured;
        state.page = 0;
        paintAll();
      }
    },
    SORT_OPTIONS.map((option) =>
      el("option", { value: option, selected: option === state.sort ? "selected" : null }, sortLabel(option))
    )
  );

  const gridHost = el("div", { class: "ct-grid", role: "list", "aria-label": "Danh mục sản phẩm" });
  const pagerHost = el("div", { class: "co-pager" });

  /* ---------------- Bố cục ---------------- */

  const head = el(
    "header",
    { class: "page-head co-head" },
    el(
      "div",
      { class: "page-head__text" },
      el("h1", {}, "Bán hàng"),
      el("p", {}, "Chọn món cho khách, đơn tự cộng tiền và trừ kho khi thanh toán.")
    ),
    summaryHost
  );

  const searchBox = el(
    "div",
    { class: "search-box co-search" },
    icon("search", { size: 17 }),
    searchInput,
    searchClear,
    el("kbd", { class: "co-search__kbd" }, "Ctrl K")
  );

  const toolbar = el(
    "div",
    { class: "co-toolbar" },
    searchBox,
    chipRow,
    el(
      "div",
      { class: "co-options" },
      el("label", { class: "check co-option" }, availableCheck, el("span", {}, "Chỉ hàng còn bán")),
      el(
        "label",
        { class: "co-option co-option--sort" },
        icon("sort", { size: 15 }),
        sortSelect
      ),
      el(
        "button",
        {
          type: "button",
          class: "btn btn--ghost btn--sm co-option-btn",
          onClick: () => openImageSource(),
          title: imageSourceNote()
        },
        icon("image", { size: 15 }),
        "Nguồn ảnh"
      )
    )
  );

  const catalogColumn = el(
    "section",
    { class: "co-catalog", "aria-label": "Danh mục sản phẩm" },
    head,
    toolbar,
    gridHost,
    pagerHost
  );

  const view = el(
    "div",
    { class: "view co-view" },
    el("div", { class: "split co-split" }, catalogColumn, cartPanel.element)
  );

  /* ---------------- Vẽ ---------------- */

  const scheduleRepaint = debounce(() => paintAll(), 160);

  function paintAll() {
    paintSummary();
    paintChips();
    paintGrid();
    searchClear.hidden = String(state.query ?? "").trim() === "";
  }

  function paintSummary() {
    const summary = todaySummary(store?.getSales?.() ?? store?.state?.sales ?? []);
    clear(summaryHost);
    summaryHost.append(
      el(
        "div",
        { class: "co-stat" },
        el("span", { class: "co-stat__label" }, icon("receipt", { size: 14 }), "Hôm nay"),
        el("strong", { class: "co-stat__value" }, summary.orderText)
      ),
      el(
        "div",
        { class: "co-stat co-stat--brand" },
        el("span", { class: "co-stat__label" }, icon("coins", { size: 14 }), "Doanh thu"),
        el("strong", { class: "co-stat__value" }, summary.revenueText)
      )
    );
  }

  function paintChips() {
    const products = store?.getProducts?.() ?? [];
    const chips = buildCategoryChips(products);
    clear(chipRow);
    chipRow.append(
      ...chips.map((chip) => {
        const active = (chip.key ?? null) === (state.category ?? null);
        return el(
          "button",
          {
            type: "button",
            class: "chip co-chip",
            "aria-pressed": active ? "true" : "false",
            "data-category": chip.key ?? "",
            onClick: () => {
              state.category = chip.key;
              state.page = 0;
              paintAll();
            }
          },
          el("span", {}, chip.label),
          el("span", { class: "chip__count" }, formatNumber(chip.count))
        );
      })
    );
  }

  function currentResults() {
    const products = store?.getProducts?.() ?? [];
    return filterCatalog(products, state);
  }

  function paintGrid() {
    const results = currentResults();
    lastResults = results;
    const pagination = pageOf(results, state.page, PAGE_SIZE);
    state.page = pagination.page;
    clear(gridHost);

    if (pagination.total === 0) {
      gridHost.classList.add("is-empty");
      gridHost.append(buildEmpty());
      clear(pagerHost);
      return;
    }

    gridHost.classList.remove("is-empty");
    const quantityOf = (product) => (typeof cart?.quantityOf === "function" ? cart.quantityOf(product.id) : 0);
    gridHost.append(
      ...pagination.items.map((product) =>
        el(
          "div",
          { class: "co-cell", role: "listitem" },
          createProductCard(product, {
            quantity: quantityOf(product),
            onAdd: (item) => addToCart(item),
            onOpen: (item) => openDetails(item)
          })
        )
      )
    );
    paintPager(pagination);
  }

  function paintPager(pagination) {
    clear(pagerHost);
    pagerHost.append(
      el("p", { class: "co-pager__range" }, rangeLabel(pagination)),
      el(
        "div",
        { class: "co-pager__controls" },
        el(
          "button",
          {
            type: "button",
            class: "btn btn--ghost btn--sm btn--icon",
            "aria-label": "Trang trước",
            disabled: pagination.page <= 0,
            onClick: () => {
              state.page = pagination.page - 1;
              paintGrid();
            }
          },
          icon("chevronLeft", { size: 16 })
        ),
        el("span", { class: "co-pager__page" }, "Trang " + (pagination.page + 1) + " / " + pagination.pages),
        el(
          "button",
          {
            type: "button",
            class: "btn btn--ghost btn--sm btn--icon",
            "aria-label": "Trang sau",
            disabled: pagination.page >= pagination.pages - 1,
            onClick: () => {
              state.page = pagination.page + 1;
              paintGrid();
            }
          },
          icon("chevronRight", { size: 16 })
        )
      )
    );
  }

  function buildEmpty() {
    return el(
      "div",
      { class: "empty co-empty" },
      el("span", { class: "empty__icon" }, icon("search", { size: 27 })),
      el("h3", {}, "Chưa có mặt hàng nào"),
      el("p", {}, emptyCatalogMessage(state)),
      el(
        "button",
        {
          type: "button",
          class: "btn btn--soft btn--sm",
          onClick: () => {
            searchInput.value = "";
            Object.assign(state, createCatalogFilter());
            availableCheck.checked = false;
            sortSelect.value = CatalogSort.Featured;
            paintAll();
          }
        },
        icon("refresh", { size: 15 }),
        "Xoá bộ lọc"
      )
    );
  }

  /* ---------------- Thao tác ---------------- */

  function addToCart(product, quantity = 1) {
    if (!product) return false;
    if (!isSellable(product)) {
      toast.warning("“" + product.name + "” đã hết hàng hoặc quá hạn, không bán được.");
      return false;
    }
    try {
      cart.addItem(product, quantity);
    } catch (error) {
      toast.error(error?.message ?? "Không thêm được mặt hàng này vào đơn.");
      return false;
    }
    cartPanel.refresh();
    paintGrid();
    toast.success("Đã thêm “" + product.name + "” vào đơn.", { duration: 1600 });
    return true;
  }

  function handleEnterSearch() {
    const results = currentResults();
    const action = enterAction(results);
    if (action.type === "add") {
      addToCart(action.product);
      searchInput.value = "";
      state.query = "";
      state.page = 0;
      paintAll();
      focus(searchInput);
      return;
    }
    if (action.type === "ambiguous") {
      toast.info("Có " + formatNumber(action.count) + " mặt hàng khớp. Bấm vào thẻ để chọn.");
      return;
    }
    toast.warning("Không có mặt hàng nào khớp từ khoá này.");
  }

  function openDetails(product) {
    openModal({
      title: String(product?.name ?? "Chi tiết mặt hàng"),
      size: "sm",
      iconName: "box",
      content: el(
        "div",
        { class: "co-detail" },
        el("p", { class: "co-detail__line" }, "Nhóm hàng: ", el("strong", {}, categoryLabel(product?.category))),
        el(
          "p",
          { class: "co-detail__line" },
          "Giá bán: ",
          el("strong", {}, formatMoney(product?.discountedPrice ?? product?.unitPrice)),
          Number(product?.discountPercent) > 0
            ? el("span", { class: "co-detail__was" }, formatMoney(product?.unitPrice))
            : null
        ),
        el("p", { class: "co-detail__line" }, "Tồn kho: ", el("strong", {}, formatNumber(product?.stock ?? 0))),
        typeof product?.displayInfo === "function"
          ? el("p", { class: "co-detail__line" }, product.displayInfo())
          : null,
        el(
          "p",
          { class: "co-detail__line" },
          "Trong đơn: ",
          el("strong", {}, formatNumber(cart?.quantityOf?.(product?.id) ?? 0) + " món")
        )
      ),
      actions: [
        { label: "Đóng", kind: "ghost" },
        {
          label: "Thêm vào đơn",
          kind: "primary",
          onClick: ({ close }) => {
            addToCart(product);
            close();
          }
        }
      ]
    });
  }

  function openImageSource() {
    openModal({
      title: "Nguồn ảnh sản phẩm",
      size: "sm",
      iconName: "image",
      content: el(
        "div",
        { class: "co-source" },
        el("p", {}, imageSourceNote()),
        el("p", { class: "text-muted" }, "Ảnh được lưu sẵn trong thư mục assets/products nên ứng dụng mở được khi không có mạng.")
      ),
      actions: [{ label: "Đã hiểu", kind: "primary" }]
    });
  }

  /* ---------------- Khởi động ---------------- */

  searchClear.hidden = true;
  paintAll();

  return view;
}
