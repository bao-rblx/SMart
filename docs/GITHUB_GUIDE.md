# Hướng dẫn đưa SmartMart Web lên GitHub

Tài liệu này dành cho cả nhóm 6 người. Đọc mục 1–3 một lần, sau đó mỗi người chỉ cần đọc phần của mình
trong `docs/team/`.

---

## 1. Chuẩn bị một lần (làm trên máy của bạn)

### 1.1 Kiểm tra Git

Mở PowerShell:

```powershell
git --version
```

Nếu chưa có, tải tại <https://git-scm.com/download/win> và cài đặt với tuỳ chọn mặc định.

### 1.2 Khai báo danh tính

Git cần biết bạn là ai để ghi vào lịch sử commit:

```powershell
git config --global user.name "Nguyễn Văn A"
git config --global user.email "email-cua-ban@example.com"
```

> Dùng **đúng email đã đăng ký GitHub** thì commit mới được tính vào đóng góp của bạn.

### 1.3 Đăng nhập GitHub

Cách dễ nhất là **GitHub CLI**:

```powershell
winget install --id GitHub.cli
gh auth login
```

Chọn theo thứ tự: `GitHub.com` → `HTTPS` → `Login with a web browser` → dán mã 8 ký tự vào trình duyệt.

Nếu không dùng GitHub CLI, Git sẽ mở cửa sổ đăng nhập trình duyệt ở lần push đầu tiên — bấm
**Sign in with your browser** là xong. Không cần tạo Personal Access Token bằng tay.

---

## 2. Tạo kho lưu trữ trên GitHub (chỉ nhóm trưởng làm, một lần)

1. Mở <https://github.com/new>.
2. Điền:
   - **Repository name:** `smartmart`
   - **Description:** `SmartMart — Ứng dụng quản lý bán lẻ (web) · Đồ án Lập trình hướng đối tượng`
   - **Visibility:** `Public` (đồ án cần công khai) hoặc `Private` nếu giảng viên đồng ý
   - **KHÔNG** tích "Add a README file", "Add .gitignore", "Choose a license" — kho phải trống.
3. Bấm **Create repository**.
4. Copy đường dẫn dạng `https://github.com/<tài-khoản>/smartmart.git`.

### 2.1 Đưa mã nguồn lên lần đầu (chỉ nhóm trưởng)

```powershell
cd D:\Down\SmartMart
git remote add origin https://github.com/<tài-khoản>/smartmart.git
git branch -M main
git push -u origin main
```

### 2.2 Mời các thành viên

Trên trang kho lưu trữ: **Settings** → **Collaborators** → **Add people** → nhập username GitHub
của từng bạn → chọn quyền **Write** → **Add**.

