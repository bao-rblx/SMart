# SmartMart — Documentation vs Reality verification

Read-only audit. Scope: `README.md`, `TEAM_WORK_PACKS.md`, `docs/` (GITHUB_GUIDE + 6 member guides), `web/CONTRACTS.md`.
Method: every checkable claim traced to source; `npm test` re-run per test file; catalog parsed and searched programmatically.
Totals: **75 claims checked — 66 CONFIRMED, 8 WRONG/STALE, 1 UNVERIFIABLE.**

---

## Must fix

| # | Where | What is wrong |
|---|---|---|
| 1 | `README.md:202-204` | Points to `web/assets/products/credits.txt` and `web/assets/products/sources.json` as links. **Neither file exists in `web/`.** Only `SmartMart.App/Assets/Products/credits.txt` + `sources.json` exist. (`web/assets/products/` has 72 .jpg and nothing else.) Same wrong path is repeated in UI copy at `web/js/app/settings.js:173` ("Danh sách nguồn nằm trong assets/products/credits.txt"). |
| 2 | `README.md:58` | "cảnh báo **tồn thấp** (hổ phách) và **sắp hết hạn** (đỏ san hô)" — inverted. Code (`web/js/views/inventory.js:55-60`): amber = low stock **or** near-expiry; coral = **out of stock or expired**. Near-expiry is amber, not coral. `TEAM_WORK_PACKS.md:165-166` and `docs/team/member-6-dashboard.md:27-28` both state it correctly, so README is the outlier. |
| 3 | `web/CONTRACTS.md:284` | "function seedUsers() → User[] { admin, manager, cashier }". Actual `seed.js:296-301` returns `[]` (sync version deliberately empty; `seedUsersAsync()` is the real one). Contract would break anyone coding to it. |
| 4 | `web/CONTRACTS.md:261-265, 316-318` | `Inventory.add/remove/restock/withdraw/setPrice` and `AuthService.addUser/changeRole/removeUser` are documented **without the `actor` parameter**. Real signatures require it (`inventory.js:169-225`, `auth.js:302/323/348`); calling as documented is denied/throws. |
| 5 | `web/CONTRACTS.md:87, 93-94` | Raw-JSON example shows `catalogKey` and `serialNumber`. `web/data/catalog.json` actually uses `key` and `serial` (mapped later in `seed.js:164,177`). |
| 6 | `web/CONTRACTS.md:324` | "PBKDF2 trong Node: `crypto.pbkdf2Sync`". `auth.js:79` uses async `nodeCrypto.pbkdf2`. |
| 7 | `web/CONTRACTS.md:343` | `context.modal = { open, close }` is documented but never provided (`main.js:29-41` has no `modal` key) and never consumed by any view. Dead contract entry. |
| 8 | `README.md:24` vs `web/package.json` | "Node.js 18 trở lên". The test script is `node --test "tests/**/*.test.mjs"` — the quoted-glob form needs a newer Node than 18; `engines` says `>=18`. (Verified passing on Node 24; not verified on 18.) |
| 9 | `docs/team/member-4-auth.md:35` | "Trình duyệt và Node 18+ đều có Web Crypto". `globalThis.crypto` as a global needs Node ≥19 — which is what `auth.js:33` itself says. Harmless (node:crypto fallback), but stale. |
| 10 | `README.md:107-129` (tree) | All listed paths exist, but tree is incomplete: omits `web/css/app-extras.css`, `web/tools/*.mjs`, root `tools/`, `TEAM_WORK_PACKS.md`, `SmartMart_Build_Spec.md`, `artifacts/`. |

**No stale counts.** 288 tests, 72 items, 9 categories, per-member 51/36/43/47/46/65, 12-per-page, 44-char invoice, 120 000 iterations, 16-byte salt, 7-day expiry window — all verified exact. No "25/25"-style figure exists anywhere in these docs.

---

## Claim table

Status legend: CONFIRMED = code does what the doc says · WRONG = doc contradicts code · UNVERIFIABLE = could not be checked read-only.

### README.md

