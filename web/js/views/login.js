/**
 * SmartMart · Màn hình đăng nhập
 * ---------------------------------------------------------------------------
 * Hai cột: bên trái là lời giới thiệu thương hiệu (nền xanh đậm), bên phải là
 * thẻ đăng nhập. Đây là màn hình đầu tiên người xem đồ án nhìn thấy, nên phần
 * trình bày được chăm chút hơn phần còn lại.
 *
 * Vì sao form tự quản lý trạng thái bận: băm PBKDF2 mất vài trăm mili giây,
 * nếu không khoá nút và hiện vòng xoay thì người dùng sẽ tưởng máy treo và
 * bấm lại nhiều lần.
 */

import { el, focus } from "../ui/dom.js";
import { icon } from "../ui/icons.js";

/** Tài khoản dùng thử — hiển thị sẵn để lúc bảo vệ đồ án không phải nhớ. */
export const DEMO_ACCOUNTS = Object.freeze([
  { username: "admin", password: "admin", role: "Quản trị viên" },
  { username: "manager", password: "manager", role: "Quản lý" },
  { username: "cashier", password: "cashier", role: "Thu ngân" }
]);

/** Ba dòng tính năng ở cột trái. */
const FEATURES = Object.freeze([
  { icon: "cart", text: "Bán hàng một chạm, tự trừ kho, tự in hóa đơn" },
  { icon: "box", text: "Kho hàng, hạn dùng và giá bán trong cùng một nơi" },
  { icon: "chart", text: "Doanh thu theo ngày, theo nhóm hàng, xuất báo cáo" }
]);

/**
 * Lấy thông điệp lỗi tiếng Việt từ kết quả của AuthService.
 * AuthService trả { user } | { error }, nhưng vẫn phòng trường hợp ném lỗi.
 */
export function loginErrorMessage(result, fallback = "Chưa đăng nhập được. Bạn thử lại giúp mình nhé.") {
  if (!result) return fallback;
  if (typeof result.error === "string" && result.error.trim() !== "") return result.error;
  return fallback;
}

/** Đọc form thành dữ liệu sạch (bỏ khoảng trắng thừa ở tên đăng nhập). */
export function readCredentials(usernameInput, passwordInput) {
  return {
    username: String(usernameInput?.value ?? "").trim(),
    password: String(passwordInput?.value ?? "")
  };
}

/**
 * Vẽ màn hình đăng nhập.
 *
 * @param {object} context
 * @param {object} context.store        Kho dữ liệu (dùng store.auth + store.signIn).
 * @param {Function} context.onSignedIn Được gọi sau khi đăng nhập thành công.
 * @returns {HTMLElement}
 */