Người được mời phải mở email (hoặc <https://github.com/notifications>) và bấm **Accept invitation**.

---

## 3. Quy trình làm việc chung

### 3.1 Nhận mã nguồn về máy

```powershell
cd D:\
git clone https://github.com/<tài-khoản>/smartmart.git SmartMart
cd SmartMart
```

### 3.2 Vòng lặp hằng ngày

```powershell
git checkout main
git pull                       # lấy thay đổi mới nhất của nhóm
git checkout -b feature/member-2-sales   # tạo nhánh riêng cho mình (chỉ lần đầu)
```

Sau khi sửa code:

```powershell
git status                     # xem file nào đã đổi
git add web/js/core/cart.js    # thêm đúng file mình vừa sửa
git commit -m "feat(sales): cải thiện xử lý số lượng trong giỏ"
git push -u origin feature/member-2-sales
```

Lần push đầu tiên của nhánh sẽ in ra một đường dẫn tạo **Pull Request** — bấm vào, điền mô tả, chọn
người duyệt, rồi **Create pull request**.

### 3.3 Cập nhật nhánh của mình khi `main` đã đổi

```powershell
git checkout main
git pull
git checkout feature/member-2-sales
git rebase main
```

Nếu rebase báo xung đột, xem mục 5.

### 3.4 Quy ước tên nhánh

| Thành viên | Nhánh |
|---|---|
| 1 | `feature/member-1-models` |
| 2 | `feature/member-2-sales` |
| 3 | `feature/member-3-inventory` |
| 4 | `feature/member-4-auth` |
| 5 | `feature/member-5-checkout` |
| 6 | `feature/member-6-dashboard` |

### 3.5 Quy ước commit

```text
<loại>(<phạm vi>): <mô tả ngắn bằng tiếng Việt, không viết hoa đầu câu, không dấu chấm cuối>
```

| Loại | Dùng khi |
|---|---|
| `feat` | Thêm chức năng mới |
| `fix` | Sửa lỗi |
| `refactor` | Sắp xếp lại mã, không đổi hành vi |
| `style` | Chỉ đổi CSS, định dạng |
| `test` | Thêm hoặc sửa kiểm thử |
| `docs` | Tài liệu |
| `chore` | Việc phụ: cấu hình, dọn dẹp |

Ví dụ tốt:

```text
feat(models): thêm lớp PerishableProduct với ưu đãi theo hạn dùng
test(models): phủ ba mức ưu đãi khác nhau của ApplyDiscount
style(catalog): làm mượt hiệu ứng hover của thẻ sản phẩm
```

Ví dụ nên tránh: `update`, `fix bug`, `abc`, `asdf`.

---

## 4. Chạy và kiểm tra trước khi push

```powershell
cd web
npm test                    # phải xanh
npm run dev                 # mở http://127.0.0.1:5173 để xem giao diện
```

Nhấn `Ctrl+C` để tắt máy chủ.

**Không bao giờ push khi `npm test` còn đỏ.** Nếu test của người khác đỏ vì họ đang làm dở, chỉ cần
test của bạn xanh và bạn ghi rõ điều đó trong Pull Request.

---

## 5. Khi gặp xung đột (conflict)

Xung đột xảy ra khi hai người sửa cùng một dòng của cùng một file. Vì nhóm đã chia file rõ ràng,
trường hợp này rất hiếm — nhưng nếu có:

```powershell
git status                 # Git liệt kê file xung đột
```

Mở file đó, tìm các dấu:

```text
<<<<<<< HEAD
phần code của nhánh main
=======
phần code của bạn
>>>>>>> feature/member-2-sales
```

Sửa tay để giữ lại **đúng** nội dung, xoá cả ba dòng dấu, rồi:

```powershell
git add <file-vua-sua>
git rebase --continue
```

Muốn bỏ ngang và quay lại trạng thái trước: `git rebase --abort`.

---

## 6. Lệnh Git cần nhớ

| Việc cần làm | Lệnh |
|---|---|
| Xem đang ở nhánh nào | `git branch --show-current` |
| Xem file đã đổi | `git status` |
| Xem nội dung đã đổi | `git diff` |
| Xem lịch sử | `git log --oneline --graph --all` |
| Bỏ thay đổi ở một file | `git restore <file>` |
| Đưa file đã `git add` ra ngoài | `git restore --staged <file>` |
| Sửa message commit cuối | `git commit --amend -m "message mới"` |
| Tạm cất thay đổi đang làm dở | `git stash` → `git stash pop` |
| Xem nhánh trên GitHub | `git fetch --all` |

---

## 7. Những gì KHÔNG được đưa lên GitHub

File `.gitignore` ở gốc dự án đã lo phần này. Tuyệt đối không commit:

- `bin/`, `obj/` — thư mục build của .NET
- `node_modules/` — thư viện JavaScript (dự án không dùng gói nào, nhưng vẫn chặn cho chắc)
- `*.db`, `*.bak` — dữ liệu cửa hàng thật
- `.vs/`, `.vscode/` — cấu hình riêng của máy
- `*.user` — cấu hình cá nhân của Visual Studio

Nếu lỡ `git add` một file như vậy:

```powershell
git restore --staged bin/
```

Nếu lỡ commit và push rồi, báo nhóm trưởng ngay — cần xử lý riêng, không tự ý `git push --force`.

---

## 8. Thứ tự ghép bài

Ba người đầu làm tầng nghiệp vụ, ba người sau làm giao diện. Vì giao diện cần tầng nghiệp vụ,
thứ tự ghép Pull Request là:

1. **Thành viên 1** — lớp sản phẩm (nền của mọi thứ)
2. **Thành viên 2** — giỏ hàng và hóa đơn
3. **Thành viên 3** — kho hàng và lưu trữ
4. **Thành viên 4** — người dùng và xác thực
5. **Thành viên 5** — đăng nhập và bán hàng
6. **Thành viên 6** — kho, doanh thu, nhân sự

Sau **mỗi** lần ghép, nhóm trưởng chạy lại:

```powershell
cd web
npm test
```

---

## 9. Mỗi người đọc thêm phần của mình

| Thành viên | Tài liệu riêng |
|---|---|
| 1 | [member-1-models.md](team/member-1-models.md) |
| 2 | [member-2-sales.md](team/member-2-sales.md) |
| 3 | [member-3-inventory.md](team/member-3-inventory.md) |
| 4 | [member-4-auth.md](team/member-4-auth.md) |
| 5 | [member-5-checkout.md](team/member-5-checkout.md) |
| 6 | [member-6-dashboard.md](team/member-6-dashboard.md) |
