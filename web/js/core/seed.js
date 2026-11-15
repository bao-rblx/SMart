/**
 * SmartMart · Dữ liệu mẫu
 * ---------------------------------------------------------------------------
 * Ba việc, đúng ba hàm:
 *
 * 1. loadCatalog()   — tải data/catalog.json (72 mặt hàng thô). Bản tải về được
 *                       cất luôn vào localStorage để lần mở sau, kể cả khi mất
 *                       mạng hoặc mở bằng file://, cửa hàng vẫn có hàng để bán.
 * 2. seedProducts()  — biến 72 plain object thành 72 thực thể Product thật
 *                       (đa hình: hàng tươi có hạn dùng, điện tử có bảo hành).
 * 3. seedUsersAsync() — ba tài khoản mẫu admin / manager / cashier.
 *
 * Vì sao phải tách seedUsersAsync() khỏi seedUsers(): mật khẩu KHÔNG được lưu
 * dạng thô, phải băm bằng PBKDF2 — mà Web Crypto chỉ có bản bất đồng bộ. Một
 * hàm đồng bộ không thể chờ 120.000 vòng băm xong. Hợp đồng ưu tiên bản
 * async; bản đồng bộ chỉ còn là chỗ giữ tương thích và sẽ trả mảng rỗng kèm
 * giải thích (xem chú thích ở cuối file).
 *
 * Ghi chú về đường dẫn: file này nằm ở web/js/core/ nên data/catalog.json là
 * "../../data/catalog.json" — luôn tính từ import.meta.url để chạy đúng dù
 * trang được mở từ thư mục gốc hay từ thư mục con.
 */

import { Category, LOW_STOCK_THRESHOLD, ProductKind, UserRole } from "./constants.js";
import { createProduct } from "./models.js";
import { createUser, userFromJSON } from "./users.js";
import { hashPassword } from "./auth.js";

/** Khoá riêng cho bản sao danh mục tải về — không lẫn với trạng thái ứng dụng. */
export const CATALOG_CACHE_KEY = "smartmart.catalog.v3";

/**
 * Đường dẫn tới danh mục mẫu, tính từ chính file này.
 * Dùng URL thay vì chuỗi tương đối vì fetch() và import() cùng một trang có
 * thể có gốc khác nhau; URL tuyệt đối lấy từ import.meta.url là chắc chắn nhất.
 */
export const CATALOG_URL = new URL("../../data/catalog.json", import.meta.url).href;

/** Ba tài khoản mẫu — trùng tên đăng nhập/mật khẩu ghi trong README của đồ án. */
export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ username: "admin", password: "admin", role: UserRole.Admin }),
  Object.freeze({ username: "manager", password: "manager", role: UserRole.Manager }),
  Object.freeze({ username: "cashier", password: "cashier", role: UserRole.Cashier })
]);

/** Nhà cung cấp mặc định khi danh mục không ghi tên — dữ liệu mẫu để trống trường này. */
const FALLBACK_SUPPLIER = "Nhà phân phối trong nước";

/** Đã in ghi chú về đường lui của tài khoản demo chưa — in một lần là đủ. */
let seedNoticeShown = false;

/* =========================================================================
 * 1. Đọc danh mục mẫu
 * ========================================================================*/

/** Hàng xếp hàng chờ tải: mở hai màn hình cùng lúc cũng chỉ tải danh mục một lần. */
let pendingCatalog = null;

/**
 * Tải danh mục mẫu.
 * @param {(url: string) => Promise<any>} [fetcher] Hàm tải thay thế (test, hoặc
 *        khi chạy trong môi trường không có fetch). Mặc định dùng globalThis.fetch.
 * @returns {Promise<Array<object>>} Mảng plain object theo CONTRACTS.md mục 2.1.
 */
export async function loadCatalog(fetcher) {
  if (typeof fetcher === "function") {
    return readCatalogFrom(await fetcher(CATALOG_URL));
  }
  if (pendingCatalog) return pendingCatalog;

  pendingCatalog = (async () => {
    // Ưu tiên bản đã cất trên máy: mở được ứng dụng ngay cả khi mất mạng.
    const cached = readCatalogCache();
    if (cached) return cached;

    const fetchFunction = globalThis.fetch;
    if (typeof fetchFunction !== "function") {
      throw new Error("Trình duyệt không hỗ trợ fetch nên không tải được danh mục mẫu.");
    }
    const response = await fetchFunction(CATALOG_URL);
    if (!response || !response.ok) {
      throw new Error("Không tải được danh mục mẫu (" + String(response?.status ?? "?") + ").");
    }
    const items = readCatalogFrom(await response.json());
    writeCatalogCache(items);
    return items;
  })();

  try {
    return await pendingCatalog;
  } catch (error) {
    // Lần sau bấm thử lại phải thật sự thử lại, không dùng lại lời hứa đã hỏng.
    pendingCatalog = null;
    throw error;
  }
}