export function renderLogin(context = {}) {
  const { store, onSignedIn } = context;

  const usernameInput = el("input", {
    class: "input",
    id: "lg-username",
    name: "username",
    type: "text",
    autocomplete: "username",
    autocapitalize: "none",
    spellcheck: "false",
    placeholder: "Ví dụ: cashier",
    "aria-label": "Tên đăng nhập",
    "aria-describedby": "lg-username-hint"
  });

  const passwordInput = el("input", {
    class: "input",
    id: "lg-password",
    name: "password",
    type: "password",
    autocomplete: "current-password",
    placeholder: "Nhập mật khẩu",
    "aria-label": "Mật khẩu",
    "aria-describedby": "lg-password-hint lg-error"
  });

  const revealButton = buildRevealButton(passwordInput);
  const errorBox = el("p", { class: "lg-error", id: "lg-error", role: "alert", "aria-live": "polite" });
  const submitLabel = el("span", { class: "lg-submit__label" }, "Vào cửa hàng");
  const submitButton = el(
    "button",
    { class: "btn btn--primary btn--lg btn--block lg-submit", type: "submit" },
    submitLabel,
    icon("arrowRight", { size: 18 })
  );

  let busy = false;

  function showError(message) {
    errorBox.textContent = message ?? "";
    errorBox.classList.toggle("is-shown", Boolean(message));
    usernameInput.setAttribute("aria-invalid", message ? "true" : "false");
    passwordInput.setAttribute("aria-invalid", message ? "true" : "false");
  }

  async function submit() {
    if (busy) return;
    const credentials = readCredentials(usernameInput, passwordInput);

    // Kiểm tra rỗng ngay tại chỗ để không phải chờ băm mật khẩu vô ích.
    if (credentials.username === "") {
      showError("Bạn nhập tên đăng nhập giúp mình nhé.");
      focus(usernameInput);
      return;
    }
    if (credentials.password === "") {
      showError("Bạn nhập mật khẩu giúp mình nhé.");
      focus(passwordInput);
      return;
    }

    setBusy(true);
    showError("");
    try {
      const result = await store.auth.login(credentials.username, credentials.password);
      if (result?.user) {
        passwordInput.value = "";
        store.signIn(result.user);
        onSignedIn?.(result.user);
        return;
      }
      fail(loginErrorMessage(result));
    } catch (error) {
      fail(
        error?.message
          ? "Không đăng nhập được: " + error.message
          : "Có lỗi khi đăng nhập. Bạn thử lại giúp mình nhé."
      );
    } finally {
      setBusy(false);
    }
  }

  /** Giữ tên đăng nhập, xoá mật khẩu, đưa con trỏ về ô mật khẩu — đúng thói quen nhập liệu. */
  function fail(message) {
    showError(message);
    passwordInput.value = "";
    focus(passwordInput);
    passwordInput.select?.();
  }

  function setBusy(value) {
    busy = value;
    submitButton.classList.toggle("is-busy", value);
    submitButton.disabled = value;
    submitLabel.textContent = value ? "Đang kiểm tra…" : "Vào cửa hàng";
    submitButton.setAttribute("aria-busy", value ? "true" : "false");
    usernameInput.readOnly = value;
    passwordInput.readOnly = value;
  }

  const form = el(
    "form",
    {
      class: "lg-form",
      novalidate: "true",
      // Submit qua form để Enter ở bất kỳ ô nào cũng chạy, đúng kỳ vọng.
      onSubmit: (event) => {
        event.preventDefault();
        submit();
      }
    },
    field({
      label: "Tên đăng nhập",
      input: usernameInput,
      hint: "Tên đăng nhập của nhân viên",
      hintId: "lg-username-hint"
    }),
    field({
      label: "Mật khẩu",
      input: passwordInput,
      trailing: revealButton,
      hint: "Mật khẩu do quản trị viên cấp",
      hintId: "lg-password-hint"
    }),
    errorBox,
    submitButton
  );

  // Gõ lại thì dọn lỗi cũ — thông báo đỏ nằm mãi sẽ gây nhiễu.
  const clearOnInput = () => {
    if (errorBox.classList.contains("is-shown")) showError("");
  };
  usernameInput.addEventListener("input", clearOnInput);
  passwordInput.addEventListener("input", clearOnInput);

  const demoBlock = buildDemoBlock((account) => {
    usernameInput.value = account.username;
    passwordInput.value = account.password;
    showError("");
    focus(passwordInput);
  });

  const panel = el(
    "section",
    { class: "auth__panel" },
    el(
      "div",
      { class: "auth__card" },
      el(
        "div",
        { class: "lg-card-top" },
        el("span", { class: "lg-mark lg-mark--compact", "aria-hidden": "true" }, icon("store", { size: 20 })),
        el("span", { class: "lg-card-top__note" }, "Phiên bản web · Chạy ngoại tuyến")
      ),
      el("p", { class: "eyebrow auth__eyebrow" }, "SmartMart · Quầy bán hàng"),
      el("h1", { class: "auth__title" }, "Chào bạn trở lại"),
      el("p", { class: "auth__hint" }, "Đăng nhập để mở quầy. Mọi thao tác bán hàng hôm nay sẽ được ghi vào sổ của cửa hàng."),
      form,
      demoBlock,
      el(
        "p",
        { class: "lg-footnote" },
        icon("shield", { size: 14 }),
        "Dữ liệu lưu trên máy bạn · Không gửi lên máy chủ"
      )
    )
  );

  const view = el(
    "div",
    { class: "auth lg-view" },
    buildAside(),
    panel
  );

  // Đưa con trỏ vào ô đầu tiên sau khi màn hình đã gắn vào DOM. Dùng
  // requestAnimationFrame vì lúc hàm này trả về, nơi gọi còn chưa append.
  const focusFirst = () => {
    if (view.isConnected) focus(usernameInput, { preventScroll: true });
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusFirst);
  else focusFirst();

  return view;
}

