/**
 * SmartMart · Bus sự kiện nội bộ
 * ---------------------------------------------------------------------------
 * Cho phép các phần rời nhau (giỏ hàng, kho, báo cáo) báo tin mà không import
 * lẫn nhau. Chỉ dùng cho tín hiệu trong cùng một trang.
 */

const listeners = new Map();

/**
 * Đăng ký nghe một sự kiện.
 * @returns {() => void} hàm huỷ đăng ký
 */
export function on(eventName, handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(handler);
  return () => listeners.get(eventName)?.delete(handler);
}

/** Nghe một lần rồi tự huỷ. */
export function once(eventName, handler) {
  const off = on(eventName, (detail) => {
    off();
    handler(detail);
  });
  return off;
}

/** Phát sự kiện. Lỗi trong listener không được làm hỏng luồng chính. */
export function emit(eventName, detail) {
  const group = listeners.get(eventName);
  if (!group) return;
  for (const handler of [...group]) {
    try {
      handler(detail);
    } catch (error) {
      console.error(`[SmartMart] Lỗi trong listener của "${eventName}":`, error);
    }
  }
}

/** Tên sự kiện dùng trong ứng dụng. Hằng số để tránh gõ sai. */
export const Events = Object.freeze({
  CartChanged: "cart:changed",
  SaleCompleted: "sale:completed",
  ProductAdded: "product:added",
  ProductRemoved: "product:removed",
  StockChanged: "stock:changed",
  PriceChanged: "price:changed",
  UsersChanged: "users:changed",
  SessionChanged: "session:changed",
  StateSaved: "state:saved",
  StorageWarning: "storage:warning",
  ScreenChanged: "screen:changed",
  SettingsChanged: "settings:changed"
});
