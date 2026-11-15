/**
 * SmartMart · Kiểm thử người dùng và xác thực
 * ---------------------------------------------------------------------------
 * Toàn bộ API ở đây là bất đồng bộ (băm mật khẩu là phép tính nặng), nên mọi
 * test đều dùng async/await thay vì then().
 *
 * Trọng tâm: mật khẩu thô không bao giờ xuất hiện trong dữ liệu lưu, và mỗi
 * vai trò chỉ vào được đúng những màn hình của mình.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { SCREENS, UserRole } from "../js/core/constants.js";
import {
  User,
  Cashier,
  Manager,
  Admin,
  createUser,
  userFromJSON,
  userRoleLabel
} from "../js/core/users.js";
import { hashPassword, verifyPassword, AuthService } from "../js/core/auth.js";

const PASSWORD = "matkhau123";

/** Dựng một người dùng thật (có credential băm) để dùng lại trong nhiều test. */
async function makeUser(username, role, password = PASSWORD) {
  return createUser({ username, password, role });
}

/** Ba tài khoản mẫu giống seed của ứng dụng. */
async function seedService() {
  return new AuthService([
    await makeUser("admin", UserRole.Admin),
    await makeUser("manager", UserRole.Manager),
    await makeUser("cashier", UserRole.Cashier)
  ]);
}

/**
 * Người thực hiện cho các thao tác quản lý nhân sự: lấy chính tài khoản admin
 * trong dịch vụ, nên kiểm thử đi đúng đường thật (phải có quyền màn hình Nhân sự).
 */
function adminOf(auth) {
  return auth.find("admin");
}

// ---------------------------------------------------------------------------
// Băm mật khẩu
// ---------------------------------------------------------------------------

describe("hashPassword", () => {
  test("trả chuỗi 'base64(salt):base64(hash)' đúng định dạng", async () => {
    const credential = await hashPassword(PASSWORD);
    const parts = credential.split(":");
    assert.equal(parts.length, 2);
    // Salt 16 byte → 24 ký tự base64; hash 32 byte → 44 ký tự.
    assert.equal(parts[0].length, 24);
    assert.equal(parts[1].length, 44);
  });

  test("cùng một mật khẩu nhưng hai lần băm cho ra hai chuỗi khác nhau", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);
    assert.notEqual(first, second);
    // Khác vì salt khác, không phải vì hash sai.
    assert.notEqual(first.split(":")[0], second.split(":")[0]);
  });

  test("mật khẩu thô không xuất hiện trong credential", async () => {
    const credential = await hashPassword(PASSWORD);
    assert.equal(credential.includes(PASSWORD), false);
  });
});

// ---------------------------------------------------------------------------
// Kiểm tra mật khẩu
// ---------------------------------------------------------------------------

describe("verifyPassword", () => {
  test("đúng mật khẩu thì trả true", async () => {
    const credential = await hashPassword(PASSWORD);
    assert.equal(await verifyPassword(PASSWORD, credential), true);
  });

  test("sai mật khẩu thì trả false", async () => {
    const credential = await hashPassword(PASSWORD);
    assert.equal(await verifyPassword("matkhau999", credential), false);
    assert.equal(await verifyPassword("", credential), false);
    // Sai chỉ một ký tự hoa/thường cũng phải trượt.
    assert.equal(await verifyPassword("Matkhau123", credential), false);
  });

  test("credential rỗng hoặc hỏng trả false và không ném lỗi", async () => {
    const broken = [
      "",
      "   ",
      "khongcodauhai",
      "saikhongcohash:",
      ":hashkhongcosalt",
      "a:b:c",
      "!!!:###",
      "AAAA:AAAA",
      null,
      undefined,
      42,
      {}
    ];
    for (const credential of broken) {
      assert.equal(await verifyPassword(PASSWORD, credential), false, String(credential));
    }
  });

  test("mật khẩu rỗng vẫn băm và kiểm tra được (trách nhiệm chặn thuộc về lớp trên)", async () => {
    const credential = await hashPassword("");
    assert.equal(await verifyPassword("", credential), true);
    assert.equal(await verifyPassword("x", credential), false);
  });
});

// ---------------------------------------------------------------------------
// Cây lớp người dùng
// ---------------------------------------------------------------------------