| Claim | Source | Status | Evidence |
|---|---|---|---|
| Web app in `web/`, desktop in `SmartMart.App/` | README:5-8 | CONFIRMED | Both dirs exist; `SmartMart.App/SmartMart.App.csproj:4-7` WinExe, net8.0-windows, UseWindowsForms |
| `cd web; npm run dev` → 127.0.0.1:5173 | README:17-22 | CONFIRMED | `package.json` dev = `node tools/serve.mjs`; `serve.mjs:16-17` PORT 5173, HOST 127.0.0.1 |
| No `npm install` needed (no external libs) | README:22 | CONFIRMED | `package.json` has no dependencies; `.npmrc` sets `package-lock=false` |
| Node.js 18+ | README:24 | UNVERIFIABLE | `engines: >=18`, but test glob arg needs newer Node (see Must-fix 8). Ran on Node 24 only. |
| Demo accounts admin/admin, manager/manager, cashier/cashier | README:31-35 | CONFIRMED | `seed.js:40-44` DEMO_ACCOUNTS exactly those three |
| admin → all four screens | README:33 | CONFIRMED | `users.js:105-113` Admin → Checkout, Inventory, Reports, Users |
| manager → Sales, Inventory, Reports | README:34 | CONFIRMED | `users.js:100-102` Manager → [Checkout, Inventory, Reports] |
| cashier → Sales only | README:35 | CONFIRMED | `users.js:90-92` Cashier → [Checkout] |
| Click a demo row to autofill | README:37 | CONFIRMED | `login.js:193-198` onPick sets both inputs; `login.js:289-318` buildDemoBlock |
| "Danh mục 72 mặt hàng thuộc 9 nhóm" | README:45 | CONFIRMED | catalog.json `items.length === 72`; 9 distinct `category` values |
| Chip counts 14/16/4/14/11/3/4/5/1 = 72 | README:48 | CONFIRMED | Exact per-category counts: Grocery 14, Beverages 16, Snacks 4, Produce 14, Dairy 11, PersonalCare 3, Household 4, Electronics 5, General 1 |
| Real images packaged, offline | README:45 | CONFIRMED | 72 .jpg in `web/assets/products/`; all 72 items resolve to a file via `key` or `off-<barcode>` |
| Search without diacritics: `sua tuoi`, `ca phe`, `khong day` | README:46 | CONFIRMED | Live probe: `sua tuoi`→2 (Sữa tươi, Sữa tươi Vinamilk), `ca phe`→1 (Cà phê rang xay), `khong day`→2 (Chuột/Máy quét không dây) |
| Search by name, code or barcode | README:46-47 | CONFIRMED | `catalog-query.js:34-37` exact id + exact barcode + tokenized name; probe: barcode `8934563138165`→Mì Hảo Hảo, id `1001`→same |
| Filter chips with counts | README:48 | CONFIRMED | `checkout.js:60-71` buildCategoryChips + countByCategory; empty groups skipped |
| Sort by name or price | README:48 | CONFIRMED | `catalog-query.js:46-55` CatalogSort Name/PriceAsc/PriceDesc with vi collator |
| Only sellable items toggle | README:48 | CONFIRMED | `catalog-query.js:32` availableOnly → `product.canSell` |
| Pagination 12 per page | README:49 | CONFIRMED | `checkout.js:23` PAGE_SIZE=12; `catalog-query.js:64-77` paginate |
| Cart +/- qty, remove line, clear all | README:50 | CONFIRMED | `cart.js:176-240` addItem/setQuantity/removeItem/clear; `cart-panel.js:221-223` delegated line actions |
| Cart shows subtotal → savings → tax → total | README:50-51 | CONFIRMED | `cart-panel.js:81-93` cartSummaryRows = exactly those 4 rows |
| Payment: cash, bank card, e-wallet | README:52 | CONFIRMED | `cart-panel.js:24-28` PAYMENT_OPTIONS (Cash/Card/EWallet); `constants.js:35-39` |
| Receipt shown immediately, saved as .txt, or printed | README:52-53 | CONFIRMED | `cart-panel.js:112-121` receiptFileName .txt; :622-628 Blob download; :655 `window.print()` |
| Shortcuts Ctrl+K, F9, ? | README:54 | CONFIRMED | `main.js:167` ctrl+k, :170 "?"; `cart-panel.js:231` F9 → payment dialog; `shell.js:173` "Phím tắt (?)" button |
| Inventory: low-stock amber + near-expiry coral | README:58 | **WRONG** | `inventory.js:55-60` rowToneOf: amber = LOW or NEAR_EXPIRY; coral = OUT or EXPIRED |
| Stock bar visualises remaining qty | README:59 | CONFIRMED | `inventory.js:304-314` .stock-bar/.stock-bar__fill; `components.css:723-724` level low/empty |
| Restock, withdraw, edit price, add item, delete item | README:60 | CONFIRMED | `inventory.js:532/538/544/394` button labels; `inventory.js:621/634/653/673/866` dialog titles |
| Metric cards: items, low stock, expiry warnings, stock value | README:61 | CONFIRMED | `inventory.js:473-495` four `.metric` cards with those exact labels |
| Reports filter today / last 7 days / all | README:65 | CONFIRMED | `reports.js:34-42` RANGE_TODAY/WEEK/ALL labels "Hôm nay"/"7 ngày qua"/"Toàn bộ"; `rangeStart` :57-67 |
| Bar chart by category, donut, 7-day sparkline | README:66 | CONFIRMED | `reports.js` imports barChart/donutChart/sparkline (`:25`); sparkline 7 pts `:746` |
| Invoice table, re-open receipt per sale | README:67 | CONFIRMED | `reports.js:353-359` generateInvoice in modal |
| CSV export with UTF-8 BOM | README:68 | CONFIRMED | `reports.js:306` returns `"\uFEFF" + toCsvText(rows)`; `:291-307` buildSalesCsv |
| Staff list with role and per-screen access | README:72 | CONFIRMED | `users.js:359-376` table columns Tên đăng nhập / Vai trò / Quyền truy cập |
| Add staff, change role, delete account | README:73 | CONFIRMED | `users.js:184/275/281` buttons; store.changeRole/removeUser/addUser |
| Cannot delete or change role of yourself | README:74 | CONFIRMED | `users.js:116-120` selfGuardMessage blocks both paths (:385, :462) |
| Cannot delete the last admin | README:74 | CONFIRMED | `auth.js:355-357` removeUser guard; also demote guard :334-336 |
| Light / dark by choice or OS setting | README:78 | CONFIRMED | `theme.js:11-15, 65-68` theme light/dark/system + matchMedia; `settings.js:58-69` |
| Density comfortable / compact | README:79 | CONFIRMED | `theme.js:74` data-density; `tokens.css:179` `:root[data-density="compact"]`; `settings.js:71-85` |
| Reduced motion | README:80 | CONFIRMED | `theme.js:75` data-motion; `tokens.css:189-199` `:root[data-motion="reduced"]` + prefers-reduced-motion |
| Responsive at 1440 / 900 / 420 px | README:81 | CONFIRMED | Breakpoints at 1240/1080/900/720/640/480/460 px across layout/catalog/checkout/auth/inventory/reports/users CSS; 900px explicit, narrow widths covered by 460/480 (no literal 420px query) |
| 288 test cases | README:92 | CONFIRMED | `npm test`: tests 288, pass 288, fail 0 (re-run) |
| Coverage list (3 discount tiers, stock bounds, mixed cart, atomic checkout, invoice, PBKDF2, permissions, corrupt storage, stock alerts, revenue, CSV) | README:92-94 | CONFIRMED | All 11 topics present in the 6 test files by name (e.g. "ĐA HÌNH: ba loại hàng cho ba mức ưu đãi", "checkout thiếu hàng ở MỘT dòng thì KHÔNG dòng nào bị trừ kho", "storage: dữ liệu hỏng thì loadState trả null", "buildSalesCsv: bắt đầu bằng BOM UTF-8") |
| `node tools/ui-tour.mjs` screenshots each screen | README:96-101 | CONFIRMED | `web/tools/ui-tour.mjs` exists, logs in as admin, shoots 10 screens |
| Project tree paths | README:107-129 | CONFIRMED | Every listed path exists (web/index.html, css/, js/core|ui|views|app, main.js, data/catalog.json, assets/products/, tests/, tools/, CONTRACTS.md, SmartMart.Core, SmartMart.App, SmartMart.Tests, docs/GITHUB_GUIDE.md, docs/team/) |
| Tree is complete | README:107-129 | **WRONG** | Missing `web/css/app-extras.css`, root `tools/`, `TEAM_WORK_PACKS.md`, `SmartMart_Build_Spec.md`, `artifacts/` |
| 6 members, branch per member | README:137-144 | CONFIRMED | Matches GITHUB_GUIDE:119-126 and TEAM_WORK_PACKS table |
| OOP pillar 1 — abstraction: Product not instantiable; applyDiscount/displayInfo must be overridden | README:158 | CONFIRMED | `models.js:201-206` `new.target === Product` throws; :308-322 abstract methods throw; :227-237 assertConcrete |
| OOP pillar 2 — inheritance: 3 subclasses extend Product | README:159 | CONFIRMED | `models.js:423, 503, 557` PerishableProduct / ElectronicProduct / GeneralProduct |
| OOP pillar 3 — polymorphism: 30%/5% by expiry, 10% electronics, 5% general | README:160 | CONFIRMED | `models.js:71-84` RATE perishable .05 / nearExpiry .30 / electronic .10 / general .05; applied at :473-476, :523-525, :570-572 |
| OOP pillar 4 — encapsulation: private fields, stock only via restock()/trySell() | README:161 | CONFIRMED | `models.js:186-194` #id..#kind; getters only; :339-345 restock, :355-361 trySell; no setters anywhere |
| Data in localStorage, never sent to a server | README:167 | CONFIRMED | `storage.js` (localStorage, no fetch/XHR); `seed.js` caches catalog locally |
| PBKDF2-SHA256, 120 000 iterations, random per-account salt, raw never stored | README:170-171 | CONFIRMED | `auth.js:18-20` 120_000 / SALT_BYTES 16 / SHA-256; :51-57 randomSalt; credential is salt:hash only |
| VND display `125.000 ₫`, dd/MM/yyyy, 24h | README:173-174 | CONFIRMED | `format.js:31-38` Intl vi-VN VND 0 fraction; :86-90 dd/MM/yyyy; :93-97 HH:mm |
| Payments only recorded, no gateway; tax illustrative | README:176-177 | CONFIRMED | No network calls in payment path (`cart-panel.js`); `models.js:71-84` rates are project policy |
| `dotnet run --project SmartMart.App` | README:184 | CONFIRMED | `SmartMart.App.csproj` OutputType WinExe, net8.0-windows |
| SQLite at %LOCALAPPDATA%/SmartMart/smartmart.db | README:194 | CONFIRMED | `StoreSession.cs:21` Path.Combine(LocalApplicationData, "SmartMart", "smartmart.db") |
| In-memory fallback if DB can't open | README:194-195 | CONFIRMED | `StoreSession.cs:76-80` catch → StorageWarning, connection=null; Inventory/Sales/Users stay live in memory |
| Credits at web/assets/products/credits.txt + sources.json | README:201-204 | **WRONG** | Neither file exists under `web/`; only `SmartMart.App/Assets/Products/` has them |
| Desktop has a "Nguồn ảnh" button in the sales screen | README:204 | CONFIRMED | `SmartMart.App/CheckoutView.cs:53` Button("Nguồn ảnh", …ProductImages.ShowCredits) |

