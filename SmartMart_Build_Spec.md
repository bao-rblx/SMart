# SmartMart POS & Inventory — Agent Build Spec

> Hand this file to a coding agent. It is self-contained: it tells the agent exactly what to build, in what order, and how to know it's done. Scope is fixed by the course brief (Project #3, Retail POS) and the team's approved proposal.

---

## 0. One-paragraph brief

Build **SmartMart**, a desktop Retail Point-of-Sale and Inventory system as a **C# .NET 8 WinForms** application in **Visual Studio 2022**. It must demonstrate OOP: an abstract `Product` hierarchy, polymorphic `ApplyDiscount()` / `CalculateTax()`, encapsulated stock and payment data, an `IInventory` interface, and composition (`ShoppingCart` has-a `List<Product>`). Persistence is **SQLite** with a file/in-memory fallback. The UI has a **cashier checkout** screen, a **manager inventory dashboard** with low-stock and expiry alerts, **role-based login** (Cashier / Manager / Admin), and **reports + printable invoices**.

The grade depends on the OOP design being visible and clean, and on a live demo working on defense day (19 Nov 2026). Favor clarity over cleverness.

---

## 1. Hard requirements (from the course brief — non-negotiable)

These come from `OOP_Project_Intructions_261.pdf`, Project #3. If a proposal feature ever conflicts with one of these, the brief wins.

1. **Inheritance:** abstract `Product` class, inherited by `PerishableProduct` (has expiration date) and `ElectronicProduct` (has warranty period). *(Proposal adds `GeneralProduct` — keep it.)*
2. **Polymorphism:** `ApplyDiscount()` behaves differently per subclass — electronics a flat rate, perishables scaled by how close to expiry.
3. **Encapsulation:** protect stock quantity, unit price, and payment details behind private fields + public properties with validation.
4. **WinForms GUI:** a checkout interface with a shopping-cart view, a manager dashboard for adding/removing stock, and low-inventory alerts.

Everything in §2–§8 below is the approved proposal, which is a superset of the above. Build all of it, but if you run short on time, the four items above are the ones that must work.

---

## 2. Tech stack (fixed)

| Concern | Choice | Notes |
|---|---|---|
| Language / runtime | C# on .NET 8 | Full OOP: classes, inheritance, interfaces, generics |
| UI | WinForms | Required by brief; event-driven GUI demonstrates OOP |
| IDE | Visual Studio 2022 Community | WinForms designer + debugger |
| Persistence | SQLite (`Microsoft.Data.Sqlite`) | Single-file DB; seed on first run. Fall back to in-memory list repo if the DB can't open, so the demo never hard-fails. |
| Version control | Git / GitHub | Branch per feature |

**Do not** switch to WPF, MAUI, ASP.NET, or a different language. The brief mandates WinForms.

---

## 3. Target solution structure

```
SmartMart.sln
├─ SmartMart.Core/            (class library — NO WinForms reference)
│  ├─ Products/
│  │  ├─ Product.cs           (abstract)
│  │  ├─ PerishableProduct.cs
│  │  ├─ ElectronicProduct.cs
│  │  └─ GeneralProduct.cs
│  ├─ Users/
│  │  ├─ User.cs              (abstract)
│  │  ├─ Cashier.cs  Manager.cs  Admin.cs
│  ├─ Sales/
│  │  ├─ ShoppingCart.cs
│  │  ├─ Transaction.cs       (order / invoice)
│  │  └─ PaymentDetails.cs    (sealed)
│  ├─ Inventory/
│  │  ├─ IInventory.cs
│  │  └─ Inventory.cs
│  ├─ Enums.cs                (Category, PaymentMethod, UserRole)
│  └─ Data/
│     ├─ IProductRepository.cs  IUserRepository.cs
│     ├─ SqliteProductRepository.cs ...
│     └─ InMemoryProductRepository.cs   (fallback)
├─ SmartMart.App/             (WinForms exe — references Core)
│  ├─ LoginForm.cs
│  ├─ CheckoutForm.cs         (Cashier)
│  ├─ InventoryDashboardForm.cs (Manager)
│  ├─ UserManagementForm.cs   (Admin)
│  ├─ ReportsForm.cs
│  └─ Program.cs
└─ SmartMart.Tests/           (xUnit — covers Core logic)
```

