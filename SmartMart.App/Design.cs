using System.Drawing.Drawing2D;
using SmartMart.Core;

namespace SmartMart.App;

internal static class Design
{
    public static readonly Color Background = Color.FromArgb(247, 247, 241);
    public static readonly Color Ink = Color.FromArgb(28, 51, 44);
    public static readonly Color Muted = Color.FromArgb(112, 130, 119);
    public static readonly Color Accent = Color.FromArgb(27, 117, 89);
    public static readonly Color Pale = Color.FromArgb(228, 242, 230);
    public static readonly Color Border = Color.FromArgb(227, 233, 223);
    public static readonly Color Rail = Color.FromArgb(22, 49, 41);
    public static readonly Color Green = Color.FromArgb(31, 137, 109);
    public static Font Font(float size = 10, FontStyle style = FontStyle.Regular) => new("Segoe UI", size, style);
    public static Label Label(string text, float size = 10, Color? color = null, FontStyle style = FontStyle.Regular) => new()
    { Text = text, Font = Font(size, style), ForeColor = color ?? Ink, AutoSize = false, BackColor = Color.Transparent, TextAlign = ContentAlignment.MiddleLeft, UseMnemonic=false };
    public static ActionButton Button(string text, Action action, bool primary = false)
    {
        var button = new ActionButton { Text = text, Primary = primary, Height = 42, Width = 130 };
        button.Click += (_, _) => action(); return button;
    }
    public static TextBox Input(string placeholder) => new() { PlaceholderText = placeholder, BorderStyle = BorderStyle.None, Font = Font(11), BackColor = Color.White, ForeColor = Ink };
    public static void Localize(ComboBox box)
    {
        box.FormattingEnabled = true;
        box.Format += (_, e) => e.Value = e.ListItem switch
        {
            Category category => category.Label(), UserRole role => role.Label(),
            PaymentMethod method => method.Label(), _ => e.ListItem?.ToString() ?? ""
        };
    }
    public static void Notify(IWin32Window owner, string message, string title="Thông báo")
    { using var dialog=new MessageForm(title,message,false);dialog.ShowDialog(owner); }
    public static bool Ask(IWin32Window owner, string message, string title)
    { using var dialog=new MessageForm(title,message,true);return dialog.ShowDialog(owner)==DialogResult.Yes; }
    public static Panel InputBox(TextBox input)
    {
        var panel = new Surface { Height = 46, Padding = new Padding(14, 12, 14, 9) };
        input.Dock = DockStyle.Fill; panel.Controls.Add(input); return panel;
    }
    public static GraphicsPath Round(RectangleF r, float radius)
    {
        var p = new GraphicsPath(); float d = radius * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right-d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right-d, r.Bottom-d, d, d, 0, 90); p.AddArc(r.X, r.Bottom-d, d, d, 90, 90); p.CloseFigure(); return p;
    }
    public static void FillRound(Graphics g, Color color, RectangleF rect, float radius = 12)
    { using var path = Round(rect, radius); using var brush = new SolidBrush(color); g.FillPath(brush, path); }
    public static DataGridView Grid()
    {
        var grid = new DataGridView
        {
            Dock = DockStyle.Fill, BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
            ReadOnly = true, AllowUserToAddRows = false, AllowUserToDeleteRows = false,
            AllowUserToResizeRows = false, RowHeadersVisible = false, AutoGenerateColumns = false,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            MultiSelect = false, EnableHeadersVisualStyles = false, CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal,
            ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None, GridColor = Border,
            ColumnHeadersHeight = 46, Font = Font(10)
        };
        grid.ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle { BackColor = Background, ForeColor = Muted, Font = Font(9, FontStyle.Bold), Padding = new Padding(12,0,0,0), SelectionBackColor=Background };
        grid.DefaultCellStyle = new DataGridViewCellStyle { BackColor=Color.White, ForeColor=Ink, SelectionBackColor=Pale, SelectionForeColor=Ink, Padding=new Padding(12,0,0,0) };
        grid.RowTemplate.Height = 56; return grid;
    }
}

internal class Surface : Panel
{
    public Color Fill { get; set; } = Color.White;
    public bool Outline { get; set; } = true;
    public Surface() { DoubleBuffered = true; BackColor = Color.Transparent; }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var path = Design.Round(new RectangleF(0,0,Width-1,Height-1), 13);
        using var fill = new SolidBrush(Fill); e.Graphics.FillPath(fill, path);
        if (Outline) { using var pen = new Pen(Design.Border); e.Graphics.DrawPath(pen, path); }
        base.OnPaint(e);
    }
}