describe("User và các lớp con", () => {
  test("new User() ném TypeError vì lớp cơ sở là trừu tượng", () => {
    assert.throws(() => new User(), TypeError);
    assert.throws(() => new User({ username: "a", role: UserRole.Admin, credential: "x:y" }), TypeError);
  });

  test("lớp cơ sở ném lỗi ở allowedScreens, lớp con ghi đè (đa hình)", () => {
    const cashier = new Cashier({ username: "an", credential: "salt:hash" });
    const screens = cashier.allowedScreens();
    assert.deepEqual(screens, [SCREENS.Checkout]);
    // Ghi đè chứ không sửa mảng dùng chung: sửa kết quả không ảnh hưởng người khác.
    screens.push("Hacked");
    assert.deepEqual(cashier.allowedScreens(), [SCREENS.Checkout]);
  });

  test("mỗi lớp con có đúng bộ màn hình của vai trò", () => {
    const cashier = new Cashier({ username: "an", credential: "salt:hash" });
    const manager = new Manager({ username: "binh", credential: "salt:hash" });
    const admin = new Admin({ username: "chi", credential: "salt:hash" });

    assert.deepEqual(cashier.allowedScreens(), [SCREENS.Checkout]);
    assert.deepEqual(manager.allowedScreens(), [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports]);
    assert.deepEqual(admin.allowedScreens(), [
      SCREENS.Checkout,
      SCREENS.Inventory,
      SCREENS.Reports,
      SCREENS.Users
    ]);
  });

  test("vai trò của lớp con là cố định, không phụ thuộc dữ liệu truyền vào", () => {
    assert.equal(new Cashier({ username: "an" }).role, UserRole.Cashier);
    assert.equal(new Manager({ username: "binh" }).role, UserRole.Manager);
    assert.equal(new Admin({ username: "chi" }).role, UserRole.Admin);
  });

  test("canAccess đúng cho từng vai trò", () => {
    const cashier = new Cashier({ username: "an", credential: "salt:hash" });
    const manager = new Manager({ username: "binh", credential: "salt:hash" });
    const admin = new Admin({ username: "chi", credential: "salt:hash" });

    assert.equal(cashier.canAccess(SCREENS.Checkout), true);
    assert.equal(cashier.canAccess(SCREENS.Inventory), false);
    assert.equal(cashier.canAccess(SCREENS.Reports), false);
    assert.equal(cashier.canAccess(SCREENS.Users), false);

    assert.equal(manager.canAccess(SCREENS.Checkout), true);
    assert.equal(manager.canAccess(SCREENS.Inventory), true);
    assert.equal(manager.canAccess(SCREENS.Reports), true);
    assert.equal(manager.canAccess(SCREENS.Users), false);

    for (const screen of Object.values(SCREENS)) {
      assert.equal(admin.canAccess(screen), true, screen);
    }
  });

  test("displayRole trả nhãn tiếng Việt", () => {
    assert.equal(new Cashier({ username: "an" }).displayRole, "Thu ngân");
    assert.equal(new Manager({ username: "binh" }).displayRole, "Quản lý");
    assert.equal(new Admin({ username: "chi" }).displayRole, "Quản trị viên");
    assert.equal(userRoleLabel(UserRole.Admin), "Quản trị viên");
  });

  test("username/role/credential chỉ đọc qua getter", () => {
    const user = new Cashier({ username: "an", credential: "salt:hash" });
    assert.equal(user.username, "an");
    assert.equal(user.credential, "salt:hash");
    // Ghi vào thuộc tính không tồn tại sẽ ném TypeError ở ES module (chế độ nghiêm ngặt).
    assert.throws(() => {
      user.username = "ke-gia-mao";
    }, TypeError);
    assert.equal(user.username, "an");
  });

  test("toJSON trả đúng ba trường", () => {
    const user = new Admin({ username: "chi", credential: "salt:hash" });
    assert.deepEqual(user.toJSON(), { username: "chi", role: UserRole.Admin, credential: "salt:hash" });
  });
});

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

describe("createUser", () => {
  test("băm mật khẩu và trả đúng lớp con theo vai trò", async () => {
    const user = await makeUser("nhanvien", UserRole.Cashier);
    assert.ok(user instanceof Cashier);
    assert.ok(user instanceof User);
    assert.equal(await verifyPassword(PASSWORD, user.credential), true);
    assert.equal(user.credential.includes(PASSWORD), false);
  });

  test("từ chối tên đăng nhập rỗng, quá ngắn hoặc có khoảng trắng", async () => {
    await assert.rejects(() => makeUser("", UserRole.Cashier), /Tên đăng nhập/);
    await assert.rejects(() => makeUser("  ", UserRole.Cashier), /Tên đăng nhập/);
    await assert.rejects(() => makeUser("ab", UserRole.Cashier), /3 ký tự/);
    await assert.rejects(() => makeUser("nguyen van a", UserRole.Cashier), /khoảng trắng/);
  });

  test("từ chối mật khẩu ngắn hơn 6 ký tự và vai trò không hợp lệ", async () => {
    await assert.rejects(() => makeUser("nhanvien", UserRole.Cashier, "12345"), /6 ký tự/);
    await assert.rejects(() => makeUser("nhanvien", "Boss"), /Vai trò/);
    await assert.rejects(() => makeUser("nhanvien", undefined), /Vai trò/);
  });
});