**Keep `SmartMart.Core` free of any WinForms/UI dependency.** All business logic and OOP lives there and is unit-testable without a UI. This separation is itself worth demo points.

---

## 4. Domain model — exact shape

### 4.1 `Product` (abstract) — the centerpiece of the OOP story

```csharp
public abstract class Product
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public Category Category { get; init; }

    private decimal _unitPrice;
    public decimal UnitPrice
    {
        get => _unitPrice;
        set => _unitPrice = value >= 0 ? value
            : throw new ArgumentOutOfRangeException(nameof(value));
    }

    private int _stock;
    public int Stock
    {
        get => _stock;
        private set => _stock = value >= 0 ? value
            : throw new ArgumentOutOfRangeException(nameof(value));
    }

    public int LowStockThreshold { get; init; } = 5;
    public bool IsLowStock => Stock <= LowStockThreshold;

    public void Restock(int qty) { /* validate qty > 0 */ _stock += qty; }
    public bool TrySell(int qty) { /* decrement if enough, else false */ }

    // Polymorphic core — subclasses MUST override:
    public abstract decimal ApplyDiscount();      // returns the discounted unit price
    public virtual decimal CalculateTax() => UnitPrice * 0.10m; // default 10%, overridable
    public abstract string DisplayInfo();
}
```

### 4.2 Subclasses — the polymorphism that gets demoed

- **`PerishableProduct`** — adds `DateOnly ExpiryDate`, `bool IsNearExpiry` (e.g. ≤7 days).
  `ApplyDiscount()`: **30% off if near expiry**, else small/no discount. Scale by closeness if you want extra polish.
- **`ElectronicProduct`** — adds `int WarrantyMonths`, `string SerialNumber`.
  `ApplyDiscount()`: **flat 10% off**. Optionally override `CalculateTax()` for electronics.
- **`GeneralProduct`** — adds `string Supplier`.
  `ApplyDiscount()`: **seasonal 5% off**.

> The demo moment: a cart holding one of each, and the UI showing three different discounts computed by the **same `ApplyDiscount()` call**. Make this visible on screen.

### 4.3 `User` (abstract) + role subclasses

```csharp
public abstract class User
{
    public string Username { get; init; } = "";
    public UserRole Role { get; init; }
    private string _passwordHash = "";
    public bool Authenticate(string password) => /* hash-compare */;
    public abstract string[] AllowedScreens(); // drives role-based nav
}
```
- `Cashier` → checkout only.
- `Manager` → checkout + inventory dashboard + reports.
- `Admin` → everything + user management.

Password hashing: use a real hash (e.g. PBKDF2 via `Rfc2898DeriveBytes`). Never store plaintext.

### 4.4 Supporting classes

- **`ShoppingCart`** — `has-a List<Product>` with per-line quantities. `AddItem`, `RemoveItem`, `GetSubtotal()`, `GetDiscountedTotal()` (sums `ApplyDiscount()` × qty), `GetTax()`, `Checkout()` → returns a `Transaction`. Composition over inheritance — call this out in a code comment is fine, but don't over-comment.
- **`Transaction`** — `OrderId`, `DateTime`, line items snapshot, totals, `PaymentDetails`, `GenerateInvoice()` → formatted invoice string/printable doc.
- **`PaymentDetails`** (`sealed`) — encapsulates method + amount; validates amount ≥ total.
- **`IInventory`** / **`Inventory`** — `CheckStock(id)`, `Restock(id, qty)`, `GetLowStockAlerts()`, `GetExpiringSoon()`. Interface abstraction so the dashboard depends on `IInventory`, not the concrete class.
- **`Enums`** — `Category`, `PaymentMethod { Cash, Card, EWallet }`, `UserRole { Cashier, Manager, Admin }`.

