# SmartMart — Gọn việc bán. Trọn niềm vui.

Ứng dụng quản lý bán lẻ **SmartMart**, gồm hai bản:

| Bản | Công nghệ | Vị trí |
|---|---|---|
| **Web** (bản chính) | HTML + CSS + JavaScript thuần, không cần build | [`web/`](web/) |
| Desktop | C# .NET 8 WinForms | [`SmartMart.App/`](SmartMart.App/) |

Bản web là giao diện hiện đại, chạy trực tiếp trong trình duyệt, không cần cài đặt và dùng được
ngoại tuyến. Bản desktop là bài nộp gốc của đồ án môn Lập trình hướng đối tượng.

---

## Chạy bản web

```powershell
cd web
npm run dev
```

Mở <http://127.0.0.1:5173>. Không cần `npm install` — dự án không dùng thư viện ngoài.

Yêu cầu: Node.js 18 trở lên (chỉ để chạy máy chủ tĩnh và kiểm thử).

Có thể mở thẳng `web/index.html` bằng trình duyệt, nhưng nên dùng `npm run dev` để tránh giới hạn
bảo mật của giao thức `file://`.

### Tài khoản dùng thử

| Vai trò | Tên đăng nhập | Mật khẩu | Vào được |
|---|---|---|---|
| Quản trị viên | `admin` | `admin` | Cả bốn màn hình |
| Quản lý | `manager` | `manager` | Bán hàng, Kho hàng, Doanh thu |
| Thu ngân | `cashier` | `cashier` | Bán hàng |

Bấm vào dòng tài khoản ngay trên màn hình đăng nhập để tự điền.

---

## Tính năng

### Bán hàng

- **Danh mục 72 mặt hàng** thuộc 9 nhóm, ảnh thật đóng gói sẵn trong ứng dụng, dùng được ngoại tuyến.
- **Tìm kiếm không dấu**: gõ `sua tuoi`, `ca phe`, `khong day` vẫn ra đúng mặt hàng. Tìm được theo
  tên, mã hàng hoặc mã vạch.
- **Lọc và sắp xếp**: chip lọc theo nhóm hàng kèm số lượng, sắp xếp theo tên hoặc giá, chỉ hiện hàng
  còn bán, phân trang 12 mặt hàng.
- **Giỏ hàng**: tăng giảm số lượng, xoá từng dòng hoặc xoá hết, hiện tạm tính → tiết kiệm → thuế →
  tổng cộng.
- **Thanh toán**: chọn tiền mặt, thẻ ngân hàng hoặc ví điện tử; phiếu in hiện ngay, lưu được ra
  tệp `.txt` hoặc in trực tiếp.
- **Phím tắt**: `Ctrl+K` mở ô tìm kiếm, `F9` thanh toán, `?` xem danh sách phím tắt.

### Kho hàng

- Bảng sản phẩm có **cảnh báo tồn thấp** (hổ phách) và **sắp hết hạn** (đỏ san hô).
- Thanh tồn kho trực quan hoá số lượng còn lại.
- Nhập kho, xuất kho, sửa giá bán, thêm mặt hàng mới, xoá mặt hàng.
- Thẻ số liệu: số mặt hàng, sắp hết hàng, cảnh báo hạn dùng, giá trị tồn kho.

### Doanh thu

- Lọc **hôm nay / 7 ngày qua / toàn bộ**.
- Biểu đồ cột doanh thu theo nhóm hàng, biểu đồ tròn cơ cấu doanh thu, sparkline xu hướng 7 ngày.
- Bảng hóa đơn: xem lại phiếu in của từng đơn.
- **Xuất CSV** có BOM UTF-8 để Excel đọc đúng tiếng Việt.

### Nhân sự

- Danh sách tài khoản kèm vai trò và quyền truy cập từng màn hình.
- Thêm nhân sự, đổi vai trò, xoá tài khoản.
- Không thể xoá hoặc đổi vai trò của chính mình; không thể xoá quản trị viên cuối cùng.

### Giao diện

- **Sáng / tối** theo lựa chọn hoặc theo thiết lập hệ điều hành.
- **Mật độ hiển thị** thoáng hoặc gọn.
- **Giảm chuyển động** cho người thấy mỏi mắt.
- Bố cục responsive: dùng tốt ở 1440px, 900px và 420px.

---

## Kiểm thử

```powershell
cd web
npm test
```

**288 trường hợp kiểm thử**, phủ: ba mức ưu đãi đa hình của ba lớp sản phẩm, biên tồn kho, giỏ hàng
hỗn hợp, thanh toán nguyên tử, hóa đơn, băm mật khẩu PBKDF2, phân quyền, lưu trữ hỏng, cảnh báo kho,
tổng hợp doanh thu và xuất CSV.

Kiểm tra giao diện bằng trình duyệt thật (không cần mở trình duyệt bằng tay):

```powershell
npm run dev                     # cửa sổ 1
node tools/ui-tour.mjs          # cửa sổ 2 — chụp ảnh từng màn hình
```

---

## Cấu trúc dự án

