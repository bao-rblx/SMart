/**
 * SmartMart · Bảng đơn hàng hiện tại
 * ---------------------------------------------------------------------------
 * Cột phải của màn hình bán hàng: từng dòng hàng, nút tăng/giảm, tổng tiền và
 * nút thanh toán. Tách khỏi view checkout để vùng danh mục tự vẽ lại mà không
 * phải dựng lại giỏ.
 *
 * Ba trạng thái của bảng được vẽ theo cùng một hàm paint():
 *   1. giỏ trống → .empty với lời mời bắt đầu;
 *   2. đang có món → danh sách dòng + phần tổng;
 *   3. sau khi thanh toán → phiếu in trong hộp thoại.
 */

import { el, clear, delegate, focus } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { openModal, confirmDialog } from "../ui/modal.js";
import { toast as defaultToast } from "../ui/toast.js";
import { formatDiscount, formatMoney, formatNumber } from "../core/format.js";
import { paymentLabel } from "../core/vietnamese.js";
import { PaymentMethod } from "../core/constants.js";
import { generateInvoice } from "../core/transaction.js";

/** Ba phương thức thanh toán, kèm biểu tượng và lời giải thích ngắn. */
export const PAYMENT_OPTIONS = Object.freeze([
  { method: PaymentMethod.Cash, icon: "cash", hint: "Khách trả tiền mặt tại quầy" },
  { method: PaymentMethod.Card, icon: "card", hint: "Quẹt thẻ qua máy POS" },
  { method: PaymentMethod.EWallet, icon: "wallet", hint: "Chuyển khoản hoặc ví điện tử" }
]);

/* ============================================================
   Logic thuần — kiểm thử được mà không cần trình duyệt
   ============================================================ */

/** Chuyển một dòng giỏ hàng thành dữ liệu hiển thị (không phụ thuộc DOM). */
export function cartLineView(line) {
  const product = line?.product ?? {};
  const quantity = Math.max(0, Math.trunc(Number(line?.quantity) || 0));
  const stock = Math.max(0, Math.trunc(Number(product.stock) || 0));
  return {
    productId: product.id,
    name: String(product.name ?? "Mặt hàng"),
    catalogKey: typeof product.catalogKey === "string" ? product.catalogKey : "",
    quantity,
    unitPrice: Number(product.unitPrice ?? product.price) || 0,
    discountedPrice: Number(product.discountedPrice ?? product.unitPrice ?? product.price) || 0,
    discountPercent: Math.max(0, Math.round(Number(product.discountPercent) || 0)),
    lineTotal: Number(line?.lineTotal) || 0,
    taxTotal: Number(line?.taxTotal) || 0,
    stock,
    canIncrease: quantity < stock,
    canDecrease: quantity > 1,
    canRemove: quantity >= 1
  };
}

/** Tổng tiền hiển thị ở chân bảng. Trả cả số thô lẫn chuỗi đã định dạng. */
export function cartTotals(cart) {
  const subtotal = Number(cart?.subtotal) || 0;
  const savings = Number(cart?.savings) || 0;
  const tax = Number(cart?.tax) || 0;
  const grandTotal = Number(cart?.grandTotal) || 0;
  const count = Number(cart?.count) || 0;
  const lineCount = Array.isArray(cart?.lines) ? cart.lines.length : 0;
  return {
    subtotal,
    savings,
    tax,
    grandTotal,
    count,
    lineCount,
    isEmpty: count === 0,
    subtotalText: formatMoney(subtotal),
    savingsText: formatMoney(savings),
    taxText: formatMoney(tax),
    grandTotalText: formatMoney(grandTotal),
    countText: formatNumber(count) + " món"
  };
}

