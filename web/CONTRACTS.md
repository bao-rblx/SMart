# SmartMart Web · Hợp đồng mã nguồn (CONTRACTS)

> File này là **nguồn sự thật duy nhất** về API giữa các phần.
> Ai viết lệch khỏi đây thì phần ghép sẽ hỏng. Đọc kỹ trước khi viết dòng đầu tiên.

Kiến trúc: **HTML + CSS + JavaScript thuần (ES modules)**, không cần build, không thư viện ngoài.
Chạy: `cd web && npm run dev` → http://127.0.0.1:5173
Kiểm thử: `cd web && npm test` (Node 18+, dùng `node --test`)

---

## 1. Cây thư mục và chủ sở hữu

```text
web/
├─ index.html                    # [Lead] khung trang
├─ css/
│  ├─ tokens.css                 # [Lead] biến thiết kế
│  ├─ base.css boot.css          # [Lead]
│  ├─ layout.css                 # [Lead] khung ứng dụng
│  ├─ components.css             # [Lead] thư viện thành phần
│  ├─ auth.css                   # [Thành viên 5]
│  ├─ catalog.css                # [Thành viên 5]
│  ├─ cart.css                   # [Thành viên 5]
│  ├─ checkout.css               # [Thành viên 5]
│  ├─ inventory.css              # [Thành viên 6]
│  ├─ reports.css                # [Thành viên 6]
│  └─ users.css                  # [Thành viên 6]
├─ js/
│  ├─ main.js                    # [Lead] điểm khởi động
│  ├─ app/
│  │  ├─ store.js                # [Lead] trạng thái + lưu trữ
│  │  ├─ router.js               # [Lead] điều hướng
│  │  ├─ shell.js                # [Lead] khung rail/topbar/statusbar
│  │  ├─ theme.js                # [Lead] sáng tối, tuỳ chọn
│  │  ├─ shortcuts.js            # [Lead] phím tắt
│  │  └─ events.js               # [Lead] bus sự kiện
│  ├─ core/
│  │  ├─ constants.js            # [Lead] enum — ĐÃ XONG, không sửa
│  │  ├─ format.js               # [Lead] định dạng — ĐÃ XONG, không sửa
│  │  ├─ vietnamese.js           # [Lead] nhãn + tìm không dấu — ĐÃ XONG
│  │  ├─ catalog-query.js        # [Lead] lọc/sắp xếp — ĐÃ XONG
│  │  ├─ models.js               # [Thành viên 1]
│  │  ├─ cart.js                 # [Thành viên 2]
│  │  ├─ transaction.js          # [Thành viên 2]
│  │  ├─ inventory.js            # [Thành viên 3]
│  │  ├─ storage.js              # [Thành viên 3]
│  │  ├─ seed.js                 # [Thành viên 3]
│  │  ├─ users.js                # [Thành viên 4]
│  │  └─ auth.js                 # [Thành viên 4]
│  ├─ ui/
│  │  ├─ dom.js                  # [Lead] — ĐÃ XONG
│  │  ├─ icons.js                # [Lead] — ĐÃ XONG
│  │  ├─ toast.js                # [Lead]
│  │  ├─ modal.js                # [Lead]
│  │  ├─ product-card.js         # [Thành viên 5]
│  │  └─ charts.js               # [Thành viên 6]
│  └─ views/
│     ├─ login.js                # [Thành viên 5]
│     ├─ checkout.js             # [Thành viên 5]
│     ├─ cart-panel.js           # [Thành viên 5]
│     ├─ inventory.js            # [Thành viên 6]
│     ├─ reports.js              # [Thành viên 6]
│     └─ users.js                # [Thành viên 6]
├─ data/catalog.json             # [Lead] 72 mặt hàng mẫu
├─ assets/products/*.jpg         # [Lead] ảnh sản phẩm
└─ tests/*.test.mjs              # mỗi thành viên thêm file của mình
```

**Quy tắc vàng:** chỉ sửa file trong cột của mình. Cần đổi file của người khác thì nhắn Lead.

---

## 2. Kiểu dữ liệu dùng chung

### 2.1 Định dạng sản phẩm thô (plain object, dùng trong JSON)

```js
{
  id: 1001,                    // number, duy nhất
  name: "Mì Hảo Hảo tôm chua cay 75 g",
  category: "Grocery",         // khoá trong Category (constants.js)
  price: 4500,                 // decimal, đồng. KHÔNG có phần lẻ.
  stock: 24,                   // number >= 0
  kind: "general",             // "perishable" | "electronic" | "general"
  barcode: "8934563138165",    // string, có thể rỗng
  catalogKey: "off-8934563138165", // khoá file ảnh trong assets/products
  lowStockThreshold: 5,
  // riêng từng loại:
  shelfLifeDays: 90,           // perishable: số ngày còn lại lúc tạo dữ liệu
  expiryDate: "2026-11-20",    // perishable: ISO date (yyyy-mm-dd)
  warrantyMonths: 12,          // electronic
  serialNumber: "SM-1001",     // electronic
  supplier: "Nhà phân phối trong nước" // general
}
```

