/**
 * SmartMart · Khung ứng dụng
 * ---------------------------------------------------------------------------
 * Dựng thanh điều hướng trái, thanh trên và thanh trạng thái dưới.
 * Vùng nội dung do router quyết định vẽ gì vào.
 */

import { el, clear, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { toast } from "../ui/toast.js";
import { openModal } from "../ui/modal.js";
import { shortcutsPanel } from "./shortcuts.js";
import { Events, on } from "./events.js";
import { getPreferences, setPreferences, toggleTheme } from "./theme.js";
import { screenLabel } from "../core/vietnamese.js";
import { SCREENS } from "../core/constants.js";
import { formatLongDate, formatTime } from "../core/format.js";
import { roleSettings } from "./settings.js";

const SCREEN_ICONS = {
  [SCREENS.Checkout]: "cart",
  [SCREENS.Inventory]: "box",
  [SCREENS.Reports]: "chart",
  [SCREENS.Users]: "users"
};

/**
 * Dựng toàn bộ khung vào #app.
 * @returns {{ navigate: Function, refresh: Function, setContent: Function, setTitle: Function, destroy: Function }}
 */
export function mountShell({ store, navigate }) {
  const root = document.getElementById("app");
  clear(root);

  const rail = el("aside", { class: "rail", "aria-label": "Điều hướng chính" });
  const topbar = el("header", { class: "topbar" });
  const workspace = el("main", { class: "workspace scroll-area", id: "workspace", tabindex: "-1" });
  const statusbar = el("footer", { class: "statusbar" });
  const shell = el("div", { class: "shell" }, topbar, workspace, statusbar);
  // .app-grid là lưới hai cột rail + nội dung (xem css/layout.css).
  root.append(el("div", { class: "app-grid" }, rail, shell));

  let currentScreen = SCREENS.Checkout;
  let searchHandler = null;

  // ---------------- Thanh điều hướng ----------------
  function renderRail(user) {
    clear(rail);
    const screens = user?.allowedScreens?.() ?? [];

    rail.append(
      el(
        "a",
        { class: "rail__brand", href: "#", onClick: (event) => event.preventDefault() },
        el("span", { class: "rail__mark" }, icon("store", { size: 22 })),
        el(
          "span",
          { class: "rail__wordmark" },
          el("strong", {}, "smartmart"),
          el("span", {}, "cửa hàng / 01")
        )
      ),
      el(
        "nav",
        { class: "rail__section", "aria-label": "Các màn hình" },
        el("p", { class: "rail__label" }, "Làm việc"),
        screens.map((screen) =>
          el(
            "button",
            {
              type: "button",
              class: "rail__link",
              "data-screen": screen,
              "aria-current": screen === currentScreen ? "page" : null,
              onClick: () => navigate(screen)
            },
            icon(SCREEN_ICONS[screen] ?? "grid", { size: 19 }),
            el("span", {}, screenLabel(screen)),
            screen === SCREENS.Inventory ? lowStockBadge() : null
          )
        )
      ),
      el("span", { class: "rail__spacer" }),
      el(
        "div",
        { class: "rail__note" },
        el("strong", {}, "Ghi chú"),
        "Đây là ứng dụng minh hoạ cho đồ án. Giá và tồn kho là dữ liệu mẫu, không phải giá bán thực tế."
      ),
      el(
        "div",
        { class: "rail__user" },
        el("span", { class: "rail__mark", style: { width: "34px", height: "34px", borderRadius: "10px" } }, icon("user", { size: 17 })),
        el(
          "span",
          { class: "rail__user-meta" },
          el("span", { class: "rail__user-name" }, user?.username ?? "Khách"),
          el("span", { class: "rail__user-role" }, user?.displayRole ?? "")
        ),
        el(
          "button",
          {
            type: "button",
            class: "rail__link",
            style: { width: "34px", height: "34px", padding: "0", justifyContent: "center", background: "transparent" },
            title: "Đăng xuất",
            "aria-label": "Đăng xuất",
            onClick: () => signOut()
          },
          icon("logout", { size: 17 })
        )
      )
    );
  }

  function lowStockBadge() {
    const count = store.inventory.lowStockAlerts.length;
    if (count === 0) return null;
    return el("span", { class: "rail__badge", title: `${count} mặt hàng sắp hết` }, String(count));
  }

  // ---------------- Thanh trên ----------------
  let titleNode;
  let subtitleNode;
  let clockNode;

  function renderTopbar(route) {
    clear(topbar);
    titleNode = el("span", { class: "topbar__title" }, route.title);
    subtitleNode = el("span", { class: "topbar__subtitle" }, route.subtitle);
    // Chỉ giữ NGÀY ở dòng phụ. Giờ đã hiện ở <strong> phía trên; render thêm lần nữa
    // sẽ ra hai dòng giờ trùng nhau trên thanh trên.
    clockNode = el("span", {}, formatLongDate(new Date()));

    const searchInput = el("input", {
      type: "search",
      placeholder: "Tìm màn hình, sản phẩm, mã đơn…",
      "aria-label": "Tìm nhanh",
      autocomplete: "off",
      onInput: (event) => searchHandler?.(event.target.value)
    });

    topbar.append(
      el(
        "button",
        {
          type: "button",
          class: "btn btn--ghost btn--icon topbar__menu",
          "aria-label": "Mở menu điều hướng",
          onClick: () => toggleRail()
        },
        icon("menu", { size: 19 })
      ),
      el("div", { class: "topbar__titles" }, titleNode, subtitleNode),
      el(
        "div",
        { class: "topbar__search" },
        icon("search", { size: 16 }),
        searchInput,
        el("kbd", {}, "Ctrl K")
      ),
      el(
        "div",
        { class: "topbar__actions" },
        el(
          "div",
          { class: "topbar__clock" },
          el("strong", {}, formatTime(new Date())),
          clockNode
        ),
        el(
          "button",
          { type: "button", class: "btn btn--ghost btn--icon", title: "Phím tắt (?)", "aria-label": "Phím tắt", onClick: showShortcuts },
          icon("info", { size: 18 })
        ),
        themeButton(),
        el(
          "button",
          { type: "button", class: "btn btn--ghost btn--icon", title: "Cài đặt", "aria-label": "Cài đặt", onClick: showSettings },
          icon("settings", { size: 18 })
        )
      )
    );

    // Giữ ô tìm kiếm luôn trỏ tới view hiện tại.
    return { searchInput };
  }

  function themeButton() {
    const prefs = getPreferences();
    const dark = document.documentElement.dataset.theme === "dark";
    return el(
      "button",
      {
        type: "button",
        class: "btn btn--ghost btn--icon",
        title: dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối",
        "aria-label": "Đổi giao diện sáng tối",
        onClick: () => {
          toggleTheme();
          refreshTopbar();
        }
      },
      icon(dark ? "sun" : "moon", { size: 18 })
    );
  }

  // ---------------- Thanh trạng thái ----------------
  function renderStatusbar() {
    clear(statusbar);
    const warning = store.state.storage.warning;
    const mode = store.state.storage.mode;
    const lowStock = store.inventory.lowStockAlerts.length;
    const expiring = store.inventory.expiringSoon.length;

    statusbar.append(
      el(
        "span",
        { class: "statusbar__item" },
        el("span", { class: `statusbar__dot ${warning ? "statusbar__dot--warn" : ""}` }),
        warning ?? "Sẵn sàng bán hàng"
      ),
      el("span", { class: "statusbar__item" }, "Việt Nam đồng (₫)"),
      el(
        "span",
        { class: "statusbar__item" },
        mode === "local" ? "Dữ liệu lưu trên máy" : "Dữ liệu tạm trong phiên"
      ),
      el("span", { class: "statusbar__spacer" }),
      lowStock > 0
        ? el("span", { class: "statusbar__item text-amber" }, icon("alert", { size: 13 }), `${lowStock} mặt hàng sắp hết`)
        : el("span", { class: "statusbar__item" }, icon("check", { size: 13 }), "Tồn kho ổn định"),
      expiring > 0
        ? el("span", { class: "statusbar__item text-coral" }, icon("clock", { size: 13 }), `${expiring} lô sắp hết hạn`)
        : null,
      el("span", { class: "statusbar__item" }, `${store.getProducts().length} mặt hàng`)
    );
  }

  // ---------------- Hành động ----------------
  function toggleRail() {
    const open = document.body.dataset.rail === "open";
    document.body.dataset.rail = open ? "" : "open";
  }

  function signOut() {
    if (store.cart.count > 0) {
      openModal({
        title: "Đơn hàng chưa thanh toán",
        size: "sm",
        iconName: "alert",
        content: el("p", { class: "modal__message" }, "Giỏ đang có món chưa thanh toán. Đăng xuất sẽ bỏ đơn này. Tiếp tục?"),
        actions: [
          { label: "Ở lại", kind: "ghost" },
          {
            label: "Đăng xuất",
            kind: "danger-solid",
            onClick: () => {
              store.signOut();
              window.dispatchEvent(new CustomEvent("smartmart:signout"));
            }
          }
        ]
      });
      return;
    }
    store.signOut();
    window.dispatchEvent(new CustomEvent("smartmart:signout"));
  }

  function showShortcuts() {
    openModal({
      title: "Phím tắt",
      size: "sm",
      iconName: "zap",
      content: shortcutsPanel(),
      actions: [{ label: "Đã hiểu", kind: "primary" }]
    });
  }

  function showSettings() {
    roleSettings({ store, onChange: () => { refreshTopbar(); renderStatusbar(); } });
  }

  function refreshTopbar() {
    const node = topbar.querySelector(".topbar__actions");
    if (!node) return;
    const themeSlot = node.querySelector('[title*="giao diện"]');
    if (themeSlot) themeSlot.replaceWith(themeButton());
  }

  // ---------------- Cập nhật theo route ----------------
  function updateChrome(route, screen) {
    currentScreen = screen;
    if (titleNode) titleNode.textContent = route.title;
    if (subtitleNode) subtitleNode.textContent = route.subtitle;
    rail.querySelectorAll(".rail__link[data-screen]").forEach((button) => {
      if (button.dataset.screen === screen) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.body.dataset.rail = "";
    renderStatusbar();
    workspace.scrollTop = 0;
  }

  // Đồng hồ ở thanh trên cập nhật mỗi phút.
  const clockTimer = setInterval(() => {
    if (!clockNode || !clockNode.isConnected) return;
    clockNode.textContent = formatLongDate(new Date());
    const strong = topbar.querySelector(".topbar__clock strong");
    if (strong) strong.textContent = formatTime(new Date());
  }, 30_000);

  // Vẽ lại phần khung khi dữ liệu nền đổi.
  const unsubscribers = [
    store.subscribe(() => renderStatusbar()),
    on(Events.SettingsChanged, () => refreshTopbar())
  ];

  return {
    rail,
    topbar,
    workspace,
    statusbar,
    renderRail,
    renderTopbar,
    renderStatusbar,
    updateChrome,
    setSearchHandler(handler) {
      searchHandler = handler;
    },
    focusSearch() {
      const input = topbar.querySelector('input[type="search"]');
      if (input) {
        input.focus();
        input.select();
      }
      return Boolean(input);
    },
    destroy() {
      clearInterval(clockTimer);
      unsubscribers.forEach((off) => off());
    }
  };
}