# Desktop-side verification — SmartMart permission enforcement

**Scope:** READ-ONLY verification of the DESKTOP side (C# .NET 8 WinForms + `SmartMart.Core`).
Uncommitted working-tree changes adding actor-based permission enforcement to the Core layer.
The pure-JS `web/` app was **not** reviewed (out of scope for this pass).

**Verified by:** teammate `desktop-verifier` · 2026-11-15 · host `D:\Down\SmartMart`

---

## Verdict

**PASS** — with 5 non-blocking defects (2 real gate bypasses on the public Core surface, 1 latent
unhandled-exception crash path, 1 UI-only invariant, 1 dead branch).

The specific claims under test all hold:

| Claim | Result |
|---|---|
| Every `Inventory.Add/Restock/Withdraw/SetPrice` call site passes an actor | **PASS** |
| Every `StoreSession.AddUser/ChangeRole/RemoveUser` call site passes an actor | **PASS** |
| No call site missed anywhere in App/Core/Tests | **PASS** (grep, see Evidence) |
| No actor passed as `null` where a real user should be | **PASS** |
| Manager (not Admin) allowed to restock, denied user management | **PASS** (empirically confirmed) |
| Desktop app actually launches | **PASS** (real window, 40 s, no crash) |
| SQLite DB created at `%LOCALAPPDATA%\SmartMart\smartmart.db` | **PASS** |
| In-memory fallback works when the DB cannot be opened | **PASS** |
| "Add product" `TryAction` + `Find(...) is null` guard cannot half-apply | **PASS** for the reachable path (see Defect 3 for the crash caveat) |

Nothing found that makes the feature wrong for the shipped UI. The defects are about the
*public Core surface* still permitting what the gate is meant to forbid, not about the UI flow.

---

## Evidence

### 1. Call-site audit (exhaustive grep over App + Core + Tests)

Every production call site passes `user`; every test call site passes an explicit real actor or an
explicit `null` inside an `Assert.Throws`.

```
\.Restock\(  -> 7 hits
  SmartMart.App\ManagementViews.cs:53   store.Inventory.Restock(product.Id,(int)dialog.Value,user)
  SmartMart.Core\Domain.cs:232          (Find(id) ?? throw ...).Restock(qty)   <- internal unchecked helper
  CommerceTests.cs:50,51                p.Restock(...)                        <- Product-level, not Inventory
  CommerceTests.cs:98                   inventory.Restock(1,5,cashier)        <- expects throw
  CommerceTests.cs:110                  inventory.Restock(1,5,null)           <- expects throw
  CommerceTests.cs:120                  inventory.Restock(1,5,manager)

\.Withdraw\( -> 3 hits
  ManagementViews.cs:53   store.Inventory.Withdraw(product.Id,(int)dialog.Value,user)
  CommerceTests.cs:99     cashier -> expects throw
  CommerceTests.cs:122    manager -> allowed

\.SetPrice\( -> 4 hits
  ManagementViews.cs:43   inventory.SetPrice(p.Id,dialog.Value,user)
  CommerceTests.cs:100,111,124

\.AddUser\(  -> 4 hits
  ManagementViews.cs:124  store.AddUser(dialog.Member,user)
  CommerceTests.cs:75,137,143

\.ChangeRole\( -> 4 hits
  ManagementViews.cs:132  store.ChangeRole(selected,dialog.Role,user)
  CommerceTests.cs:75,138,145

\.RemoveUser\( -> 3 hits
  ManagementViews.cs:139  store.RemoveUser(selected,user)
  CommerceTests.cs:139,147

inventory.Add( / Inventory.Add( -> 2 hits
  ManagementViews.cs:20   inventory.Add(dialog.Product,user)
  CommerceTests.cs:101    cashier -> expects throw
```

No production call site was missed. The only `null` actors are deliberate fail-closed test cases.
`AddUnchecked` has exactly one caller — `StoreSession.cs:68`, the pre-login catalog-seed path — which
is legitimate because no user is logged in at that moment.

### 2. Launch test

```
$ dotnet run --project D:\Down\SmartMart\SmartMart.App -c Release --no-build   (background)
... 40 s later ...
$ Get-Process -Name SmartMart.App
  Id       : 54592
  ProcessName : SmartMart.App
  MainWindowTitle : SmartMart · Xin chào bạn
  Responding  : True
  StartTime   : 11/15/2026 12:19:54 PM
  MainWindowHandle : 4264434
```

The app **does** open a real WinForms window in this environment (desktop session is available).
It stayed responsive for the full observation window with **no crash, no unhandled exception, and
empty stderr/stdout**. Process was then force-killed; `remaining=0` confirmed. The background job
settled as `exit code: 1`, which is the expected kill artifact, not an app failure.

### 3. Database

```
%LOCALAPPDATA% = C:\Users\huyth\AppData\Local
Test-Path "$env:LOCALAPPDATA\SmartMart"  ->  False   (before launch)
Get-ChildItem ...\SmartMart
  smartmart.db   24576 bytes   11/15/2026 12:19:54 PM
header: "SQLite format 3"
payload: {"Products":[ ...72 items... ],"Sales":[],
          "Users":[{"Username":"admin","Role":2,...},{"Username":"manager","Role":1,...},
                   {"Username":"cashier","Role":0,...}],
          "Currency":"VND","Version":2,"CatalogRevision":1}
```

The DB directory and file are created on first launch, are a valid SQLite 3 database, and contain the
expected seeded catalog + three hashed accounts + the VND currency marker.

### 4. In-memory fallback

```
--- unopenable path (directory squatting on the .db filename) ---
StorageWarning = "Không mở được dữ liệu trên máy. Thay đổi chỉ tồn tại trong phiên này."
products=72  users=3
Restock in fallback mode: OK, stock=17
Save() returns False

--- corrupt DB file (8 garbage bytes) ---
StorageWarning = "Không mở được dữ liệu trên máy. ..."
products=72  users=3
```

Fallback works correctly for both failure modes: the session stays usable with a full in-memory seed,
`Save()` honestly returns `false`, and `StorageWarning` is surfaced in the status bar via
`MainForm.UpdateStatus`. No silent data-loss illusion.

### 5. Empirical role matrix (out-of-repo probe referencing `SmartMart.Core`)

```
role    | Add    | Restock | Withdraw | SetPrice
Admin   | ALLOWED| ALLOWED | ALLOWED  | ALLOWED
Manager | ALLOWED| ALLOWED | ALLOWED  | ALLOWED
Cashier | DENIED | DENIED  | DENIED   | DENIED
null    | DENIED | DENIED  | DENIED   | DENIED

role    | AddUser | ChangeRole | RemoveUser
Admin   | ALLOWED | ALLOWED    | ALLOWED*
Manager | DENIED  | DENIED     | DENIED
Cashier | DENIED  | DENIED     | DENIED
null    | DENIED  | DENIED     | DENIED

side effects after Cashier denials: stock 12->12, price 62250->62250, count 72->72  (no partial write)
Manager happy path: stock=10, price=25000, product 999 added
```

\*The probe's Admin `RemoveUser` line shows `ArgumentException` only because the probe had already
mutated that same target via `ChangeRole` (stale reference); a clean Admin remove succeeds — confirmed
by `CommerceTests.cs:147`.

Denials are genuinely fail-closed: state is provably untouched after a rejected call, and auth is
checked **before** validation, so a Cashier cannot use error messages to probe the inventory
(`cashier + duplicate-id/blank-name -> UnauthorizedAccessException`, not `ArgumentException`).

---

## Per-role permission matrix

Definitions from `SmartMart.Core\Domain.cs:89-106`:

| Role | `AllowedScreens()` | Nav rail | Inventory gate | User-management gate |
|---|---|---|---|---|
| **Cashier** | `["Checkout"]` | Checkout only | **DENIED** | **DENIED** |
| **Manager** | `["Checkout","Inventory","Reports"]` | + Kho hàng, Doanh thu | **ALLOWED** | **DENIED** |
| **Admin** | `["Checkout","Inventory","Reports","Users"]` | + Nhân sự | **ALLOWED** | **ALLOWED** |
| **null actor** | — | — | **DENIED** | **DENIED** |

How each gate resolves:

- **Inventory gate** — `Domain.cs:196` `RequireManager` requires `AllowedScreens().Contains("Inventory")`.
  Cashier's list lacks it → denied. Manager and Admin both have it → allowed. Correct.
- **User-management gate** — `StoreSession.cs:105` `RequireAdmin` requires `AllowedScreens().Contains("Users")`.
  Only Admin's list contains `"Users"` → only Admin allowed. Correct.
- **Null actor** — both gates throw before any state change. Correct fail-closed default.
- **Defense in depth** — the nav rail only renders permitted screens (`MainForm.cs:47`), `Navigate` refuses
  a non-permitted screen (`MainForm.cs:63`), and the Core gate rejects direct calls anyway. Three layers.

Note the two gates are keyed off **screen membership**, not off the `UserRole` enum. That is fine and
arguably better (single source of truth), but it means the security boundary is whatever
`AllowedScreens()` returns — see Defect 5.

---

## Problems found

### Defect 1 — `StoreSession.Users` is a public mutable `List<User>`; the admin gate is bypassable (MEDIUM)

`SmartMart.Core\StoreSession.cs:11`

```csharp
public List<User> Users { get; } = SeedData.Users().ToList();
```

The new `AddUser`/`ChangeRole`/`RemoveUser` methods enforce `RequireAdmin`, but the backing list is
still exposed and writable. Any caller — including a Cashier's code path, a future view, or the JS/web
side if it ever binds to Core — can skip the gate entirely:

```
gated AddUser as cashier: DENIED (good)
store.Users.Add(new Admin("pw") { Username = "evil" });
Users.Add bypass: evil present=True        <-- gate bypassed
store.Users.Remove(cashier)                <-- gate bypassed
```

This is exactly the class of "compile-time-silent gap" the review asked about. The **shipped UI does
not** use it (the diff correctly migrated `store.Users.Add`/`.Remove` at `ManagementViews.cs:124/139`
to the gated methods), so there is no live exploit today. It is a latent hole, not a current failure.
Same reasoning applies to `Inventory.Products` being an `IReadOnlyList` — that one is correctly read-only.

### Defect 2 — Product-level mutators bypass the inventory gate (MEDIUM)

`SmartMart.Core\Domain.cs:25` (`UnitPrice` setter) and `Domain.cs:31` (`public void Restock(int qty)`)

```
gated Restock as cashier: stock 12 -> 12 (expect unchanged)   [good]
p.Restock(500); p.UnitPrice = 1m;
Product.Restock(500) + UnitPrice=1 bypass: stock=512 price=1   <-- gate bypassed
```

`Inventory` guards its own methods, but it hands out live `Product` references (`Find`, `Products`) whose
own mutators are public. The diff actually **fixed the one place this was exploited** — `AdjustStock` used
to call `product.Restock(...)` / `product.TrySell(...)` directly and now goes through
`store.Inventory.Restock/Withdraw` (`ManagementViews.cs:53`) — so no live path remains in the App
(verified by grep: the only `Product`-level mutations in `SmartMart.App` are object-initializer
`UnitPrice=` values in `Dialogs.cs:133-135`, which construct new products rather than mutate stored ones).
But the public surface still permits it. `TrySell` must stay public (it is the stock primitive
`WithdrawUnchecked` relies on), so the cleanest fix is making `Restock(int)` and the `UnitPrice` setter
`internal` and adding an `internal` setter path for `ProductData.ToProduct()`.

### Defect 3 — `TryAction` does not catch `UnauthorizedAccessException`, and there is no global handler (MEDIUM)

`SmartMart.App\MainForm.cs:79` — the filter is
`catch(Exception ex) when(ex is InvalidOperationException or ArgumentException or OverflowException)`.

```
UnauthorizedAccessException  is ArgumentException: False   is InvalidOperationException: False
KeyNotFoundException         is ArgumentException: False   is InvalidOperationException: False
=> TryAction's catch filter does NOT catch either
```

Every new gate throws `UnauthorizedAccessException` (`Domain.cs:198,199`, `StoreSession.cs:107,108`) and
`ChangeRole`/`RemoveUser` throw `KeyNotFoundException`-adjacent `ArgumentException` in some paths.
`Program.cs:14` installs **no** `Application.ThreadException` / `AppDomain.UnhandledException` handler
(verified by grep — zero hits). So an `UnauthorizedAccessException` escaping `TryAction` reaches the
WinForms default handler and terminates the app.

Reachability today: **not reachable through the shipped UI**, because the nav rail and `Navigate`
(`MainForm.cs:47,63`) never let a Cashier open the Inventory screen, so `BuildInventory`'s buttons are
never wired for them. This is a latent crash, not a live one. It becomes live the moment any role gains
a screen without the matching gate, or any new gated call is added without widening the filter.
Note also that `ChangeRole` (`ManagementViews.cs:132`) and `RemoveUser` (`ManagementViews.cs:139`) are
**not wrapped in `TryAction` at all**, unlike `AddUser` — an inconsistent pattern in the same method.

### Defect 4 — Last-admin invariant is enforced only in the UI (LOW/MEDIUM)

`SmartMart.App\ManagementViews.cs:131` guards the demotion of the final Admin:

```csharp
if(selected.Role==UserRole.Admin&&dialog.Role!=UserRole.Admin&&store.Users.Count(x=>x.Role==UserRole.Admin)<=1)return;
```

`StoreSession.RemoveUser` (`StoreSession.cs:127-131`) has no such check, and neither does `ChangeRole`:

```
admins before=1
admins after removing last admin via Core = 0    <-- store is now unmanageable
```

Same class of bug the whole change set is about: a UI-only guard protecting a Core invariant. A store
with zero Admins can never add another Admin (only an Admin may call `AddUser`), so this is a permanent
lockout. Also note the UI guard silently `return`s with **no message to the user** — the button appears
to do nothing.

### Defect 5 — `WithdrawUnchecked`'s expiry branch is dead code (LOW, informational)

`SmartMart.Core\Domain.cs:250` claims to reject expired goods, but `Product.TrySell` (`Domain.cs:32`)
never consults `CanSell`/`IsExpired`:

```
expired product: CanSell=False IsExpired=True
TrySell(3) returns True, stock 10 -> 7
Withdraw expired qty=3 -> SUCCEEDED
```

So the `"Không thể xuất kho: mặt hàng đã hết hạn hoặc ngừng bán."` message is **unreachable** — the only
throws that can occur are `qty>stock` ("Số lượng trong kho không đủ.") and `qty<=0`
(`ArgumentOutOfRangeException`, which also surfaces a raw English parameter message to the user).
Selling is still safe: `ShoppingCart` checks `CanSell` before `TrySell`, so expired stock cannot be sold
through checkout. Whether withdrawing expired stock should be allowed is a business decision — removing
expired goods from the shelf is arguably legitimate — but the code comment and the error string both
promise the opposite of what happens. Either delete the branch or make `TrySell` expiry-aware.

---

## Recommended fixes

1. **Encapsulate `StoreSession.Users`** — change `StoreSession.cs:11` to
   `private readonly List<User> users = ...` with `public IReadOnlyList<User> Users => users.AsReadOnly();`,
   and keep `AddUser`/`ChangeRole`/`RemoveUser` as the only mutators. Fixes Defect 1 with no call-site
   changes beyond the (already-updated) `ManagementViews` usages. `LoginForm.cs:44` and
   `ManagementViews.cs:117,120,124,131` only read, so they compile unchanged.
2. **Close the product-level hole** — make `Product.Restock(int)` `internal` and give `UnitPrice` an
   `internal` setter (or an `internal void SetPriceCore(decimal)`), leaving the public path as
   `Inventory.Restock`/`Inventory.SetPrice`. Fixes Defect 2. `ProductData.ToProduct()` uses object
   initializers inside `SmartMart.Core`, so `internal` is sufficient.
3. **Widen the `TryAction` filter and add a global handler** — at `MainForm.cs:79` add
   `or UnauthorizedAccessException or KeyNotFoundException`, and in `Program.cs` before
   `Application.Run` add `Application.ThreadException += ...` (and
   `Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException)`) to show
   `Design.Notify` and keep the app alive. Also wrap `ChangeRole` (`ManagementViews.cs:132`) and
   `RemoveUser` (`ManagementViews.cs:139`) in `TryAction` for consistency with `AddUser`.
   Fixes Defect 3.
4. **Move the last-admin invariant into Core** — add to `RemoveUser` and to the demoting branch of
   `ChangeRole`: refuse when the operation would leave zero Admins
   (`if (Users.Count(x => x.Role == UserRole.Admin) <= 1) throw new InvalidOperationException(...)`),
   and surface the UI guard's message via `UpdateStatus` instead of a silent `return`.
   Fixes Defect 4.
5. **Reconcile `WithdrawUnchecked` with `TrySell`** — either make `Product.TrySell` check
   `CanSell` (then the message becomes real and expired stock cannot be withdrawn) or drop the
   unreachable branch and the comment. Also localise the `qty<=0` path so users never see
   "Specified argument was out of the range of valid values." Fixes Defect 5.
6. **Cosmetic/API consistency (optional)** — `IInventory` (`Domain.cs:174-182`) declares only
   `Restock(id,qty,actor)`; `Add`, `Withdraw` and `SetPrice` are not on the interface, so the abstraction
   no longer describes the gated surface. Add them, or drop `IInventory` if nothing depends on it
   (nothing in the App does — grep shows only the spec doc references it).

**Not a defect, but worth stating:** the "add product" flow at `ManagementViews.cs:20` is correct.
`Inventory.Add` performs all validation *before* `_products.Add`, so a rejected add can never leave a
half-applied state; the `if(inventory.Find(dialog.Product.Id) is null) return;` guard then correctly
skips `Save`/`Navigate` on failure, avoiding a misleading success toast and a needless re-render. The
only caveat is Defect 3: if the failure is an `UnauthorizedAccessException` the guard is never reached
because the exception escapes `TryAction` first — but that path is not reachable from the UI today, and
even then no partial state is written.

---

## Side effects of this verification

- `%LOCALAPPDATA%\SmartMart\smartmart.db` (24 KB) was created by the launch test. Delete the
  `%LOCALAPPDATA%\SmartMart` folder if a clean first-run state is wanted for a later demo.
- The launched `SmartMart.App` process (PID 54592) was terminated; `Get-Process` confirms none remain.
- Probe projects were built **outside** the repository, under
  `%TEMP%\sm-probe`, `sm-probe2`, `sm-probe3`; no file under `D:\Down\SmartMart` was modified
  except this report. The repo's `obj`/`bin` were touched only by the pre-existing Release build.
