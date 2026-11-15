/**
 * SmartMart · Người dùng và phân quyền
 * ---------------------------------------------------------------------------
 * Vì sao có cây kế thừa ở đây: yêu cầu của đồ án là minh hoạ đa hình — cùng
 * một lời gọi allowedScreens() nhưng mỗi vai trò trả về một bộ màn hình khác
 * nhau. Nhờ vậy thanh điều hướng chỉ cần hỏi người dùng, không cần biết vai trò
 * của họ là gì.
 *
 * Quy tắc bất di bất dịch: mật khẩu thô KHÔNG BAO GIỜ được lưu. Người dùng chỉ
 * giữ "credential" — chuỗi băm PBKDF2 dạng "base64(salt):base64(hash)" do
 * auth.js sinh ra.
 */

import { SCREENS, UserRole } from "./constants.js";
import { roleLabel } from "./vietnamese.js";
import { hashPassword } from "./auth.js";

/** Màn hình quản trị chỉ dành cho quản trị viên. */
const ADMIN_SCREENS = Object.freeze([SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports, SCREENS.Users]);

/** Lớp con cho từng vai trò, dựng theo khoá UserRole. */
const ROLE_CLASSES = new Map();

/**
 * Gốc của cây người dùng.
 * Trừu tượng có chủ đích: một "user chung chung" không có nghĩa trong nghiệp
 * vụ, nên lớp cơ sở chặn việc khởi tạo trực tiếp.
 */
export class User {
  #username;
  #role;
  #credential;

  constructor({ username, role, credential } = {}) {
    if (new.target === User) {
      throw new TypeError("Không thể tạo trực tiếp User: hãy dùng Cashier, Manager hoặc Admin.");
    }

    const name = String(username ?? "").trim();
    if (!name) throw new Error("Tên đăng nhập không được để trống.");

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) throw new Error(`Vai trò "${String(role ?? "")}" không hợp lệ.`);

    this.#username = name;
    this.#role = normalizedRole;
    this.#credential = typeof credential === "string" ? credential : "";
  }

  get username() {
    return this.#username;
  }

  get role() {
    return this.#role;
  }

  /** Chỉ đọc để lớp ngoài không vô tình ghi đè bằng mật khẩu thô. */
  get credential() {
    return this.#credential;
  }

  /**
   * TRỪU TƯỢNG: lớp cơ sở không biết vai trò này được vào đâu.
   * Ghi đè ở lớp con chính là phần đa hình mà đồ án muốn trình diễn.
   */
  allowedScreens() {
    throw new Error("allowedScreens() là phương thức trừu tượng, lớp con phải ghi đè.");
  }

  canAccess(screen) {
    return this.allowedScreens().includes(screen);
  }

  get displayRole() {
    return userRoleLabel(this.#role);
  }

  /** Đủ ba trường để dựng lại y nguyên: credential đã băm sẵn, không cần mật khẩu. */
  toJSON() {
    return { username: this.#username, role: this.#role, credential: this.#credential };
  }
}

export class Cashier extends User {
  constructor({ username, credential } = {}) {
    super({ username, role: UserRole.Cashier, credential });
  }

  allowedScreens() {
    return [SCREENS.Checkout];
  }
}

export class Manager extends User {
  constructor({ username, credential } = {}) {
    super({ username, role: UserRole.Manager, credential });
  }

  allowedScreens() {
    return [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports];
  }
}

export class Admin extends User {
  constructor({ username, credential } = {}) {
    super({ username, role: UserRole.Admin, credential });
  }

  allowedScreens() {
    return [...ADMIN_SCREENS];
  }
}

ROLE_CLASSES.set(UserRole.Cashier, Cashier);
ROLE_CLASSES.set(UserRole.Manager, Manager);
ROLE_CLASSES.set(UserRole.Admin, Admin);

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

/** Nhãn tiếng Việt của vai trò, dùng chung một nguồn với phần còn lại của ứng dụng. */
export function userRoleLabel(role) {
  return roleLabel(role);
}

/**
 * Chuẩn hoá vai trò. Nhận khoá ("Admin") lẫn nhãn tiếng Việt ("Quản trị viên")
 * vì biểu mẫu trên giao diện có thể gửi lên cả hai kiểu.
 */
export function normalizeRole(role) {
  const raw = String(role ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  for (const candidate of Object.values(UserRole)) {
    if (candidate.toLowerCase() === key || roleLabel(candidate).toLowerCase() === key) {
      return candidate;
    }
  }
  return null;
}

/** Lớp của một vai trò, kèm thông báo tiếng Việt khi vai trò không hợp lệ. */
function roleClassOf(role) {
  const normalized = normalizeRole(role);
  const RoleClass = normalized ? ROLE_CLASSES.get(normalized) : undefined;
  if (!RoleClass) throw new Error(`Vai trò "${String(role ?? "")}" không hợp lệ.`);
  return RoleClass;
}

/** Kiểm tra tên đăng nhập; ném lỗi tiếng Việt nói rõ sai ở đâu. */
function checkUsername(username) {
  const name = String(username ?? "").trim();
  if (!name) throw new Error("Tên đăng nhập không được để trống.");
  if (name.length < 3) throw new Error("Tên đăng nhập phải có ít nhất 3 ký tự.");
  if (/\s/.test(name)) throw new Error("Tên đăng nhập không được chứa khoảng trắng.");
  return name;
}

/** Kiểm tra mật khẩu; chỉ đếm ký tự, không áp thêm luật phức tạp để buổi demo dễ dùng. */
function checkPassword(password) {
  const secret = typeof password === "string" ? password : String(password ?? "");
  if (secret.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
  return secret;
}

// ---------------------------------------------------------------------------
// API công khai
// ---------------------------------------------------------------------------

/**
 * Tạo người dùng mới từ mật khẩu thô: kiểm tra dữ liệu, băm mật khẩu rồi mới
 * dựng đối tượng — nhờ thứ tự này, một mật khẩu sai luật không tốn 120.000
 * vòng PBKDF2.
 */
export async function createUser({ username, password, role } = {}) {
  const name = checkUsername(username);
  const secret = checkPassword(password);
  const RoleClass = roleClassOf(role);
  const credential = await hashPassword(secret);
  return new RoleClass({ username: name, credential });
}

/** Dựng lại người dùng từ dữ liệu đã lưu — credential đã băm sẵn nên KHÔNG băm lại. */
export function userFromJSON(data) {
  if (data instanceof User) return data;
  if (!data || typeof data !== "object") {
    throw new Error("Dữ liệu người dùng không hợp lệ.");
  }
  const RoleClass = roleClassOf(data.role);
  return new RoleClass({ username: data.username, credential: data.credential });
}
