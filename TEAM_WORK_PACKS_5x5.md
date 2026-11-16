# SmartMart · Kế hoạch 5 đợt push · 25 gói việc

> Chia toàn bộ đồ án thành **25 gói việc** (5 người × 5 đợt). Mỗi đợt là một vòng
> push lên GitHub: mỗi người mở **một** Pull Request, nhóm trưởng gộp xong mới sang đợt sau.
>
> **Chưa push gì cả.** Tài liệu này chỉ là kế hoạch.

---

## Thành viên

| # | Họ tên | Vai trò (theo proposal) | Mảng phụ trách |
|---|---|---|---|
| 1 | **Luu Gia Bao** | Team Lead · Architecture | Khung ứng dụng, hạ tầng, tích hợp, ghép nhánh |
| 2 | **Nguyen Dung** | OOP Engineer · Business Logic | Lớp sản phẩm, giỏ hàng, hóa đơn, người dùng, xác thực |
| 3 | **Tran Quang Minh** | UI Engineer · WinForms & UX | Toàn bộ giao diện: thư viện thành phần, 4 màn hình |
| 4 | **Nguyen Thanh Son** | Data Engineer · Database & Inventory | Kho hàng, lưu trữ, dữ liệu mẫu, tầng .NET |
| 5 | **Ninh Tan Phuc** | QA Lead · Testing & Documentation | Kiểm thử, tài liệu, công cụ kiểm tra giao diện |

> ⚠️ **Cần xác nhận:** proposal ghi thành viên 5 là **Vo On Gia Bao** (QA Lead).
> Danh sách bạn đưa ghi **Ninh Tan Phuc**. Tài liệu này dùng tên bạn đưa; nếu proposal
> đã nộp cho giảng viên thì phải thống nhất lại một tên trước khi bảo vệ.

---

## Nguyên tắc chia đợt

Thứ tự đợt **không phải** chia cho đẹp — nó theo đúng đồ thị phụ thuộc của mã nguồn.
Gói sau chỉ được import gói trước; không có vòng lặp.

```text
Đợt 1  Nền móng      constants · format · vietnamese · dom · icons · tokens   (không phụ thuộc gì)
Đợt 2  Nghiệp vụ lõi models · inventory · storage · toast · modal · router
Đợt 3  Xác thực      users · auth · seed · product-card · theme · shortcuts
Đợt 4  Bán hàng      cart · transaction · store · shell · login/checkout/cart-panel
Đợt 5  Báo cáo       inventory/reports/users views · charts · desktop App · kiểm thử còn lại
```

**Quy tắc vàng:** trong một đợt, không ai sửa tệp của người khác. Cần đổi tệp ngoài
phần mình thì nhắn nhóm trưởng, nhóm trưởng sửa trong đợt đó.

---

## Bảng tổng hợp 25 gói

| Đợt | Luu Gia Bao | Nguyen Dung | Tran Quang Minh | Nguyen Thanh Son | Ninh Tan Phuc |
|---|---|---|---|---|---|
| **1** | 1.1 Khung dự án | 1.2 Hằng số & định dạng | 1.3 Thư viện DOM | 1.4 Danh mục & ảnh | 1.5 Tài liệu & công cụ |
| **2** | 2.1 Sự kiện & điều hướng | 2.2 Lớp sản phẩm | 2.3 Toast & hộp thoại | 2.4 Kho & lưu trữ | 2.5 Kiểm thử lớp sản phẩm |
| **3** | 3.1 Giao diện & phím tắt | 3.2 Người dùng & PBKDF2 | 3.3 Thẻ sản phẩm | 3.4 Nạp dữ liệu mẫu | 3.5 Kiểm thử kho & xác thực |
| **4** | 4.1 Store & khung shell | 4.2 Giỏ hàng & hóa đơn | 4.3 Ba màn hình bán hàng | 4.4 Tầng .NET Core | 4.5 Kiểm thử bán hàng |
| **5** | 5.1 Tích hợp & hợp đồng | 5.2 Lớp nghiệp vụ .NET | 5.3 Ba màn hình quản trị | 5.4 Ứng dụng WinForms | 5.5 Kiểm thử báo cáo & gói việc |