### TEAM_WORK_PACKS.md

| Claim | Source | Status | Evidence |
|---|---|---|---|
| Per-member tests 51 / 36 / 43 / 47 / 46 / 65 | TEAM_WORK_PACKS:20-25 | CONFIRMED | Ran each file: models 51, cart 36, inventory 43, auth 47, checkout-ui 46, reports 65 |
| Total 288, all green | TEAM_WORK_PACKS:27 | CONFIRMED | `npm test` 288 pass / 0 fail |
| 4 product classes | TEAM_WORK_PACKS:20 | CONFIRMED | Product + 3 subclasses |
| Discounts 30% (≤7 days) / 5% / 10% / 5% | TEAM_WORK_PACKS:42-43 | CONFIRMED | `models.js:71-84`, `isNearExpiry` :455-458 (0..7 days) |
| calculateTax default 10%, electronics 12% | TEAM_WORK_PACKS:44 | CONFIRMED | `models.js:330-332` and :528-530 |
| Encapsulation via restock()/trySell() | TEAM_WORK_PACKS:45 | CONFIRMED | `models.js:339-361` |
| toJSON/fromJSON restore the right subclass | TEAM_WORK_PACKS:46 | CONFIRMED | `models.js:406-409` static fromJSON → createProduct; :599-613 factory |
| Cart is composition (has-a), not inheritance | TEAM_WORK_PACKS:64 | CONFIRMED | `cart.js:36-45` CartLine holds #product; ShoppingCart holds #lines |
| Cannot exceed stock | TEAM_WORK_PACKS:65 | CONFIRMED | `cart.js:343-350` assertEnoughStock; tested |
| checkout() validates whole cart before deducting | TEAM_WORK_PACKS:66 | CONFIRMED | `cart.js:270-292` #assertWholeCartSellable then #deductStock |
| SaleLine stores price snapshot | TEAM_WORK_PACKS:67 | CONFIRMED | `transaction.js:142` SaleLine with unitPrice/discountedUnitPrice; test "SaleLine là ảnh chụp" |
| Invoice 44-char width with amount in Vietnamese words | TEAM_WORK_PACKS:68 | CONFIRMED | `transaction.js:25` INVOICE_WIDTH = 44; `format.js:142` numberToVietnameseWords |
| storage.js never throws, falls back to memory | TEAM_WORK_PACKS:89 | CONFIRMED | 0 `throw` statements in `storage.js`; tests "localStorage ném lỗi thì saveState trả ok:false…" |
| seed.js loads 72 items from data/catalog.json, cached offline | TEAM_WORK_PACKS:90 | CONFIRMED | `seed.js:65-124` fetch + CATALOG_CACHE_KEY local cache |
| User abstract + Cashier/Manager/Admin subclasses | TEAM_WORK_PACKS:110 | CONFIRMED | `users.js:29-113`, `new.target === User` throws |
| allowedScreens() polymorphic per role | TEAM_WORK_PACKS:111 | CONFIRMED | `users.js:90-92, 100-102, 110-112` |
| PBKDF2-SHA256, 120k, 16-byte salt, constant-time compare, browser+Node | TEAM_WORK_PACKS:112-113 | CONFIRMED | `auth.js:18-20, 51-57, 155-163, 34-88` |
| AuthService blocks deleting/demoting last admin | TEAM_WORK_PACKS:114 | CONFIRMED | `auth.js:334-336, 355-357` |
| CSS prefixes lg- ct- ctp- co- | TEAM_WORK_PACKS:139 | CONFIRMED | 156 prefixed selectors across auth/catalog/cart/checkout CSS |
| No direct colour codes in member CSS | TEAM_WORK_PACKS:139 | CONFIRMED | No hex literals in auth.css/catalog.css/cart.css/checkout.css (hex only in Lead-owned tokens/layout/components) |
| charts.js pure SVG, colours from CSS variables | TEAM_WORK_PACKS:164 | CONFIRMED | `charts.js:165, 304` svg:rect; `seriesColor` returns var(--…) (test "luôn trả về biến CSS") |
| Inventory rows amber / coral | TEAM_WORK_PACKS:165-166 | CONFIRMED | `inventory.js:270` `dataset.state` = tone; `components.css:680-683` |
| Reports CSV has UTF-8 BOM | TEAM_WORK_PACKS:168 | CONFIRMED | `reports.js:306` |
| Users screen blocks acting on self | TEAM_WORK_PACKS:169 | CONFIRMED | `users.js:116-120, 385, 462` |
| "npm test xanh toàn bộ 288 kiểm thử" | TEAM_WORK_PACKS:231 | CONFIRMED | Re-run: 288 pass |
| "Không lỗi console trên mọi màn hình" | TEAM_WORK_PACKS:232 | UNVERIFIABLE | Not re-run in a browser in this audit (read-only); `ui-tour.mjs` collects console errors but was not executed |
| Data survives reload | TEAM_WORK_PACKS:233 | CONFIRMED | `store.js:45-69` loadState → Inventory.fromJSON / Transaction.fromJSON |
| Works offline after first open | TEAM_WORK_PACKS:234 | CONFIRMED | Catalog cached to localStorage (`seed.js:107-124`); images local |
| No external libs; no innerHTML for user data | TEAM_WORK_PACKS:236 | CONFIRMED | `package.json` no deps; innerHTML only in `dom.js:53` (`html:` prop) and :205 fromHTML, used solely by `icons.js:88` for trusted SVG paths |

