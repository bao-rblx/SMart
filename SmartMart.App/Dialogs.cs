using System.Drawing.Printing;
using SmartMart.Core;

namespace SmartMart.App;

internal class WorkspaceDialog : Form
{
    protected readonly Panel Body=new() { Dock=DockStyle.Fill,Padding=new Padding(28) };
    public WorkspaceDialog(string title,int height=380,int width=480)
    {
        Text="SmartMart · "+title;ClientSize=new Size(width,height);FormBorderStyle=FormBorderStyle.FixedDialog;
        StartPosition=FormStartPosition.CenterParent;MaximizeBox=false;MinimizeBox=false;BackColor=Design.Background;Font=Design.Font();AutoScaleMode=AutoScaleMode.Dpi;
        Controls.Add(Body);
        var heading=Design.Label(title,22,Design.Ink,FontStyle.Bold);heading.SetBounds(28,24,width-56,43);Body.Controls.Add(heading);
    }
    protected void Field(string title,Control control,int y,int width=424)
    {
        var label=Design.Label(title,9,Design.Muted,FontStyle.Bold);label.SetBounds(28,y,width,25);Body.Controls.Add(label);
        control.SetBounds(28,y+30,width,38);Body.Controls.Add(control);
    }
    protected ActionButton Confirm(string text,Action action,int y,int width=424)
    {
        var button=Design.Button(text,action,true);button.SetBounds(28,y,width,44);Body.Controls.Add(button);AcceptButton=button;return button;
    }
}

internal sealed class MessageForm : WorkspaceDialog
{
    public MessageForm(string title,string message,bool confirm) : base(title,300,530)
    {
        var body=Design.Label(message,11,Design.Muted);body.SetBounds(28,90,474,110);Body.Controls.Add(body);
        if(confirm)
        {
            var cancel=Design.Button("Hủy",()=>DialogResult=DialogResult.No);cancel.SetBounds(28,223,150,44);Body.Controls.Add(cancel);CancelButton=cancel;
            var yes=Confirm("Đồng ý",()=>DialogResult=DialogResult.Yes,223,305);yes.Left=197;
        }
        else { var close=Confirm("Đã hiểu",()=>DialogResult=DialogResult.OK,223,474);CancelButton=close; }
    }
}

internal sealed class NumberForm : WorkspaceDialog
{
    private readonly NumericUpDown number;
    public decimal Value=>number.Value;
    public NumberForm(string title,string note,decimal value,decimal minimum,decimal maximum,int decimals) : base(title,270)
    {
        number=new NumericUpDown { Minimum=minimum,Maximum=maximum,Value=value,DecimalPlaces=decimals,ThousandsSeparator=true,Font=Design.Font(14),BorderStyle=BorderStyle.FixedSingle };
        Field(note,number,88);Confirm("Lưu thay đổi",()=>DialogResult=DialogResult.OK,191);
    }
}

internal sealed class PaymentForm : WorkspaceDialog
{
    private PaymentMethod method=PaymentMethod.Cash;
    public PaymentMethod Method=>method;
    public PaymentForm(decimal total) : base("Hoàn tất đơn hàng",440)
    {
        var label=Design.Label("KHÁCH CẦN THANH TOÁN",9,Design.Muted,FontStyle.Bold);label.SetBounds(28,89,424,25);
        var amount=Design.Label(Money.Format(total),37,Design.Ink,FontStyle.Bold);amount.SetBounds(24,116,425,70);Body.Controls.AddRange([label,amount]);
        var note=Design.Label("Khách thanh toán bằng cách nào?",10,Design.Muted);note.SetBounds(28,201,424,26);Body.Controls.Add(note);
        var buttons=new List<ActionButton>();int i=0;
        foreach(var option in Enum.GetValues<PaymentMethod>())
        {
            var button=Design.Button(option.Label(),()=> { method=option;foreach(var b in buttons) { b.Selected=(PaymentMethod)b.Tag! == option;b.Invalidate(); } });
            button.Tag=option;button.Selected=option==method;button.SetBounds(28+i++*144,239,136,46);buttons.Add(button);Body.Controls.Add(button);
        }
        var help=Design.Label("Chỉ ghi nhận thanh toán. Hãy nhận tiền hoặc xác nhận\ngiao dịch trên thiết bị trước khi hoàn tất đơn.",9,Design.Muted);help.SetBounds(28,301,424,45);Body.Controls.Add(help);
        Confirm("Xác nhận đã nhận tiền  →",()=>DialogResult=DialogResult.OK,365);
    }
}

