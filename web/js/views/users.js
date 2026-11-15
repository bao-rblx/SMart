/**
 * SmartMart · Màn hình Nhân sự
 * ---------------------------------------------------------------------------
 * Quản lý tài khoản của cửa hàng: ai đang dùng, vai trò gì, vào được màn hình
 * nào. Ba hành động: thêm, đổi vai trò, xoá.
 *
 * Hai chốt an toàn nằm ở tầng giao diện vì chúng liên quan tới NGƯỜI ĐANG ĐĂNG
 * NHẬP (tầng core không biết ai đang đăng nhập):
 *   1. Không tự xoá / tự đổi vai trò của chính mình — tránh tự khoá quyền.
 *   2. Không để mất quản trị viên cuối cùng — AuthService đã chặn, giao diện chỉ
 *      hiện đúng câu thông báo lỗi trả về, không tự đoán.
 */

import { el, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { UserRole, SCREENS } from "../core/constants.js";
import { roleLabel, screenLabel } from "../core/vietnamese.js";
import { formatNumber, initials } from "../core/format.js";

// ===========================================================================
// PHẦN THUẦN — kiểm thử được không cần DOM
// ===========================================================================

/** Thứ tự vai trò từ thấp tới cao để hiển thị badge và sắp xếp danh sách. */
export const ROLE_ORDER = Object.freeze([UserRole.Cashier, UserRole.Manager, UserRole.Admin]);

/** Lớp badge theo vai trò — chỉ dùng các biến thể có sẵn trong components.css. */
export function roleBadgeClass(role) {
  switch (role) {
    case UserRole.Admin:
      return "badge badge--violet";
    case UserRole.Manager:
      return "badge badge--brand";
    default:
      return "badge badge--outline";
  }
}

/** Nhãn màn hình mà vai trò đó vào được, ví dụ ["Bán hàng", "Kho hàng"]. */
export function allowedScreenLabels(user) {
  let screens = [];
  try {
    screens = typeof user?.allowedScreens === "function" ? user.allowedScreens() : [];
  } catch {
    screens = [];
  }
  return (Array.isArray(screens) ? screens : []).map((screen) => screenLabel(screen));
}

/** Hai tên đăng nhập coi là trùng khi bỏ khoảng trắng và không phân biệt hoa thường. */
export function sameUsername(left, right) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

/**
 * Đếm số liệu trên thẻ.
 * @returns {{total:number, admins:number, roleOfCurrent:string}}
 */
export function summarizeUsers(users, currentUser = null) {
  const list = Array.isArray(users) ? users : [];
  return {
    total: list.length,
    admins: list.filter((user) => user?.role === UserRole.Admin).length,
    roleOfCurrent: currentUser?.role ?? ""
  };
}

/** Sắp xếp danh sách hiển thị: quản trị viên trước, rồi tới quản lý, thu ngân; cùng vai trò thì theo tên. */
export function sortUsers(users) {
  const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
  return [...(Array.isArray(users) ? users : [])].sort((left, right) => {
    const rankOf = (user) => {
      const index = ROLE_ORDER.indexOf(user?.role);
      return index < 0 ? ROLE_ORDER.length : index;
    };
    return rankOf(right) - rankOf(left) || collator.compare(String(left?.username ?? ""), String(right?.username ?? ""));
  });
}

/**
 * Kiểm tra dữ liệu biểu mẫu thêm nhân sự, trả lỗi theo từng trường.
 * Ở đây kiểm tra những gì nhìn thấy ngay được; trùng tên thật sự vẫn do
 * AuthService quyết định (nó là nơi duy nhất biết danh sách hiện tại).
 *
 * @returns {Record<string,string>}
 */
export function validateUserForm(form, existing = []) {
  const errors = {};
  const username = String(form?.username ?? "").trim();
  const password = String(form?.password ?? "");

  if (!username) errors.username = "Hãy nhập tên đăng nhập.";
  else if (username.length < 3) errors.username = "Tên đăng nhập phải có ít nhất 3 ký tự.";
  else if (/\s/.test(username)) errors.username = "Tên đăng nhập không được chứa khoảng trắng.";
  else if ((Array.isArray(existing) ? existing : []).some((user) => sameUsername(user?.username, username))) {
    errors.username = "Tên đăng nhập \"" + username + "\" đã có người dùng. Vui lòng chọn tên khác.";
  }

  if (!password) errors.password = "Hãy nhập mật khẩu.";
  else if (password.length < 6) errors.password = "Mật khẩu phải có ít nhất 6 ký tự.";

  if (!ROLE_ORDER.includes(form?.role)) errors.role = "Hãy chọn vai trò.";

  return errors;
}

/**
 * Kiểm tra trước khi xoá / đổi vai trò.
 * Trả về thông báo tiếng Việt giải thích lý do chặn, hoặc null nếu được phép.
 *
 * @param {object} target      Người dùng sắp bị tác động.
 * @param {object} currentUser Người đang đăng nhập.
 * @returns {string|null}
 */
export function selfGuardMessage(target, currentUser) {
  if (!target || !currentUser) return null;
  if (!sameUsername(target.username, currentUser.username)) return null;
  return "Bạn không thể tự đổi vai trò hay xoá chính mình. Hãy nhờ một quản trị viên khác.";
}

/** Các màn hình trong hệ thống — dùng cho gợi ý quyền của từng vai trò. */
export function allScreenLabels() {
  return Object.values(SCREENS).map((screen) => screenLabel(screen));
}

// ===========================================================================
// PHẦN GIAO DIỆN
// ===========================================================================

/** Avatar chữ cái đầu — không cần ảnh, vẫn phân biệt được từng người. */
function avatar(user) {
  const name = String(user?.username ?? "?");
  return el("span", { class: "us-avatar", "aria-hidden": "true" }, initials(name, 1) || name.charAt(0).toUpperCase());
}

/**
 * Vẽ màn hình nhân sự.
 *
 * @param {object} context { store, state, toast, confirm, refresh }
 * @returns {HTMLElement} Node bọc trong .view
 */
export function renderUsers(context = {}) {
  const { store = null, state = null, toast = null, confirm = null, refresh = null } = context;
  const appState = state ?? store?.state ?? {};
  const ui = { selectedName: null };

  const root = el("div", { class: "view us-view" });

  function users() {
    return appState.users ?? store?.getUsers?.() ?? [];
  }

  function currentUser() {
    return appState.currentUser ?? store?.state?.currentUser ?? null;
  }

  function selectedUser() {
    if (!ui.selectedName) return null;
    return users().find((user) => sameUsername(user?.username, ui.selectedName)) ?? null;
  }

  function afterChange(message) {
    toast?.success?.(message);
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
        el("h1", {}, "Nhân sự"),
        el("p", {}, "Cùng một đội ngũ, cùng chăm chút cửa hàng.")
      ),
      el(
        "div",
        { class: "page-head__actions" },
        el(
          "button",
          { class: "btn btn--primary", type: "button", onClick: () => openUserForm() },
          icon("plus", { size: 16 }),
          "Thêm nhân sự"
        )
      )
    )
  );

  // --- Thẻ số liệu -------------------------------------------------------
  const metricsHost = el("div", { class: "metric-grid" });
  const selectionBar = el("div", { class: "us-selection", hidden: true });
  const tableWrap = el("div", { class: "table-wrap us-table-wrap" });
  const countLabel = el("span", { class: "us-hint" }, "");
  const tableCard = el(
    "section",
    { class: "card us-card" },
    el("div", { class: "card__head" }, el("h2", {}, "Tài khoản"), countLabel),
    selectionBar,
    tableWrap
  );

  root.append(metricsHost, tableCard);

  function paintMetrics() {
    const summary = summarizeUsers(users(), currentUser());
    clear(metricsHost);
    metricsHost.append(
      el(
        "article",
        { class: "metric metric--brand" },
        el("p", { class: "metric__label" }, icon("users", { size: 14 }), "Nhân sự"),
        el("p", { class: "metric__value" }, formatNumber(summary.total)),
        el("p", { class: "metric__note" }, "Tài khoản đang có trong cửa hàng")
      ),
      el(
        "article",
        { class: "metric metric--violet" },
        el("p", { class: "metric__label" }, icon("shield", { size: 14 }), "Quản trị viên"),
        el("p", { class: "metric__value" }, formatNumber(summary.admins)),
        el("p", { class: "metric__note" }, "Luôn cần ít nhất một người")
      ),
      el(
        "article",
        { class: "metric metric--sky" },
        el("p", { class: "metric__label" }, icon("user", { size: 14 }), "Vai trò của bạn"),
        el("p", { class: "metric__value" }, summary.roleOfCurrent ? roleLabel(summary.roleOfCurrent) : "—"),
        el(
          "p",
          { class: "metric__note" },
          summary.roleOfCurrent
            ? allowedScreenLabels(currentUser()).join(" · ")
            : "Chưa đăng nhập"
        )
      )
    );
  }

  function selectUser(user) {
    const name = String(user?.username ?? "");
    ui.selectedName = sameUsername(ui.selectedName, name) ? null : name;
    paintSelection();
  }

  function paintSelection() {
    tableWrap.querySelectorAll("tr[data-username]").forEach((row) => {
      const active = sameUsername(row.dataset.username, ui.selectedName);
      row.classList.toggle("is-selected", active);
      row.setAttribute("aria-selected", String(active));
    });

    clear(selectionBar);
    const user = selectedUser();
    if (!user) {
      selectionBar.hidden = true;
      return;
    }

    const isSelf = sameUsername(user.username, currentUser()?.username);
    selectionBar.hidden = false;
    selectionBar.append(
      el(
        "span",
        { class: "us-selection__label" },
        String(user.username),
        isSelf ? el("span", { class: "badge badge--outline us-selection__self" }, "Bạn") : null
      ),
      el(
        "div",
        { class: "us-selection__actions" },
        el(
          "button",
          { class: "btn btn--soft btn--sm", type: "button", onClick: () => changeRole(user) },
          icon("shield", { size: 14 }),
          "Đổi vai trò"
        ),
        el(
          "button",
          { class: "btn btn--danger btn--sm", type: "button", onClick: () => removeUser(user) },
          icon("trash", { size: 14 }),
          "Xoá thành viên"
        )
      )
    );
  }

  function paintTable() {
    const list = sortUsers(users());
    clear(tableWrap);

    if (list.length === 0) {
      tableWrap.append(
        el(
          "div",
          { class: "empty" },
          el("span", { class: "empty__icon" }, icon("users", { size: 26 })),
          el("h3", {}, "Chưa có tài khoản nào"),
          el("p", {}, "Thêm nhân sự đầu tiên để họ có thể đăng nhập và bán hàng.")
        )
      );
      countLabel.textContent = "0 tài khoản";
      paintSelection();
      return;
    }

    const body = el("tbody");
    const me = currentUser();

    for (const user of list) {
      const isSelf = sameUsername(user?.username, me?.username);
      body.append(
        el(
          "tr",
          {
            dataset: { username: String(user?.username ?? "") },
            tabindex: "0",
            "aria-selected": "false",
            onClick: () => selectUser(user),
            onKeydown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectUser(user);
              }
            }
          },
          el(
            "td",
            {},
            el(
              "div",
              { class: "us-person" },
              avatar(user),
              el(
                "div",
                { class: "us-person__meta" },
                el("span", { class: "us-person__name" }, String(user?.username ?? "")),
                el("span", { class: "us-person__sub" }, isSelf ? "Bạn đang đăng nhập" : "Tài khoản cửa hàng")
              )
            )
          ),
          el("td", {}, el("span", { class: roleBadgeClass(user?.role) }, roleLabel(user?.role))),
          el(
            "td",
            {},
            el(
              "div",
              { class: "us-screens" },
              allowedScreenLabels(user).map((label) =>
                el("span", { class: "badge badge--outline us-screen" }, label)
              )
            )
          )
        )
      );
    }

    tableWrap.append(
      el(
        "table",
        { class: "table us-table" },
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", {}, "Tên đăng nhập"),
            el("th", {}, "Vai trò"),
            el("th", {}, "Quyền truy cập")
          )
        ),
        body
      )
    );

    countLabel.textContent = list.length + " tài khoản";
    if (ui.selectedName && !selectedUser()) ui.selectedName = null;
    paintSelection();
  }

  // --- Đổi vai trò -------------------------------------------------------
  async function changeRole(user) {
    const guard = selfGuardMessage(user, currentUser());
    if (guard) {
      toast?.info?.(guard);
      return;
    }

    const result = await chooseRoleDialog(user);
    if (!result) return;

    try {
      const outcome = store.changeRole(user.username, result);
      if (outcome?.error) {
        toast?.error?.(outcome.error);
        return;
      }
      afterChange("Đã đổi vai trò \"" + user.username + "\" thành " + roleLabel(result) + ".");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  /** Hộp thoại chọn vai trò mới; trả về mã vai trò hoặc null nếu huỷ. */
  function chooseRoleDialog(user) {
    let picked = user.role;
    const select = el(
      "select",
      {
        class: "select",
        onChange: (event) => {
          picked = event.target.value;
        }
      },
      ROLE_ORDER.map((role) => el("option", { value: role, selected: role === user.role }, roleLabel(role)))
    );

    const preview = el("p", { class: "us-role-hint" }, "");
    const paintPreview = () => {
      const fake = { allowedScreens: () => screensOfRole(picked) };
      preview.textContent = "Được vào: " + allowedScreenLabels(fake).join(", ");
    };
    paintPreview();
    select.addEventListener("change", paintPreview);

    const dialog = openModal({
      title: "Đổi vai trò cho \"" + user.username + "\"",
      size: "sm",
      iconName: "shield",
      content: el(
        "label",
        { class: "field" },
        el("span", { class: "field__label" }, "Vai trò mới"),
        select,
        preview
      ),
      actions: [
        { label: "Hủy", kind: "ghost", value: null },
        { label: "Lưu vai trò", kind: "primary", value: true }
      ]
    });

    return dialog.result.then((answer) => (answer === true ? picked : null));
  }

  /** Màn hình mặc định của một vai trò — chỉ để xem trước quyền trong hộp thoại. */
  function screensOfRole(role) {
    switch (role) {
      case UserRole.Admin:
        return [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports, SCREENS.Users];
      case UserRole.Manager:
        return [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports];
      default:
        return [SCREENS.Checkout];
    }
  }

  // --- Xoá thành viên ----------------------------------------------------
  async function removeUser(user) {
    const guard = selfGuardMessage(user, currentUser());
    if (guard) {
      toast?.info?.(guard);
      return;
    }

    const message =
      "Xoá tài khoản \"" + user.username + "\"? Họ sẽ không đăng nhập được nữa, hóa đơn cũ vẫn được giữ lại.";
    const asked = confirm
      ? await confirm({ title: "Xoá thành viên", message, confirmLabel: "Xoá", cancelLabel: "Giữ lại", tone: "danger" })
      : await confirmDialog({ title: "Xoá thành viên", message, confirmLabel: "Xoá", cancelLabel: "Giữ lại", tone: "danger" });
    if (!asked) return;

    try {
      const outcome = store.removeUser(user.username);
      // AuthService chặn xoá quản trị viên cuối cùng — hiện đúng câu nó trả về.
      if (outcome?.error) {
        toast?.error?.(outcome.error);
        return;
      }
      ui.selectedName = null;
      afterChange("Đã xoá tài khoản \"" + user.username + "\".");
    } catch (error) {
      toast?.error?.(String(error?.message ?? error));
    }
  }

  // --- Biểu mẫu thêm nhân sự ---------------------------------------------
  function openUserForm() {
    const form = { username: "", password: "", role: UserRole.Cashier };
    const errorNodes = {};

    const field = (key, label, control, hint) => {
      const errorNode = el("p", { class: "field__error is-hidden" });
      errorNodes[key] = errorNode;
      return el(
        "label",
        { class: "field" },
        el("span", { class: "field__label" }, label),
        control,
        hint ? el("span", { class: "field__hint" }, hint) : null,
        errorNode
      );
    };

    const usernameInput = el("input", {
      class: "input",
      type: "text",
      placeholder: "Ví dụ: nhanvien2",
      autocomplete: "off",
      "data-autofocus": "true",
      onInput: (event) => {
        form.username = event.target.value;
      }
    });

    const passwordInput = el("input", {
      class: "input",
      type: "password",
      placeholder: "Ít nhất 6 ký tự",
      autocomplete: "new-password",
      onInput: (event) => {
        form.password = event.target.value;
      }
    });

    const roleInput = el(
      "select",
      {
        class: "select",
        onChange: (event) => {
          form.role = event.target.value;
        }
      },
      ROLE_ORDER.map((role) => el("option", { value: role, selected: role === form.role }, roleLabel(role)))
    );

    const roleHint = el("p", { class: "us-role-hint" }, "Được vào: " + allowedScreenLabels({ allowedScreens: () => screensOfRole(form.role) }).join(", "));
    roleInput.addEventListener("change", () => {
      roleHint.textContent = "Được vào: " + allowedScreenLabels({ allowedScreens: () => screensOfRole(form.role) }).join(", ");
    });

    const body = el(
      "form",
      { class: "us-form", onSubmit: (event) => event.preventDefault() },
      field("username", "Tên đăng nhập", usernameInput, "Không dấu, không khoảng trắng — dùng để đăng nhập."),
      field("password", "Mật khẩu", passwordInput, "Mật khẩu được băm trước khi lưu, không ai đọc lại được."),
      field("role", "Vai trò", roleInput),
      roleHint
    );

    const clearErrors = () => {
      for (const node of Object.values(errorNodes)) {
        node.textContent = "";
        node.classList.add("is-hidden");
      }
      for (const input of [usernameInput, passwordInput, roleInput]) input.removeAttribute("aria-invalid");
    };

    const dialog = openModal({
      title: "Thêm nhân sự",
      size: "md",
      iconName: "users",
      content: body,
      actions: [
        { label: "Hủy", kind: "ghost" },
        {
          label: "Tạo tài khoản",
          kind: "primary",
          onClick: async () => {
            clearErrors();
            const errors = validateUserForm(form, users());
            const keys = Object.keys(errors);
            if (keys.length > 0) {
              for (const key of keys) {
                const node = errorNodes[key];
                if (node) {
                  node.textContent = errors[key];
                  node.classList.remove("is-hidden");
                }
              }
              const first = { username: usernameInput, password: passwordInput, role: roleInput }[keys[0]];
              first?.setAttribute("aria-invalid", "true");
              first?.focus();
              return false;
            }

            try {
              // store.addUser là bất đồng bộ vì phải băm mật khẩu (PBKDF2).
              const outcome = await store.addUser({ ...form });
              if (outcome?.error) {
                const node = errorNodes.username;
                if (node) {
                  node.textContent = outcome.error;
                  node.classList.remove("is-hidden");
                }
                toast?.error?.(outcome.error);
                return false;
              }
              dialog.close(true);
              afterChange("Đã tạo tài khoản \"" + String(outcome?.user?.username ?? form.username) + "\".");
            } catch (error) {
              toast?.error?.(String(error?.message ?? error));
              return false;
            }
            return true;
          }
        }
      ],
      onOpen: () => usernameInput.focus()
    });

    return dialog;
  }

  // --- Vẽ lần đầu --------------------------------------------------------
  paintMetrics();
  paintTable();

  return root;
}