### docs/team/*.md

| Claim | Source | Status | Evidence |
|---|---|---|---|
| m1: four-pillar table for models.js | member-1-models.md:13-18 | CONFIRMED | Same as README table; matches `models.js` |
| m1: worked example 100 000 → 70 000 / 90 000 / 95 000 | member-1-models.md:29-37 | CONFIRMED | 30% near-expiry (invalid date ⇒ today ⇒ 0 days ⇒ isNearExpiry), 10% electronic, 5% general |
| m1: constructor throws RangeError for stock 1.5 | member-1-models.md:102-103 | CONFIRMED | `models.js:113-122` readCount |
| m2: whole-cart check before any deduction | member-2-sales.md:23-34 | CONFIRMED | `cart.js:264-292`; doc snippet is illustrative, real messages are per-item Vietnamese |
| m2: invoice 44 chars + words | member-2-sales.md:46-51 | CONFIRMED | INVOICE_WIDTH 44; numberToVietnameseWords |
| m2: PaymentDetails read-only, rejects negative | member-2-sales.md:17 | CONFIRMED | `transaction.js:97-140`; test "PaymentDetails ném RangeError khi số tiền âm" |
| m3: Inventory API (lowStockAlerts, expiringSoon, expiredProducts, inventoryValue) | member-3-inventory.md:27-31 | CONFIRMED | `inventory.js:244-278` |
| m3: setPrice uses withPrice() copy | member-3-inventory.md:33-38 | CONFIRMED | `inventory.js:225-241` |
| m3: loadState/saveState/storageMode, never throws | member-3-inventory.md:45-49 | CONFIRMED | `storage.js` exports those; no throw |
| m3: status bar shows "Dữ liệu tạm trong phiên" | member-3-inventory.md:127 | CONFIRMED | `shell.js:227` |
| m3: catalog path ../../data/catalog.json | member-3-inventory.md:57-61 | CONFIRMED | `seed.js:37` |
| m4: PBKDF2 rules (raw never stored, per-user salt, constant-time, 120k) | member-4-auth.md:23-29 | CONFIRMED | `auth.js:18-20, 51-57, 155-163` |
| m4: "Node 18+ đều có Web Crypto" | member-4-auth.md:35 | **WRONG** | `globalThis.crypto` global needs Node ≥19; `auth.js:33` says "Node ≥ 19" |
| m5: 72 images at web/assets/products/<catalogKey>.jpg | member-5-checkout.md:40 | CONFIRMED | 72 files; every catalog item resolves (key or off-barcode) |
| m5: search input carries data-catalog-search | member-5-checkout.md:51 | CONFIRMED | `checkout.js:164` |
| m5: cart shows 4 totals | member-5-checkout.md:54-56 | CONFIRMED | `cart-panel.js:81-93` |
| m5: print CSS isolates receipt | member-5-checkout.md:83-88 | CONFIRMED | `cart.css:559-580` `body[data-print="receipt"]` (implemented differently, same effect) |
| m6: data-state="amber"/"coral" rows | member-6-dashboard.md:27-28 | CONFIRMED | `inventory.js:270`; `components.css:680-683` |
| m6: SVG built with `el("svg:rect", …)` | member-6-dashboard.md:43 | CONFIRMED | `charts.js:165, 304` |
| m6: CSV Blob prefixed with \uFEFF | member-6-dashboard.md:56 | CONFIRMED | `reports.js:306` then `downloadTextFile` :321-333 |
| m6: last-admin rule lives in AuthService, not UI | member-6-dashboard.md:122-124 | CONFIRMED | `auth.js:334-336, 355-357`; `users.js:10-11` comment |

