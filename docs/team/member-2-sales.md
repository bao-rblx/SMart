# Thành viên 2 · Giỏ hàng, thanh toán, hóa đơn

**Nhánh:** `feature/member-2-sales`
**File bạn sở hữu:** `web/js/core/cart.js`, `web/js/core/transaction.js`, `web/tests/cart.test.mjs`

---

## Phần của bạn trong đồ án

Bạn làm phần **"tính tiền"** — nơi mọi con số của cửa hàng được chốt lại. Ba khái niệm OOP bạn
thể hiện ở đây:

| Khái niệm | Nằm ở đâu |
|---|---|
| **Kết hợp** (Composition) | `ShoppingCart` **có một** danh sách `CartLine`. Đây là "has-a", khác với "is-a" của kế thừa — hãy nói rõ điều này khi bảo vệ |
| **Đa hình** (Polymorphism) | Giỏ không tự tính giảm giá. Nó hỏi từng `product.applyDiscount()` và cộng lại |
| **Đóng gói** (Encapsulation) | `PaymentDetails` là lớp chỉ đọc, không cho tạo số tiền âm |

---

## Hai điểm nghiệp vụ quan trọng nhất

### 1. Kiểm tra toàn bộ giỏ trước khi trừ kho

```js
// Nếu một dòng thiếu hàng thì KHÔNG dòng nào bị trừ.
// Không có chuyện "trừ được 3 món rồi báo lỗi món thứ 4".
if (lines.some((l) => !l.product.canSell || l.quantity > l.product.stock)) {
  throw new Error("Tồn kho đã thay đổi. Hãy kiểm tra đơn trước khi thanh toán.");
}
```

Đây là **tính nguyên tử** (atomicity). Giảng viên rất hay hỏi: "Nếu khách mua 5 món mà món thứ 4 hết
hàng thì sao?" — câu trả lời là không món nào bị trừ, giỏ giữ nguyên.

### 2. Hóa đơn là ảnh chụp, không phải con trỏ

`SaleLine` lưu lại **giá tại thời điểm bán**. Sau này quản lý sửa giá sản phẩm, hóa đơn cũ vẫn giữ
đúng số tiền đã thu. Đây là lý do `SaleLine` lưu `unitPrice` và `discountedUnitPrice` riêng, chứ
không trỏ tới `product`.

---

## Hàm quan trọng: `generateInvoice()`

Hóa đơn này được **in ra máy in thật** lúc bảo vệ. Nó phải:

- Canh cột thẳng hàng bằng khoảng trắng (độ rộng cố định ~44 ký tự)
- Có mã đơn, ngày giờ, từng dòng hàng, tạm tính, tiết kiệm, thuế, tổng cộng
- Có **số tiền bằng chữ tiếng Việt** (`numberToVietnameseWords` trong `format.js`)
- Không có ký tự đặc biệt làm vỡ khổ giấy 80mm

Thử nhanh:

```powershell
node -e "import('./web/js/core/transaction.js').then(()=>console.log('ok'))"
```

---

## Quy trình push

```powershell
git checkout main
git pull
git checkout -b feature/member-2-sales

cd web
npm test
cd ..

git add web/js/core/cart.js
git commit -m "feat(sales): thêm ShoppingCart với kiểm tra tồn kho nguyên tử"

git add web/js/core/transaction.js
git commit -m "feat(sales): thêm Transaction và hóa đơn in được"

git add web/tests/cart.test.mjs
git commit -m "test(sales): phủ giỏ hỗn hợp, thanh toán và hóa đơn"

git push -u origin feature/member-2-sales
```

---

## Commit gợi ý

```text
feat(sales): thêm CartLine và ShoppingCart
feat(sales): kiểm tra toàn bộ tồn kho trước khi thanh toán
feat(sales): thêm Transaction lưu ảnh chụp giá tại thời điểm bán
feat(sales): tạo hóa đơn văn bản có số tiền bằng chữ
test(sales): phủ giỏ hỗn hợp và các trường hợp biên
```

---

## Điều phải nhớ khi bảo vệ

**"Vì sao `ShoppingCart` không kế thừa từ `Product`?"**
→ Vì giỏ hàng **chứa** sản phẩm, không **là** sản phẩm. Đây là quan hệ "has-a" — kết hợp, không phải
kế thừa. Dùng kế thừa ở đây sẽ sai bản chất.

**"Vì sao cần `SaleLine` riêng, sao không lưu thẳng `Product`?"**
→ Vì giá thay đổi theo thời gian. Hóa đơn phải giữ đúng giá đã bán, nếu không thì báo cáo doanh thu
sẽ sai mỗi lần sửa giá.

**"Làm sao biết giỏ tính đúng?"**
→ Test so sánh tổng của giỏ hỗn hợp với tổng tính tay từng dòng. Nếu đa hình sai, hai số này lệch nhau.

---

## Nếu bị chặn

- `models.js` chưa có → test của bạn dùng lớp giả, vẫn chạy được
- Test đỏ ở file người khác → `node --test tests/cart.test.mjs`
