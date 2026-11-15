/**
 * SmartMart · Định dạng hiển thị
 * ---------------------------------------------------------------------------
 * Toàn bộ con số, ngày tháng và tiền tệ đều đi qua file này để cả ứng dụng
 * hiển thị giống nhau: tiếng Việt, dấu chấm phân cách nghìn, ký hiệu ₫.
 */

const LOCALE = "vi-VN";

/** Đệm số 0 ở đầu cho chuỗi số. */
export function pad2(value) {
  return String(value).padStart(2, "0");
}

/** Chuyển giá trị bất kỳ thành số hữu hạn; trả về mặc định nếu không hợp lệ. */
export function toNumber(value, fallback = 0) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Làm tròn tới đồng, dùng chuẩn "nửa lên" như hóa đơn thật.
 * Mọi phép tính tiền tệ trong miền nghiệp vụ đều phải đi qua hàm này.
 */
export function roundMoney(value) {
  const number = toNumber(value);
  return Math.sign(number) * Math.round(Math.abs(number));
}

/** Chuỗi tiền tệ đầy đủ, ví dụ: 125.000 ₫ */
export function formatMoney(value) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(roundMoney(value));
}

/** Chuỗi tiền tệ rút gọn cho thẻ nhỏ, ví dụ: 1,2 tr ₫ */
export function formatMoneyCompact(value) {
  const rounded = roundMoney(value);
  const absolute = Math.abs(rounded);
  if (absolute >= 1_000_000_000) return `${trimNumber(rounded / 1_000_000_000)} tỉ ₫`;
  if (absolute >= 1_000_000) return `${trimNumber(rounded / 1_000_000)} tr ₫`;
  return formatMoney(rounded);
}

function trimNumber(value) {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value);
}

/** Số nguyên có phân cách nghìn, ví dụ: 2.602 */
export function formatNumber(value) {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(toNumber(value));
}

/** Phần trăm, ví dụ: -30% hoặc 12,5% */
export function formatPercent(value, digits = 0) {
  const number = toNumber(value);
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(number / 100);
}

/** Phần trăm kiểu "−30%" đúng như hóa đơn hiển thị. */
export function formatDiscount(discountPercent) {
  const percent = Math.round(toNumber(discountPercent));
  if (percent <= 0) return "0%";
  return "−" + percent + "%";
}

/** Nhận Date, DateOnly giả lập, chuỗi ISO hoặc mốc thời gian; trả về Date hợp lệ. */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(NaN) : value;
  if (value && typeof value === "object" && "year" in value) {
    return new Date(value.year, value.month - 1, value.day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(NaN) : date;
}

/** Ngày dạng dd/MM/yyyy. */
export function formatDate(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Giờ dạng 24h HH:mm. */
export function formatTime(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Ngày giờ dạng dd/MM/yyyy · HH:mm. */
export function formatDateTime(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** Thứ trong tuần tiếng Việt, ví dụ: Thứ Hai. */
export function formatWeekday(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat(LOCALE, { weekday: "long" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ngày đầy đủ dùng ở thanh trên, ví dụ: Thứ Hai, 12/11/2026. */
export function formatLongDate(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatWeekday(date)}, ${formatDate(date)}`;
}

/** Số ngày còn lại tới một ngày; âm nghĩa là đã qua. */
export function daysUntil(value) {
  const target = toDate(value);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** Mô tả hạn dùng bằng lời, dùng cho huy hiệu trạng thái. */
export function describeExpiry(value) {
  const days = daysUntil(value);
  if (days < 0) return `Hết hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Hết hạn hôm nay";
  if (days === 1) return "Còn 1 ngày";
  if (days <= 7) return `Còn ${days} ngày`;
  return formatDate(value);
}

/** Chuyển số thành chữ tiếng Việt để in hóa đơn (0 – 999.999.999.999). */
export function numberToVietnameseWords(value) {
  const number = Math.round(toNumber(value));
  if (number === 0) return "Không đồng";
  if (number < 0) return "Âm " + numberToVietnameseWords(-number);
  if (number > 999_999_999_999) return formatNumber(number) + " đồng";

  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const groups = ["", " nghìn", " triệu", " tỉ"];

  function readGroup(group, forceFull) {
    const hundreds = Math.floor(group / 100);
    const tens = Math.floor((group % 100) / 10);
    const units = group % 10;
    const parts = [];
    if (hundreds > 0 || forceFull) parts.push(digits[hundreds], "trăm");
    if (tens > 1) {
      parts.push(digits[tens], "mươi");
      if (units === 1) parts.push("mốt");
      else if (units === 5) parts.push("lăm");
      else if (units > 0) parts.push(digits[units]);
    } else if (tens === 1) {
      parts.push("mười");
      if (units === 5) parts.push("lăm");
      else if (units > 0) parts.push(digits[units]);
    } else if (units > 0) {
      if (hundreds > 0 || forceFull) parts.push("lẻ");
      parts.push(digits[units]);
    }
    return parts.join(" ");
  }

  const chunks = [];
  let rest = number;
  while (rest > 0) {
    chunks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const words = [];
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index];
    if (chunk === 0) continue;
    const forceFull = index < chunks.length - 1;
    const text = readGroup(chunk, forceFull);
    words.push(text + groups[index]);
  }

  const sentence = words.join(" ").replace(/\s+/g, " ").trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + " đồng";
}

/** Cắt chuỗi dài, thêm dấu ba chấm. */
export function truncate(text, max = 60) {
  const value = String(text ?? "");
  return value.length <= max ? value : value.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Viết hoa chữ đầu. */
export function capitalize(text) {
  const value = String(text ?? "");
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Tên hiển thị ngắn cho sản phẩm dài. */
export function initials(text, count = 2) {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
