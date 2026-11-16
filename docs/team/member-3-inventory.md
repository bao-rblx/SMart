# Thành viên 3 · Kho hàng, lưu trữ, dữ liệu mẫu

**Nhánh:** `feature/member-3-inventory`
**File bạn sở hữu:** `web/js/core/inventory.js`, `web/js/core/storage.js`, `web/js/core/seed.js`, `web/tests/inventory.test.mjs`

---

## Phần của bạn trong đồ án

Bạn lo **dữ liệu sống còn của cửa hàng**: hàng trong kho và việc giữ cho nó không mất khi tắt máy.

| Khái niệm OOP | Nằm ở đâu |
|---|---|
| **Trừu tượng** (Interface/Abstraction) | `Inventory` là lớp bọc duy nhất; nơi khác không đụng thẳng vào mảng sản phẩm |
| **Đóng gói** | `Inventory` không cho sửa `stock` trực tiếp — phải gọi `restock()`/`withdraw()`, và hai hàm này gọi tiếp phương thức của `Product` |
| **Kết hợp** | `Inventory` **có một** danh sách `Product`, giống `ShoppingCart` có `CartLine` |

---

## Ba file, ba nhiệm vụ khác nhau

### `inventory.js` — nghiệp vụ kho

Trách nhiệm: biết hàng nào sắp hết, hàng nào sắp hết hạn, tính giá trị tồn kho.

```js
inventory.lowStockAlerts   // hàng sắp hết
inventory.expiringSoon     // hàng tươi còn <= 7 ngày
inventory.expiredProducts  // hàng đã hết hạn, không bán được
inventory.inventoryValue   // tổng giá trị hàng đang nằm trong kho
```

**Quan trọng:** `setPrice()` không được gán thẳng `product.unitPrice = x` — `Product` không có setter
(đóng gói của Thành viên 1). Phải dùng bản sao:

```js
this.#products[index] = product.withPrice(newPrice);
```

### `storage.js` — giữ dữ liệu qua các lần mở

Đây là file **không được phép ném lỗi**. Trình duyệt ở chế độ riêng tư sẽ chặn `localStorage`;
ứng dụng phải tự chuyển sang chế độ bộ nhớ tạm và vẫn chạy bình thường.

```js
loadState()    // null nếu không có hoặc dữ liệu hỏng — KHÔNG ném
saveState(s)   // { ok: true } hoặc { ok: false, warning: "..." } — KHÔNG ném
storageMode()  // "local" hoặc "memory"
```

Nguyên tắc: **chỉ lưu plain object**. Instance lớp không serialize được thành JSON đúng cách —
phải đi qua `toJSON()`.

### `seed.js` — 72 mặt hàng mẫu

Đọc `web/data/catalog.json`, dựng thành đối tượng thật bằng `createProduct()` của Thành viên 1.
Chú ý đường dẫn: từ `js/core/seed.js`, file dữ liệu nằm ở `../../data/catalog.json`.

```js
new URL("../../data/catalog.json", import.meta.url)
```

---

## Kiểm thử lưu trữ mà không cần trình duyệt

Trong file test, tự cài một `localStorage` giả:

```js
globalThis.localStorage = {
  #data: new Map(),
  getItem(k) { return this.#data.get(k) ?? null; },
  setItem(k, v) { this.#data.set(k, v); },
  removeItem(k) { this.#data.delete(k); }
};
```

Rồi kiểm tra trường hợp `setItem` ném lỗi (giả lập chế độ riêng tư) — `saveState` phải trả
`{ ok: false }` chứ không được ném.

---

## Quy trình push

```powershell
git checkout main
git pull
git checkout -b feature/member-3-inventory

cd web
npm test
cd ..

git add web/js/core/inventory.js
git commit -m "feat(inventory): thêm Inventory với cảnh báo tồn kho và hạn dùng"

git add web/js/core/storage.js
git commit -m "feat(data): lưu trạng thái vào localStorage, tự rơi về bộ nhớ"

git add web/js/core/seed.js
git commit -m "feat(data): nạp 72 mặt hàng mẫu từ catalog.json"

git add web/tests/inventory.test.mjs
git commit -m "test(inventory): phủ nhập xuất kho, cảnh báo và lưu trữ"

git push -u origin feature/member-3-inventory
```

---

## Commit gợi ý

```text
feat(inventory): thêm Inventory bọc danh sách sản phẩm
feat(inventory): cảnh báo tồn thấp, sắp hết hạn, đã hết hạn
feat(data): lưu trạng thái vào localStorage có dự phòng trong bộ nhớ
feat(data): nạp danh mục mẫu 72 mặt hàng
test(inventory): phủ nghiệp vụ kho và các trường hợp localStorage hỏng
```

---

## Điều phải nhớ khi bảo vệ

**"Nếu trình duyệt chặn lưu trữ thì sao?"**
→ `storage.js` phát hiện và chuyển sang lưu trong bộ nhớ. Ứng dụng vẫn bán hàng bình thường, chỉ là
tắt trình duyệt thì mất dữ liệu. Thanh trạng thái hiện chữ "Dữ liệu tạm trong phiên" để người dùng biết.

**"Vì sao `Inventory` là một lớp riêng thay vì dùng thẳng mảng?"**
→ Để đóng gói. Nếu ai cũng cầm mảng thô thì họ sẽ tự `push`, tự sửa `stock`, và các quy tắc
(như "không cho tồn kho âm") sẽ bị phá vỡ ở nhiều nơi. Gom vào một lớp thì quy tắc chỉ nằm một chỗ.

**"Dữ liệu hỏng thì sao?"**
→ `loadState` bắt lỗi JSON, trả `null`, và store nạp lại dữ liệu mẫu. Ứng dụng không bao giờ trắng trang.

---

## Nếu bị chặn

- `models.js` chưa có → test dùng lớp giả, vẫn chạy
- `users.js` chưa có → `seedUsersAsync` import nó; nếu chưa có, chạy riêng test `inventory.test.mjs`