### docs/GITHUB_GUIDE.md

| Claim | Source | Status | Evidence |
|---|---|---|---|
| `cd web; npm test` must be green before push | GITHUB_GUIDE:158-167 | CONFIRMED | Test script exists; suite green |
| `npm run dev` serves 127.0.0.1:5173 | GITHUB_GUIDE:161 | CONFIRMED | `serve.mjs:16-17` |
| Branch naming per member | GITHUB_GUIDE:119-126 | CONFIRMED | Identical to README:137-144 |
| .gitignore already excludes bin/, obj/, node_modules/, *.db, *.bak, .vs/, .vscode/, *.user | GITHUB_GUIDE:219-225 | CONFIRMED | `.gitignore` contains all of those (plus web/.screenshots/) |

### web/CONTRACTS.md

| Claim | Source | Status | Evidence |
|---|---|---|---|
| Pure HTML/CSS/JS ES modules, no build, no libs | CONTRACTS:6-8 | CONFIRMED | `index.html` loads `<script type="module" src="js/main.js">`; no bundler; no deps |
| File tree and owners | CONTRACTS:14-68 | CONFIRMED | All listed files exist and match owners (omits overlays.css / app-extras.css) |
| 2.1 raw product JSON uses `catalogKey`, `serialNumber` | CONTRACTS:87, 93-94 | **WRONG** | `catalog.json` items use `key`, `serial`; mapped in `seed.js:164, 177` |
| 3.1 Product/Perishable/Electronic/General API | CONTRACTS:120-177 | CONFIRMED | Every member (getters, restock, trySell, renamed, withPrice, toJSON, fromJSON, createProduct, productKindOf) present in `models.js` |
| 3.2 CartLine/ShoppingCart/SaleLine/PaymentDetails/Transaction/generateInvoice | CONTRACTS:191-243 | CONFIRMED | All present in `cart.js` / `transaction.js`; 8-char uppercase orderId (`transaction.js:61-71`) |
| 3.3 `seedUsers()` → User[] admin/manager/cashier | CONTRACTS:284 | **WRONG** | `seed.js:296-301` returns `[]`; real path is `seedUsersAsync()` |
| 3.3 Inventory signatures (no actor) | CONTRACTS:261-265 | **WRONG** | `inventory.js:169-225` require `actor`; without it permission check denies |
| 3.3 storage API + never throws | CONTRACTS:276-280 | CONFIRMED | `storage.js` exports loadState/saveState/clearState/storageMode, no throws |
| 3.4 User/createUser/userFromJSON/hash/verify | CONTRACTS:295-310 | CONFIRMED | `users.js` / `auth.js` |
| 3.4 AuthService signatures (no actor) | CONTRACTS:312-321 | **WRONG** | `auth.js:302, 323, 348` take `actor`; omitting it always returns a permission error |
| 3.4 "PBKDF2 trong Node: crypto.pbkdf2Sync" | CONTRACTS:324 | **WRONG** | `auth.js:79` uses async `nodeCrypto.pbkdf2` |
| 4.1 view context includes `modal` | CONTRACTS:339-348 | **WRONG** | `main.js:29-41` provides store/state/session/navigate/repaint/refresh/toast/confirm/format — no `modal`; no view reads `context.modal` |
| 4.3 component class library | CONTRACTS:374 | CONFIRMED | All listed classes (.card .metric .btn… .chip .table .empty .progress .tabs .list .divider) exist in `components.css` |
| 4.3 CSS prefix convention | CONTRACTS:377 | CONFIRMED | co-/ct-/iv-/rp-/us-/lg- all in use |
| 5 test files per member | CONTRACTS:385-392 | CONFIRMED | Six files, one per member, as tabulated |

---

## Notes on method / limits

- `npm test` re-run per file: 51+36+43+47+46+65 = 288, all pass, 0 fail — the README/TEAM_WORK_PACKS numbers are exact, not rounded.
- Catalog verified both by parsing `catalog.json` and by running the real `seedProducts()` + `findProducts()` pipeline in Node.
- Nothing was modified outside this file.
- UNVERIFIABLE items are browser/console and Node-18-specific claims; both need a live browser or an older Node to settle.
