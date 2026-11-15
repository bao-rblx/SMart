# Thành viên 4 · Người dùng, xác thực, phân quyền

**Nhánh:** `feature/member-4-auth`
**File bạn sở hữu:** `web/js/core/users.js`, `web/js/core/auth.js`, `web/tests/auth.test.mjs`

---

## Phần của bạn trong đồ án

Bạn giữ **phần bảo mật** và **phân quyền** — hai thứ giảng viên chấm kỹ vì dễ làm sai.

| Khái niệm OOP | Nằm ở đâu |
|---|---|
| **Trừu tượng** | `class User` không khởi tạo trực tiếp; `allowedScreens()` buộc lớp con ghi đè |
| **Kế thừa** | `Cashier`, `Manager`, `Admin` đều `extends User` |
| **Đa hình** | Cùng lời gọi `user.allowedScreens()` trả về danh sách màn hình khác nhau tuỳ vai trò |
| **Đóng gói** | `credential` là private field — không ai đọc được hash từ bên ngoài |

---

## Phần quan trọng nhất: băm mật khẩu

### Nguyên tắc

1. **Không bao giờ lưu mật khẩu thô.** Chỉ lưu chuỗi `base64(salt):base64(hash)`.
2. **Mỗi người dùng có salt riêng.** Hai người cùng mật khẩu `123456` phải ra hai hash khác nhau.
3. **So sánh hằng thời gian.** Không được thoát sớm khi thấy ký tự khác nhau — kẻ tấn công có thể
   đo thời gian phản hồi để đoán dần mật khẩu.
4. **PBKDF2-SHA256, 120.000 vòng.** Con số vòng lặp là thứ làm cho việc dò mật khẩu trở nên đắt đỏ.

### Chạy ở cả Node và trình duyệt

```js
// Trình duyệt và Node 18+ đều có Web Crypto
if (globalThis.crypto?.subtle) {
  // dùng crypto.subtle.deriveBits
} else {
  const { pbkdf2 } = await import("node:crypto");
  // dùng bản của Node
}
```

Bắt buộc phải có cả hai nhánh, vì:
- Trình duyệt dùng để đăng nhập thật
- Node dùng để chạy `npm test`

---

## Ba quy tắc nghiệp vụ không được bỏ

### 1. Không tiết lộ sai tên hay sai mật khẩu

```js
// ĐÚNG — kẻ tấn công không biết tài khoản nào tồn tại
return { error: "Tên đăng nhập hoặc mật khẩu chưa đúng." };

// SAI — tiết lộ thông tin
return { error: "Tên đăng nhập này không tồn tại." };
```

### 2. Không hạ quyền quản trị viên cuối cùng

Nếu chỉ còn một Admin mà hạ quyền người đó, cửa hàng sẽ **không còn ai quản trị** — mất luôn khả năng
thêm nhân sự. Phải chặn.

### 3. Không xoá quản trị viên cuối cùng

Cùng lý do. Hãy thử tưởng tượng: xoá xong thì không ai vào được màn hình Nhân sự nữa.

---

## Kiểm thử bảo mật bạn nên viết

```js
// Salt phải khác nhau
const a = await hashPassword("matkhau123");
const b = await hashPassword("matkhau123");
assert.notEqual(a, b);              // hai chuỗi khác nhau
assert.equal(await verifyPassword("matkhau123", a), true);
assert.equal(await verifyPassword("matkhau123", b), true);

// Mật khẩu thô không được xuất hiện trong credential
assert.ok(!a.includes("matkhau123"));

// Credential hỏng không được ném lỗi
assert.equal(await verifyPassword("x", "rác"), false);
assert.equal(await verifyPassword("x", ""), false);
```

---

## Quy trình push

```powershell
git checkout main
git pull
git checkout -b feature/member-4-auth

cd web
npm test
cd ..

git add web/js/core/users.js
git commit -m "feat(users): thêm User trừu tượng và ba lớp vai trò"

git add web/js/core/auth.js
git commit -m "feat(users): băm mật khẩu PBKDF2 chạy cả trình duyệt và Node"

git add web/tests/auth.test.mjs
git commit -m "test(users): phủ đăng nhập, phân quyền và bảo vệ admin cuối cùng"

git push -u origin feature/member-4-auth
```

---

## Commit gợi ý

```text
feat(users): thêm User trừu tượng với allowedScreens đa hình
feat(users): thêm ba lớp Cashier, Manager, Admin
feat(users): băm mật khẩu PBKDF2-SHA256 120.000 vòng
feat(users): thêm AuthService với đăng nhập và quản lý tài khoản
test(users): phủ đăng nhập, salt, phân quyền và biên quản trị viên
```

---

## Điều phải nhớ khi bảo vệ

**"Vì sao dùng PBKDF2 mà không dùng MD5 hay SHA256 trần?"**
→ MD5 và SHA256 trần được thiết kế để chạy **nhanh** — kẻ tấn công có thể thử hàng tỉ mật khẩu mỗi giây.
PBKDF2-SHA256 cố tình chạy chậm (120.000 vòng lặp) nên việc dò trở nên quá đắt.

**"Salt để làm gì?"**
→ Chống bảng tra sẵn (rainbow table). Nếu không có salt, hai người cùng mật khẩu sẽ có cùng hash, và
kẻ tấn công chỉ cần tra bảng có sẵn là ra. Salt riêng cho từng người làm mỗi lần băm là duy nhất.

**"So sánh hằng thời gian là gì?"**
→ So sánh thường thoát ngay khi thấy ký tự khác, nên thời gian phản hồi tiết lộ có bao nhiêu ký tự
đúng. So sánh hằng thời gian luôn duyệt hết chuỗi dù đã thấy khác, nên không rò rỉ thông tin đó.

**"Phân quyền dựa trên gì?"**
→ Đa hình. `user.allowedScreens()` — mỗi lớp con trả danh sách riêng. Router hỏi người dùng đang
đăng nhập được vào màn hình nào, không cần `if (role === "Admin")` rải khắp nơi.

---

## Nếu bị chặn

- Web Crypto không có trong Node → dùng nhánh `import("node:crypto")`
- Test chậm → PBKDF2 120k vòng mất khoảng 50–100ms mỗi lần; 20 test là dưới 3 giây, chấp nhận được
