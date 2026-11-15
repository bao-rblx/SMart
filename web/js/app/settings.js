/**
 * SmartMart · Hộp thoại cài đặt
 * ---------------------------------------------------------------------------
 * Cho người dùng chỉnh giao diện sáng/tối, mật độ hiển thị và chuyển động.
 * Tuỳ chọn lưu lại cho lần mở sau.
 */

import { el } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { getPreferences, setPreferences } from "./theme.js";

function optionRow({ title, description, children }) {
  return el(
    "div",
    { class: "settings-row" },
    el("div", { class: "settings-row__text" }, el("h3", {}, title), el("p", {}, description)),
    el("div", { class: "settings-row__control" }, children)
  );
}

function segmented({ options, value, onSelect }) {
  return el(
    "div",
    { class: "tabs", role: "tablist" },
    options.map((option) =>
      el(
        "button",
        {
          type: "button",
          class: "tabs__tab",
          role: "tab",
          "aria-selected": String(option.value === value),
          onClick: (event) => {
            const group = event.currentTarget.parentElement;
            group.querySelectorAll(".tabs__tab").forEach((tab) => tab.setAttribute("aria-selected", "false"));
            event.currentTarget.setAttribute("aria-selected", "true");
            onSelect(option.value);
          }
        },
        option.label
      )
    )
  );
}

/** Mở hộp thoại cài đặt chung. */
export function roleSettings({ onChange = null } = {}) {
  const prefs = getPreferences();

  const content = el(
    "div",
    { class: "settings" },
    optionRow({
      title: "Giao diện",
      description: "Sáng, tối hoặc theo thiết lập của máy.",
      children: segmented({
        value: prefs.theme,
        options: [
          { value: "light", label: "Sáng" },
          { value: "dark", label: "Tối" },
          { value: "system", label: "Theo máy" }
        ],
        onSelect: (theme) => {
          setPreferences({ theme });
          onChange?.();
        }
      })
    }),
    optionRow({
      title: "Mật độ hiển thị",
      description: "Thu gọn để thấy nhiều dòng hơn trên màn hình nhỏ.",
      children: segmented({
        value: prefs.density,
        options: [
          { value: "comfortable", label: "Thoáng" },
          { value: "compact", label: "Gọn" }
        ],
        onSelect: (density) => {
          setPreferences({ density });
          onChange?.();
        }
      })
    }),
    optionRow({
      title: "Chuyển động",
      description: "Giảm hiệu ứng nếu bạn thấy mỏi mắt.",
      children: segmented({
        value: prefs.motion,
        options: [
          { value: "full", label: "Đầy đủ" },
          { value: "reduced", label: "Giảm" }
        ],
        onSelect: (motion) => {
          setPreferences({ motion });
          onChange?.();
        }
      })
    }),
    el(
      "div",
      { class: "settings-note" },
      icon("info", { size: 15 }),
      el(
        "p",
        {},
        "SmartMart lưu dữ liệu ngay trên máy bạn bằng localStorage. Không có máy chủ nào nhận dữ liệu của cửa hàng. ",
        "Xoá dữ liệu trình duyệt sẽ xoá luôn dữ liệu cửa hàng."
      )
    ),
    el(
      "div",
      { class: "settings-actions" },
      el(
        "button",
        {
          type: "button",
          class: "btn btn--danger btn--sm",
          onClick: async () => {
            const { confirmDialog } = await import("../ui/modal.js");
            const yes = await confirmDialog({
              title: "Đặt lại dữ liệu cửa hàng?",
              message:
                "Toàn bộ mặt hàng, hóa đơn và tài khoản tự tạo sẽ bị xoá và nạp lại dữ liệu mẫu. Thao tác này không hoàn tác được.",
              confirmLabel: "Xoá và nạp lại",
              tone: "danger"
            });
            if (!yes) return;
            window.dispatchEvent(new CustomEvent("smartmart:reset"));
          }
        },
        icon("refresh", { size: 14 }),
        "Đặt lại dữ liệu mẫu"
      )
    )
  );

  openModal({
    title: "Cài đặt",
    size: "md",
    iconName: "settings",
    content,
    actions: [{ label: "Xong", kind: "primary" }]
  });
}

/** Hộp thoại giới thiệu ứng dụng — dùng ở màn hình đăng nhập. */
export function showAbout() {
  openModal({
    title: "Về SmartMart",
    size: "md",
    iconName: "store",
    content: el(
      "div",
      { class: "settings" },
      el(
        "p",
        { class: "modal__message" },
        "SmartMart là ứng dụng quản lý bán lẻ nhỏ: bán hàng, kho hàng, doanh thu và nhân sự trong một giao diện. ",
        "Bản web này được viết bằng HTML, CSS và JavaScript thuần, chạy trực tiếp trong trình duyệt, không cần cài đặt và dùng được ngoại tuyến sau lần mở đầu tiên."
      ),
      el(
        "div",
        { class: "settings-note" },
        icon("shield", { size: 15 }),
        el("p", {}, "Mật khẩu được băm bằng PBKDF2-SHA256 với 120.000 vòng lặp và salt ngẫu nhiên. Mật khẩu thô không bao giờ được lưu lại.")
      ),
      el(
        "div",
        { class: "settings-note" },
        icon("image", { size: 15 }),
        el("p", {}, "Ảnh sản phẩm lấy từ Open Food Facts và Wikimedia Commons, đóng gói sẵn trong ứng dụng. Danh sách nguồn nằm trong assets/products/credits.txt.")
      )
    ),
    actions: [{ label: "Đóng", kind: "primary" }]
  });
}