internal sealed class ReceiptForm : WorkspaceDialog
{
    private readonly Transaction transaction;
    public ReceiptForm(Transaction transaction) : base("Bán xong rồi!",710,530)
    {
        this.transaction=transaction;
        var note=Design.Label($"✓  Đã ghi nhận thanh toán · #{transaction.OrderId}",10,Design.Green);note.SetBounds(28,76,474,30);Body.Controls.Add(note);
        var text=new TextBox { Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,BorderStyle=BorderStyle.None,BackColor=Color.White,Font=new Font("Consolas",11),Text=transaction.GenerateInvoice().Replace("\n",Environment.NewLine) };
        var paper=new Surface { Padding=new Padding(20) };paper.SetBounds(28,126,474,460);text.Dock=DockStyle.Fill;paper.Controls.Add(text);Body.Controls.Add(paper);
        var save=Design.Button("Lưu hóa đơn",Save);save.SetBounds(28,601,150,42);
        var print=Design.Button("In hóa đơn",Print);print.SetBounds(190,601,150,42);
        var done=Design.Button("Xong",()=>DialogResult=DialogResult.OK,true);done.SetBounds(352,601,150,42);Body.Controls.AddRange([save,print,done]);AcceptButton=done;
        Shown+=(_,_)=> { text.Select(0,0);done.Focus(); };
    }
    private void Save()
    {
        using var dialog=new SaveFileDialog { Title="Lưu hóa đơn",Filter="Hóa đơn văn bản (*.txt)|*.txt",FileName=$"SmartMart-{transaction.OrderId}.txt" };
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        try { File.WriteAllText(dialog.FileName,transaction.GenerateInvoice()); }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException) { Design.Notify(this,"Không ghi được tệp. Hãy chọn thư mục khác và thử lại.","Chưa lưu được hóa đơn"); }
    }
    private void Print()
    {
        try
        {
            using var document=new PrintDocument { DocumentName=$"Hóa đơn SmartMart {transaction.OrderId}" };using var font=new Font("Consolas",11);
            int offset=0;string receipt=transaction.GenerateInvoice();
            document.PrintPage+=(_,e)=>
            {
                var graphics=e.Graphics!;
                graphics.MeasureString(receipt[offset..],font,e.MarginBounds.Size,StringFormat.GenericTypographic,out int characters,out int linesFitted);
                graphics.DrawString(receipt.Substring(offset,characters),font,Brushes.Black,e.MarginBounds,StringFormat.GenericTypographic);
                offset+=characters;e.HasMorePages=offset<receipt.Length;
            };
            using var dialog=new PrintDialog { Document=document,UseEXDialog=true };if(dialog.ShowDialog(this)==DialogResult.OK)document.Print();
        }
        catch(Exception ex) when(ex is InvalidPrinterException or System.ComponentModel.Win32Exception) { Design.Notify(this,"Kiểm tra kết nối và thiết lập máy in rồi thử lại nhé.","Chưa thể in hóa đơn"); }
    }
}

