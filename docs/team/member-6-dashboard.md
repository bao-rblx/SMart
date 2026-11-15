# Thành viên 6 · Kho hàng, doanh thu, nhân sự

**Nhánh:** `feature/member-6-dashboard`
**File bạn sở hữu:** `web/js/views/inventory.js`, `web/js/views/reports.js`, `web/js/views/users.js`, `web/js/ui/charts.js`, `web/css/inventory.css`, `web/css/reports.css`, `web/css/users.css`, `web/tests/reports.test.mjs`

---

## Phần của bạn trong đồ án

Bạn làm **ba màn hình quản trị** — phần chứng minh ứng dụng không chỉ là máy tính tiền mà là một
hệ thống quản lý thật.

| Màn hình | Chứng minh điều gì |
|---|---|
| Kho hàng | Cảnh báo tồn thấp và hạn dùng — yêu cầu bắt buộc của đề bài |
| Doanh thu | Báo cáo, biểu đồ, xuất dữ liệu — phần "quản lý" của đồ án |
| Nhân sự | Phân quyền theo vai trò — phần "hệ thống" của đồ án |

---

## Màn hình kho: hai cảnh báo là yêu cầu bắt buộc

Đề bài ghi rõ: *"manager dashboard for adding/removing stock, and low-inventory alerts"*. Bạn phải
làm nổi bật **hai** loại cảnh báo bằng **hai màu khác nhau**:

```html
<tr data-state="amber">   <!-- sắp hết hàng HOẶC sắp hết hạn -->
<tr data-state="coral">   <!-- đã hết hàng HOẶC đã hết hạn -->
```

CSS đã có sẵn trong `components.css` (lớp `.table--row-alert`), bạn chỉ cần gắn đúng `data-state`.
Đừng viết mã màu mới — dùng `var(--amber-100)` và `var(--coral-100)`.

---

## Biểu đồ bằng SVG thuần

Không có Chart.js, không có thư viện nào. Tự vẽ SVG:

```js
// Biểu đồ cột dọc: mỗi cột là một <rect>, nhãn là <text>
const height = (value / max) * chartHeight;
el("svg:rect", { x, y: chartHeight - height, width, height, rx: 4, fill: "var(--brand-500)" });
```

Ưu điểm khi bảo vệ: bạn giải thích được **từng dòng**, không phải "thư viện nó tự vẽ".
Thêm `<title>` trong mỗi `<rect>` để có tooltip và trình đọc màn hình đọc được.

---

## CSV cho Excel Việt Nam: phải có BOM

Đây là lỗi kinh điển. Excel không nhận UTF-8 nếu thiếu BOM, và tiếng Việt sẽ thành `S?a t??i`:

```js
const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
```

Thêm nữa, phải thoát đúng chuẩn CSV:

```js
function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
```

---

## Ba quy tắc phân quyền ở màn hình Nhân sự

1. **Không xoá chính mình** — so sánh với `context.state.currentUser.username`
2. **Không đổi vai trò chính mình** — cùng lý do (sẽ tự khoá mình ra ngoài)
3. **Không xoá quản trị viên cuối cùng** — `AuthService` đã chặn, bạn chỉ cần hiện đúng thông báo lỗi
   mà nó trả về

Khi bị chặn, hiện `toast.info()` giải thích **vì sao**, đừng chỉ disable nút im lặng.

---

## Quy trình push

```powershell
git checkout main
git pull
git checkout -b feature/member-6-dashboard

cd web
npm test
cd ..

git add web/js/ui/charts.js web/css/reports.css
git commit -m "feat(reports): biểu đồ cột, donut và sparkline bằng SVG thuần"

git add web/js/views/inventory.js web/css/inventory.css
git commit -m "feat(inventory): bảng kho có cảnh báo tồn thấp và hạn dùng"

git add web/js/views/reports.js
git commit -m "feat(reports): báo cáo doanh thu, lọc thời gian và xuất CSV"

git add web/js/views/users.js web/css/users.css
git commit -m "feat(users): quản lý nhân sự với chặn tự xoá tài khoản"

git add web/tests/reports.test.mjs
git commit -m "test(reports): phủ tổng hợp doanh thu và tạo CSV"

git push -u origin feature/member-6-dashboard
```

---

## Điều phải nhớ khi bảo vệ

**"Biểu đồ vẽ bằng gì?"**
→ SVG tự sinh bằng JavaScript, mỗi cột là một thẻ `<rect>`. Không dùng thư viện nào nên nhẹ và
giải thích được từng phần.

**"Vì sao file CSV phải có BOM?"**
→ Excel đọc file theo bảng mã hệ thống nếu không thấy BOM, và tiếng Việt sẽ bị lỗi dấu. Ba byte BOM
báo cho Excel biết đây là UTF-8.

**"Làm sao chặn xoá quản trị viên cuối cùng?"**
→ Kiểm tra ở tầng `AuthService` (Thành viên 4), không phải ở giao diện. Giao diện chỉ hiện thông báo.
Đây là nguyên tắc: **quy tắc nghiệp vụ nằm ở tầng core, giao diện chỉ hiển thị**.

**"Cảnh báo hạn dùng tính thế nào?"**
→ `PerishableProduct.isNearExpiry` — hàng tươi còn từ 0 đến 7 ngày. Giao diện chỉ đọc getter đó.

---

## Nếu bị chặn

- `transaction.js` chưa có → màn hình doanh thu cần `generateInvoice`; nếu thiếu, tạm hiện mã đơn
- Dữ liệu trống lúc test → dùng mảng hóa đơn giả trong file test