/** Các dòng tổng ở chân bảng, theo đúng thứ tự cần vẽ. */
export function cartSummaryRows(cart) {
  const totals = cartTotals(cart);
  return [
    { key: "subtotal", label: "Tạm tính", value: totals.subtotalText, tone: "muted" },
    {
      key: "savings",
      label: "Tiết kiệm",
      value: totals.savings > 0 ? "−" + totals.savingsText : totals.savingsText,
      tone: "brand"
    },
    { key: "tax", label: "Thuế", value: totals.taxText, tone: "muted" },
    { key: "grandTotal", label: "Tổng cộng", value: totals.grandTotalText, tone: "total" }
  ];
}

/** Câu mô tả số tiền phải trả, dùng trong hộp thoại chọn phương thức. */
export function paymentAmountLabel(cart) {
  const totals = cartTotals(cart);
  return "Khách thanh toán " + totals.grandTotalText + " cho " + totals.countText;
}

/** Chọn phương thức mặc định: tiền mặt là thói quen của quầy tạp hóa. */
export function defaultPaymentMethod() {
  return PaymentMethod.Cash;
}

/** Kiểm tra một phương thức có nằm trong danh sách cho phép không. */
export function isPaymentMethod(value) {
  return PAYMENT_OPTIONS.some((option) => option.method === value);
}

/** Tên tệp khi lưu hóa đơn: Hoa-don-<mã>-<ngày>-<giờ>.txt */
export function receiptFileName(transaction, now = new Date()) {
  const orderId = String(transaction?.orderId ?? "HD").replace(/[^\w-]/g, "");
  const stamp = transaction?.timestamp ? new Date(transaction.timestamp) : new Date(now);
  const safe = Number.isNaN(stamp.getTime()) ? new Date(now) : stamp;
  const pad = (value) => String(value).padStart(2, "0");
  const date = safe.getFullYear() + pad(safe.getMonth() + 1) + pad(safe.getDate());
  const time = pad(safe.getHours()) + pad(safe.getMinutes());
  return "Hoa-don-" + orderId + "-" + date + "-" + time + ".txt";
}

/**
 * Văn bản hóa đơn để lưu/in. Bọc generateInvoice để lỗi dữ liệu không làm sập
 * hộp thoại — người dùng vẫn còn phần đầu phiếu trực quan.
 */
export function invoiceTextOf(transaction) {
  try {
    return generateInvoice(transaction);
  } catch (error) {
    console.error("[SmartMart] Không dựng được phiếu in:", error);
    const orderId = String(transaction?.orderId ?? "—");
    return "SMARTMART\nMã đơn: " + orderId + "\n(Không dựng được phiếu chi tiết)";
  }
}

/** Tiêu đề ngắn của hộp thoại hóa đơn. */
export function receiptTitle(transaction) {
  const orderId = String(transaction?.orderId ?? "");
  return orderId ? "Đơn " + orderId + " đã thanh toán" : "Đã thanh toán";
}

/* ============================================================
   Bảng giỏ hàng
   ============================================================ */

/**
 * Dựng bảng đơn hàng hiện tại.
 *
 * @param {object} context
 * @param {object} context.store    Kho dữ liệu; giỏ lấy từ store.cart.
 * @param {object} [context.toast]  Bộ thông báo.
 * @param {Function} [context.confirm] Hộp thoại xác nhận.
 * @param {Function} [context.onChange] Gọi sau mỗi thay đổi giỏ.
 * @returns {{ element: HTMLElement, refresh: Function, focusSearch: Function }}
 */