internal sealed class ProductForm : WorkspaceDialog
{
    public Product? Product { get; private set; }
    public ProductForm(int id) : base("Thêm mặt hàng",690)
    {
        var name=Design.Input("Tên sản phẩm");var nameBox=Design.InputBox(name);Field("Tên sản phẩm",nameBox,84);
        var category=new ComboBox { DataSource=Enum.GetValues<Category>(),DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(11) };Field("Nhóm hàng",category,164);Design.Localize(category);
        var type=new ComboBox { DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(11) };type.Items.AddRange(["Hàng thông thường","Hàng tươi / có hạn dùng","Thiết bị điện tử"]);type.SelectedIndex=0;Field("Loại hàng / chính sách ưu đãi",type,244);
        var price=new NumericUpDown { Minimum=0,Maximum=1000000000,DecimalPlaces=0,ThousandsSeparator=true,Increment=1000,Font=Design.Font(11),Value=10000 };Field("Giá bán (₫)",price,324,198);
        var stock=new NumericUpDown { Minimum=0,Maximum=1000000,Font=Design.Font(11) };stock.SetBounds(254,354,198,38);var stockLabel=Design.Label("Tồn kho ban đầu",9,Design.Muted,FontStyle.Bold);stockLabel.SetBounds(254,324,198,25);Body.Controls.AddRange([stock,stockLabel]);
        var expiry=new DateTimePicker { Format=DateTimePickerFormat.Custom,CustomFormat="dd/MM/yyyy",Value=DateTime.Today.AddDays(14),Font=Design.Font(11) };Field("Hạn dùng (hàng tươi)",expiry,404);expiry.Enabled=false;
        var warranty=new NumericUpDown { Minimum=0,Maximum=120,Value=12,Font=Design.Font(11),Enabled=false };Field("Bảo hành theo tháng (điện tử)",warranty,484);
        type.SelectedIndexChanged+=(_,_)=> { expiry.Enabled=type.SelectedIndex==1;warranty.Enabled=type.SelectedIndex==2; };
        var error=Design.Label("",9,Color.Firebrick);error.SetBounds(28,564,424,30);Body.Controls.Add(error);
        Confirm("Thêm vào kho",()=>
        {
            if(string.IsNullOrWhiteSpace(name.Text)) { error.Text="Bạn nhập tên sản phẩm nhé.";name.Focus();return; }
            var c=(Category)category.SelectedItem!;
            if(type.SelectedIndex==1&&expiry.Value.Date<DateTime.Today) { error.Text="Hạn dùng phải từ hôm nay trở đi.";return; }
            Product=type.SelectedIndex switch
            {
                1=>new PerishableProduct((int)stock.Value) { Id=id,Name=name.Text.Trim(),Category=c,UnitPrice=price.Value,ExpiryDate=DateOnly.FromDateTime(expiry.Value) },
                2=>new ElectronicProduct((int)stock.Value) { Id=id,Name=name.Text.Trim(),Category=c,UnitPrice=price.Value,WarrantyMonths=(int)warranty.Value,SerialNumber=$"SM-{id:0000}" },
                _=>new GeneralProduct((int)stock.Value) { Id=id,Name=name.Text.Trim(),Category=c,UnitPrice=price.Value,Supplier="Nhà cung cấp trong nước" }
            };DialogResult=DialogResult.OK;
        },610);
    }
}

internal sealed class MemberForm : WorkspaceDialog
{
    public User? Member { get; private set; }
    public MemberForm(IEnumerable<string> existing) : base("Thêm nhân sự",480)
    {
        var username=Design.Input("Tên đăng nhập");Field("Tên đăng nhập",Design.InputBox(username),85);
        var password=Design.Input("Tối thiểu 6 ký tự");password.UseSystemPasswordChar=true;Field("Mật khẩu",Design.InputBox(password),165);
        var role=new ComboBox { DataSource=Enum.GetValues<UserRole>(),DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(11) };Field("Vai trò tại cửa hàng",role,245);Design.Localize(role);
        var error=Design.Label("",9,Color.Firebrick);error.SetBounds(28,333,424,43);Body.Controls.Add(error);
        Confirm("Tạo tài khoản",()=>
        {
            if(string.IsNullOrWhiteSpace(username.Text)||existing.Contains(username.Text.Trim(),StringComparer.OrdinalIgnoreCase)) { error.Text="Tên đăng nhập cần có nội dung và không bị trùng.";return; }
            if(password.Text.Length<6) { error.Text="Mật khẩu cần có ít nhất 6 ký tự.";return; }
            Member=(UserRole)role.SelectedItem! switch
            {
                UserRole.Admin=>new Admin(password.Text) { Username=username.Text.Trim() },
                UserRole.Manager=>new Manager(password.Text) { Username=username.Text.Trim() },
                _=>new Cashier(password.Text) { Username=username.Text.Trim() }
            };DialogResult=DialogResult.OK;
        },398);
    }
}

internal sealed class RoleForm : WorkspaceDialog
{
    private readonly ComboBox role;
    public UserRole Role=>(UserRole)role.SelectedItem!;
    public RoleForm(UserRole current) : base("Đổi quyền truy cập",275)
    {
        role=new ComboBox { DataSource=Enum.GetValues<UserRole>(),DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(11),SelectedItem=current };
        Field("Vai trò tại cửa hàng",role,88);Design.Localize(role);Confirm("Lưu vai trò",()=>DialogResult=DialogResult.OK,195);
        Load+=(_,_)=>role.SelectedItem=current;
    }
}