Mỗi người **5 gói**, mỗi đợt **1 PR**. Tổng 25 PR.

---

# ĐỢT 1 · Nền móng

Không phụ thuộc gì. Sau đợt này `index.html` mở được nhưng chỉ hiện màn hình chờ.

### 1.1 · Luu Gia Bao — Khung dự án

**Nhánh:** `feature/1.1-project-shell`

| Tệp | Việc |
|---|---|
| `web/index.html` | Khung trang, nạp 14 tệp CSS, hai gốc `#toast-root` `#modal-root` |
| `web/package.json` | Script `dev` / `test`, không thư viện ngoài |
| `web/.npmrc` | Tắt lockfile |
| `web/css/tokens.css` | Biến thiết kế: màu, chữ, khoảng cách, bóng |
| `web/css/base.css` | Reset, kiểu chữ nền, tiện ích |
| `web/css/boot.css` | Màn hình chờ lúc khởi động |
| `web/tools/serve.mjs` | Máy chủ tĩnh, chặn truy cập ra ngoài `web/` |
| `.gitignore` | Bỏ `bin/` `obj/` `node_modules/` `*.db` `.screenshots/` |

**Xong khi:** `cd web && npm run dev` → 5173 trả 200, màn hình chờ hiện ra.

### 1.2 · Nguyen Dung — Hằng số và định dạng

**Nhánh:** `feature/1.2-constants-format`

| Tệp | Việc |
|---|---|
| `web/js/core/constants.js` | `SCREENS`, `UserRole`, `Category`, `ProductKind`, `PaymentMethod`, `NEAR_EXPIRY_DAYS` |
| `web/js/core/format.js` | `formatMoney` (125.000 ₫), `formatDate` (dd/MM/yyyy), `roundMoney`, `toNumber` |
| `web/js/core/vietnamese.js` | Bỏ dấu tiếng Việt, `matches`, `tokenize`, nhãn hiển thị |

Ba tệp này **không import gì** — mọi tệp khác đều import chúng.

**Xong khi:** `formatMoney(125000)` ra `"125.000 ₫"`; `normalize("Sữa tươi")` khớp `"sua tuoi"`.

### 1.3 · Tran Quang Minh — Thư viện DOM

**Nhánh:** `feature/1.3-dom-library`

| Tệp | Việc |
|---|---|
| `web/js/ui/dom.js` | `el()` dựng phần tử, `clear`, `focus`, `delegate`, `parseNumberInput`. **Không dùng `innerHTML` cho dữ liệu người dùng** |
| `web/js/ui/icons.js` | Bộ icon SVG nội tuyến, một chỗ duy nhất dùng `html:` |
| `web/css/components.css` | Nút, thẻ, bảng, badge, ô nhập, metric — thư viện thành phần dùng chung |

Đây là nền của **mọi** màn hình. Làm sai chỗ này thì 4 màn hình sau đều lệch.

**Xong khi:** `el("button", { class: "btn" }, "Lưu")` trả về `<button class="btn">Lưu</button>`.

### 1.4 · Nguyen Thanh Son — Danh mục và ảnh

**Nhánh:** `feature/1.4-catalog-assets`

| Tệp | Việc |
|---|---|
| `web/data/catalog.json` | **72 mặt hàng / 9 nhóm** (Thực phẩm 14, Đồ uống 16, Bánh kẹo 4, Rau củ 14, Sữa & bơ 11, Cá nhân 3, Gia dụng 4, Điện tử 5, Khác 1) |
| `web/assets/products/*.jpg` | 72 ảnh, đóng gói sẵn để dùng ngoại tuyến |
| `tools/prepare_catalog.py` | Sinh catalog từ dữ liệu thô |
| `tools/find_product_photos.py` | Tìm ảnh từ Open Food Facts / Wikimedia |

**Xong khi:** đếm `items.length === 72`, đúng 9 giá trị `category` khác nhau, 72 tệp .jpg khớp tên.

### 1.5 · Ninh Tan Phuc — Tài liệu và công cụ