export function createCartPanel(context = {}) {
  const store = context.store;
  const toast = context.toast ?? defaultToast;
  const confirm = context.confirm ?? confirmDialog;
  const cart = store?.cart;

  const countBadge = el("span", { class: "ctp-count" });
  const linesHost = el("div", { class: "ctp-lines scroll-area", role: "list", "aria-label": "Các món trong đơn" });
  const summaryHost = el("div", { class: "ctp-summary" });
  const cautionHost = el("div", { class: "ctp-caution" });
  const checkoutButton = el(
    "button",
    {
      type: "button",
      class: "btn btn--primary btn--lg btn--block ctp-checkout",
      onClick: () => openPaymentDialog()
    },
    el("span", {}, "Thanh toán"),
    icon("arrowRight", { size: 18 })
  );
  const clearButton = el(
    "button",
    {
      type: "button",
      class: "btn btn--ghost btn--sm btn--icon",
      title: "Xoá đơn hiện tại",
      "aria-label": "Xoá toàn bộ đơn hiện tại",
      onClick: () => clearCart()
    },
    icon("trash", { size: 16 })
  );

  const element = el(
    "section",
    { class: "card ctp", "aria-label": "Đơn hiện tại" },
    el(
      "header",
      { class: "ctp-head" },
      el(
        "div",
        { class: "ctp-head__text" },
        el("h2", { class: "ctp-title" }, "Đơn hiện tại"),
        el("p", { class: "ctp-subtitle" }, "Món đang bán cho khách")
      ),
      countBadge,
      clearButton
    ),
    linesHost,
    el(
      "footer",
      { class: "ctp-foot" },
      cautionHost,
      summaryHost,
      checkoutButton,
      el(
        "p",
        { class: "ctp-shortcut" },
        el("kbd", { class: "kbd" }, "F9"),
        el("span", {}, "Mở nhanh hộp thoại thanh toán")
      )
    )
  );

  // Uỷ quyền sự kiện cho cả danh sách: dòng hàng được vẽ lại liên tục.
  delegate(linesHost, "click", "[data-action]", (event, target) => {
    handleLineAction(target.dataset.action, Number(target.dataset.id), target);
  });

  // F9 là phím tắt của quầy; tự gỡ khi bảng đã rời khỏi DOM để không rò rỉ.
  function onKeydown(event) {
    if (!element.isConnected) {
      document.removeEventListener("keydown", onKeydown, true);
      return;
    }
    if (event.key === "F9" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (document.body.dataset.modal === "open") return;
      event.preventDefault();
      openPaymentDialog();
    }
  }
  document.addEventListener("keydown", onKeydown, true);

  /* ---------------- Vẽ ---------------- */

  function refresh() {
    paintHead();
    paintLines();
    paintSummary();
  }

  function paintHead() {
    const totals = cartTotals(cart);
    countBadge.textContent = totals.countText;
    countBadge.dataset.empty = totals.isEmpty ? "true" : "false";
    clearButton.disabled = totals.isEmpty;
    checkoutButton.disabled = totals.isEmpty;
  }

  function paintLines() {
    clear(linesHost);
    const lines = Array.isArray(cart?.lines) ? cart.lines : [];
    if (lines.length === 0) {
      linesHost.classList.add("is-empty");
      linesHost.append(buildEmptyState());
      return;
    }
    linesHost.classList.remove("is-empty");
    linesHost.append(...lines.map(buildLine));
  }

  function paintSummary() {
    clear(summaryHost);
    const rows = cartSummaryRows(cart);
    for (const row of rows) {
      summaryHost.append(
        el(
          "div",
          { class: "ctp-summary__row", "data-tone": row.tone },
          el("span", { class: "ctp-summary__label" }, row.label),
          el("span", { class: "ctp-summary__value" }, row.value)
        )
      );
    }
    clear(cautionHost);
    const blocked = blockedProducts();
    if (blocked.length > 0) {
      cautionHost.append(
        el(
          "p",
          { class: "ctp-warning" },
          icon("alert", { size: 14 }),
          blocked.join(" · ") + " — cần xử lý trước khi thanh toán."
        )
      );
    }
  }

  /** Món trong giỏ không còn bán được (hết hàng hoặc quá hạn). */
  function blockedProducts() {
    const lines = Array.isArray(cart?.lines) ? cart.lines : [];
    return lines
      .filter((line) => line.product?.canSell !== true)
      .map((line) => String(line.product?.name ?? "Mặt hàng"));
  }

  /* ---------------- Dòng hàng ---------------- */

  function buildLine(line) {
    const view = cartLineView(line);
    const thumbs = view.catalogKey
      ? [
          el("img", {
            class: "ctp-line__img",
            src: "assets/products/" + view.catalogKey + ".jpg",
            alt: "",
            loading: "lazy",
            onError: (event) => {
              const target = event?.currentTarget ?? event?.target;
              if (target) target.hidden = true;
            }
          })
        ]
      : [];
    return el(
      "div",
      { class: "ctp-line", role: "listitem", "data-id": String(view.productId ?? "") },
      el(
        "div",
        { class: "ctp-line__thumb", "data-category": String(line?.product?.category ?? "General") },
        ...thumbs,
        icon("box", { size: 16 })
      ),
      el(
        "div",
        { class: "ctp-line__main" },
        el("p", { class: "ctp-line__name", title: view.name }, view.name),
        el(
          "p",
          { class: "ctp-line__meta" },
          el("span", {}, formatMoney(view.discountedPrice) + " / món"),
          view.discountPercent > 0
            ? el("span", { class: "ctp-line__off" }, formatDiscount(view.discountPercent))
            : null
        ),
        el(
          "div",
          { class: "ctp-line__controls" },
          el(
            "div",
            { class: "stepper" },
            el(
              "button",
              {
                type: "button",
                "data-action": "decrease",
                "data-id": view.productId,
                "aria-label": "Bớt một " + view.name,
                disabled: !view.canDecrease
              },
              icon("minus", { size: 14 })
            ),
            el("output", { "aria-label": "Số lượng " + view.name }, formatNumber(view.quantity)),
            el(
              "button",
              {
                type: "button",
                "data-action": "increase",
                "data-id": view.productId,
                "aria-label": "Thêm một " + view.name,
                disabled: !view.canIncrease
              },
              icon("plus", { size: 14 })
            )
          ),
          el(
            "button",
            {
              type: "button",
              class: "ctp-line__remove",
              "data-action": "remove",
              "data-id": view.productId,
              "aria-label": "Xoá " + view.name + " khỏi đơn",
              title: "Xoá khỏi đơn"
            },
            icon("close", { size: 14 })
          )
        )
      ),
      el(
        "div",
        { class: "ctp-line__total" },
        el("strong", {}, formatMoney(view.lineTotal)),
        el("span", {}, "SL " + formatNumber(view.quantity) + " · " + formatNumber(view.stock) + " trong kho")
      )
    );
  }

  function buildEmptyState() {
    return el(
      "div",
      { class: "empty ctp-empty" },
      el("span", { class: "empty__icon" }, icon("cart", { size: 27 })),
      el("h3", {}, "Lên đơn thôi nào"),
      el("p", {}, "Bấm vào thẻ sản phẩm bên trái hoặc gõ tên hàng để thêm món đầu tiên vào đơn."),
      el("p", { class: "ctp-empty__hint" }, "Mẹo: quét mã vạch vào ô tìm kiếm là cách nhanh nhất.")
    );
  }

  /* ---------------- Thao tác ---------------- */

  function findLine(productId) {
    const lines = Array.isArray(cart?.lines) ? cart.lines : [];
    return lines.find((line) => String(line.product?.id) === String(productId));
  }

  function handleLineAction(action, productId, target) {
    const line = findLine(productId);
    if (!line) return;
    const product = line.product;
    try {
      if (action === "increase") {
        if (!cart.canAdd(product, 1)) {
          toast.warning?.("“" + product.name + "” chỉ còn " + formatNumber(product.stock) + " trong kho.");
          return;
        }
        cart.setQuantity(product, line.quantity + 1);
      } else if (action === "decrease") {
        cart.setQuantity(product, line.quantity - 1);
      } else if (action === "remove") {
        cart.removeItem(product.id);
        toast.info?.("Đã bỏ “" + product.name + "” khỏi đơn.");
      }
    } catch (error) {
      toast.error(error?.message ?? "Không cập nhật được đơn hàng.");
      return;
    }
    refresh();
    context.onChange?.();
    // Sau khi xoá cả dòng, con trỏ đang ở nút vừa mất — đưa về nút thanh toán.
    if (action === "remove" && !target?.isConnected) focus(checkoutButton);
  }

  async function clearCart() {
    if (cartTotals(cart).isEmpty) return;
    const answer = await confirm?.({
      title: "Xoá đơn hiện tại?",
      message: "Toàn bộ món trong đơn sẽ bị bỏ. Thao tác này không hoàn tác được.",
      confirmLabel: "Xoá đơn",
      cancelLabel: "Giữ lại",
      tone: "danger"
    });
    if (!answer) return;
    cart.clear();
    refresh();
    context.onChange?.();
    toast.info?.("Đã xoá đơn hiện tại.");
  }

  /* ---------------- Thanh toán ---------------- */

  function openPaymentDialog() {
    if (cartTotals(cart).isEmpty) {
      toast.warning?.("Đơn đang trống. Thêm món trước khi thanh toán nhé.");
      return;
    }

    let selected = defaultPaymentMethod();
    const totals = cartTotals(cart);

    const optionButtons = PAYMENT_OPTIONS.map((option) => {
      const button = el(
        "button",
        {
          type: "button",
          class: "ctp-pay__option",
          role: "radio",
          "aria-checked": option.method === selected ? "true" : "false",
          "data-method": option.method,
          onClick: () => select(option.method)
        },
        el("span", { class: "ctp-pay__icon" }, icon(option.icon, { size: 20 })),
        el(
          "span",
          { class: "ctp-pay__text" },
          el("strong", {}, paymentLabel(option.method)),
          el("span", {}, option.hint)
        ),
        el("span", { class: "ctp-pay__tick", "aria-hidden": "true" }, icon("check", { size: 14 }))
      );
      return button;
    });

    function select(method) {
      selected = isPaymentMethod(method) ? method : defaultPaymentMethod();
      for (const button of optionButtons) {
        button.setAttribute("aria-checked", button.dataset.method === selected ? "true" : "false");
      }
    }

    const group = el(
      "div",
      { class: "ctp-pay__options", role: "radiogroup", "aria-label": "Phương thức thanh toán" },
      optionButtons
    );

    const content = el(
      "div",
      { class: "ctp-pay" },
      el(
        "div",
        { class: "ctp-pay__amount" },
        el("span", { class: "ctp-pay__amount-label" }, "Khách phải trả"),
        el("strong", { class: "ctp-pay__amount-value" }, totals.grandTotalText),
        el("span", { class: "ctp-pay__amount-note" }, paymentAmountLabel(cart))
      ),
      group
    );

    const dialog = openModal({
      title: "Chọn phương thức thanh toán",
      size: "sm",
      iconName: "receipt",
      content,
      actions: [
        { label: "Huỷ", kind: "ghost" },
        {
          label: "Xác nhận thanh toán",
          kind: "primary",
          onClick: ({ close }) => {
            const transaction = completePayment(selected);
            // Lỗi (thiếu hàng, giỏ đổi giữa chừng) thì giữ hộp thoại mở để thử lại.
            if (!transaction) return false;
            close(true);
            showReceipt(transaction);
            return false;
          }
        }
      ]
    });
    return dialog;
  }

  /** Chốt đơn. Trả Transaction khi thành công, null khi thất bại. */
  function completePayment(method) {
    let transaction;
    try {
      transaction = cart.checkout(method);
    } catch (error) {
      toast.error(error?.message ?? "Không hoàn tất được thanh toán. Kiểm tra lại giỏ hàng.");
      refresh();
      context.onChange?.();
      return null;
    }

    try {
      store.commitSale(transaction);
    } catch (error) {
      console.error("[SmartMart] Không ghi được hóa đơn:", error);
      toast.error("Đã trừ kho nhưng chưa lưu được hóa đơn. Bạn kiểm tra dung lượng lưu trữ nhé.");
    }

    refresh();
    context.onChange?.();
    toast.success("Đã thanh toán " + formatMoney(transaction.grandTotal) + " · Mã đơn " + transaction.orderId);
    return transaction;
  }

  /* ---------------- Hóa đơn ---------------- */

  function showReceipt(transaction) {
    const invoiceDialog = openModal({
      title: receiptTitle(transaction),
      size: "lg",
      iconName: "check",
      content: buildReceipt(transaction),
      actions: [
        { label: "Đóng", kind: "ghost" },
        {
          label: "Lưu .txt",
          kind: "default",
          onClick: () => downloadReceipt(transaction),
          close: false
        },
        {
          label: "In hóa đơn",
          kind: "primary",
          onClick: () => printReceipt(invoiceDialog),
          close: false
        }
      ]
    });
    return invoiceDialog;
  }

  function buildReceipt(transaction) {
    const total = Number(transaction?.grandTotal) || 0;
    return el(
      "div",
      { class: "ctp-receipt" },
      el(
        "div",
        { class: "ctp-receipt__hero" },
        el("span", { class: "ctp-receipt__check", "aria-hidden": "true" }, icon("check", { size: 26 })),
        el(
          "div",
          { class: "ctp-receipt__hero-text" },
          el("p", { class: "ctp-receipt__eyebrow" }, "Thanh toán thành công"),
          el("p", { class: "ctp-receipt__order" }, "Mã đơn " + String(transaction?.orderId ?? "—")),
          el(
            "p",
            { class: "ctp-receipt__total" },
            el("span", {}, "Tổng tiền"),
            el("strong", {}, formatMoney(total))
          ),
          el(
            "p",
            { class: "ctp-receipt__pay" },
            paymentLabel(transaction?.payment?.method) + " · " + formatNumber(transaction?.itemCount || 0) + " món"
          )
        )
      ),
      el("pre", { class: "ctp-receipt__paper" }, invoiceTextOf(transaction))
    );
  }

  function downloadReceipt(transaction) {
    const text = invoiceTextOf(transaction);
    const fileName = receiptFileName(transaction);
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = el("a", { href: url, download: fileName });
      document.body.append(link);
      link.click();
      link.remove();
      // Thu hồi URL sau một nhịp để trình duyệt kịp bắt đầu tải.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("Đã lưu hóa đơn thành " + fileName);
    } catch (error) {
      console.error("[SmartMart] Không lưu được hóa đơn:", error);
      toast.error("Trình duyệt không cho lưu tệp. Bạn thử in hóa đơn thay thế nhé.");
    }
  }

  function printReceipt(dialog) {
    const modal = dialog?.element;
    const backdrop = modal?.parentElement;
    if (!backdrop) return;
    // Đánh dấu đúng hộp thoại cần in; cart.css lo phần ẩn các phần còn lại.
    backdrop.classList.add("ctp-print-target");
    document.body.dataset.print = "receipt";
    const cleanup = () => {
      delete document.body.dataset.print;
      backdrop.classList.remove("ctp-print-target");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    try {
      window.print();
    } finally {
      // Safari không phát afterprint trong một số trường hợp — vẫn dọn dẹp.
      setTimeout(cleanup, 1200);
    }
  }

  refresh();

  return {
    element,
    refresh,
    /** Đưa con trỏ về ô tìm kiếm của danh mục (giữ đúng hợp đồng context). */
    focusSearch() {
      const input = document.querySelector("[data-catalog-search]");
      if (input) {
        input.focus();
        input.select?.();
        return true;
      }
      focus(checkoutButton);
      return false;
    }
  };
}
