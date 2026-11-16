# -*- coding: utf-8 -*-
"""SmartMart final project deck - English, screenshot-first, low theory."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches as IN

FIG = r"D:\Down\SmartMart\presentation\f"
OUT = r"D:\Down\SmartMart\presentation\SmartMart-Final-Project-EN.pptx"

NAVY  = RGBColor(0x1F, 0x4E, 0x79)
BLUE  = RGBColor(0x2E, 0x75, 0xB6)
DARK  = RGBColor(0x2D, 0x2D, 0x2D)
GREY  = RGBColor(0x77, 0x77, 0x77)
LINE  = RGBColor(0xD5, 0xDB, 0xE3)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PALE  = RGBColor(0xF2, 0xF5, 0xF9)
GREEN = RGBColor(0x1B, 0x75, 0x59)
RED   = RGBColor(0xA0, 0x36, 0x2C)
F = "Arial"
M = 0.45

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
CW = 13.333 - 2 * M
BLANK = prs.slide_layouts[6]


def new_slide(bg=WHITE):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = bg
    return s


def tb(s, text, x, y, w, h, size, color=DARK, bold=False, align=PP_ALIGN.LEFT, italic=False):
    box = s.shapes.add_textbox(IN(x), IN(y), IN(w), IN(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0; tf.margin_right = 0; tf.margin_top = 0; tf.margin_bottom = 0
    for i, line in enumerate(str(text).split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.name = F; r.font.color.rgb = color
        r.font.bold = bold; r.font.italic = italic
    return box


def pic(s, name, x, y, w=None, h=None):
    p = os.path.join(FIG, name)
    if w and h:
        return s.shapes.add_picture(p, IN(x), IN(y), IN(w), IN(h))
    if w:
        return s.shapes.add_picture(p, IN(x), IN(y), width=IN(w))
    return s.shapes.add_picture(p, IN(x), IN(y), height=IN(h))


def frame(s, x, y, w, h):
    sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, IN(x), IN(y), IN(w), IN(h))
    sh.fill.background()
    sh.line.color.rgb = LINE
    sh.line.width = Pt(0.75)
    sh.shadow.inherit = False
    return sh


def head(s, title, sub=None):
    tb(s, title, M, 0.32, CW, 0.62, 28, NAVY, bold=True)
    if sub:
        tb(s, sub, M, 0.95, CW, 0.34, 15, GREY)
    sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, IN(M), IN(1.38), IN(CW), IN(0.025))
    sh.fill.solid(); sh.fill.fore_color.rgb = LINE
    sh.line.fill.background(); sh.shadow.inherit = False


def note(s, text, y=6.95):
    tb(s, text, M, y, CW, 0.3, 13, GREY)


def badge(s, x, y, w, h, text, fill, fg=WHITE, size=14):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(x), IN(y), IN(w), IN(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.color.rgb = fill; sh.shadow.inherit = False
    try: sh.adjustments[0] = 0.25
    except Exception: pass
    tf = sh.text_frame; tf.word_wrap = True
    tf.margin_left = 0; tf.margin_right = 0; tf.margin_top = 0; tf.margin_bottom = 0
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.name = F; r.font.bold = True; r.font.color.rgb = fg
    return sh


def steps(s, items, x, y, w, size=15):
    cy = y
    for i, (label, detail) in enumerate(items, start=1):
        sq = s.shapes.add_shape(MSO_SHAPE.OVAL, IN(x), IN(cy), IN(0.32), IN(0.32))
        sq.fill.solid(); sq.fill.fore_color.rgb = BLUE
        sq.line.color.rgb = BLUE; sq.shadow.inherit = False
        tf = sq.text_frame; tf.margin_left=0; tf.margin_right=0; tf.margin_top=0; tf.margin_bottom=0
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = str(i)
        r.font.size = Pt(12); r.font.name = F; r.font.bold = True; r.font.color.rgb = WHITE
        tb(s, label, x + 0.45, cy - 0.03, w - 0.45, 0.3, size, NAVY, bold=True)
        tb(s, detail, x + 0.45, cy + 0.26, w - 0.45, 0.3, size - 2, DARK)
        cy += 0.82
    return cy


# =====================================================================
# 1  TITLE
# =====================================================================
s = new_slide(NAVY)
tb(s, "SmartMart", 0.9, 1.25, 11.5, 1.1, 54, WHITE, bold=True)
tb(s, "A retail management app - sales, stock, revenue and staff in one place", 0.9, 2.35, 11.5, 0.5, 22, RGBColor(0xCA,0xDC,0xFC))
sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, IN(0.9), IN(3.05), IN(2.4), IN(0.05))
sh.fill.solid(); sh.fill.fore_color.rgb = BLUE; sh.line.fill.background(); sh.shadow.inherit = False
tb(s, "Final project - Object-Oriented Programming", 0.9, 3.3, 11.5, 0.4, 18, WHITE)
tb(s, "72ITSE30203  ·  Lecturer: Dr. Huy T. Nguyen", 0.9, 3.75, 11.5, 0.35, 15, RGBColor(0xA0,0xBB,0xDD))
tb(s, "Team of 5", 0.9, 4.55, 5.5, 0.35, 15, RGBColor(0xA0,0xBB,0xDD))
tb(s, "Luu Gia Bao\nNguyen Dung\nTran Quang Minh\nNguyen Thanh Son\nNinh Tan Phuc",
   0.9, 4.95, 5.5, 1.6, 15, WHITE)
tb(s, "19 November 2026", 9.4, 6.35, 3.0, 0.4, 15, RGBColor(0xA0,0xBB,0xDD), align=PP_ALIGN.RIGHT)

# =====================================================================
# 2  WHAT IT IS
# =====================================================================
s = new_slide()
head(s, "What is SmartMart?", "A sales app for a small shop - sell, reduce stock, print receipts, see revenue")
pic(s, "checkout.jpg", M, 1.62, w=8.02)
frame(s, M, 1.62, 8.02, 5.01)
tb(s, "Sales", 9.0, 1.7, 3.85, 0.35, 20, NAVY, bold=True)
tb(s, "Pick items, the cart adds the money, pay, print the receipt.",
   9.0, 2.1, 3.85, 0.8, 15, DARK)
tb(s, "Stock", 9.0, 3.0, 3.85, 0.35, 20, NAVY, bold=True)
tb(s, "Stock goes down by itself. Low stock and expiry warnings.",
   9.0, 3.4, 3.85, 0.8, 15, DARK)
tb(s, "Revenue", 9.0, 4.3, 3.85, 0.35, 20, NAVY, bold=True)
tb(s, "Charts by product group. Export to CSV.",
   9.0, 4.7, 3.85, 0.6, 15, DARK)
tb(s, "Staff", 9.0, 5.45, 3.85, 0.35, 20, NAVY, bold=True)
tb(s, "Three roles. Add and remove accounts.",
   9.0, 5.85, 3.85, 0.8, 15, DARK)
note(s, "Screenshots from the running app, 15 November 2026")

# =====================================================================
# 3  LOGIN + ROLES
# =====================================================================
s = new_slide()
head(s, "Login - each role sees a different set of screens")
pic(s, "login.jpg", M, 1.7, w=6.9)
frame(s, M, 1.7, 6.9, 4.31)
tb(s, "Three demo accounts", 7.75, 1.75, 5.1, 0.35, 20, NAVY, bold=True)
rows = [
    ("admin / admin", "Admin", "All four screens", NAVY),
    ("manager / manager", "Manager", "Sales, Stock, Revenue", BLUE),
    ("cashier / cashier", "Cashier", "Sales only", GREY),
]
cy = 2.25
for cred, role, screens, col in rows:
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(7.75), IN(cy), IN(5.1), IN(0.95))
    box.fill.solid(); box.fill.fore_color.rgb = PALE
    box.line.color.rgb = LINE; box.shadow.inherit = False
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = IN(0.18); tf.margin_top = IN(0.1)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = role + "   "
    r.font.size = Pt(16); r.font.name = F; r.font.bold = True; r.font.color.rgb = col
    r2 = p.add_run(); r2.text = cred
    r2.font.size = Pt(14); r2.font.name = F; r2.font.color.rgb = DARK
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.LEFT
    r3 = p2.add_run(); r3.text = screens
    r3.font.size = Pt(13); r3.font.name = F; r3.font.color.rgb = GREY
    cy += 1.05
tb(s, "Click a row and the form fills itself.", 7.75, 5.5, 5.1, 0.4, 14, GREY, italic=True)
note(s, "Passwords are hashed with PBKDF2-SHA256, 120,000 rounds - the real password is never stored")

# =====================================================================
# 4  WRONG PASSWORD
# =====================================================================
s = new_slide()
head(s, "A wrong password is blocked - and we do not say which part was wrong")
pic(s, "login-error.jpg", M, 1.66, w=7.9)
frame(s, M, 1.66, 7.9, 4.94)
tb(s, "One general message", 8.75, 1.8, 4.1, 0.35, 18, NAVY, bold=True)
tb(s, "\"Wrong username or password.\"", 8.75, 2.2, 4.1, 0.5, 15, DARK)
tb(s, "Why?", 8.75, 3.1, 4.1, 0.35, 18, NAVY, bold=True)
tb(s, "If we said \"wrong password\", a stranger would know the account exists.",
   8.75, 3.5, 4.1, 1.0, 15, DARK)
tb(s, "Small detail, real security.", 8.75, 4.9, 4.1, 0.4, 15, GREY, italic=True)
note(s, "Login screen with a wrong password")

# =====================================================================
# 5  CASHIER LIMITED
# =====================================================================
s = new_slide()
head(s, "A cashier only sees the sales screen - the menu hides itself by role")
pic(s, "cashier.jpg", M, 1.68, w=7.9)
frame(s, M, 1.68, 7.9, 4.94)
tb(s, "Cashier menu", 8.85, 1.75, 4.0, 0.35, 19, NAVY, bold=True)
for i, (txt, has) in enumerate([("Sales", True), ("Stock", False), ("Revenue", False), ("Staff", False)]):
    yy = 2.25 + i * 0.55
    mark = "Yes" if has else "No"
    col = GREEN if has else RED
    tb(s, mark + "   " + txt, 8.85, yy, 4.0, 0.35, 17, col, bold=True)
tb(s, "Hiding the menu is not enough", 8.85, 4.6, 4.0, 0.35, 16, NAVY, bold=True)
tb(s, "If someone calls store.restock() from the browser console, the domain layer still says no.",
   8.85, 5.0, 4.0, 1.3, 14, DARK)
note(s, "Logged in as cashier / cashier")

# =====================================================================
# 6  SEARCH
# =====================================================================
s = new_slide()
head(s, "Search without accents - typing \"sua tuoi\" still finds \"Sua tuoi\"")
pic(s, "search.jpg", M, 1.7, w=9.0)
frame(s, M, 1.7, 9.0, 2.40)
steps(s, [
    ("Remove the accents", "Unicode NFD, handles d and D too"),
    ("Split the words", "Every word must match"),
    ("Search three fields", "Name, product code, barcode"),
], 9.7, 1.8, 3.2, 14)
note(s, "Cashiers type fast and rarely add accents, so search must not require them")

# =====================================================================
# 7  CART WITH DISCOUNTS
# =====================================================================
s = new_slide()
head(s, "Four products, four different discounts - worked out by the products themselves")
pic(s, "cart-panel.jpg", M, 1.7, h=5.1)
frame(s, M, 1.7, 3.13, 5.1)
tb(s, "Same base price of 100,000 VND", 3.95, 1.75, 8.9, 0.35, 18, NAVY, bold=True)
tbl = s.shapes.add_table(5, 3, IN(3.95), IN(2.25), IN(8.9), IN(2.9)).table
tbl.columns[0].width = IN(4.0)
tbl.columns[1].width = IN(2.2)
tbl.columns[2].width = IN(2.7)
for c, h in enumerate(["Product", "Type", "Discount"]):
    cell = tbl.cell(0, c); cell.text = h
    pr = cell.text_frame.paragraphs[0]
    pr.runs[0].font.size = Pt(15); pr.runs[0].font.name = F
    pr.runs[0].font.bold = True; pr.runs[0].font.color.rgb = WHITE
    cell.fill.solid(); cell.fill.fore_color.rgb = NAVY
data = [
    ("Fresh milk, near expiry", "Perishable, 2 days", "-30%"),
    ("Green apple, fresh", "Perishable, 60 days", "-5%"),
    ("Wireless mouse", "Electronic", "-10%"),
    ("Ground coffee", "General", "-5%"),
]
for r, (a, b, c) in enumerate(data, start=1):
    for ci, val in enumerate([a, b, c]):
        cell = tbl.cell(r, ci); cell.text = val
        pr = cell.text_frame.paragraphs[0]
        pr.runs[0].font.size = Pt(14); pr.runs[0].font.name = F
        pr.runs[0].font.color.rgb = DARK if ci != 2 else GREEN
        if ci == 2: pr.runs[0].font.bold = True
        cell.fill.solid(); cell.fill.fore_color.rgb = WHITE if r % 2 else PALE
tb(s, "Both perishables are the same class. Only the expiry date is different.",
   3.95, 5.35, 8.9, 0.4, 15, DARK)
tb(s, "Total: 400,000 VND, save 37,500, tax 39,850, pay 402,350",
   3.95, 5.85, 8.9, 0.4, 15, NAVY, bold=True)
note(s, "Real cart screenshot from the app")

# =====================================================================
# 8  PAYMENT + RECEIPT
# =====================================================================
s = new_slide()
head(s, "Payment and printed receipt")
pic(s, "payment.jpg", M, 1.75, h=4.9)
frame(s, M, 1.75, 3.84, 4.9)
pic(s, "receipt.jpg", 4.52, 1.75, h=4.9)
frame(s, 4.52, 1.75, 4.08, 4.9)
tb(s, "Three payment methods", 8.95, 1.8, 3.9, 0.35, 18, NAVY, bold=True)
tb(s, "Cash, bank card, e-wallet", 8.95, 2.2, 3.9, 0.5, 15, DARK)
tb(s, "What is on the receipt?", 8.95, 2.95, 3.9, 0.35, 18, NAVY, bold=True)
tb(s, "Order code and time\nEvery line with its discount\nSubtotal, saving, tax, total\nThe amount written in words",
   8.95, 3.35, 3.9, 1.6, 14, DARK)
tb(s, "Save to .txt or print directly", 8.95, 5.25, 3.9, 0.4, 15, BLUE, bold=True)
note(s, "Payment is only recorded - the app does not connect to a real payment gateway")

# =====================================================================
# 9  INVENTORY
# =====================================================================
s = new_slide()
head(s, "Stock - low stock and near-expiry warnings")
pic(s, "inventory.jpg", M, 1.68, w=7.95)
frame(s, M, 1.68, 7.95, 4.97)
tb(s, "Four number cards", 8.9, 1.75, 3.95, 0.35, 18, NAVY, bold=True)
tb(s, "72 products, 3 low, 2 near expiry, 107,406,000 VND in stock",
   8.9, 2.15, 3.95, 0.9, 14, DARK)
tb(s, "Row colours", 8.9, 3.15, 3.95, 0.35, 18, NAVY, bold=True)
badge(s, 8.9, 3.55, 1.45, 0.36, "Amber", RGBColor(0xFB,0xF0,0xD5), RGBColor(0x8A,0x60,0x00), 12)
tb(s, "low stock or near expiry", 10.5, 3.6, 2.35, 0.3, 13, DARK)
badge(s, 8.9, 4.0, 1.45, 0.36, "Coral", RGBColor(0xFA,0xE3,0xE1), RGBColor(0xA0,0x36,0x2C), 12)
tb(s, "out of stock or expired", 10.5, 4.05, 2.35, 0.3, 13, DARK)
tb(s, "Six actions", 8.9, 4.75, 3.95, 0.35, 18, NAVY, bold=True)
tb(s, "Add, delete, restock, withdraw, change price, view detail",
   8.9, 5.15, 3.95, 0.8, 14, DARK)
note(s, "Stock screen, logged in as manager")

# =====================================================================
# 10 ADD PRODUCT
# =====================================================================
s = new_slide()
head(s, "Adding a product - choosing the type changes the pricing rule")
pic(s, "add-product.jpg", M, 1.75, h=5.0)
frame(s, M, 1.75, 6.25, 5.0)
tb(s, "Three product types", 7.0, 1.8, 5.85, 0.35, 19, NAVY, bold=True)
opts = [
    ("Perishable", "Has an expiry date. 30% off when near expiry.", BLUE),
    ("Electronic", "Has a warranty. 10% off. Tax 12%.", RGBColor(0x70,0x30,0xA0)),
    ("General", "No expiry. 5% off. Tax 10%.", GREEN),
]
cy = 2.3
for name, desc, col in opts:
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(7.0), IN(cy), IN(5.85), IN(0.9))
    box.fill.solid(); box.fill.fore_color.rgb = PALE
    box.line.color.rgb = LINE; box.shadow.inherit = False
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = IN(0.18); tf.margin_top = IN(0.08)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r1 = p.add_run(); r1.text = name
    r1.font.size = Pt(16); r1.font.name = F; r1.font.bold = True; r1.font.color.rgb = col
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.LEFT
    r2 = p2.add_run(); r2.text = desc
    r2.font.size = Pt(13); r2.font.name = F; r2.font.color.rgb = DARK
    cy += 1.0
tb(s, "The expiry field only appears if you pick Perishable.",
   7.0, 5.5, 5.85, 0.4, 14, GREY, italic=True)
note(s, "The add-product dialog")

# =====================================================================
# 11 REPORTS
# =====================================================================
s = new_slide()
head(s, "Revenue - filter by time, read the charts, export to CSV")
pic(s, "reports.jpg", M, 1.66, w=7.9)
frame(s, M, 1.66, 7.9, 4.94)
tb(s, "Three time ranges", 8.85, 1.75, 4.0, 0.35, 17, NAVY, bold=True)
tb(s, "Today, last 7 days, all time", 8.85, 2.12, 4.0, 0.35, 14, DARK)
tb(s, "Four number cards", 8.85, 2.65, 4.0, 0.35, 17, NAVY, bold=True)
tb(s, "Revenue, orders, average order, items sold", 8.85, 3.02, 4.0, 0.7, 14, DARK)
tb(s, "Three charts", 8.85, 3.85, 4.0, 0.35, 17, NAVY, bold=True)
tb(s, "Bar by group, donut share, 7-day trend", 8.85, 4.22, 4.0, 0.7, 14, DARK)
tb(s, "Export CSV", 8.85, 5.0, 4.0, 0.35, 17, NAVY, bold=True)
tb(s, "UTF-8 with BOM, so Excel opens it with correct accents",
   8.85, 5.37, 4.0, 0.7, 14, DARK)
note(s, "Charts are plain SVG - no external chart library")

# =====================================================================
# 12 INVOICE MODAL
# =====================================================================
s = new_slide()
head(s, "Open an old invoice - and print the same receipt the customer got")
pic(s, "invoice-modal.jpg", M, 1.75, h=4.9)
frame(s, M, 1.75, 5.05, 4.9)
tb(s, "Click a row", 7.6, 1.8, 5.25, 0.35, 19, NAVY, bold=True)
tb(s, "A small bar appears: View invoice, Print", 7.6, 2.2, 5.25, 0.4, 15, DARK)
tb(s, "The invoice keeps its own prices", 7.6, 2.85, 5.25, 0.35, 19, NAVY, bold=True)
tb(s, "If we change a price today, yesterday's invoice does not change. Each line stores the price it was sold at.",
   7.6, 3.25, 5.25, 1.2, 15, DARK)
tb(s, "Print again", 7.6, 4.65, 5.25, 0.35, 19, NAVY, bold=True)
tb(s, "It opens a separate print window, so the admin screen is not printed.",
   7.6, 5.05, 5.25, 0.8, 15, DARK)
note(s, "Invoice dialog opened from the Revenue screen")

# =====================================================================
# 13 USERS
# =====================================================================
s = new_slide()
head(s, "Staff - add people, change their role, remove accounts")
pic(s, "users.jpg", M, 1.68, w=7.95)
frame(s, M, 1.68, 7.95, 4.97)
tb(s, "Three rules we block", 8.9, 1.75, 3.95, 0.35, 18, NAVY, bold=True)
rules = [
    ("You cannot delete yourself", "You would lock yourself out"),
    ("You cannot delete the last admin", "Then nobody can manage the shop"),
    ("You cannot demote yourself", "Same reason"),
]
cy = 2.2
for t, d in rules:
    tb(s, "- " + t, 8.9, cy, 3.95, 0.3, 15, DARK, bold=True)
    tb(s, d, 9.15, cy + 0.3, 3.7, 0.3, 13, GREY)
    cy += 0.85
tb(s, "Passwords cannot be read back", 8.9, 4.8, 3.95, 0.35, 15, DARK, bold=True)
tb(s, "We only store the hash. If a user forgets, we set a new password.",
   8.9, 5.15, 3.95, 0.8, 13, GREY)
note(s, "Staff screen - admin only")

# =====================================================================
# 14 SETTINGS + DARK
# =====================================================================
s = new_slide()
head(s, "Settings - light or dark, display density, reduced motion")
pic(s, "settings.jpg", M, 1.62, w=5.9)
frame(s, M, 1.62, 5.9, 3.69)
pic(s, "darkmode.jpg", 6.6, 1.62, w=5.9)
frame(s, 6.6, 1.62, 5.9, 3.69)
tb(s, "Light / Dark / Follow system", M, 5.6, 3.0, 0.3, 15, NAVY, bold=True)
tb(s, "Density: Comfortable / Compact", M, 5.9, 3.0, 0.3, 15, NAVY, bold=True)
tb(s, "Keyboard shortcuts", 3.4, 5.6, 3.0, 0.3, 15, NAVY, bold=True)
tb(s, "Ctrl+K, F9, ?", 3.4, 5.9, 3.0, 0.3, 15, DARK)
tb(s, "Responsive: 1440 / 900 / 420 px", 6.6, 5.6, 5.9, 0.3, 15, NAVY, bold=True)
tb(s, "Works on phone and tablet", 6.6, 5.9, 5.9, 0.35, 14, DARK)
note(s, "Settings dialog and the dark theme")

# =====================================================================
# 15 MOBILE
# =====================================================================
s = new_slide()
head(s, "It runs on a phone - no sideways scrolling at 420 px")
pic(s, "mobile.jpg", M, 1.7, h=5.1)
frame(s, M, 1.7, 2.38, 5.1)
tb(s, "The layout folds itself", 3.3, 1.75, 9.5, 0.4, 20, NAVY, bold=True)
tb(s, "Product grid goes from 4 columns to 2\nCards stack vertically\nThe cart becomes a sheet from the bottom\nButtons are at least 44 px tall",
   3.3, 2.2, 9.5, 1.9, 17, DARK)
tb(s, "How we checked", 3.3, 4.3, 9.5, 0.35, 18, NAVY, bold=True)
tb(s, "No horizontal scrollbar at 420 px or 900 px - measured in a headless browser.",
   3.3, 4.7, 9.5, 0.8, 15, DARK)
note(s, "Screenshot at 420 x 900")

# =====================================================================
# 16 OOP
# =====================================================================
s = new_slide()
head(s, "The OOP part - where the four ideas live in the code")
cols = [
    ("Abstraction", "Product", "You cannot write new Product().\nSubclasses must override applyDiscount()."),
    ("Inheritance", "3 subclasses", "Perishable, Electronic, General.\nAll extend Product."),
    ("Polymorphism", "applyDiscount()", "One call.\nDifferent results: 30%, 10%, 5%."),
    ("Encapsulation", "#stock #price", "Private fields.\nOnly restock() and trySell() can change stock."),
]
w = 3.0
for i, (title, name, desc) in enumerate(cols):
    x = M + i * (w + 0.12)
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(x), IN(1.75), IN(w), IN(3.5))
    box.fill.solid(); box.fill.fore_color.rgb = PALE
    box.line.color.rgb = LINE; box.shadow.inherit = False
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = IN(0.16); tf.margin_right = IN(0.16); tf.margin_top = IN(0.16)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = title
    r.font.size = Pt(17); r.font.name = F; r.font.bold = True; r.font.color.rgb = BLUE
    p2 = tf.add_paragraph(); p2.space_before = Pt(6); p2.alignment = PP_ALIGN.LEFT
    r2 = p2.add_run(); r2.text = name
    r2.font.size = Pt(19); r2.font.name = F; r2.font.bold = True; r2.font.color.rgb = NAVY
    p3 = tf.add_paragraph(); p3.space_before = Pt(8); p3.alignment = PP_ALIGN.LEFT
    r3 = p3.add_run(); r3.text = desc
    r3.font.size = Pt(13); r3.font.name = F; r3.font.color.rgb = DARK
tb(s, "File: web/js/core/models.js  ·  desktop version: SmartMart.Core/Domain.cs",
   M, 5.5, CW, 0.35, 14, GREY)
tb(s, "Only this one place knows the discount rule. The cart, the invoice and the report all call the same method.",
   M, 5.95, CW, 0.4, 16, NAVY, bold=True)
note(s, "We explain this slide with our voice - no need to read code on screen")

# =====================================================================
# 17 TESTING
# =====================================================================
s = new_slide()
head(s, "We tested it - 288 web tests and 25 .NET tests, all passing")
cd = CategoryChartData()
cd.categories = ["Products", "Cart", "Stock", "Login", "Sales UI", "Reports"]
cd.add_series("Tests", (51, 36, 43, 47, 46, 65))
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, IN(M), IN(1.8), IN(6.9), IN(4.0), cd)
ch = gf.chart
ch.has_legend = False
ch.has_title = True
ch.chart_title.text_frame.text = "288 tests by module"
for pp in ch.chart_title.text_frame.paragraphs:
    for rr in pp.runs:
        rr.font.size = Pt(15); rr.font.name = F; rr.font.color.rgb = NAVY; rr.font.bold = True
plot = ch.plots[0]; plot.gap_width = 60; plot.has_data_labels = True
plot.data_labels.font.size = Pt(13); plot.data_labels.font.name = F
plot.data_labels.font.color.rgb = DARK
ser = plot.series[0]; ser.format.fill.solid(); ser.format.fill.fore_color.rgb = BLUE
ch.category_axis.tick_labels.font.size = Pt(12)
ch.category_axis.tick_labels.font.name = F
ch.category_axis.tick_labels.font.color.rgb = GREY
ch.value_axis.tick_labels.font.size = Pt(11)
ch.value_axis.tick_labels.font.name = F
ch.value_axis.tick_labels.font.color.rgb = GREY
ch.value_axis.has_major_gridlines = True
ch.value_axis.major_gridlines.format.line.color.rgb = RGBColor(0xE8,0xEC,0xF2)
ch.value_axis.maximum_scale = 70
items = [
    ("288 web tests", "node --test, runs in under 2 seconds"),
    ("25 .NET tests", "xUnit for the Core layer"),
    ("0 console errors", "checked in a headless browser"),
    ("0 build warnings", "dotnet build -c Release"),
]
cy = 1.85
for t, d in items:
    tb(s, "OK   " + t, 7.75, cy, 5.1, 0.35, 18, GREEN, bold=True)
    tb(s, d, 8.15, cy + 0.35, 4.7, 0.35, 14, DARK)
    cy += 0.95
note(s, "Run on 15 November 2026, before submission")

# =====================================================================
# 18 LIMITS
# =====================================================================
s = new_slide()
head(s, "What is not finished - we list it ourselves")
tb(s, "Two weak points in the Core layer", M, 1.75, CW, 0.4, 20, NAVY, bold=True)
items = [
    ("The user list is public.", "You can call Users.Add() and skip the permission check."),
    ("Product.Restock() and the price setter are public.", "You can call them directly and skip Inventory."),
    ("The \"at least one admin\" rule is only in the UI.", "The Core layer does not check it."),
]
cy = 2.25
for t, d in items:
    tb(s, "X   " + t, M, cy, CW, 0.35, 17, RED, bold=True)
    tb(s, d, M + 0.4, cy + 0.32, 11.5, 0.35, 14, DARK)
    cy += 0.9
box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, IN(M), IN(5.2), IN(CW), IN(1.0))
box.fill.solid(); box.fill.fore_color.rgb = RGBColor(0xFF,0xF7,0xE0)
box.line.color.rgb = RGBColor(0xE6,0xC8,0x00); box.shadow.inherit = False
tf = box.text_frame; tf.word_wrap = True
tf.margin_left = IN(0.2); tf.margin_top = IN(0.12)
p = tf.paragraphs[0]
r = p.add_run()
r.text = "You cannot reach these through the normal UI - but we should still fix them."
r.font.size = Pt(16); r.font.name = F; r.font.bold = True
r.font.color.rgb = RGBColor(0x7A,0x52,0x00)
note(s, "We found these by calling the Core layer directly, not through the screen")

# =====================================================================
# 19 NEXT
# =====================================================================
s = new_slide()
head(s, "If we had more time, what would we do next")
items = [
    ("1", "Fix the two weak points", "~1 day", "Make the list read-only, make setters internal"),
    ("2", "Share one Core", "~1 week", "Web and desktop use the same rules"),
    ("3", "Barcode scanner", "~2 days", "Right now the barcode is typed by hand"),
    ("4", "Cloud sync", "Out of scope", "Not needed for this project"),
]
cy = 1.85
for num, what, cost, why in items:
    badge(s, M, cy, 0.45, 0.45, num, BLUE if num in ("1","2") else RGBColor(0xCC,0xD3,0xDD),
          WHITE if num in ("1","2") else GREY, 15)
    tb(s, what, M + 0.65, cy - 0.02, 4.6, 0.35, 19, NAVY, bold=True)
    tb(s, cost, M + 5.4, cy + 0.02, 1.9, 0.3, 15, GREY)
    tb(s, why, M + 7.4, cy + 0.02, 5.3, 0.3, 14, DARK)
    cy += 1.05
note(s, "We sorted these by risk, not by what would be fun to build")

# =====================================================================
# 20 CONCLUSION
# =====================================================================
s = new_slide(NAVY)
tb(s, "To sum up", M, 0.5, CW, 0.6, 26, RGBColor(0xA0,0xBB,0xDD))
sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, IN(M), IN(1.15), IN(CW), IN(0.035))
sh.fill.solid(); sh.fill.fore_color.rgb = BLUE; sh.line.fill.background(); sh.shadow.inherit = False
pts = [
    ("The app really works", "Sales, stock, revenue, staff - all four screens"),
    ("Polymorphism is used, not just shown", "4 products give 4 discounts, with no if/else"),
    ("It is tested", "288 web tests + 25 .NET tests, 0 failures"),
    ("Two small weak points are left", "We listed them, we know the fix, they do not show in normal use"),
]
cy = 1.5
for head_t, sub in pts:
    tb(s, "OK", M, cy, 0.5, 0.4, 18, RGBColor(0x6E,0xD1,0x9B), bold=True)
    tb(s, head_t, M + 0.6, cy - 0.02, CW - 0.6, 0.4, 20, WHITE, bold=True)
    tb(s, sub, M + 0.6, cy + 0.38, CW - 0.6, 0.35, 16, RGBColor(0xCA,0xDC,0xFC))
    cy += 1.18
tb(s, "Thank you - we are happy to take questions",
   M, 6.55, CW, 0.4, 17, WHITE, bold=True)

# =====================================================================
# 21 DEMO SCRIPT
# =====================================================================
s = new_slide()
head(s, "Demo plan - 5 minutes, use this during the presentation")
items = [
    ("1", "Log in as cashier", "Only the Sales menu shows", "0:00"),
    ("2", "Type \"sua tuoi\"", "Finds the milk, no accents needed", "0:40"),
    ("3", "Add 4 different products", "The cart shows 4 different discounts", "1:10"),
    ("4", "Pay and print", "Order code, amount in words", "2:10"),
    ("5", "Open Stock", "Stock went down, warnings still correct", "3:00"),
    ("6", "Log in as admin, open Revenue", "The new order is in the chart", "3:40"),
    ("7", "Export CSV", "Open it in Excel", "4:30"),
]
cy = 1.8
for num, what, expect, t in items:
    badge(s, M, cy, 0.42, 0.42, num, BLUE, WHITE, 14)
    tb(s, what, M + 0.6, cy - 0.02, 3.7, 0.35, 17, NAVY, bold=True)
    tb(s, expect, M + 4.5, cy + 0.02, 6.2, 0.3, 15, DARK)
    tb(s, t, M + 11.0, cy + 0.02, 1.2, 0.3, 14, GREY)
    cy += 0.72
note(s, "Backup slide - skip it if you are short on time")

prs.save(OUT)
print("SAVED:", OUT)
print("slides:", len(prs.slides._sldIdLst))