**Nhánh:** `feature/1.5-docs-tooling`

| Tệp | Việc |
|---|---|
| `README.md` | Giới thiệu, cách chạy, tài khoản mẫu, tính năng, cấu trúc |
| `docs/GITHUB_GUIDE.md` | Hướng dẫn nhánh, commit, Pull Request, xử lý xung đột |
| `web/tools/debug-console.mjs` | Mở headless Edge, bắt lỗi console + lỗi mạng |

**Xong khi:** `node web/tools/debug-console.mjs` chạy và in ra `(không có)` lỗi.

---

# ĐỢT 2 · Nghiệp vụ lõi

### 2.1 · Luu Gia Bao — Sự kiện và điều hướng

**Nhánh:** `feature/2.1-events-router`

| Tệp | Việc |
|---|---|
| `web/js/app/events.js` | Bus sự kiện: `emit`, `on`, hằng `Events` |
| `web/js/app/router.js` | Điều hướng bằng biến trạng thái (không hash/History) để chạy được cả `file://` |
| `web/css/layout.css` | Khung rail + topbar + statusbar, responsive 1440/900/420px |

**Xong khi:** `navigate("Inventory")` đổi tuyến và phát `ScreenChanged`.

### 2.2 · Nguyen Dung — Lớp sản phẩm (trái tim đồ án)

**Nhánh:** `feature/2.2-product-models`

| Tệp | Việc |
|---|---|
| `web/js/core/models.js` | Bốn trụ cột OOP — xem bảng dưới |
| `web/js/core/catalog-query.js` | Lọc, sắp xếp, phân trang danh mục |

| Trụ cột | Thể hiện |
|---|---|
| Trừu tượng | `Product` không cho `new`; `applyDiscount()` / `displayInfo()` buộc lớp con ghi đè |
| Kế thừa | `PerishableProduct`, `ElectronicProduct`, `GeneralProduct` extends `Product` |
| Đa hình | Hàng tươi 30% (≤7 ngày) / 5%; điện tử 10%; thông thường 5%. Thuế 10%, điện tử 12% |
| Đóng gói | Private field `#id #name #unitPrice #stock`; chỉ đổi qua `restock()` / `trySell()` |

**Xong khi:** cùng một lời gọi `product.applyDiscount()` cho ba kết quả khác nhau.

### 2.3 · Tran Quang Minh — Toast và hộp thoại

**Nhánh:** `feature/2.3-overlays`

| Tệp | Việc |
|---|---|
| `web/js/ui/toast.js` | Thông báo nổi: thành công, lỗi, cảnh báo, tự tắt |
| `web/js/ui/modal.js` | `openModal`, `confirmDialog`, `promptDialog`, xếp chồng, Esc đóng |
| `web/css/overlays.css` | Nền mờ, tấm hộp thoại, hiệu ứng vào ra |

**Xong khi:** mở hai hộp thoại chồng nhau, Esc chỉ đóng cái trên cùng.

### 2.4 · Nguyen Thanh Son — Kho và lưu trữ

**Nhánh:** `feature/2.4-inventory-storage`

| Tệp | Việc |
|---|---|
| `web/js/core/inventory.js` | `add` / `remove` / `restock` / `withdraw` / `setPrice`, **chốt quyền theo `actor`** |
| `web/js/core/storage.js` | localStorage, **không bao giờ ném** — hỏng thì rơi về bộ nhớ |

`inventory.js` kiểm tra quyền **trước** mọi kiểm tra khác, để tài khoản không có quyền
không dò được kho qua nội dung thông báo lỗi.

**Xong khi:** `restock(id, qty, cashier)` ném lỗi quyền; `restock(id, qty, manager)` chạy.

### 2.5 · Ninh Tan Phuc — Kiểm thử lớp sản phẩm

**Nhánh:** `feature/2.5-test-models`

| Tệp | Việc |
|---|---|
| `web/tests/models.test.mjs` | **51 kiểm thử**: ba mức ưu đãi, biên tồn kho, round-trip JSON |
| `web/tools/screenshot.mjs` | Chụp ảnh một màn hình qua DevTools |

