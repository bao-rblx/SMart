/**
 * SmartMart · Điểm khởi động
 * ---------------------------------------------------------------------------
 * Nhiệm vụ: nạp tuỳ chọn giao diện → mở dữ liệu → vào màn hình đăng nhập →
 * sau khi đăng nhập thì dựng khung ứng dụng và điều hướng theo vai trò.
 */

import { store } from "./app/store.js";
import { mountShell } from "./app/shell.js";
import { initRouter, navigate, getCurrentRoute, repaint, routeInfo } from "./app/router.js";
import { loadPreferences, watchSystemTheme } from "./app/theme.js";
import { installShortcuts, registerShortcut } from "./app/shortcuts.js";
import { confirmDialog } from "./ui/modal.js";
import { toast } from "./ui/toast.js";
import { el, clear } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { SCREENS } from "./core/constants.js";
import { screenLabel } from "./core/vietnamese.js";
import { renderLogin } from "./views/login.js";
import { renderCheckout } from "./views/checkout.js";
import { renderInventory } from "./views/inventory.js";
import { renderReports } from "./views/reports.js";
import { renderUsers } from "./views/users.js";
import { clearState } from "./core/storage.js";

const appRoot = document.getElementById("app");

/** Những gì view nào cũng cần: kho dữ liệu, điều hướng, thông báo, hộp thoại. */
function buildContext() {
  return {
    store,
    state: store.state,
    session: { get user() { return store.state.currentUser; }, cart: store.cart },
    navigate: (screen) => navigate(screen),
    repaint: () => repaint(),
    refresh: () => repaint(),
    toast,
    confirm: confirmDialog,
    format: {}
  };
}

let shell = null;
let unsubscribeStore = null;

/** Vẽ màn hình theo tuyến hiện tại. */
async function renderScreen({ screen, container }) {
  const user = store.state.currentUser;
  if (!user) return;

  if (!user.canAccess(screen)) {
    const first = user.allowedScreens()[0] ?? SCREENS.Checkout;
    if (screen !== first) {
      navigate(first, { force: true });
      return;
    }
  }

  clear(container);
  const context = buildContext();
  const renderers = {
    [SCREENS.Checkout]: renderCheckout,
    [SCREENS.Inventory]: renderInventory,
    [SCREENS.Reports]: renderReports,
    [SCREENS.Users]: renderUsers
  };

  const render = renderers[screen] ?? renderCheckout;
  let view;
  try {
    view = await render(context);
  } catch (error) {
    console.error("[SmartMart] Không vẽ được màn hình:", error);
    view = renderError(error);
  }
  if (view) container.append(view);

  if (shell) {
    shell.updateChrome(routeInfo(screen), screen);
    shell.renderStatusbar();
    // Ô tìm kiếm ở thanh trên chỉ có ý nghĩa ở màn hình bán hàng.
    shell.setSearchHandler(
      screen === SCREENS.Checkout
        ? (value) => {
            const input = container.querySelector("[data-catalog-search]");
            if (input) {
              input.value = value;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        : null
    );
  }
}

function renderError(error) {
  return el(
    "div",
    { class: "view" },
    el(
      "div",
      { class: "empty" },
      el("span", { class: "empty__icon" }, icon("alert", { size: 26 })),
      el("h3", {}, "Màn hình này chưa mở được"),
      el("p", {}, "Đã xảy ra lỗi khi dựng giao diện. Bạn tải lại trang giúp mình nhé."),
      el("p", { class: "mono text-muted" }, String(error?.message ?? error))
    )
  );
}

/** Vào ứng dụng sau khi đăng nhập thành công. */
function enterApp() {
  if (shell) return;
  const user = store.state.currentUser;
  if (!user) return;

  clear(appRoot);
  shell = mountShell({ store, navigate });

  initRouter({
    container: shell.workspace,
    render: async (payload) => {
      if (!store.state.currentUser) return;
      await renderScreen(payload);
    }
  });

  shell.renderRail(user);
  shell.renderTopbar(routeInfo(SCREENS.Checkout));
  shell.renderStatusbar();

  unsubscribeStore = store.subscribe(() => {
    if (!store.state.currentUser) return;
    shell.renderRail(store.state.currentUser);
    shell.renderStatusbar();
  });

  registerAppShortcuts();
  navigate(user.allowedScreens()[0] ?? SCREENS.Checkout, { force: true });
}

function leaveApp() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  shell?.destroy?.();
  shell = null;
  showLogin();
}

/** Màn hình đăng nhập. */
function showLogin() {
  clear(appRoot);
  initRouter({ container: appRoot, render: () => {} });
  const node = renderLogin({
    store,
    onSignedIn: () => enterApp(),
    toast,
    confirm: confirmDialog
  });
  appRoot.append(node);
  installGlobalShortcutsLogin();
}

function registerAppShortcuts() {
  registerShortcut("ctrl+k", "Mở ô tìm kiếm sản phẩm", () => shell?.focusSearch?.(), {
    when: () => getCurrentRoute() === SCREENS.Checkout
  });
  registerShortcut("?", "Xem danh sách phím tắt", () => {
    import("./app/shell.js").then(() => {
      const button = document.querySelector('[title^="Phím tắt"]');
      button?.click();
    });
  });
  registerShortcut("ctrl+shift+l", "Đổi giao diện sáng / tối", () => {
    import("./app/theme.js").then(({ toggleTheme }) => toggleTheme());
  });
}

function installGlobalShortcutsLogin() {
  // Ở màn hình đăng nhập chỉ cần Enter là đủ; phím tắt chung bật sau khi vào ứng dụng.
}

/** Xoá dữ liệu và nạp lại dữ liệu mẫu. */
async function resetApplication() {
  clearState();
  window.location.reload();
}

/** Điểm vào duy nhất. */
async function boot() {
  loadPreferences();
  watchSystemTheme();
  installShortcuts();

  try {
    await store.init();
  } catch (error) {
    console.error("[SmartMart] Không nạp được dữ liệu:", error);
    toast.error("Không nạp được dữ liệu cửa hàng. Ứng dụng sẽ dùng dữ liệu tạm trong phiên này.");
  }

  showLogin();

  // Cầu nối giữa các phần rời nhau.
  window.addEventListener("smartmart:signout", () => leaveApp());
  window.addEventListener("smartmart:reset", () => resetApplication());
  window.addEventListener("smartmart:navigate", (event) => navigate(event.detail?.screen));

  // Ctrl+K ở thanh trên cũng mở hộp tìm kiếm.
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      shell?.focusSearch?.();
    }
  });
}

boot().catch((error) => {
  console.error(error);
  clear(appRoot);
  appRoot.append(
    el(
      "div",
      { class: "empty", style: { height: "100vh", justifyContent: "center" } },
      el("span", { class: "empty__icon" }, icon("alert", { size: 26 })),
      el("h3", {}, "SmartMart chưa mở được"),
      el("p", {}, "Hãy tải lại trang. Nếu vẫn lỗi, mở Console của trình duyệt để xem chi tiết."),
      el("p", { class: "mono text-muted" }, String(error?.message ?? error))
    )
  );
});