```text
SmartMart/
├─ web/                     Bản web (bản chính)
│  ├─ index.html
│  ├─ css/                  tokens · base · layout · components · overlays
│  ├─ js/
│  │  ├─ core/              nghiệp vụ thuần, không phụ thuộc DOM
│  │  ├─ ui/                tiện ích giao diện dùng chung
│  │  ├─ views/             từng màn hình
│  │  ├─ app/               khung ứng dụng, trạng thái, điều hướng
│  │  └─ main.js
│  ├─ data/catalog.json     72 mặt hàng mẫu
│  ├─ assets/products/      ảnh sản phẩm
│  ├─ tests/                288 kiểm thử
│  ├─ tools/                máy chủ phát triển, công cụ chụp ảnh
│  └─ CONTRACTS.md          hợp đồng API giữa các phần
├─ SmartMart.Core/          Nghiệp vụ .NET (bản desktop)
├─ SmartMart.App/           WinForms (bản desktop)
├─ SmartMart.Tests/         xUnit (bản desktop)
└─ docs/
   ├─ GITHUB_GUIDE.md       Hướng dẫn đưa lên GitHub
   └─ team/                 Hướng dẫn riêng từng thành viên
```

---

## Chia việc nhóm

Dự án chia cho 6 thành viên, mỗi người một nhánh và một nhóm tệp riêng:

| Thành viên | Nhánh | Phụ trách |
|---|---|---|
| 1 | `feature/member-1-models` | Lớp sản phẩm (kế thừa, đa hình, đóng gói) |
| 2 | `feature/member-2-sales` | Giỏ hàng, thanh toán, hóa đơn |
| 3 | `feature/member-3-inventory` | Kho hàng, lưu trữ, dữ liệu mẫu |
| 4 | `feature/member-4-auth` | Người dùng, xác thực, phân quyền |
| 5 | `feature/member-5-checkout` | Màn hình đăng nhập và bán hàng |
| 6 | `feature/member-6-dashboard` | Kho, doanh thu, nhân sự, biểu đồ |

Xem [GITHUB_GUIDE.md](docs/GITHUB_GUIDE.md) để biết cách push và mở Pull Request, và
[docs/team/](docs/team/) để xem hướng dẫn riêng của từng người.

---

## Bốn trụ cột OOP trong mã nguồn

Đồ án môn Lập trình hướng đối tượng nên bốn trụ cột được thể hiện rõ ở
[`web/js/core/models.js`](web/js/core/models.js):

| Trụ cột | Nơi thể hiện |
|---|---|
| **Trừu tượng** | `Product` không khởi tạo trực tiếp; `applyDiscount()` và `displayInfo()` buộc lớp con ghi đè |
| **Kế thừa** | `PerishableProduct`, `ElectronicProduct`, `GeneralProduct` kế thừa `Product` |
| **Đa hình** | Cùng `applyDiscount()`, ba mức giảm khác nhau: hàng tươi 30%/5% theo hạn, điện tử 10%, thông thường 5% |
| **Đóng gói** | Trạng thái trong private field; đổi tồn kho chỉ qua `restock()` / `trySell()` |

---

## Dữ liệu và quyền riêng tư

Dữ liệu lưu trong `localStorage` của trình duyệt, **không gửi lên máy chủ nào**. Xoá dữ liệu trình
duyệt sẽ xoá luôn dữ liệu cửa hàng — vào **Cài đặt** để nạp lại dữ liệu mẫu.

Mật khẩu được băm bằng PBKDF2-SHA256 với 120.000 vòng lặp và salt ngẫu nhiên cho từng tài khoản.
Mật khẩu thô không bao giờ được lưu lại.

Giá hiển thị bằng Việt Nam đồng, ví dụ `125.000 ₫`, không có phần lẻ. Ngày dùng `dd/MM/yyyy`,
giờ dùng định dạng 24 giờ.

Thanh toán chỉ **ghi nhận** tiền mặt, thẻ ngân hàng hoặc ví điện tử; ứng dụng không kết nối cổng
thu tiền. Thuế suất là chính sách minh hoạ của đồ án.

---

## Bản desktop (WinForms)

```powershell
dotnet run --project SmartMart.App
```

Hoặc mở `SmartMart.sln` trong Visual Studio 2022, chọn `SmartMart.App` làm dự án khởi động.

```powershell
dotnet build SmartMart.sln -c Release
dotnet test SmartMart.Tests/SmartMart.Tests.csproj -c Release
```

Bản desktop dùng SQLite tại `%LOCALAPPDATA%/SmartMart/smartmart.db`, có dự phòng bằng dữ liệu
trong bộ nhớ nếu không mở được cơ sở dữ liệu.

---

## Ảnh và danh mục mẫu

Ảnh lấy từ Open Food Facts và Wikimedia Commons, đóng gói cùng ứng dụng. Thông tin tác giả, đường
dẫn và giấy phép từng ảnh nằm tại [`web/assets/products/credits.txt`](web/assets/products/credits.txt)
và [`sources.json`](web/assets/products/sources.json); bản desktop xem trong màn hình bán hàng qua
nút **Nguồn ảnh**.

Giá, tồn kho và hạn dùng là dữ liệu minh hoạ cho đồ án, không phải giá bán thực tế.