**Xong khi:** `npm test` xanh 51 kiểm thử của riêng tệp này.

---

# ĐỢT 3 · Xác thực và dữ liệu mẫu

### 3.1 · Luu Gia Bao — Giao diện, phím tắt, cài đặt

**Nhánh:** `feature/3.1-theme-shortcuts`

| Tệp | Việc |
|---|---|
| `web/js/app/theme.js` | Sáng / tối / theo máy, mật độ, giảm chuyển động |
| `web/js/app/shortcuts.js` | Đăng ký phím tắt, bảng tra cứu |
| `web/js/app/settings.js` | Hộp thoại cài đặt, đặt lại dữ liệu mẫu |
| `web/css/app-extras.css` | Bổ sung giao diện |

> 🐞 **Lỗi đã biết cần sửa trong gói này:** `shortcuts.js:44` viết
> `if (event.shiftKey && event.key.length > 1) parts.push("shift")`.
> `"L"` dài 1 ký tự nên `shift` không bao giờ được thêm → `Ctrl+Shift+L` không chạy.
> Sửa thành kiểm tra theo ký tự chữ cái thay vì độ dài, và thêm kiểm thử.

**Xong khi:** `Ctrl+Shift+L` đổi được sáng/tối; `Ctrl+K`, `F9`, `?` vẫn chạy.

### 3.2 · Nguyen Dung — Người dùng và xác thực

**Nhánh:** `feature/3.2-auth`

| Tệp | Việc |
|---|---|
| `web/js/core/users.js` | `User` trừu tượng + `Cashier` / `Manager` / `Admin`; `allowedScreens()` đa hình |
| `web/js/core/auth.js` | PBKDF2-SHA256, 120.000 vòng, salt 16 byte; `addUser` / `changeRole` / `removeUser` **có `actor`** |

Chặn xoá và hạ quyền **quản trị viên cuối cùng** — nếu không sẽ khoá cứng cả cửa hàng.

**Xong khi:** `admin` → 4 màn hình, `manager` → 3, `cashier` → 1.

### 3.3 · Tran Quang Minh — Thẻ sản phẩm

**Nhánh:** `feature/3.3-product-card`

| Tệp | Việc |
|---|---|
| `web/js/ui/product-card.js` | Thẻ sản phẩm: ảnh, huy hiệu ưu đãi, giá gốc gạch ngang, nút thêm, số lượng |
| `web/css/catalog.css` | Lưới danh mục, chip lọc |
| `web/css/auth.css` | Màn hình đăng nhập hai cột |

**Xong khi:** thẻ hiện đúng `−30%` / `−10%` / `−5%` theo lớp sản phẩm.

### 3.4 · Nguyen Thanh Son — Nạp dữ liệu mẫu

**Nhánh:** `feature/3.4-seed`

| Tệp | Việc |
|---|---|
| `web/js/core/seed.js` | `loadCatalog`, `seedProducts`, `seedUsersAsync`, cache ngoại tuyến |
| `SmartMart.Core/CatalogSeed.cs` | Bản .NET của cùng bộ dữ liệu |
| `SmartMart.Core/catalog.json` | Danh mục cho bản desktop |

**Xong khi:** lần mở đầu nạp đủ 72 mặt hàng + 3 tài khoản; lần sau đọc từ cache.

### 3.5 · Ninh Tan Phuc — Kiểm thử kho và xác thực

**Nhánh:** `feature/3.5-test-auth-inventory`

| Tệp | Việc |
|---|---|
| `web/tests/auth.test.mjs` | **47 kiểm thử**: salt khác nhau, không lưu mật khẩu thô, phân quyền |
| `web/tests/inventory.test.mjs` | **43 kiểm thử**: nghiệp vụ kho, chốt quyền, dữ liệu hỏng |
| `web/tools/ui-tour.mjs` | Đăng nhập rồi chụp ảnh từng màn hình |

**Xong khi:** `npm test` xanh 90 kiểm thử của hai tệp này.

---

# ĐỢT 4 · Bán hàng

### 4.1 · Luu Gia Bao — Store và khung ứng dụng

**Nhánh:** `feature/4.1-store-shell`

