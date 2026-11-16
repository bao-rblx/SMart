# Thành viên 1 · Lớp sản phẩm (OOP Core)

**Nhánh:** `feature/member-1-models`
**File bạn sở hữu:** `web/js/core/models.js`, `web/tests/models.test.mjs`

---

## Phần của bạn trong đồ án

Bạn giữ **trái tim của đồ án OOP**. Giảng viên chấm điểm dựa trên bốn trụ cột, và bốn trụ cột đó
nằm gần như trọn vẹn trong file `models.js`:

| Trụ cột | Nằm ở đâu trong `models.js` |
|---|---|
| **Trừu tượng** (Abstraction) | `class Product` không thể khởi tạo trực tiếp; `applyDiscount()` và `displayInfo()` là phương thức buộc lớp con ghi đè |
| **Kế thừa** (Inheritance) | `PerishableProduct`, `ElectronicProduct`, `GeneralProduct` đều `extends Product` |
| **Đa hình** (Polymorphism) | Cùng một lời gọi `product.applyDiscount()` cho ra ba mức giảm khác nhau tuỳ lớp thật của đối tượng |
| **Đóng gói** (Encapsulation) | Toàn bộ trạng thái trong private field (`#id`, `#unitPrice`, `#stock`, …); bên ngoài chỉ đọc qua getter, chỉ đổi qua phương thức có kiểm tra |

---

## Ba mức ưu đãi — "màn trình diễn" của đa hình

Đây là thứ bạn sẽ chỉ cho giảng viên xem lúc bảo vệ:

```js
import { createProduct } from "./js/core/models.js";

const milk = createProduct({ id: 1, name: "Sữa tươi", category: "Dairy", price: 100000, stock: 10, kind: "perishable", expiryDate: "…" });
const charger = createProduct({ id: 2, name: "Củ sạc", category: "Electronics", price: 100000, stock: 10, kind: "electronic" });
const tissue = createProduct({ id: 3, name: "Khăn giấy", category: "Household", price: 100000, stock: 10, kind: "general" });

// Một lời gọi, ba kết quả khác nhau — đây chính là đa hình
[milk, charger, tissue].forEach((p) => console.log(p.name, p.applyDiscount()));
// Sữa tươi   70000   ← gần hạn, giảm 30%
// Củ sạc     90000   ← điện tử, giảm 10%
// Khăn giấy   95000   ← thông thường, giảm 5%
```

---

## Quy trình push

```powershell
# 1. Lấy code mới nhất
git checkout main
git pull

# 2. Tạo nhánh của bạn (chỉ lần đầu)
git checkout -b feature/member-1-models

# 3. Kiểm tra trước khi commit
cd web
npm test
cd ..

# 4. Commit theo từng mốc nhỏ
git add web/js/core/models.js
git commit -m "feat(models): thêm lớp Product trừu tượng với đóng gói private field"

git add web/tests/models.test.mjs
git commit -m "test(models): phủ ba mức ưu đãi đa hình và kiểm tra tồn kho"

# 5. Đẩy lên GitHub
git push -u origin feature/member-1-models
```

Sau khi push, GitHub in ra đường dẫn tạo Pull Request. Bấm vào, đặt tiêu đề
`[TV1] Lớp sản phẩm OOP`, mô tả ngắn những gì đã làm, rồi **Create pull request**.

---

## Commit gợi ý

```text
feat(models): thêm lớp Product trừu tượng với đóng gói private field
feat(models): thêm ba lớp con với ưu đãi đa hình
feat(models): thêm toJSON và fromJSON khôi phục đúng lớp con
test(models): phủ ba mức ưu đãi và biên tồn kho
docs(models): ghi chú bốn trụ cột OOP trong mã nguồn
```

---

## Điều phải nhớ khi bảo vệ

Câu hỏi giảng viên hay hỏi:

**"Đa hình của em thể hiện ở đâu?"**
→ Ở chỗ vòng lặp trong `ShoppingCart` gọi `line.product.applyDiscount()` mà không cần biết đó là
hàng tươi, điện tử hay thông thường. Cùng một dòng mã, ba kết quả khác nhau.

**"Vì sao `Product` là lớp trừu tượng?"**
→ Vì không có khái niệm "sản phẩm chung chung" trong cửa hàng — mọi món đều phải thuộc một loại có
cách tính ưu đãi riêng. Nếu cho khởi tạo `Product`, ta sẽ phải viết một `applyDiscount()` mặc định
vô nghĩa.

**"Đóng gói nghĩa là gì trong bài của em?"**
→ `#stock` là private field. Không ai gán `product.stock = -5` được. Muốn đổi phải gọi
`restock()` hoặc `trySell()`, và hai hàm đó kiểm tra dữ liệu trước khi cho qua.

**"Vì sao `stock` phải là số nguyên?"**
→ Vì không bán được nửa hộp sữa. Constructor ném `RangeError` nếu nhận 1.5.

---

## Nếu bị chặn

- Test của người khác đỏ → bình thường khi họ đang làm dở. Chạy riêng: `node --test tests/models.test.mjs`
- Push bị từ chối vì `main` đã đổi → `git pull --rebase origin main` rồi push lại
- Xung đột ở file của mình → xem mục 5 trong [GITHUB_GUIDE.md](../GITHUB_GUIDE.md)
