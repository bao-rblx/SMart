/**
 * SmartMart · Lưu trữ trên máy
 * ---------------------------------------------------------------------------
 * Cửa hàng phải dùng được ngoại tuyến, nên toàn bộ trạng thái nằm trong
 * localStorage của trình duyệt. Nhưng localStorage KHÔNG phải lúc nào cũng
 * dùng được: chế độ riêng tư có thể ném lỗi ngay khi đọc, bộ nhớ đã đầy thì
 * setItem ném QuotaExceededError, chính sách của tổ chức có thể chặn hẳn.
 *
 * Nguyên tắc của file này: KHÔNG BAO GIỜ ném lỗi ra ngoài. Mọi sự cố được
 * đóng gói thành giá trị trả về để giao diện kịp hiện banner cảnh báo, thay vì
 * làm trắng cả ứng dụng chỉ vì không ghi được vài byte.
 *
 * File này cố tình KHÔNG import gì từ tầng miền nghiệp vụ: nó chỉ nhận và trả
 * plain object. Nhờ vậy nó chạy được trong Node để kiểm thử mà không cần
 * Product, User hay Transaction.
 *
 * Định dạng ghi xuống:
 *   { version: SCHEMA_VERSION, savedAt: "ISO", data: { products, users, sales } }
 * Có "version" để sau này đổi cấu trúc thì biết dữ liệu cũ mà bỏ qua, thay vì
 * cố đọc rồi vỡ giữa đường.
 */

import { SCHEMA_VERSION, STORAGE_KEY } from "./constants.js";

/** Tiền tố khoá của kho dự phòng trong bộ nhớ — tách khỏi khoá localStorage thật. */
const MEMORY_PREFIX = "memory:";

const DEFAULT_WARNING =
  "Trình duyệt không cho phép lưu dữ liệu trên máy. SmartMart sẽ giữ dữ liệu trong phiên làm việc này.";

/** Kho dự phòng: Map thay cho localStorage khi trình duyệt chặn. */
const memoryStore = new Map();

/** Những khoá đã từng bị chặn — dùng để storageMode() báo đúng cả sau khi xoá. */
const blockedKeys = new Set();

/** Lý do chặn gần nhất, để banner cảnh báo nói được đúng nguyên nhân. */
let lastWarning = null;

/** Môi trường hiện tại không hề có localStorage (khác với "có nhưng ném lỗi"). */
let localStorageMissing = false;

/** Bản trong bộ nhớ đang MỚI HƠN bản trên đĩa (lần ghi đĩa gần nhất đã thất bại). */
let memoryIsNewer = false;

/** Cảnh báo phát sinh riêng vì môi trường thiếu localStorage — để rút lại khi nó có trở lại. */
let missingEnvWarning = null;

/** Đã in cảnh báo chưa — chỉ in một lần mỗi phiên cho khỏi rác console. */
let warned = false;

/* =========================================================================
 * 1. Tiện ích nội bộ
 * ========================================================================*/

function messageOf(error) {
  const text = error && error.message ? String(error.message) : String(error ?? "");
  return text.trim() || DEFAULT_WARNING;
}

/**
 * Ghi nhận sự cố và in cảnh báo đúng MỘT lần.
 * Vì sao: mỗi lần bấm lưu đều thất bại, nếu lần nào cũng in thì console đầy
 * lỗi trong khi người dùng chẳng có thêm thông tin gì.
 */
function markBlocked(error) {
  lastWarning = messageOf(error);
  if (!warned) {
    warned = true;
    try {
      globalThis.console?.warn?.("[SmartMart] Không dùng được localStorage — chuyển sang bộ nhớ tạm: " + lastWarning);
    } catch {
      // Thiếu console cũng không phải lý do để ném lỗi.
    }
  }
  return lastWarning;
}

/**
 * Lấy localStorage nếu thật sự dùng được.
 * Phải bọc try: ở chế độ riêng tư, chính việc ĐỌC thuộc tính localStorage đã ném SecurityError.
 */