---

## 5. Screens (WinForms)

1. **LoginForm** — username/password, resolves to a `User` subclass, routes by role. Seed users: `admin/admin`, `manager/manager`, `cashier/cashier` (document these on the login screen for the demo).
2. **CheckoutForm (Cashier)** — search/add product by name or id (a "scan barcode" textbox that matches on id is enough), cart grid showing each line's base price, discount label (e.g. "−30% expiry"), and line total. Footer: subtotal → discounted total → tax → grand total. Buttons: Clear Cart, Checkout (opens payment, produces invoice).
3. **InventoryDashboardForm (Manager)** — product grid with stock levels; **low-stock rows highlighted** (e.g. amber) and **expiring-soon rows** flagged (e.g. red). Add / remove / restock controls.
4. **UserManagementForm (Admin)** — list users, add/remove, set role.
5. **ReportsForm** — daily sales total, revenue by category (a simple bar chart or grid is fine), list of today's transactions, and a reprint-invoice action.

UI polish target: match the proposal mockup's spirit (clean cart view with visible per-item discounts). Functional correctness first, looks second.

---

## 6. Persistence & seeding

- On first run, create the SQLite DB and seed: ~10 products spanning all three subclasses (at least 2 perishables with near + far expiry, 2 electronics, rest general), the 3 seed users, and the product categories.
- Repositories sit behind interfaces (`IProductRepository`, etc.). If SQLite fails to initialize, swap in the in-memory repo with the same seed data and surface a non-blocking warning — the demo must still run.
- Keep SQL simple; an ORM is optional (hand-written queries or Dapper both fine). **Do not** pull in Entity Framework unless it's trivial for you — it's overkill here.

---

## 7. Tests (xUnit, Core only)

Cover the logic that the grade hinges on:
- `ApplyDiscount()` for each subclass (near-expiry vs not, flat electronics, seasonal general).
- `Product.TrySell` / `Restock` boundary and validation (can't go negative, can't sell more than stock).
- `ShoppingCart.GetDiscountedTotal()` with a mixed cart equals the sum of per-item polymorphic discounts.
- `Inventory.GetLowStockAlerts()` / `GetExpiringSoon()` return the right items.
- `User.Authenticate` accepts the right password, rejects wrong ones.

No UI tests required. Aim for the logic to be green before wiring screens.

---

## 8. Build order (do it in this sequence)

1. Create the solution + three projects; add `Microsoft.Data.Sqlite` and `xUnit`.
2. Build `SmartMart.Core`: enums → `Product` + 3 subclasses → write their tests → get green.
3. `ShoppingCart` + `Transaction` + `PaymentDetails` → tests → green.
4. `User` hierarchy + auth → tests → green.
5. `IInventory`/`Inventory` + repositories + SQLite seed + in-memory fallback → tests → green.
6. WinForms: LoginForm → CheckoutForm → InventoryDashboardForm → ReportsForm → UserManagementForm.
7. Manual pass: log in as each role, run a mixed-cart checkout, confirm the three discounts differ on screen, trigger a low-stock + expiry alert, print an invoice, view the report.

**Definition of done:** the seven manual steps above all pass, `dotnet test` is green, and the four hard requirements in §1 are visibly demonstrable in under two minutes.

---

## 9. Guardrails for the agent

- Match the structure in §3; don't invent extra layers (no MVVM, no DI container unless trivial, no microservices — it's a desktop app).
- Don't add features not listed here. If you think one is needed, note it and keep going.
- Keep `SmartMart.Core` UI-free so the OOP is testable in isolation.
- Comment only where the *why* isn't obvious; let the class/method names carry the *what*.
- Every team member must be able to explain every class on defense day, so keep it readable — no clever tricks.
- Commit per completed step in §8 with a clear message.

---

## 10. Context dates (for reference, not to be built)

Proposal delivered 28 Sep 2026 · final ready 12 Nov · oral defense (live demo) **19 Nov 2026** · submission 22 Nov. The app must be demo-ready and stable by 12 Nov.