| Tệp | Việc |
|---|---|
| `web/js/app/store.js` | Một nơi giữ trạng thái; mọi thay đổi đi qua đây, **truyền `currentUser` xuống tầng kho** |
| `web/js/app/shell.js` | Rail điều hướng theo quyền, topbar, statusbar |

Điểm khó: `Product` bất biến nên đổi giá tạo **instance mới**; giỏ phải tra lại theo id
trước khi thanh toán, nếu không sẽ trừ kho trên bản sao.

**Xong khi:** đổi giá xong, dòng trong giỏ vẫn trừ đúng kho thật.

### 4.2 · Nguyen Dung — Giỏ hàng và hóa đơn

**Nhánh:** `feature/4.2-cart-transaction`

| Tệp | Việc |
|---|---|
| `web/js/core/cart.js` | `CartLine`, `ShoppingCart` (has-a), `checkout()` **nguyên tử** |
| `web/js/core/transaction.js` | `Transaction`, `SaleLine`, `generateInvoice()` khổ 44 ký tự |

Thanh toán phải kiểm **toàn bộ** giỏ trước khi trừ bất kỳ dòng nào — một món thiếu hàng
thì không món nào bị trừ.

**Xong khi:** giỏ có một món vượt tồn kho thì `checkout()` ném lỗi và kho không đổi.

### 4.3 · Tran Quang Minh — Ba màn hình bán hàng

**Nhánh:** `feature/4.3-checkout-views`

| Tệp | Việc |
|---|---|
| `web/js/views/login.js` | Đăng nhập hai cột, bấm dòng tài khoản mẫu để tự điền |
| `web/js/views/checkout.js` | Lưới sản phẩm, tìm không dấu, chip lọc, phân trang 12 |
| `web/js/views/cart-panel.js` | Giỏ: tăng giảm, xoá, tạm tính → tiết kiệm → thuế → tổng |
| `web/css/checkout.css` | Bố cục hai cột |
| `web/css/cart.css` | Bảng giỏ hàng |

**Xong khi:** bấm thẻ → giỏ tăng; F9 mở hộp thoại thanh toán; xác nhận ra phiếu in.

### 4.4 · Nguyen Thanh Son — Tầng .NET Core

**Nhánh:** `feature/4.4-dotnet-core`

| Tệp | Việc |
|---|---|
| `SmartMart.Core/StoreSession.cs` | Phiên cửa hàng, SQLite + dự phòng bộ nhớ, phân quyền |
| `SmartMart.Core/CatalogQuery.cs` | Lọc/sắp xếp bản .NET |
| `SmartMart.Core/Vietnamese.cs` | Bỏ dấu bản .NET |

**Xong khi:** `%LOCALAPPDATA%/SmartMart/smartmart.db` được tạo; DB hỏng thì vẫn chạy bằng bộ nhớ.

### 4.5 · Ninh Tan Phuc — Kiểm thử bán hàng

**Nhánh:** `feature/4.5-test-sales`

| Tệp | Việc |
|---|---|
| `web/tests/cart.test.mjs` | **36 kiểm thử**: giỏ hỗn hợp, thanh toán nguyên tử, hóa đơn |
| `web/tests/checkout-ui.test.mjs` | **46 kiểm thử**: lọc, tổng tiền, trạng thái màn hình bán hàng |

**Xong khi:** `npm test` xanh 82 kiểm thử của hai tệp này.

---

# ĐỢT 5 · Quản trị, báo cáo và đóng gói

### 5.1 · Luu Gia Bao — Tích hợp và hợp đồng

**Nhánh:** `feature/5.1-integration`

| Tệp | Việc |
|---|---|
| `web/js/main.js` | Điểm khởi động, nối store ↔ shell ↔ router, phím tắt toàn cục |
| `SmartMart.sln` | Giải pháp .NET 8 gồm ba dự án |
| `SmartMart.Core/SmartMart.Core.csproj` | Thư viện nghiệp vụ, **không** tham chiếu WinForms |
| `SmartMart.App/SmartMart.App.csproj` | Ứng dụng WinForms `net8.0-windows` |
| `SmartMart.Tests/SmartMart.Tests.csproj` | xUnit, `Microsoft.Data.Sqlite` |
| `web/CONTRACTS.md` | Hợp đồng API giữa các phần |