// ---------------------------------------------------------------------------
// userFromJSON
// ---------------------------------------------------------------------------

describe("userFromJSON", () => {
  test("dựng lại đúng lớp con và giữ nguyên credential (không băm lại)", async () => {
    const original = await makeUser("admin", UserRole.Admin);
    const restored = userFromJSON(original.toJSON());

    assert.ok(restored instanceof Admin);
    assert.equal(restored.role, UserRole.Admin);
    assert.equal(restored.username, "admin");
    // Nếu băm lại, credential sẽ khác đi và mật khẩu cũ không còn đăng nhập được.
    assert.equal(restored.credential, original.credential);
    assert.equal(await verifyPassword(PASSWORD, restored.credential), true);
  });

  test("toJSON → userFromJSON → toJSON là vòng tròn kín", async () => {
    const original = await makeUser("manager", UserRole.Manager);
    const once = userFromJSON(original.toJSON());
    const twice = userFromJSON(once.toJSON());
    assert.deepEqual(twice.toJSON(), original.toJSON());
  });

  test("đi qua JSON.stringify/parse (đường lưu localStorage) vẫn giữ nguyên và đăng nhập được", async () => {
    const auth = await seedService();
    // Sao chép đúng cách store.js lưu: map(toJSON) rồi ghi xuống máy.
    const saved = JSON.stringify(auth.users.map((user) => user.toJSON()));
    assert.equal(saved.includes(PASSWORD), false);

    const restored = new AuthService(JSON.parse(saved).map(userFromJSON));
    assert.equal(restored.users.length, 3);
    const login = await restored.login("manager", PASSWORD);
    assert.equal(login.user?.username, "manager");
    assert.ok(login.user instanceof Manager);
    assert.deepEqual(login.user.allowedScreens(), [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports]);
  });

  test("mỗi vai trò đăng nhập xong vào đúng màn hình đầu tiên của mình", async () => {
    const auth = await seedService();
    const expected = [
      ["admin", SCREENS.Checkout, 4],
      ["manager", SCREENS.Checkout, 3],
      ["cashier", SCREENS.Checkout, 1]
    ];
    for (const [username, firstScreen, screenCount] of expected) {
      const { user } = await auth.login(username, PASSWORD);
      assert.equal(user.allowedScreens()[0], firstScreen, username);
      assert.equal(user.allowedScreens().length, screenCount, username);
    }
  });

  test("dữ liệu hỏng hoặc thiếu thì ném lỗi tiếng Việt", () => {
    assert.throws(() => userFromJSON(null), /không hợp lệ/);
    assert.throws(() => userFromJSON(undefined), /không hợp lệ/);
    assert.throws(() => userFromJSON({ username: "a", role: "Boss" }), /Vai trò/);
    assert.throws(() => userFromJSON({ username: "", role: UserRole.Admin }), /Tên đăng nhập/);
  });
});

// ---------------------------------------------------------------------------
// AuthService — đăng nhập
// ---------------------------------------------------------------------------

