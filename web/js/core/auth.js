/**
 * SmartMart · Băm và xác thực mật khẩu
 * ---------------------------------------------------------------------------
 * Vì sao chọn PBKDF2-SHA256: nó có sẵn ở cả Web Crypto (trình duyệt hiện đại)
 * lẫn node:crypto, nên cùng một file chạy được ở hai môi trường mà không cần
 * thư viện ngoài. 120.000 vòng lặp làm chi phí của mỗi lần thử mật khẩu đắt
 * lên đáng kể, đó chính là mục đích của hàm dẫn xuất khoá.
 *
 * Credential luôn có dạng "base64(salt):base64(hash)":
 *   - salt ngẫu nhiên 16 byte cho TỪNG người dùng, nên hai người trùng mật khẩu
 *     vẫn có credential khác nhau (vô hiệu hoá bảng băm dựng sẵn),
 *   - mật khẩu thô không bao giờ được ghi vào bộ nhớ dài hạn hay localStorage.
 */

import { SCREENS, UserRole } from "./constants.js";
import { User, createUser, normalizeRole, userFromJSON } from "./users.js";

const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PBKDF2_DIGEST = "SHA-256";
/** Base64 chuẩn: chỉ chữ, số, dấu + / và tối đa hai dấu = ở cuối. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
/** Thông báo duy nhất cho mọi trường hợp đăng nhập hỏng — không mách là sai tên hay sai mật khẩu. */
const LOGIN_ERROR = "Tên đăng nhập hoặc mật khẩu chưa đúng.";

const textEncoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Môi trường: Web Crypto trước, node:crypto sau
// ---------------------------------------------------------------------------

/** Trình duyệt hiện đại và Node ≥ 19 đều có Web Crypto dùng được. */
function webCryptoAvailable() {
  return (
    typeof globalThis.crypto?.getRandomValues === "function" &&
    typeof globalThis.crypto?.subtle?.importKey === "function"
  );
}

/** Chỉ tới đây khi KHÔNG có Web Crypto — tức là đang chạy trong Node. */
async function loadNodeCrypto() {
  try {
    return await import("node:crypto");
  } catch {
    throw new Error("Môi trường này không hỗ trợ băm mật khẩu vì thiếu Web Crypto.");
  }
}

/** Salt ngẫu nhiên 16 byte, lấy từ nguồn ngẫu nhiên mật mã học của từng môi trường. */
async function randomSalt() {
  if (webCryptoAvailable()) {
    return globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  }
  const nodeCrypto = await loadNodeCrypto();
  return new Uint8Array(nodeCrypto.randomBytes(SALT_BYTES));
}

/** Dẫn xuất 32 byte khoá từ mật khẩu + salt bằng PBKDF2-SHA256. */
async function deriveBits(password, salt) {
  if (webCryptoAvailable()) {
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_DIGEST },
      keyMaterial,
      HASH_BYTES * 8
    );
    return new Uint8Array(bits);
  }

  const nodeCrypto = await loadNodeCrypto();
  return new Promise((resolve, reject) => {
    nodeCrypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      HASH_BYTES,
      PBKDF2_DIGEST.toLowerCase().replace("-", ""),
      (error, derived) => (error ? reject(error) : resolve(new Uint8Array(derived)))
    );
  });
}

// ---------------------------------------------------------------------------
// Base64 — Buffer ở Node, atob/btoa ở trình duyệt
// ---------------------------------------------------------------------------

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBytes(text) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(text, "base64"));
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// API công khai
// ---------------------------------------------------------------------------

/**
 * Băm mật khẩu thành credential "base64(salt):base64(hash)".
 * Salt mới mỗi lần gọi nên cùng một mật khẩu cho ra hai chuỗi khác nhau.
 */