> ⚠️ **CONTRACTS.md đang lệch mã nguồn** — phải sửa trong gói này:
> - dòng 261-265, 316-318: thiếu tham số `actor` (nay bắt buộc)
> - dòng 284: `seedUsers()` thật ra trả `[]`; bản dùng được là `seedUsersAsync()`
> - dòng 87, 93-94: JSON dùng `key`/`serial`, không phải `catalogKey`/`serialNumber`
> - dòng 324: dùng `pbkdf2` bất đồng bộ, không phải `pbkdf2Sync`
> - dòng 343: `context.modal` không tồn tại

**Xong khi:** mở app, đăng nhập, đi đủ 4 màn hình, không lỗi console.

### 5.2 · Nguyen Dung — Lớp nghiệp vụ .NET

**Nhánh:** `feature/5.2-dotnet-domain`

| Tệp | Việc |
|---|---|
| `SmartMart.Core/Domain.cs` | `Product` trừu tượng + 3 lớp con, `User` + 3 vai trò, `Inventory`, `ShoppingCart`, `Transaction`, `PaymentDetails` |

Cùng bốn trụ cột OOP như bản web nhưng viết bằng C#, để bảo vệ trước giảng viên.

**Xong khi:** `dotnet build` sạch; ba mức ưu đãi đa hình chạy đúng.

### 5.3 · Tran Quang Minh — Ba màn hình quản trị

**Nhánh:** `feature/5.3-admin-views`

| Tệp | Việc |
|---|---|
| `web/js/views/inventory.js` | Bảng kho, cảnh báo tồn thấp (hổ phách) và hết hạn (san hô), CRUD |
| `web/js/views/reports.js` | Lọc hôm nay / 7 ngày / toàn bộ, biểu đồ, xuất CSV có BOM |
| `web/js/views/users.js` | Danh sách nhân sự, thêm/đổi vai trò/xoá, chặn tự xoá |
| `web/js/ui/charts.js` | Biểu đồ cột, tròn, sparkline bằng SVG thuần |
| `web/css/inventory.css` | Bố cục bảng kho, thanh tồn, tô màu cảnh báo |
| `web/css/reports.css` | Bố cục báo cáo, thẻ số liệu, bảng hóa đơn |
| `web/css/users.css` | Bố cục bảng nhân sự, badge vai trò |

> 📌 `README.md:58` đang ghi **ngược** màu cảnh báo. Thực tế: hổ phách = tồn thấp **hoặc**
> cận hạn; san hô = hết hàng **hoặc** hết hạn. Sửa README cho khớp `inventory.js:55-60`.

**Xong khi:** bán một đơn rồi xem lại được hóa đơn ở màn hình doanh thu.

### 5.4 · Nguyen Thanh Son — Ứng dụng WinForms

**Nhánh:** `feature/5.4-winforms-app`

| Tệp | Việc |
|---|---|
| `SmartMart.App/Program.cs` | Điểm vào, xử lý lỗi toàn cục |
| `SmartMart.App/LoginForm.cs` | Đăng nhập, điều hướng theo vai trò |
| `SmartMart.App/MainForm.cs` | Khung chính, thanh trạng thái |
| `SmartMart.App/CheckoutView.cs` | Màn hình bán hàng |
| `SmartMart.App/ManagementViews.cs` | Kho, doanh thu, nhân sự |
| `SmartMart.App/Design.cs` | Bảng màu, phông, nút, lưới dùng chung |
| `SmartMart.App/Dialogs.cs` | Hộp thoại nhập số, sản phẩm, thành viên |
| `SmartMart.App/ProductImages.cs` | Nạp ảnh sản phẩm |
| `SmartMart.App/Assets/Products/*` | 72 ảnh + `credits.txt` + `sources.json` |