### 2.2 Trạng thái ứng dụng (state)

```js
{
  products: Product[],   // thực thể, KHÔNG phải plain object
  users: User[],
  sales: Transaction[],
  currentUser: User|null,
  storage: { mode: "local"|"memory", warning: string|null, notice: string|null }
}
```

---

## 3. Hợp đồng tầng core

### 3.1 `js/core/models.js` — Thành viên 1

```js
import { Product, PerishableProduct, ElectronicProduct, GeneralProduct,
         createProduct, productKindOf } from "../core/models.js";

// Lớp cơ sở trừu tượng
class Product {
  constructor({ id, name, category, price, stock, kind, barcode, catalogKey, lowStockThreshold })
  // Thuộc tính chỉ đọc (getter):
  get id()               // number
  get name()             // string
  get category()         // string (khoá Category)
  get unitPrice()        // number >= 0, đã làm tròn tới đồng
  get stock()            // number nguyên >= 0
  get lowStockThreshold()// number
  get barcode()          // string
  get catalogKey()       // string
  get kind()             // "perishable" | "electronic" | "general"

  // Dẫn xuất
  get isLowStock()       // stock <= lowStockThreshold
  get canSell()          // stock > 0 (PerishableProduct ghi đè: thêm điều kiện chưa hết hạn)
  get discountedPrice()  // = applyDiscount(); tiện cho lọc/sắp xếp
  get discountPercent()  // = round((1 - discountedPrice / unitPrice) * 100); 0 nếu giá 0

  // Phương thức nghiệp vụ
  applyDiscount()        // TRỪU TƯỢNG — lớp con bắt buộc ghi đè, lớp cơ sở ném lỗi
  calculateTax()         // mặc định: round(discountedPrice * 0.10); ElectronicProduct: 0.12
  displayInfo()          // TRỪU TƯỢNG — chuỗi mô tả riêng của lớp con
  restock(qty)           // cộng tồn kho, qty phải là số nguyên > 0, ngược lại ném RangeError
  trySell(qty)           // trả true và trừ kho nếu đủ; false nếu không đủ/không bán được
  renamed(name)          // trả bản sao cùng loại với tên mới (không sửa đối tượng gốc)
  withPrice(price)       // trả bản sao cùng loại với giá mới
  toJSON()               // → plain object đúng mục 2.1

  static fromJSON(data)  // dựng lại đúng lớp con từ plain object
}

class PerishableProduct extends Product {
  get expiryDate()       // Date (nửa đêm giờ địa phương)
  get shelfLifeDays()    // số ngày còn lại (âm nếu quá hạn)
  get isExpired()        // shelfLifeDays < 0 hoặc < hôm nay
  get isNearExpiry()     // 0 <= shelfLifeDays <= 7
  applyDiscount()        // gần hạn (<=7 ngày): 30%; xa hơn: 5%
  displayInfo()          // "Hạn dùng: dd/mm/yyyy"
}

class ElectronicProduct extends Product {
  get warrantyMonths()   // number
  get serialNumber()     // string
  applyDiscount()        // luôn giảm 10%
  calculateTax()         // 12%
  displayInfo()          // "Bảo hành 12 tháng"
}

class GeneralProduct extends Product {
  get supplier()         // string
  applyDiscount()        // luôn giảm 5%
  displayInfo()          // "Nhà cung cấp: CleanCo"
}

function createProduct(data)  // chọn lớp con theo data.kind, trả instance
function productKindOf(product) // → "perishable" | "electronic" | "general"
```

**Yêu cầu chung:** `applyDiscount()` và `calculateTax()` phải đi qua `roundMoney` trong `format.js`.
Giá trị `price` luôn làm tròn tới đồng ngay khi khởi tạo.

---

### 3.2 `js/core/cart.js` + `js/core/transaction.js` — Thành viên 2