export async function hashPassword(password) {
  const secret = toPasswordText(password);
  const salt = await randomSalt();
  const hash = await deriveBits(secret, salt);
  return `${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
}

/**
 * Kiểm tra mật khẩu với credential đã lưu.
 * Credential rỗng/hỏng/sai định dạng đều trả false thay vì ném lỗi: nơi gọi chỉ
 * cần biết "đúng hay sai", còn dữ liệu hỏng thì phải coi như không đăng nhập được.
 */
export async function verifyPassword(password, credential) {
  const parsed = parseCredential(credential);
  if (!parsed) return false;

  try {
    const derived = await deriveBits(toPasswordText(password), parsed.salt);
    return constantTimeEquals(derived, parsed.hash);
  } catch (error) {
    console.warn("[SmartMart] Không kiểm tra được mật khẩu:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// So sánh hằng thời gian
// ---------------------------------------------------------------------------

/**
 * So sánh hai dãy byte mà không thoát sớm.
 * Vì sao: nếu thoát ngay ở byte lệch đầu tiên, thời gian chạy sẽ tiết lộ bao
 * nhiêu byte đầu đã đúng, đủ để kẻ tấn công dò dần từng byte của hash.
 */
function constantTimeEquals(left, right) {
  const length = Math.max(left.length, right.length);
  // Độ dài lệch nhau cũng phải chạy hết vòng lặp để thời gian không lộ thông tin.
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

// ---------------------------------------------------------------------------
// Phân tích credential
// ---------------------------------------------------------------------------

/** Tách credential thành salt/hash; trả null nếu chuỗi hỏng. */
function parseCredential(credential) {
  if (typeof credential !== "string") return null;
  const parts = credential.split(":");
  if (parts.length !== 2) return null;
  const [saltText, hashText] = parts;
  if (!BASE64_PATTERN.test(saltText) || !BASE64_PATTERN.test(hashText)) return null;

  try {
    const salt = base64ToBytes(saltText);
    const hash = base64ToBytes(hashText);
    // Độ dài tối thiểu để loại các credential cụt do dữ liệu lưu bị cắt.
    if (salt.length < 8 || hash.length < HASH_BYTES / 2) return null;
    return { salt, hash };
  } catch {
    return null;
  }
}

/** Ép giá trị nhập về chuỗi an toàn; mật khẩu rỗng vẫn là một chuỗi hợp lệ để băm. */
function toPasswordText(password) {
  return typeof password === "string" ? password : String(password ?? "");
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

/**
 * Credential giả dùng khi không tìm thấy tên đăng nhập. Nhờ vậy nhánh "sai tên"
 * cũng tốn đúng một lần PBKDF2 như nhánh "sai mật khẩu", và kẻ dò tài khoản
 * không đo được thời gian phản hồi để biết tên nào có thật.
 */
let decoyCredentialPromise = null;

function decoyCredential() {
  decoyCredentialPromise ??= hashPassword("smartmart-decoy-password");
  return decoyCredentialPromise;
}

/** Đưa một phần tử bất kỳ về User; trả null nếu không dựng được. */
function toUser(entry) {
  if (entry instanceof User) return entry;
  if (!entry || typeof entry !== "object") return null;
  try {
    return userFromJSON(entry);
  } catch (error) {
    console.warn("[SmartMart] Bỏ qua bản ghi người dùng hỏng:", error?.message ?? error);
    return null;
  }
}

function usernameKey(username) {
  return String(username ?? "").trim().toLowerCase();
}

function notFoundMessage(username) {
  return `Không tìm thấy người dùng "${String(username ?? "").trim()}".`;
}

/**
 * Thao tác quản lý nhân sự chỉ dành cho người được vào màn hình Nhân sự.
 * Trả về thông báo lỗi (không ném) để khớp quy ước { error } của AuthService.
 * Nhận đối tượng User thật chứ không nhận chuỗi vai trò, nên không giả mạo được.
 */
function permissionError(actor, action) {
  if (!actor || typeof actor.canAccess !== "function") {
    return "Không xác định được người thực hiện, nên không thể " + action + ". Hãy đăng nhập lại.";
  }
  if (!actor.canAccess(SCREENS.Users)) {
    return (
      "Tài khoản \"" +
      String(actor.username ?? "") +
      "\" không có quyền " +
      action +
      ". Chỉ quản trị viên mới làm được việc này."
    );
  }
  return null;
}

/** Quản lý danh sách người dùng: đăng nhập, thêm, đổi vai trò, xoá. */
export class AuthService {
  #users;

  constructor(users = []) {
    this.#users = [];
    this.setUsers(users);
  }

  /** Bản sao của danh sách — sửa mảng trả về không làm hỏng dịch vụ. */
  get users() {
    return [...this.#users];
  }

  /** Đặt lại toàn bộ danh sách (dùng khi nạp dữ liệu đã lưu). */
  setUsers(users) {
    this.#users = [];
    for (const entry of Array.isArray(users) ? users : []) {
      const user = toUser(entry);
      if (user) this.#users.push(user);
    }
    return this.users;
  }

  /** Tìm theo tên đăng nhập, không phân biệt hoa thường (tên đăng nhập là duy nhất theo nghĩa đó). */
  find(username) {
    const key = usernameKey(username);
    if (!key) return undefined;
    return this.#users.find((user) => usernameKey(user.username) === key);
  }

  /**
   * Đăng nhập. Chỉ có MỘT thông báo lỗi cho mọi trường hợp sai — không tiết lộ
   * tên đăng nhập có tồn tại hay không.
   */
  async login(username, password) {
    const user = this.find(username);
    if (!user) {
      // Vẫn tiêu tốn một lần PBKDF2 để thời gian phản hồi không lộ tên nào có thật.
      try {
        await verifyPassword(password, await decoyCredential());
      } catch {
        // Không dựng được credential giả thì bỏ qua: kết quả vẫn là đăng nhập hỏng.
      }
      return { error: LOGIN_ERROR };
    }
    const valid = await verifyPassword(password, user.credential);
    if (!valid) return { error: LOGIN_ERROR };
    return { user };
  }

  /** Thêm người dùng mới. Tên đăng nhập trùng (không phân biệt hoa thường) bị từ chối. */
  async addUser({ username, password, role } = {}, actor = null) {
    const denied = permissionError(actor, "thêm nhân sự");
    if (denied) return { error: denied };

    const name = String(username ?? "").trim();
    if (this.find(name)) {
      return { error: `Tên đăng nhập "${name}" đã có người dùng. Vui lòng chọn tên khác.` };
    }
    try {
      const user = await createUser({ username: name, password, role });
      this.#users.push(user);
      return { user };
    } catch (error) {
      return { error: error?.message || "Không tạo được người dùng." };
    }
  }

  /**
   * Đổi vai trò. Chặn hạ quyền quản trị viên cuối cùng để hệ thống không còn
   * ai quản trị được nữa (kể cả việc cấp lại quyền cho người khác).
   */
  changeRole(username, role, actor = null) {
    const denied = permissionError(actor, "đổi vai trò");
    if (denied) return { error: denied };

    const user = this.find(username);
    if (!user) return { error: notFoundMessage(username) };

    const targetRole = normalizeRole(role);
    if (!targetRole) return { error: `Vai trò "${String(role ?? "")}" không hợp lệ.` };
    if (user.role === targetRole) return { user };

    if (user.role === UserRole.Admin && this.#adminCount() <= 1) {
      return { error: "Không thể hạ quyền quản trị viên cuối cùng. Hãy bổ nhiệm một quản trị viên khác trước." };
    }

    const updated = userFromJSON({
      username: user.username,
      role: targetRole,
      credential: user.credential
    });
    this.#users[this.#users.indexOf(user)] = updated;
    return { user: updated };
  }

  /** Xoá người dùng; chặn xoá quản trị viên cuối cùng vì cùng lý do trên. */
  removeUser(username, actor = null) {
    const denied = permissionError(actor, "xoá nhân sự");
    if (denied) return { error: denied };

    const user = this.find(username);
    if (!user) return { error: notFoundMessage(username) };

    if (user.role === UserRole.Admin && this.#adminCount() <= 1) {
      return { error: "Không thể xoá quản trị viên cuối cùng. Hãy bổ nhiệm một quản trị viên khác trước." };
    }

    this.#users = this.#users.filter((entry) => entry !== user);
    return { ok: true };
  }

  #adminCount() {
    return this.#users.filter((user) => user.role === UserRole.Admin).length;
  }
}
