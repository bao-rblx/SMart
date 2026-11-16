# SmartMart · Sáu gói việc cho sáu thành viên

Mỗi người một nhánh, một nhóm tệp riêng. **Không sửa tệp của người khác.**
Cần đổi tệp nằm ngoài phần mình thì nhắn nhóm trưởng.

- Nhánh gốc: `main`
- Đặt tên nhánh: `feature/member-<số>-<việc>`
- Chạy thử: `cd web && npm run dev` → <http://127.0.0.1:5173>
- Chạy kiểm thử: `cd web && npm test`

Hướng dẫn push chi tiết: [docs/GITHUB_GUIDE.md](docs/GITHUB_GUIDE.md).
Hướng dẫn riêng từng người: [docs/team/](docs/team/).

---

## Bảng tổng hợp

| # | Nhánh | Tệp sở hữu | Sản phẩm bàn giao |
|---|---|---|---|
| 1 | `feature/member-1-models` | `web/js/core/models.js`<br>`web/tests/models.test.mjs` | 4 lớp sản phẩm, 51 kiểm thử |
| 2 | `feature/member-2-sales` | `web/js/core/cart.js`<br>`web/js/core/transaction.js`<br>`web/tests/cart.test.mjs` | Giỏ hàng, hóa đơn, 36 kiểm thử |
| 3 | `feature/member-3-inventory` | `web/js/core/inventory.js`<br>`web/js/core/storage.js`<br>`web/js/core/seed.js`<br>`web/tests/inventory.test.mjs` | Kho, lưu trữ, dữ liệu mẫu, 43 kiểm thử |
| 4 | `feature/member-4-auth` | `web/js/core/users.js`<br>`web/js/core/auth.js`<br>`web/tests/auth.test.mjs` | Người dùng, PBKDF2, phân quyền, 47 kiểm thử |
| 5 | `feature/member-5-checkout` | `web/js/views/login.js`<br>`web/js/views/checkout.js`<br>`web/js/views/cart-panel.js`<br>`web/js/ui/product-card.js`<br>`web/css/{auth,catalog,cart,checkout}.css`<br>`web/tests/checkout-ui.test.mjs` | Đăng nhập, bán hàng, giỏ, thanh toán, 46 kiểm thử |
| 6 | `feature/member-6-dashboard` | `web/js/views/{inventory,reports,users}.js`<br>`web/js/ui/charts.js`<br>`web/css/{inventory,reports,users}.css`<br>`web/tests/reports.test.mjs` | Kho, doanh thu, nhân sự, biểu đồ, 65 kiểm thử |

Tổng: **288 kiểm thử**, tất cả xanh.

---

## Thành viên 1 · Lớp sản phẩm (trái tim của đồ án OOP)

**Nhánh:** `feature/member-1-models`

Đây là phần được chấm điểm nặng nhất. Bốn trụ cột OOP phải nhìn thấy rõ trong tệp
`web/js/core/models.js`.

Việc cần làm:

1. `class Product` trừu tượng — không cho `new Product()`.
2. Ba lớp con kế thừa: `PerishableProduct`, `ElectronicProduct`, `GeneralProduct`.
3. `applyDiscount()` đa hình: hàng tươi 30% khi còn ≤ 7 ngày (5% khi xa hơn), điện tử 10%,
   thông thường 5%.
4. `calculateTax()`: mặc định 10%, điện tử ghi đè 12%.
5. Đóng gói: trạng thái trong private field, chỉ đổi qua `restock()` / `trySell()`.
6. `toJSON()` / `fromJSON()` khôi phục đúng lớp con.
7. Kiểm thử phủ ba mức ưu đãi và các biên tồn kho.

Commit gợi ý:

```text
feat(models): lớp Product trừu tượng với đóng gói private field
test(models): phủ ba mức ưu đãi đa hình và biên tồn kho
```

---

## Thành viên 2 · Giỏ hàng, thanh toán, hóa đơn

**Nhánh:** `feature/member-2-sales`

Việc cần làm:

1. `CartLine` và `ShoppingCart` — quan hệ **kết hợp** (has-a), không phải kế thừa.
2. Thêm, sửa số lượng, xoá dòng, xoá giỏ. Không cho vượt tồn kho.
3. `checkout()` kiểm tra **toàn bộ** giỏ trước khi trừ bất kỳ dòng nào (tính nguyên tử).
4. `Transaction` / `SaleLine` lưu ảnh chụp giá tại thời điểm bán.
5. `generateInvoice()` — văn bản khổ 44 ký tự, có số tiền bằng chữ tiếng Việt.
6. Kiểm thử giỏ hỗn hợp, thanh toán nguyên tử, round-trip JSON, nội dung hóa đơn.

Commit gợi ý:

```text
feat(sales): ShoppingCart với kiểm tra tồn kho nguyên tử
feat(sales): Transaction lưu ảnh chụp giá và hóa đơn in được
test(sales): phủ giỏ hỗn hợp, thanh toán và hóa đơn
```

---

## Thành viên 3 · Kho hàng, lưu trữ, dữ liệu mẫu

**Nhánh:** `feature/member-3-inventory`

Việc cần làm:

1. `Inventory` bọc danh sách sản phẩm, đủ API tra cứu và thay đổi.
2. Cảnh báo: `lowStockAlerts`, `expiringSoon`, `expiredProducts`.
3. `storage.js` — **không bao giờ ném lỗi**; tự rơi về bộ nhớ khi trình duyệt chặn lưu trữ.
4. `seed.js` — nạp 72 mặt hàng từ `data/catalog.json`, cache để dùng ngoại tuyến.
5. Kiểm thử nghiệp vụ kho và các trường hợp dữ liệu hỏng.

Commit gợi ý:

```text
feat(inventory): Inventory bọc danh sách sản phẩm
feat(data): lưu trạng thái vào localStorage có dự phòng trong bộ nhớ
feat(data): nạp danh mục mẫu 72 mặt hàng
test(inventory): phủ nghiệp vụ kho và các trường hợp lưu trữ hỏng
```

---

## Thành viên 4 · Người dùng, xác thực, phân quyền

**Nhánh:** `feature/member-4-auth`

Việc cần làm:

1. `User` trừu tượng + `Cashier`, `Manager`, `Admin` kế thừa.
2. `allowedScreens()` đa hình — mỗi vai trò một bộ màn hình.
3. `hashPassword()` / `verifyPassword()`: PBKDF2-SHA256, 120.000 vòng, salt 16 byte,
   so sánh hằng thời gian. Chạy được cả trình duyệt và Node.
4. `AuthService`: đăng nhập, thêm, đổi vai trò, xoá; chặn xoá/hạ quyền quản trị viên cuối cùng.
5. Kiểm thử: salt khác nhau, mật khẩu thô không lưu, phân quyền, biên quản trị viên.

Commit gợi ý:

```text
feat(users): User trừu tượng với allowedScreens đa hình
feat(users): băm mật khẩu PBKDF2-SHA256 120.000 vòng
test(users): phủ đăng nhập, salt, phân quyền và biên quản trị viên
```

---

## Thành viên 5 · Đăng nhập và bán hàng

**Nhánh:** `feature/member-5-checkout`

Đây là mặt tiền của đồ án — giảng viên nhìn màn hình này suốt buổi bảo vệ.

Việc cần làm:

1. `renderLogin` — bố cục hai cột, nút hiện/ẩn mật khẩu, tài khoản dùng thử bấm-là-điền.
2. `createProductCard` — ảnh thật, huy hiệu giảm giá, trạng thái hết hàng/hết hạn.
3. `createCartPanel` — tăng giảm số lượng, tổng bốn dòng, hộp thoại thanh toán, phiếu in.
4. `renderCheckout` — tìm không dấu, chip lọc, sắp xếp, phân trang 12 món.
5. Bốn tệp CSS với tiền tố `lg-`, `ct-`, `ctp-`, `co-`; **không viết mã màu trực tiếp**.
6. Kiểm thử logic lọc, tổng tiền, trạng thái tồn kho.

**Lưu ý quan trọng:** giao diện **không được tự tính** mức giảm giá. Đọc
`product.discountPercent` — phép tính là việc của `applyDiscount()` đa hình. Nếu tự viết
`if (category === "Electronics")` là đã làm sai ý đồ đồ án.

Commit gợi ý:

```text
feat(ui): màn hình đăng nhập hai cột với tài khoản dùng thử
feat(ui): thẻ sản phẩm có ảnh thật và huy hiệu ưu đãi
feat(ui): giỏ hàng với tăng giảm số lượng và thanh toán
feat(ui): màn hình bán hàng có tìm kiếm, lọc và phân trang
test(ui): phủ logic lọc, tổng tiền và trạng thái của màn hình bán hàng
```

---

## Thành viên 6 · Kho hàng, doanh thu, nhân sự

**Nhánh:** `feature/member-6-dashboard`

Việc cần làm:

1. `charts.js` — biểu đồ cột, tròn và sparkline bằng **SVG thuần**, màu lấy từ biến CSS.
2. `renderInventory` — bảng có cảnh báo hổ phách (sắp hết) và đỏ san hô (hết hạn),
   thanh tồn kho, nhập/xuất kho, sửa giá, thêm và xoá mặt hàng.
3. `renderReports` — lọc thời gian, biểu đồ theo nhóm hàng, bảng hóa đơn xem lại được,
   xuất CSV **có BOM UTF-8** để Excel đọc đúng tiếng Việt.
4. `renderUsers` — danh sách tài khoản, thêm, đổi vai trò, xoá; chặn tự thao tác lên chính mình.
5. Ba tệp CSS tiền tố `iv-`, `rp-`, `us-`.
6. Kiểm thử tổng hợp doanh thu, khoảng thời gian, tạo CSV.

Commit gợi ý:

```text
feat(reports): biểu đồ cột, donut và sparkline bằng SVG thuần
feat(inventory): bảng kho có cảnh báo tồn thấp và hạn dùng
feat(reports): báo cáo doanh thu, lọc thời gian và xuất CSV
feat(users): quản lý nhân sự với chặn tự xoá tài khoản
test(reports): phủ tổng hợp doanh thu, khoảng thời gian và tạo CSV
```

---

## Thứ tự ghép bài

Ba người đầu làm tầng nghiệp vụ, ba người sau làm giao diện. Giao diện cần tầng nghiệp vụ,
nên ghép theo đúng thứ tự:

1. Thành viên 1 — lớp sản phẩm
2. Thành viên 2 — giỏ hàng và hóa đơn
3. Thành viên 3 — kho hàng và lưu trữ
4. Thành viên 4 — người dùng và xác thực
5. Thành viên 5 — đăng nhập và bán hàng
6. Thành viên 6 — kho, doanh thu, nhân sự

Sau **mỗi** lần ghép, nhóm trưởng chạy lại:

```powershell
cd web
npm test
```

---

## Danh sách kiểm tra trước khi nộp

**Nghiệp vụ**

- [x] Đăng nhập được bằng cả ba tài khoản admin, manager, cashier
- [x] Sai mật khẩu bị từ chối, không tiết lộ tên hay mật khẩu sai
- [x] Thu ngân chỉ thấy màn hình bán hàng
- [x] Ba loại sản phẩm cho ba mức ưu đãi khác nhau trên cùng một giá gốc
- [x] Hàng hết hạn không bán được
- [x] Không thể bán quá tồn kho
- [x] Thanh toán nguyên tử: một món thiếu hàng thì không món nào bị trừ kho

**Giao diện**

- [x] Tìm không dấu ra đúng mặt hàng
- [x] Giỏ hiện đủ tạm tính, tiết kiệm, thuế, tổng
- [x] Hóa đơn in được, có mã đơn, từng dòng, tổng, phương thức thanh toán
- [x] Kho tô màu cảnh báo tồn thấp và hạn dùng
- [x] Doanh thu lọc được hôm nay / 7 ngày / toàn bộ
- [x] Xuất CSV mở bằng Excel không lỗi dấu
- [x] Nhân sự chặn tự xoá và chặn xoá quản trị viên cuối cùng
- [x] Giao diện sáng/tối, responsive ở 1440 / 900 / 420px

**Kỹ thuật**

- [x] `npm test` xanh toàn bộ 288 kiểm thử
- [x] Không lỗi console trên mọi màn hình
- [x] Dữ liệu giữ nguyên sau khi tải lại trang
- [x] Mất mạng sau lần mở đầu vẫn dùng được
- [x] Không có mã màu viết trực tiếp trong CSS của thành viên
- [x] Không dùng thư viện ngoài, không dùng `innerHTML` cho dữ liệu người dùng
