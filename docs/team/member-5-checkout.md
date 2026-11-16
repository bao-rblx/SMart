# Thành viên 5 · Đăng nhập và bán hàng

**Nhánh:** `feature/member-5-checkout`
**File bạn sở hữu:** `web/js/views/login.js`, `web/js/views/checkout.js`, `web/js/views/cart-panel.js`, `web/js/ui/product-card.js`, `web/css/auth.css`, `web/css/catalog.css`, `web/css/cart.css`, `web/css/checkout.css`, `web/tests/checkout-ui.test.mjs`

---

## Phần của bạn trong đồ án

Bạn làm **màn hình đầu tiên và màn hình được dùng nhiều nhất**. Giảng viên sẽ nhìn màn hình bán hàng
trong suốt buổi bảo vệ, nên đây là mặt tiền của đồ án.

| Màn hình | Vai trò |
|---|---|
| Đăng nhập | Cổng vào — cũng là nơi chứng minh phân quyền hoạt động |
| Bán hàng | Màn hình chính của thu ngân — nơi đa hình ưu đãi hiện ra trước mắt giảng viên |

---

## Điều quan trọng nhất về màn hình bán hàng

Mỗi thẻ sản phẩm phải hiện **ba mức giảm khác nhau** cho ba loại hàng khác nhau. Đây chính là lúc
"màn trình diễn đa hình" diễn ra trước mắt người chấm:

```text
Sữa tươi    −30%   ← hàng tươi gần hạn
Củ sạc      −10%   ← điện tử
Khăn giấy    −5%   ← hàng thông thường
```

Giao diện của bạn **không được tự tính** mức giảm đó. Nó chỉ hỏi `product.discountPercent` — một getter
đã lo phần đa hình. Nếu bạn tự viết `if (category === "Electronics") ...` thì đã làm sai ý đồ của đồ án.

---

## Bốn yêu cầu về chất lượng giao diện

### 1. Ảnh sản phẩm thật

72 ảnh nằm ở `web/assets/products/<catalogKey>.jpg`. Nền ảnh nhạt theo nhóm hàng để đồng bộ.
Luôn có `onerror` để ẩn ảnh hỏng — một ảnh lỗi không được làm vỡ bố cục.

### 2. Tìm kiếm không dấu

Người dùng gõ `sua tuoi` phải ra **Sữa tươi**; `ca phe` phải ra **Cà phê rang xay**.
Đừng tự viết hàm chuẩn hoá — dùng `findProducts()` trong `js/core/catalog-query.js`, nó đã xử lý
dấu tiếng Việt qua `normalize()`.

### 3. Phím tắt phải nối được

Ô tìm kiếm lớn phải có thuộc tính `data-catalog-search`. Lead dùng nó để nối `Ctrl+K` ở thanh trên.
Thiếu thuộc tính này thì phím tắt không chạy.

### 4. Giỏ hàng tính đúng, hiện đủ

Bốn con số: **Tạm tính** → **Tiết kiệm** → **Thuế** → **Tổng**. Cộng lại phải khớp với hóa đơn in ra.
Đây là chỗ giảng viên hay bấm máy tính kiểm tra lại.

---

## Chống lỗi thường gặp

### Giỏ vượt tồn kho

```js
// Sai: để người dùng bấm + đến khi lỗi mới báo
// Đúng: khoá nút + ngay từ đầu khi đã đủ tồn kho
const canAddMore = cart.canAdd(product, 1);
plusButton.disabled = !canAddMore;
```

### Bấm + liên tục gây nhảy số

```js
// Sai: mỗi lần bấm vẽ lại toàn bộ giỏ → giật
// Đúng: cập nhật đúng dòng vừa đổi, hoặc gộp vẽ lại vào requestAnimationFrame
```

### In hóa đơn in cả trang

Thêm vào `cart.css`:

```css
@media print {
  body > *:not(.modal-root) { display: none !important; }
  .modal-backdrop { position: static; background: none; }
}
```

---

## Quy trình push

```powershell
git checkout main
git pull
git checkout -b feature/member-5-checkout

cd web
npm test
cd ..

git add web/js/views/login.js web/css/auth.css
git commit -m "feat(ui): màn hình đăng nhập hai cột với tài khoản dùng thử"

git add web/js/ui/product-card.js web/css/catalog.css
git commit -m "feat(ui): thẻ sản phẩm có ảnh thật và huy hiệu ưu đãi"

git add web/js/views/cart-panel.js web/css/cart.css
git commit -m "feat(ui): giỏ hàng với tăng giảm số lượng và thanh toán"

git add web/js/views/checkout.js web/css/checkout.css
git commit -m "feat(ui): màn hình bán hàng có tìm kiếm, lọc và phân trang"

git add web/tests/checkout-ui.test.mjs
git commit -m "test(ui): phủ logic lọc và tổng tiền của màn hình bán hàng"

git push -u origin feature/member-5-checkout
```

---

## Điều phải nhớ khi bảo vệ

**"Ưu đãi được tính ở đâu?"**
→ Không tính ở giao diện. Giao diện chỉ hiển thị `product.discountPercent`, còn phép tính nằm trong
`Product.applyDiscount()` — mỗi lớp con một cách. Giao diện không cần biết sản phẩm thuộc loại nào.

**"Vì sao tìm `sua tuoi` ra Sữa tươi?"**
→ Hàm `normalize()` bỏ dấu tiếng Việt và chuyển về chữ thường trước khi so khớp. Nhờ vậy người dùng
không cần gõ dấu — quan trọng với thu ngân gõ nhanh.

**"Ô tìm kiếm nối với Ctrl+K thế nào?"**
→ Ô có `data-catalog-search`; khung ứng dụng bắt `Ctrl+K` rồi tìm phần tử đó và focus vào.

---

## Nếu bị chặn

- `cart.js` chưa có → bạn viết theo hợp đồng; chỉ cần `cart.addItem`, `cart.lines`, các getter tổng tiền
- `models.js` chưa có → thẻ sản phẩm chỉ dùng getter, không cần import lớp
- Giao diện chưa hiện ra → mở Console trình duyệt, lỗi import thường là thiếu đuôi `.js`