```js
import { ShoppingCart, CartLine } from "../core/cart.js";
import { Transaction, SaleLine, PaymentDetails, generateInvoice } from "../core/transaction.js";

class CartLine {
  constructor(product, quantity)
  get product()          // Product
  get quantity()         // number nguyên > 0
  get lineTotal()        // = product.discountedPrice * quantity, đã làm tròn
  get taxTotal()         // = product.calculateTax() * quantity, đã làm tròn
  get grandTotal()       // = lineTotal + taxTotal
  get discountPercent()  // = product.discountPercent
  withQuantity(qty)      // trả CartLine mới
}

class ShoppingCart {
  constructor()
  get lines()            // CartLine[] chỉ đọc
  get count()            // tổng số lượng món
  get isEmpty()          // boolean
  get subtotal()         // sum(product.unitPrice * qty) đã làm tròn
  get discountedTotal()  // sum(lineTotal)
  get savings()          // subtotal - discountedTotal
  get tax()              // sum(taxTotal)
  get grandTotal()       // discountedTotal + tax

  addItem(product, qty = 1)   // gộp dòng nếu đã có; ném Error nếu vượt tồn kho hoặc qty <= 0
  setQuantity(product, qty)   // qty = 0 → xoá dòng; ném Error nếu > tồn kho
  removeItem(productId)
  clear()
  canAdd(product, qty = 1)    // boolean, dùng để khoá nút "+" trên giao diện
  quantityOf(productId)       // number, 0 nếu không có
  checkout(method)            // PaymentMethod key → Transaction; kiểm tra toàn bộ tồn kho
                              // trước khi trừ; ném Error nếu giỏ trống hoặc thiếu hàng
}

class SaleLine {
  constructor({ productId, name, category, quantity, unitPrice, discountedUnitPrice, taxPerUnit })
  get lineTotal()        // discountedUnitPrice * quantity
}
class PaymentDetails {
  constructor(method, amount)  // amount > 0; ném RangeError nếu âm
  get method()  get amount()
}
class Transaction {
  constructor({ orderId, timestamp, lines, subtotal, discountedTotal, tax, payment })
  get orderId()      // 8 ký tự hoa
  get timestamp()    // Date
  get lines()        // SaleLine[]
  get subtotal()  get discountedTotal()  get savings()  get tax()  get grandTotal()
  get itemCount()    // tổng số lượng
  get payment()      // PaymentDetails
  toJSON()           // plain object
  static fromJSON(data)
}
function generateInvoice(transaction) // chuỗi văn bản thuần (xuống dòng bằng \n) để in/lưu
```

---

### 3.3 `js/core/inventory.js` · `storage.js` · `seed.js` — Thành viên 3

```js
import { Inventory } from "../core/inventory.js";
import { loadState, saveState, clearState, storageMode } from "../core/storage.js";
import { seedProducts, seedUsers } from "../core/seed.js";

class Inventory {
  constructor(products = [])
  get products()               // Product[] chỉ đọc
  get count()                  // số mặt hàng
  get totalUnits()             // tổng tồn kho
  find(id)                     // Product | undefined
  findByName(name)             // Product | undefined (so khớp không dấu)
  add(product)                 // ném Error nếu trùng id hoặc tên rỗng
  remove(id)                   // boolean
  restock(id, qty)             // ném RangeError nếu qty <= 0
  withdraw(id, qty)            // giảm kho; ném Error nếu không đủ
  setPrice(id, price)          // đổi giá; ném RangeError nếu âm
  get lowStockAlerts()         // Product[] có isLowStock
  get expiringSoon()           // PerishableProduct[] có isNearExpiry
  get expiredProducts()        // PerishableProduct[] đã hết hạn
  get healthyCount()           // số mặt hàng không có cảnh báo
  get inventoryValue()         // sum(unitPrice * stock)
  get nextId()                 // số id lớn nhất + 1
  static fromJSON(list)        // dựng từ mảng plain object
}

// storage.js — lưu bằng localStorage, tự rơi về chế độ trong bộ nhớ khi bị chặn
function loadState()           // → { products, users, sales } | null
function saveState(state)      // → { ok: true } | { ok: false, warning: string }
function clearState()
function storageMode()         // "local" | "memory"
// Mọi hàm KHÔNG được ném lỗi ra ngoài; lỗi đóng gói trong giá trị trả về.

// seed.js — dữ liệu mẫu
async function seedProducts(fetcher) // → Product[] (72 món), đọc data/catalog.json qua fetch
function seedUsers()                // → User[] { admin, manager, cashier }
```

---

### 3.4 `js/core/users.js` + `js/core/auth.js` — Thành viên 4

```js
import { User, Cashier, Manager, Admin, createUser, userFromJSON } from "../core/users.js";
import { hashPassword, verifyPassword, AuthService } from "../core/auth.js";

class User {
  constructor({ username, role, credential })  // credential = chuỗi "salt:hash" dạng base64
  get username()  get role()  get credential()
  allowedScreens()          // chuỗi khoá SCREENS: Cashier → ["Checkout"]; Manager → +Inventory, Reports;
                            // Admin → cả bốn
  canAccess(screen)         // boolean
  get displayRole()         // nhãn tiếng Việt của vai trò
  toJSON()                  // { username, role, credential }
}
// Cashier / Manager / Admin: lớp con, role cố định

function createUser({ username, password, role })  // → Promise<User> (băm mật khẩu)
function userFromJSON(data)                        // → User (không băm lại)

async function hashPassword(password)   // → Promise<string> salt:hash (PBKDF2-SHA256, 120k vòng)
async function verifyPassword(password, credential) // → Promise<boolean>, so sánh hằng thời gian

class AuthService {
  constructor(users)
  get users()                       // User[]
  async login(username, password)   // → { user } | { error }   error là chuỗi tiếng Việt
  async addUser({ username, password, role }) // → { user } | { error }
  changeRole(username, role)        // → { user } | { error }
  removeUser(username)              // → { ok } | { error }
  find(username)                    // User | undefined
  setUsers(users)
}
```