function localStore() {
  try {
    const candidate = globalThis.localStorage;
    if (!candidate || typeof candidate.getItem !== "function" || typeof candidate.setItem !== "function") {
      // Không có localStorage (Node, trình duyệt tối giản, iframe bị cô lập):
      // ghi nhận là "đã bị chặn" để storageMode() báo đúng là "memory".
      if (!localStorageMissing) {
        localStorageMissing = true;
        missingEnvWarning = markBlocked(new Error("Môi trường này không có localStorage."));
      }
      return null;
    }
    localStorageMissing = false;
    // localStorage quay lại (ví dụ trang được nhúng lại vào ngữ cảnh cho phép):
    // rút lại đúng cảnh báo do thiếu môi trường, không đụng tới cảnh báo khác.
    if (missingEnvWarning !== null && lastWarning === missingEnvWarning) {
      lastWarning = null;
      missingEnvWarning = null;
    }
    return candidate;
  } catch (error) {
    localStorageMissing = true;
    markBlocked(error);
    return null;
  }
}

function readLocal(key) {
  const store = localStore();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch (error) {
    markBlocked(error);
    return null;
  }
}

function writeLocal(key, value) {
  const store = localStore();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch (error) {
    // Hết dung lượng (QuotaExceededError) cũng rơi vào đây — vẫn phải chạy tiếp.
    markBlocked(error);
    return false;
  }
}

function removeLocal(key) {
  const store = localStore();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch (error) {
    markBlocked(error);
    return false;
  }
}

function memoryKey(key) {
  return MEMORY_PREFIX + key;
}

function readMemory(key) {
  const value = memoryStore.get(memoryKey(key));
  return typeof value === "string" ? value : null;
}

function writeMemory(key, value) {
  memoryStore.set(memoryKey(key), value);
}

function removeMemory(key) {
  return memoryStore.delete(memoryKey(key));
}

/** Đang phải sống nhờ kho dự phòng trong bộ nhớ hay không. */
function isBlocked() {
  if (localStorageMissing) return true;
  if (lastWarning) return true;
  if (blockedKeys.has(STORAGE_KEY)) return true;
  return memoryStore.has(memoryKey(STORAGE_KEY));
}

/* =========================================================================
 * 2. Chuyển đổi dữ liệu — chỉ plain object mới được lưu
 * ========================================================================*/

/**
 * Hạ một giá trị bất kỳ về plain object.
 * Vì sao bắt buộc: Product giấu trạng thái trong private field (#stock...).
 * JSON.stringify(instance) sẽ ra "{}" và ta mất sạch dữ liệu — đúng cái bẫy
 * mà Thành viên 1 đã cảnh báo. Cách duy nhất đúng là qua toJSON().
 */
function toPlainValue(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") {
    try {
      return value.toJSON();
    } catch {
      // Một bản ghi hỏng không được làm hỏng cả lần lưu.
      return undefined;
    }
  }
  return value;
}

function toPlainList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(toPlainValue).filter((item) => item !== undefined);
}

function toPlainPayload(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    products: toPlainList(source.products),
    users: toPlainList(source.users),
    sales: toPlainList(source.sales)
  };
}

/**
 * Đọc bản ghi JSON đã lưu. Trả null cho mọi trường hợp không dùng được:
 * rỗng, không phải JSON, không phải object, hoặc thuộc lược đồ cũ.
 * Vì sao không "cố gắng sửa": dữ liệu hỏng mà đoán mò sẽ tạo ra kho hàng
 * nửa đúng nửa sai, tệ hơn nhiều so với việc nạp lại dữ liệu mẫu.
 */
function parseRecord(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let record;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    markWarningOnly("Dữ liệu lưu trên máy bị hỏng nên đã bỏ qua. Đã nạp dữ liệu mẫu thay thế.");
    return null;
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  if (record.version !== SCHEMA_VERSION) {
    markWarningOnly("Dữ liệu lưu thuộc phiên bản " + String(record.version) + ", khác phiên bản hiện tại nên đã bỏ qua.");
    return null;
  }
  return record;
}

/** Ghi nhận một cảnh báo "mềm" (dữ liệu hỏng) mà không đổi chế độ lưu trữ. */
function markWarningOnly(message) {
  if (warned) return;
  warned = true;
  try {
    globalThis.console?.warn?.("[SmartMart] " + message);
  } catch {
    // bỏ qua
  }
}

/** Bản ghi → trạng thái ứng dụng. Trả null khi không có gì để khôi phục. */
function toState(record) {
  const data = record && typeof record === "object" ? record.data : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const products = Array.isArray(data.products) ? data.products : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const sales = Array.isArray(data.sales) ? data.sales : [];
  if (products.length === 0 && users.length === 0 && sales.length === 0) return null;

  return { products, users, sales };
}