describe("AuthService.login", () => {
  test("đúng mật khẩu thì trả về người dùng", async () => {
    const auth = await seedService();
    const result = await auth.login("admin", PASSWORD);
    assert.equal(result.error, undefined);
    assert.equal(result.user.username, "admin");
    assert.ok(result.user instanceof Admin);
  });

  test("sai mật khẩu trả lỗi, không trả người dùng", async () => {
    const auth = await seedService();
    const result = await auth.login("admin", "saibet");
    assert.equal(result.user, undefined);
    assert.equal(result.error, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
  });

  test("tên đăng nhập không tồn tại trả cùng một thông báo (không tiết lộ tên có thật hay không)", async () => {
    const auth = await seedService();
    const wrongPassword = await auth.login("admin", "saibet");
    const unknownName = await auth.login("khongtontai", PASSWORD);
    assert.equal(unknownName.error, wrongPassword.error);
  });

  test("không nhận mật khẩu thô làm mật khẩu (so sánh đúng chiều)", async () => {
    const auth = await seedService();
    const user = auth.find("cashier");
    const rawAttempt = await auth.login("cashier", user.credential);
    assert.equal(rawAttempt.error, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
  });

  test("tên đăng nhập không phân biệt hoa thường", async () => {
    const auth = await seedService();
    const result = await auth.login("AdMiN", PASSWORD);
    assert.equal(result.user?.username, "admin");
  });
});

// ---------------------------------------------------------------------------
// AuthService — quản lý người dùng
// ---------------------------------------------------------------------------

describe("AuthService.addUser", () => {
  test("thêm thành công thì đăng nhập được bằng mật khẩu mới", async () => {
    const auth = await seedService();
    const added = await auth.addUser({ username: "nhanvien2", password: "matkhaumoi", role: UserRole.Manager }, adminOf(auth));
    assert.ok(added.user instanceof Manager);
    assert.equal(auth.users.length, 4);

    const login = await auth.login("nhanvien2", "matkhaumoi");
    assert.equal(login.user?.username, "nhanvien2");
    assert.equal(login.user?.role, UserRole.Manager);
  });

  test("trùng tên đăng nhập (kể cả khác hoa thường) bị từ chối", async () => {
    const auth = await seedService();
    const duplicate = await auth.addUser({ username: "ADMIN", password: "matkhaumoi", role: UserRole.Cashier }, adminOf(auth));
    assert.equal(duplicate.user, undefined);
    assert.match(duplicate.error, /đã có người dùng/);
    assert.equal(auth.users.length, 3);
  });

  test("dữ liệu không hợp lệ trả error tiếng Việt thay vì ném lỗi", async () => {
    const auth = await seedService();
    const shortPassword = await auth.addUser({ username: "nhanvien3", password: "123", role: UserRole.Cashier }, adminOf(auth));
    assert.match(shortPassword.error, /6 ký tự/);

    const badRole = await auth.addUser({ username: "nhanvien4", password: "matkhaumoi", role: "Boss" }, adminOf(auth));
    assert.match(badRole.error, /Vai trò/);
    assert.equal(auth.users.length, 3);
  });
});

describe("AuthService.changeRole", () => {
  test("đổi vai trò thì lớp và bộ màn hình đổi theo, mật khẩu cũ vẫn dùng được", async () => {
    const auth = await seedService();
    const result = auth.changeRole("cashier", UserRole.Manager, adminOf(auth));
    assert.equal(result.error, undefined);
    assert.equal(result.user.role, UserRole.Manager);
    assert.ok(result.user instanceof Manager);
    assert.deepEqual(result.user.allowedScreens(), [SCREENS.Checkout, SCREENS.Inventory, SCREENS.Reports]);

    const login = await auth.login("cashier", PASSWORD);
    assert.equal(login.user?.role, UserRole.Manager);
    assert.equal(auth.users.length, 3);
  });

  test("không hạ được quyền quản trị viên cuối cùng", async () => {
    const auth = await seedService();
    const result = auth.changeRole("admin", UserRole.Cashier, adminOf(auth));
    assert.equal(result.user, undefined);
    assert.match(result.error, /quản trị viên cuối cùng/);
    assert.equal(auth.find("admin").role, UserRole.Admin);
  });

  test("có từ hai quản trị viên trở lên thì hạ quyền được", async () => {
    const auth = await seedService();
    await auth.addUser({ username: "admin2", password: "matkhaumoi", role: UserRole.Admin }, adminOf(auth));

    const result = auth.changeRole("admin2", UserRole.Cashier, adminOf(auth));
    assert.equal(result.error, undefined);
    assert.equal(result.user.role, UserRole.Cashier);
    // Còn lại một quản trị viên duy nhất nên giờ lại bị chặn.
    assert.match(auth.changeRole("admin", UserRole.Cashier, adminOf(auth)).error, /cuối cùng/);
  });

  test("vai trò không hợp lệ hoặc tên không tồn tại trả error", async () => {
    const auth = await seedService();
    assert.match(auth.changeRole("cashier", "Boss", adminOf(auth)).error, /Vai trò/);
    assert.match(auth.changeRole("khongtontai", UserRole.Admin, adminOf(auth)).error, /Không tìm thấy/);
  });
});

describe("AuthService.removeUser", () => {
  test("xoá được người dùng và sau đó không đăng nhập được nữa", async () => {
    const auth = await seedService();
    const result = auth.removeUser("cashier", adminOf(auth));
    assert.deepEqual(result, { ok: true });
    assert.equal(auth.users.length, 2);
    assert.equal(auth.find("cashier"), undefined);

    const login = await auth.login("cashier", PASSWORD);
    assert.equal(login.user, undefined);
    assert.equal(login.error, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
  });

  test("không xoá được quản trị viên cuối cùng", async () => {
    const auth = await seedService();
    const result = auth.removeUser("admin", adminOf(auth));
    assert.equal(result.ok, undefined);
    assert.match(result.error, /quản trị viên cuối cùng/);
    assert.equal(auth.users.length, 3);
  });

  test("xoá tên không tồn tại trả error tiếng Việt", async () => {
    const auth = await seedService();
    const result = auth.removeUser("khongtontai", adminOf(auth));
    assert.match(result.error, /Không tìm thấy/);
  });
});

// ---------------------------------------------------------------------------
// Phân quyền quản lý nhân sự — chặn ở tầng dịch vụ, không chỉ ẩn nút
// ---------------------------------------------------------------------------

describe("AuthService — phân quyền quản lý nhân sự", () => {
  test("thu ngân không thêm được nhân sự", async () => {
    const auth = await seedService();
    const result = await auth.addUser(
      { username: "nguoila", password: "matkhaumoi", role: UserRole.Admin },
      auth.find("cashier")
    );
    assert.equal(result.user, undefined);
    assert.match(result.error, /không có quyền thêm nhân sự/);
    assert.equal(auth.users.length, 3);
  });

  test("quản lý (không phải quản trị viên) không đổi được vai trò", async () => {
    const auth = await seedService();
    const result = auth.changeRole("cashier", UserRole.Admin, auth.find("manager"));
    assert.equal(result.user, undefined);
    assert.match(result.error, /không có quyền đổi vai trò/);
    assert.equal(auth.find("cashier").role, UserRole.Cashier);
  });

  test("quản lý không xoá được nhân sự", async () => {
    const auth = await seedService();
    const result = auth.removeUser("cashier", auth.find("manager"));
    assert.equal(result.ok, undefined);
    assert.match(result.error, /không có quyền xoá nhân sự/);
    assert.equal(auth.users.length, 3);
  });

  test("thiếu người thực hiện thì bị chặn, không mặc định cho qua", async () => {
    const auth = await seedService();
    assert.match((await auth.addUser({ username: "x", password: "matkhaumoi", role: UserRole.Cashier })).error, /Không xác định được người thực hiện/);
    assert.match(auth.changeRole("cashier", UserRole.Admin).error, /Không xác định được người thực hiện/);
    assert.match(auth.removeUser("cashier").error, /Không xác định được người thực hiện/);
    assert.equal(auth.users.length, 3);
  });
});

// ---------------------------------------------------------------------------
// AuthService — danh sách và tra cứu
// ---------------------------------------------------------------------------

describe("AuthService — danh sách người dùng", () => {
  test("find không phân biệt hoa thường và trả undefined khi không có", async () => {
    const auth = await seedService();
    assert.equal(auth.find("MANAGER").username, "manager");
    assert.equal(auth.find("khongtontai"), undefined);
    assert.equal(auth.find(""), undefined);
  });

  test("get users trả bản sao nên sửa mảng bên ngoài không ảnh hưởng dịch vụ", async () => {
    const auth = await seedService();
    const list = auth.users;
    list.push(new Cashier({ username: "ma", credential: "salt:hash" }));
    assert.equal(auth.users.length, 3);
    assert.equal(auth.find("ma"), undefined);
  });

  test("setUsers thay cả danh sách và bỏ qua bản ghi hỏng", async () => {
    const auth = await seedService();
    const admin = auth.find("admin");
    auth.setUsers([admin.toJSON(), { username: "hong", role: "Boss" }, null]);
    assert.equal(auth.users.length, 1);
    assert.equal(auth.find("admin").username, "admin");
    assert.equal((await auth.login("admin", PASSWORD)).user?.username, "admin");
  });

  test("setUsers nhận thẳng đối tượng User đang có", async () => {
    const auth = new AuthService([]);
    const admin = await makeUser("admin", UserRole.Admin);
    auth.setUsers([admin]);
    assert.equal(auth.users[0], admin);
  });

  test("constructor mặc định là danh sách rỗng", async () => {
    const auth = new AuthService();
    assert.deepEqual(auth.users, []);
    assert.equal((await auth.login("admin", PASSWORD)).error, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
  });
});