**PBKDF2 trong Node:** `crypto.pbkdf2Sync`, trong trình duyệt: `crypto.subtle`.
File `auth.js` phải chạy được ở **cả hai** môi trường (kiểm tra `globalThis.crypto?.subtle`).

---

## 4. Hợp đồng giao diện

### 4.1 Cách một view được gọi

```js
// Mỗi view export đúng một hàm render:
export function renderCheckout(context) {
  // trả về Node (HTMLElement) — framework không dùng innerHTML cho dữ liệu người dùng
}

context = {
  store,          // xem mục 4.2
  navigate,       // (screenName) => void
  toast,          // { success(msg), error(msg), info(msg) }
  confirm,        // (options) => Promise<boolean>
  modal,          // { open(node), close() }
  refresh,        // () => void — vẽ lại màn hình hiện tại
  state,          // trạng thái hiện tại: { products, users, sales, currentUser }
  session         // { user, cart }
}
```

### 4.2 `store` (Lead viết, thành viên chỉ **gọi**)

```js
store.state                    // { products, users, sales, currentUser }
store.cart                     // ShoppingCart của phiên hiện tại
store.auth                     // AuthService
store.inventory                // Inventory
store.getProducts()            // Product[]
store.getSales()               // Transaction[]
store.getUsers()               // User[]
store.commitSale(transaction)  // thêm hóa đơn + lưu + phát sự kiện "sale"
store.addProduct(product)      // thêm mặt hàng + lưu
store.removeProduct(id)
store.restock(id, qty)
store.withdraw(id, qty)
store.setPrice(id, price)
store.save()                   // lưu xuống storage, trả giá trị saveState
store.subscribe(listener)      // listener(state) — trả hàm huỷ đăng ký
store.emit(name, detail)       // phát sự kiện nội bộ
```

### 4.3 CSS: dùng lại thư viện thành phần

Đã có sẵn trong `components.css`: `.card` `.metric` `.btn` (+ `--primary` `--ghost` `--soft` `--danger` `--sm` `--lg` `--block` `--icon`) `.input` `.select` `.search-box` `.check` `.switch` `.stepper` `.badge` `.chip` `.table` `.empty` `.progress` `.tabs` `.list` `.divider`.

**Cấm** viết mã màu trực tiếp — luôn dùng biến trong `tokens.css` (`var(--brand-600)`, `var(--surface)`, `var(--line)`, ...).
Tên lớp CSS của bạn phải có tiền tố riêng: `co-` (checkout), `ct-` (catalog), `iv-` (inventory), `rp-` (reports), `us-` (users), `lg-` (login).

---

## 5. Kiểm thử

Mỗi thành viên tạo **một** file trong `web/tests/`:

| Thành viên | File | Nội dung tối thiểu |
|---|---|---|
| 1 | `models.test.mjs` | ưu đãi 3 lớp khác nhau, tồn kho không âm, thuế |
| 2 | `cart.test.mjs` | tổng giỏ hỗn hợp, thanh toán, hóa đơn |
| 3 | `inventory.test.mjs` | nhập/xuất kho, cảnh báo, lưu trữ |
| 4 | `auth.test.mjs` | đăng nhập đúng/sai, phân quyền, băm mật khẩu |
| 5 | `checkout-ui.test.mjs` | dựng view trong DOM giả, tính tiền hiển thị đúng |
| 6 | `reports.test.mjs` | tổng hợp doanh thu, nhóm hàng, CSV |

Chạy: `cd web && npm test`.

---

## 6. Quy ước viết mã

1. **Không** dùng `innerHTML` cho dữ liệu người dùng — dùng `el()`, `textContent`.
2. Chú thích bằng **tiếng Việt**, giải thích *vì sao*, không giải thích *cái gì*.
3. Tên biến, hàm, lớp bằng **tiếng Anh**; chữ hiển thị bằng **tiếng Việt**.
4. Mỗi hàm một việc. Hàm quá 40 dòng thì tách.
5. Không thêm thư viện ngoài. Không dùng `eval`. Không dùng `var`.
6. Chạy `npm test` trước khi báo xong.
