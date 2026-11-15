/**
 * SmartMart · Điều hướng
 * ---------------------------------------------------------------------------
 * Không dùng hash hay History API: ứng dụng là một trang duy nhất, màn hình là
 * biến trạng thái. Nhờ vậy chạy được cả khi mở thẳng từ đĩa (file://).
 */

import { SCREENS } from "../core/constants.js";
import { Events, emit } from "./events.js";

const ROUTES = Object.freeze({
  [SCREENS.Checkout]: { title: "Bán hàng", subtitle: "Thêm chút tận tâm, thêm một vị khách hài lòng." },
  [SCREENS.Inventory]: { title: "Kho hàng", subtitle: "Nắm rõ từng mặt hàng, chủ động mỗi ngày." },
  [SCREENS.Reports]: { title: "Doanh thu", subtitle: "Từng đơn hàng nhỏ, một hành trình lớn." },
  [SCREENS.Users]: { title: "Nhân sự", subtitle: "Cùng một đội ngũ, cùng chăm chút cửa hàng." }
});

let current = SCREENS.Checkout;
let renderer = null;
let host = null;

/** Đăng ký hàm vẽ màn hình và vùng chứa nội dung. */
export function initRouter({ container, render }) {
  host = container;
  renderer = render;
}

export function getCurrentRoute() {
  return current;
}

export function routeInfo(screen = current) {
  return ROUTES[screen] ?? ROUTES[SCREENS.Checkout];
}

export function screenExists(screen) {
  return Object.prototype.hasOwnProperty.call(ROUTES, screen);
}

/**
 * Chuyển màn hình. Trả về false nếu màn hình không tồn tại hoặc đang ở đó rồi.
 */
export function navigate(screen, options = {}) {
  if (!screenExists(screen)) return false;
  const changed = screen !== current;
  current = screen;
  if (changed || options.force) {
    emit(Events.ScreenChanged, { screen });
  }
  paint();
  return changed;
}

/** Vẽ lại màn hình hiện tại mà không đổi tuyến. */
export function repaint() {
  paint();
}

function paint() {
  if (!host || typeof renderer !== "function") return;
  renderer({ screen: current, container: host, route: routeInfo(current) });
}
