/**
 * SmartMart · Giao diện sáng / tối và tuỳ chọn hiển thị
 * ---------------------------------------------------------------------------
 * Lựa chọn lưu trong localStorage để lần mở sau giữ nguyên.
 * Mặc định bám theo thiết lập của hệ điều hành.
 */

import { PREF_KEY } from "../core/constants.js";
import { Events, emit } from "./events.js";

const DEFAULTS = Object.freeze({
  theme: "system",   // "light" | "dark" | "system"
  density: "comfortable", // "comfortable" | "compact"
  motion: "full"     // "full" | "reduced"
});

let prefs = { ...DEFAULTS };
const mediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

/** Đọc tuỳ chọn đã lưu; hỏng dữ liệu thì dùng mặc định. */
export function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      prefs = {
        theme: ["light", "dark", "system"].includes(saved.theme) ? saved.theme : DEFAULTS.theme,
        density: ["comfortable", "compact"].includes(saved.density) ? saved.density : DEFAULTS.density,
        motion: ["full", "reduced"].includes(saved.motion) ? saved.motion : DEFAULTS.motion
      };
    }
  } catch {
    prefs = { ...DEFAULTS };
  }
  apply();
  return { ...prefs };
}

/** Lưu và áp dụng tuỳ chọn mới. */
export function setPreferences(patch) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* Trình duyệt chặn lưu trữ: giữ nguyên trong phiên, không làm hỏng ứng dụng. */
  }
  apply();
  emit(Events.SettingsChanged, { ...prefs });
  return { ...prefs };
}

export function getPreferences() {
  return { ...prefs };
}

/** Chuyển nhanh giữa sáng và tối. */
export function toggleTheme() {
  const resolved = resolvedTheme();
  return setPreferences({ theme: resolved === "dark" ? "light" : "dark" });
}

/** Chủ đề đang thực sự hiển thị, đã tính cả "system". */
export function resolvedTheme() {
  if (prefs.theme !== "system") return prefs.theme;
  return mediaQuery?.matches ? "dark" : "light";
}

function apply() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.dataset.density = prefs.density;
  root.dataset.motion = prefs.motion;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolvedTheme() === "dark" ? "#0c1a16" : "#10312a");
}

/** Nghe thay đổi từ hệ điều hành khi đang ở chế độ "system". */
export function watchSystemTheme() {
  if (!mediaQuery) return;
  const handler = () => {
    if (prefs.theme === "system") {
      apply();
      emit(Events.SettingsChanged, { ...prefs });
    }
  };
  if (typeof mediaQuery.addEventListener === "function") mediaQuery.addEventListener("change", handler);
  else if (typeof mediaQuery.addListener === "function") mediaQuery.addListener(handler);
}