internal sealed class ActionButton : Button
{
    public bool Primary { get; set; }
    public bool Selected { get; set; }
    public Color? CustomFill { get; set; }
    public Color? CustomText { get; set; }
    private bool hover;
    public ActionButton()
    {
        FlatStyle=FlatStyle.Flat; FlatAppearance.BorderSize=0; Cursor=Cursors.Hand; Font=Design.Font(10,FontStyle.Bold);
        BackColor=Color.Transparent; UseMnemonic=false; SetStyle(ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
    }
    protected override void OnMouseEnter(EventArgs e) { hover=true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover=false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.Clear(Parent is Surface surface ? surface.Fill : Parent?.BackColor is Color background && background.A==255 ? background : Design.Background);
        e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
        var fill = !Enabled ? Design.Border : CustomFill ?? (Primary ? Design.Accent : Selected ? Design.Pale : hover ? Color.FromArgb(238,246,237) : Color.White);
        Design.FillRound(e.Graphics, fill, new RectangleF(0,0,Width-1,Height-1), 9);
        var color = !Enabled ? Design.Muted : CustomText ?? (Primary ? Color.White : Selected ? Design.Accent : Design.Ink);
        TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, color, TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.NoPrefix);
        if (Focused) { using var pen = new Pen(Design.Accent); e.Graphics.DrawRectangle(pen, 4,4,Width-9,Height-9); }
    }
}