/** Chấp nhận cả mảng thuần lẫn object bọc { items: [...] } như data/catalog.json. */
function readCatalogFrom(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Danh mục mẫu rỗng hoặc sai định dạng.");
  }
  return items;
}

function readCatalogCache() {
  try {
    const raw = globalThis.localStorage?.getItem(CATALOG_CACHE_KEY);
    if (typeof raw !== "string" || raw === "") return null;
    return readCatalogFrom(JSON.parse(raw));
  } catch {
    // Cache hỏng hoặc bị chặn: coi như chưa có, tải lại từ mạng.
    return null;
  }
}

function writeCatalogCache(items) {
  try {
    globalThis.localStorage?.setItem(CATALOG_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Không cất được thì thôi — lần sau tải lại, không phải lỗi chặn đường.
  }
}

/* =========================================================================
 * 2. Dựng 72 sản phẩm
 * ========================================================================*/

/** Chuỗi ngày "yyyy-mm-dd" ở giờ địa phương (không dùng toISOString vì nó là UTC). */
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

/** Hôm nay + số ngày, đã cắt về nửa đêm để không lệch giờ khi so sánh. */
function addDays(base, days) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/**
 * Đổi một item thô của data/catalog.json thành dữ liệu đúng định dạng mục 2.1.
 * Vì sao phải biến đổi: file danh mục dùng tên ngắn cho gọn ("key", "serial"),
 * còn hợp đồng dùng "catalogKey", "serialNumber". Hạn dùng cũng vậy: danh mục
 * ghi "còn bao nhiêu ngày" (shelfLifeDays) nên phải quy ra một mốc ngày thật,
 * nếu không hàng tươi sẽ hết hạn ngay khi đóng ứng dụng.
 *
 * @param {object} item  Item thô.
 * @param {Date} [today] Mốc "hôm nay" — tham số hoá để kiểm thử được.
 */
export function normalizeCatalogItem(item, today = new Date()) {
  const raw = item && typeof item === "object" ? item : {};
  const kind = readKind(raw.kind);
  const data = {
    id: raw.id,
    name: String(raw.name ?? "").trim(),
    category: readCategory(raw.category),
    price: raw.price,
    stock: raw.stock,
    kind,
    barcode: String(raw.barcode ?? ""),
    catalogKey: String(raw.catalogKey ?? raw.key ?? ""),
    lowStockThreshold: Number.isFinite(Number(raw.lowStockThreshold))
      ? Number(raw.lowStockThreshold)
      : LOW_STOCK_THRESHOLD
  };

  // Chỉ giữ đúng trường của từng loại: đưa "warrantyMonths" cho hàng tươi là
  // dữ liệu rác, dễ khiến người đọc sau này tưởng hàng tươi có bảo hành.
  if (kind === ProductKind.Perishable) {
    data.expiryDate = readExpiryDate(raw, today);
    data.shelfLifeDays = Number(raw.shelfLifeDays) || 0;
  } else if (kind === ProductKind.Electronic) {
    data.warrantyMonths = Number(raw.warrantyMonths) || 0;
    data.serialNumber = String(raw.serialNumber ?? raw.serial ?? "");
  } else {
    data.supplier = String(raw.supplier ?? "").trim() || FALLBACK_SUPPLIER;
  }

  return data;
}

/** Hạn dùng: ưu tiên mốc ngày có sẵn, nếu không thì tính từ số ngày còn lại. */
function readExpiryDate(raw, today) {
  const explicit = String(raw.expiryDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const remaining = Number(raw.shelfLifeDays);
  const days = Number.isFinite(remaining) ? Math.trunc(remaining) : 0;
  return toISODate(addDays(today, days));
}

function readKind(kind) {
  return kind === ProductKind.Perishable || kind === ProductKind.Electronic
    ? kind
    : ProductKind.General;
}

function readCategory(category) {
  return Object.values(Category).includes(category) ? category : Category.General;
}

/**
 * Dựng 72 sản phẩm mẫu.
 * @param {(url: string) => Promise<any>} [fetcher] Hàm tải thay thế, truyền thẳng cho loadCatalog().
 * @returns {Promise<Array>} Danh sách thực thể Product.
 */
export async function seedProducts(fetcher) {
  const items = await loadCatalog(fetcher);
  const today = new Date();
  return items.map((item) => createProduct(normalizeCatalogItem(item, today)));
}

/* =========================================================================
 * 3. Ba tài khoản mẫu
 * ========================================================================*/

/**
 * Ba người dùng mẫu: admin / manager / cashier.
 * Bản async là bản CHÍNH (hợp đồng ưu tiên): createUser() băm mật khẩu bằng
 * PBKDF2 qua Web Crypto nên bắt buộc phải await.
 *
 * @returns {Promise<Array>} Danh sách User đã có credential băm.
 */
export async function seedUsersAsync() {
  const users = [];
  for (const account of DEMO_ACCOUNTS) {
    users.push(await seedOneUser(account));
  }
  return users;
}

/** Dựng một tài khoản mẫu, chịu được cả hai luật mật khẩu đang tồn tại. */
async function seedOneUser(account) {
  try {
    return await createUser({
      username: account.username,
      password: account.password,
      role: account.role
    });
  } catch (error) {
    return seedDemoUser(account, error);
  }
}

/**
 * Đường lui cho ba tài khoản demo.
 *
 * VÌ SAO CẦN: tài khoản demo dùng chính tên đăng nhập làm mật khẩu
 * (admin/admin, manager/manager, cashier/cashier — đúng như README của đồ án
 * và đúng như bảng "Tài khoản dùng thử" trên màn hình đăng nhập). Nếu
 * users.js áp luật "mật khẩu tối thiểu 6 ký tự" thì createUser() từ chối cả
 * ba, và ứng dụng sẽ không còn đường đăng nhập nào.
 *
 * Cách xử lý KHÔNG phải là nới luật (đó là việc của users.js), mà là đi vòng
 * đúng cách: băm mật khẩu bằng chính hàm băm của auth.js rồi dựng người dùng
 * từ credential đã băm, y hệt cách userFromJSON() khôi phục tài khoản đã lưu.
 * Mật khẩu thô vẫn không bao giờ được lưu.
 */
async function seedDemoUser(account, cause) {
  markSeedNotice(
    "Tài khoản demo \"" + account.username + "\" ngắn hơn luật mật khẩu của createUser() (" +
      String(cause?.message ?? cause) + "). Đã băm trực tiếp bằng auth.hashPassword()."
  );
  const credential = await hashPassword(account.password);
  return userFromJSON({ username: account.username, role: account.role, credential });
}

/** Ghi nhận đường lui đã dùng — in một lần để người ghép phần biết mà đối chiếu. */
function markSeedNotice(message) {
  if (seedNoticeShown) return;
  seedNoticeShown = true;
  try {
    globalThis.console?.info?.("[SmartMart] " + message);
  } catch {
    // Thiếu console cũng không phải lý do để ném lỗi.
  }
}

/**
 * Bản đồng bộ của seedUsers().
 *
 * GIỚI HẠN CÓ CHỦ Ý: trả mảng RỖNG. Lý do: băm PBKDF2 không thể chạy đồng bộ
 * trong trình duyệt, mà một tài khoản không có credential băm thì không đăng
 * nhập được — trả về tài khoản "nửa vời" còn tệ hơn trả về rỗng. Ai cần dữ
 * liệu mẫu hãy dùng seedUsersAsync().
 *
 * Hàm vẫn nhận một tham số tuỳ chọn: nếu nơi gọi đã có sẵn danh sách plain
 * object (ví dụ đọc từ storage), truyền vào để khôi phục ngay mà không phải
 * chờ băm lại mật khẩu.
 *
 * @param {Array<object>} [savedUsers] Dữ liệu người dùng đã lưu (plain object).
 * @returns {Array}
 */
export function seedUsers(savedUsers) {
  if (Array.isArray(savedUsers) && savedUsers.length > 0) {
    return savedUsers.map((item) => userFromJSON(item));
  }
  return [];
}

export default { loadCatalog, seedProducts, seedUsers, seedUsersAsync, CATALOG_URL, DEMO_ACCOUNTS };