> 🐞 **Ba lỗi tiềm ẩn cần xử lý trong gói này:**
> 1. `TryAction` chỉ bắt `InvalidOperation`/`Argument`/`Overflow` — **không bắt**
>    `UnauthorizedAccessException`, và `Program.cs` không có bộ xử lý toàn cục.
> 2. `ChangeRole` và `RemoveUser` không nằm trong `TryAction` (khác `AddUser`).
> 3. Luật "còn ít nhất một quản trị viên" chỉ có ở giao diện, tầng Core không chặn →
>    xoá hết quản trị viên là khoá cứng vĩnh viễn.

**Xong khi:** `dotnet run --project SmartMart.App` mở cửa sổ, đăng nhập được cả ba vai trò.

### 5.5 · Ninh Tan Phuc — Kiểm thử báo cáo và đóng gói

**Nhánh:** `feature/5.5-test-reports-packaging`

| Tệp | Việc |
|---|---|
| `web/tests/reports.test.mjs` | **65 kiểm thử**: tổng hợp doanh thu, khoảng thời gian, CSV, biểu đồ |
| `SmartMart.Tests/CatalogTests.cs` | 4 kiểm thử danh mục |
| `SmartMart.Tests/CommerceTests.cs` | 13 kiểm thử bán hàng + phân quyền |
| `SmartMart.Tests/LocalizationTests.cs` | 4 kiểm thử tiếng Việt |
| `TEAM_WORK_PACKS.md` | Thay bằng kế hoạch 25 gói này (`TEAM_WORK_PACKS_5x5.md`) |
| **Xoá** `docs/team/member-1-models.md`, `member-2-sales.md`, `member-3-inventory.md`, `member-4-auth.md`, `member-5-checkout.md`, `member-6-dashboard.md` | Sáu tệp của bản chia 6 người, không còn đúng |
| **Viết mới** `docs/team/member-1-lead.md` … `member-5-qa.md` | Năm tệp khớp tên và mảng việc mới |

> ⚠️ Repo đang có **sáu** tệp `docs/team/member-1..6` và sáu nhánh `feature/member-1..6`
> từ bản chia 6 người. Phải dọn về 5 cho khớp proposal.

**Xong khi:** `npm test` **288/288 xanh**; `dotnet test` **25/25 xanh**.

---

## Cách chạy một đợt

1. Mỗi người tạo nhánh từ `main`: `git switch main && git pull && git switch -c feature/<số>.<đợt>-<việc>`
2. Làm đúng tệp trong gói của mình. **Không sửa tệp người khác.**
3. Tự chạy kiểm thử trước khi push: `cd web && npm test`
4. Push nhánh, mở Pull Request vào `main`, ghi rõ số gói.
5. Nhóm trưởng review, gộp. **Gộp đủ 5 PR mới sang đợt sau.**
6. Nhóm trưởng chạy lại toàn bộ kiểm thử trên `main` sau khi gộp.

## Kiểm tra sau mỗi đợt

| Đợt | Lệnh kiểm tra | Kỳ vọng |
|---|---|---|
| 1 | `cd web && npm run dev` | 5173 trả 200, hiện màn hình chờ |
| 2 | `npm test` | 51 kiểm thử xanh |
| 3 | `npm test` | 141 kiểm thử xanh |
| 4 | `npm test` | 223 kiểm thử xanh |
| 5 | `npm test` + `dotnet test` | 288/288 và 25/25 xanh |

---

## Bảng đối chiếu tên

| Tài liệu cũ (6 người) | Kế hoạch mới (5 người) |
|---|---|
| member-1-models | Nguyen Dung — gói 2.2 |
| member-2-sales | Nguyen Dung — gói 4.2 |
| member-3-inventory | Nguyen Thanh Son — gói 2.4 |
| member-4-auth | Nguyen Dung — gói 3.2 |
| member-5-checkout | Tran Quang Minh — gói 4.3 |
| member-6-dashboard | Tran Quang Minh — gói 5.3 |
| *(chưa có)* | Luu Gia Bao — gói 1.1, 2.1, 3.1, 4.1, 5.1 |
| *(chưa có)* | Ninh Tan Phuc — gói 1.5, 2.5, 3.5, 4.5, 5.5 |