internal sealed class ProductCard : Button
{
    public Product Product { get; }
    private bool hover;
    public ProductCard(Product product)
    {
        Product=product; Width=210; Height=264; Margin=new Padding(0,0,16,16); Cursor=Cursors.Hand;
        FlatStyle=FlatStyle.Flat; FlatAppearance.BorderSize=0; BackColor=Design.Background;
        AccessibleName=$"Thêm {product.Name}"; Text=product.Name;
        SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint,true);
    }
    protected override void OnMouseEnter(EventArgs e) { hover=true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover=false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g=e.Graphics; g.Clear(Design.Background); g.SmoothingMode=SmoothingMode.AntiAlias;
        Design.FillRound(g,Color.White,new RectangleF(0,0,Width-1,Height-1),14);
        using var outline = new Pen(hover || Focused ? Design.Accent : Design.Border, hover ? 2 : 1);
        using var path=Design.Round(new RectangleF(1,1,Width-3,Height-3),14); g.DrawPath(outline,path);
        var tint = Product.Category switch { Category.Dairy=>Color.FromArgb(232,241,253), Category.Produce=>Color.FromArgb(235,244,232), Category.Electronics=>Color.FromArgb(237,234,249), Category.Household=>Color.FromArgb(249,237,229), _=>Color.FromArgb(245,239,225) };
        var photo=ProductImages.Get(Product);
        Design.FillRound(g,photo is null?tint:Color.FromArgb(251,251,248),new RectangleF(12,12,Width-24,128),10);
        if(photo is null)ProductArt.Draw(g,Product,new Rectangle(Width/2-48,22,96,104));
        else
        {
            float scale=Math.Min((Width-50f)/photo.Width,116f/photo.Height);
            float w=photo.Width*scale,h=photo.Height*scale;
            g.InterpolationMode=InterpolationMode.HighQualityBicubic;
            g.DrawImage(photo,new RectangleF((Width-w)/2,18+(116-h)/2,w,h));
        }
        using var small=Design.Font(8,FontStyle.Bold); using var name=Design.Font(10,FontStyle.Bold); using var price=Design.Font(14,FontStyle.Bold); using var normal=Design.Font(9);
        var discount=Product.UnitPrice==0?0:(1-Product.ApplyDiscount()/Product.UnitPrice)*100;
        Design.FillRound(g,Color.White,new RectangleF(20,20,62,23),6);
        TextRenderer.DrawText(g,$"−{discount:0}%",small,new Rectangle(20,20,62,23),Design.Accent,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(g,Product.Name,name,new Rectangle(16,149,Width-30,42),Design.Ink,TextFormatFlags.EndEllipsis|TextFormatFlags.WordBreak|TextFormatFlags.Left|TextFormatFlags.NoPrefix);
        string stock=Product is PerishableProduct { IsExpired:true } ? "Hết hạn · ngừng bán" : Product.Stock==0 ? "Hết hàng" : $"Còn {Product.Stock}  ·  {Product.Category.Label()}";
        TextRenderer.DrawText(g,stock,normal,new Rectangle(16,194,Width-26,20),Product.IsLowStock?Color.FromArgb(174,110,39):Design.Muted,TextFormatFlags.Left|TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g,Money.Format(Product.ApplyDiscount()),price,new Rectangle(15,226,Width-60,30),Design.Ink,TextFormatFlags.Left);
        Design.FillRound(g,Product.CanSell?Design.Pale:Design.Background,new RectangleF(Width-48,223,34,32),9);
        TextRenderer.DrawText(g,"+",price,new Rectangle(Width-48,222,34,32),Product.CanSell?Design.Accent:Design.Muted,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
    }
}

internal static class ProductArt
{
    public static void Draw(Graphics g, Product p, Rectangle r)
    {
        var state=g.Save(); g.TranslateTransform(r.X,r.Y); g.ScaleTransform(r.Width/100f,r.Height/110f);
        using var shadow=new SolidBrush(Color.FromArgb(18,40,40,70)); g.FillEllipse(shadow,16,92,72,10);
        var color=p.Category switch { Category.Dairy=>Color.FromArgb(88,139,196), Category.Produce=>Color.FromArgb(103,155,86), Category.Electronics=>Color.FromArgb(67,66,83), Category.Household=>Color.FromArgb(203,153,105), _=>Color.FromArgb(154,113,76) };
        if (Vietnamese.Matches(p.Name,"táo"))
        {
            using var green=new SolidBrush(color); using var dark=new Pen(Color.FromArgb(72,101,52),4);
            g.DrawLine(dark,52,32,56,18); g.FillEllipse(green,45,17,22,10); g.FillEllipse(green,18,34,43,55); g.FillEllipse(green,43,34,43,55);
            using var light=new Pen(Color.FromArgb(165,201,125),4); g.DrawArc(light,26,44,20,30,150,90);
        }
        else if (p.Category==Category.Electronics)
        {
            Design.FillRound(g,color,new RectangleF(27,30,51,61),12);
            if(Vietnamese.Matches(p.Name,"sạc")) { using var metal=new Pen(Color.FromArgb(155,155,169),5); g.DrawLine(metal,40,15,40,31); g.DrawLine(metal,64,15,64,31); }
            else { Design.FillRound(g,Color.FromArgb(95,91,117),new RectangleF(20,24,64,34),10); Design.FillRound(g,Color.FromArgb(166,209,197),new RectangleF(29,32,46,12),3); }
            using var white=new SolidBrush(Color.FromArgb(215,210,239)); g.FillRectangle(white,47,65,12,4);
        }
        else if(Vietnamese.Matches(p.Name,"nui"))
        {
            using var leaf=new SolidBrush(color); for(int i=0;i<5;i++)g.FillEllipse(leaf,20+i*10,34+(i%2)*9,24,24);
            using var bowl=new SolidBrush(Color.White); g.FillPie(bowl,13,27,78,69,0,180);
            using var line=new Pen(Color.FromArgb(194,212,184),3);g.DrawLine(line,14,61,91,61);
        }
        else
        {
            bool bottle=Vietnamese.Matches(p.Name,"sữa tươi")||Vietnamese.Matches(p.Name,"nước");
            if(bottle) { Design.FillRound(g,color,new RectangleF(37,10,26,14),3); Design.FillRound(g,Color.FromArgb(250,252,253),new RectangleF(26,24,49,70),9); }
            else { Design.FillRound(g,color,new RectangleF(24,16,56,79),6); using var seam=new Pen(Color.FromArgb(70,255,255,255),3);g.DrawLine(seam,29,24,75,24); }
            var label=bottle?color:Color.FromArgb(250,246,234);
            Design.FillRound(g,label,new RectangleF(27,45,47,33),2);
            using var f=Design.Font(7,FontStyle.Bold);
            var title=Vietnamese.Matches(p.Name,"cà phê")?"CÀ PHÊ":Vietnamese.Matches(p.Name,"sữa tươi")?"SỮA":Vietnamese.Matches(p.Name,"khoáng")?"MÁT":Vietnamese.Matches(p.Name,"rửa")?"SẠCH":Vietnamese.Matches(p.Name,"sữa chua")?"SỮA CHUA":Vietnamese.Matches(p.Name,"giấy")?"MỀM":Vietnamese.Matches(p.Name,"túi")?"TÁI DÙNG":"BÁNH";
            using var ink=new SolidBrush(bottle?Color.White:color);
            using var format=new StringFormat { Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center };
            g.DrawString(title,f,ink,new RectangleF(27,53,47,15),format);
        }
        g.Restore(state);
    }
}