function fail(warning) {
  return { ok: false, warning: String(warning || DEFAULT_WARNING) };
}

/* =========================================================================
 * 3. API công khai
 * ========================================================================*/

/**
 * Đọc trạng thái đã lưu.
 * Thứ tự: localStorage trước, rồi tới kho dự phòng trong bộ nhớ (để phiên
 * đang chạy vẫn thấy dữ liệu của chính nó sau khi bị chặn ghi).
 *
 * @returns {{products: Array, users: Array, sales: Array}|null}
 */
export function loadState() {
  try {
    // Khi lần ghi đĩa gần nhất thất bại, bản trong bộ nhớ mới là bản đúng —
    // đọc bản trên đĩa trước sẽ làm người dùng thấy dữ liệu cũ quay về.
    if (memoryIsNewer) {
      const newest = toState(parseRecord(readMemory(STORAGE_KEY)));
      if (newest) return newest;
    }
    const fromLocal = toState(parseRecord(readLocal(STORAGE_KEY)));
    if (fromLocal) return fromLocal;
    return toState(parseRecord(readMemory(STORAGE_KEY)));
  } catch (error) {
    markWarningOnly("Không đọc được dữ liệu đã lưu: " + messageOf(error));
    return null;
  }
}

/**
 * Lưu trạng thái xuống máy.
 * Không bao giờ ném lỗi: thành công trả { ok: true }, thất bại trả
 * { ok: false, warning } để giao diện hiện banner cảnh báo.
 *
 * @param {{products?: Array, users?: Array, sales?: Array}} state
 */
export function saveState(state) {
  try {
    const record = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data: toPlainPayload(state)
    };

    let text;
    try {
      text = JSON.stringify(record);
    } catch (error) {
      // Vòng tham chiếu hoặc dữ liệu không tuần tự hoá được.
      return fail("Không chuyển được dữ liệu sang JSON: " + messageOf(error));
    }

    if (writeLocal(STORAGE_KEY, text)) {
      // Ghi được nghĩa là môi trường đã hết chặn (ví dụ người dùng thoát chế độ
      // riêng tư): trả chế độ về "local" thay vì giữ cảnh báo cũ đã hết đúng.
      blockedKeys.delete(STORAGE_KEY);
      if (!localStorageMissing) lastWarning = null;
      // Bản trên đĩa đã là mới nhất: bỏ bản trong bộ nhớ để không còn hai nguồn sự thật.
      memoryIsNewer = false;
      removeMemory(STORAGE_KEY);
      return { ok: true };
    }

    // Bị chặn: vẫn giữ dữ liệu trong bộ nhớ để phiên này làm việc liền mạch,
    // chỉ mất khi tải lại trang — người dùng được cảnh báo đúng như vậy.
    blockedKeys.add(STORAGE_KEY);
    writeMemory(STORAGE_KEY, text);
    memoryIsNewer = true;
    return fail(lastWarning ?? DEFAULT_WARNING);
  } catch (error) {
    // Lưới an toàn cuối cùng, hợp đồng cam kết storage.js không ném lỗi.
    return fail("Không lưu được dữ liệu: " + messageOf(error));
  }
}

/**
 * Xoá dữ liệu đã lưu (dùng cho nút "Đặt lại dữ liệu mẫu").
 * Trả true nếu đã xoá xong; false nếu môi trường chặn thao tác.
 */
export function clearState() {
  try {
    const removedLocal = removeLocal(STORAGE_KEY);
    const removedMemory = removeMemory(STORAGE_KEY);
    memoryIsNewer = false;
    // Vẫn giữ dấu "đã bị chặn" để storageMode() phản ánh đúng môi trường,
    // chứ không báo "local" chỉ vì kho vừa được dọn sạch.
    return removedLocal || removedMemory || !isBlocked();
  } catch (error) {
    markWarningOnly("Không xoá được dữ liệu đã lưu: " + messageOf(error));
    return false;
  }
}

/** Chế độ lưu trữ hiện tại: "local" (có localStorage) hoặc "memory" (bộ nhớ tạm). */
export function storageMode() {
  try {
    // Thăm dò môi trường mỗi lần gọi: nhờ vậy cờ "không có localStorage" được
    // cập nhật ngay cả khi chưa ai kịp đọc/ghi lần nào.
    localStore();
    return isBlocked() ? "memory" : "local";
  } catch {
    return "memory";
  }
}

export default { loadState, saveState, clearState, storageMode };