// ---------------------------------------------------------------------------
// Các khối giao diện
// ---------------------------------------------------------------------------

/** Thẻ bọc một ô nhập: nhãn + ô (+ nút phụ) + gợi ý. */
function field({ label, input, trailing = null, hint = "", hintId = "" }) {
  return el(
    "label",
    { class: "field lg-field", for: input.id ?? null },
    el("span", { class: "field__label" }, label),
    trailing ? el("span", { class: "lg-input-wrap" }, input, trailing) : input,
    hint ? el("span", { class: "field__hint", id: hintId || null }, hint) : null
  );
}

/** Nút hiện/ẩn mật khẩu — đổi cả biểu tượng, nhãn và kiểu ô nhập. */
function buildRevealButton(passwordInput) {
  let visible = false;
  const button = el(
    "button",
    {
      type: "button",
      class: "lg-reveal",
      "aria-label": "Hiện mật khẩu",
      title: "Hiện mật khẩu",
      "aria-pressed": "false",
      onClick: () => {
        visible = !visible;
        passwordInput.type = visible ? "text" : "password";
        button.replaceChildren(icon(visible ? "eyeOff" : "eye", { size: 17 }));
        button.setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        button.setAttribute("title", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        button.setAttribute("aria-pressed", visible ? "true" : "false");
        // Giữ con trỏ trong ô mật khẩu để gõ tiếp ngay, không bị nhảy về đầu.
        const end = passwordInput.value.length;
        focus(passwordInput);
        passwordInput.setSelectionRange?.(end, end);
      }
    },
    icon("eye", { size: 17 })
  );
  return button;
}

/** Khối "TÀI KHOẢN DÙNG THỬ": bấm một dòng là tự điền form. */
function buildDemoBlock(onPick) {
  return el(
    "div",
    { class: "lg-demo" },
    el("p", { class: "lg-demo__title" }, "Tài khoản dùng thử"),
    el(
      "ul",
      { class: "lg-demo__list", role: "list" },
      DEMO_ACCOUNTS.map((account) =>
        el(
          "li",
          {},
          el(
            "button",
            {
              type: "button",
              class: "lg-demo__row",
              "aria-label":
                "Điền tài khoản " + account.username + " (mật khẩu " + account.password + ", " + account.role + ")",
              onClick: () => onPick(account)
            },
            el("span", { class: "lg-demo__role" }, account.role),
            el("span", { class: "lg-demo__cred" }, account.username + " / " + account.password),
            icon("arrowRight", { size: 14 })
          )
        )
      )
    )
  );
}

/** Cột trái: thương hiệu, khẩu hiệu, ba dòng tính năng, dải phiên bản. */
function buildAside() {
  return el(
    "aside",
    { class: "auth__aside lg-aside", "aria-label": "Giới thiệu SmartMart" },
    el(
      "div",
      { class: "lg-aside__top" },
      el(
        "div",
        { class: "lg-brand" },
        el("span", { class: "lg-mark", "aria-hidden": "true" }, icon("store", { size: 22 })),
        el(
          "span",
          { class: "lg-brand__word" },
          el("strong", {}, "smartmart"),
          el("span", {}, "quầy bán hàng")
        )
      ),
      el(
        "h2",
        { class: "auth__headline" },
        "Gọn việc bán. ",
        el("em", {}, "Trọn niềm vui.")
      ),
      el(
        "p",
        { class: "auth__lede" },
        "Một ứng dụng cho cả quầy: bán nhanh tại quầy, kho tự trừ theo từng món, cuối ngày xem lại doanh thu và ưu đãi đã trao cho khách."
      ),
      el(
        "ul",
        { class: "auth__features", role: "list" },
        FEATURES.map((feature) =>
          el(
            "li",
            { class: "auth__feature" },
            icon(feature.icon, { size: 18 }),
            el("span", {}, feature.text)
          )
        )
      )
    ),
    el("p", { class: "lg-aside__strip" }, "Phiên bản web · Chạy ngoại tuyến")
  );
}
