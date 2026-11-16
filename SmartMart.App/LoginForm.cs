using SmartMart.Core;

namespace SmartMart.App;

public sealed class LoginForm : Form
{
    private readonly StoreSession store;
    private readonly TextBox username=Design.Input("Nhập tên đăng nhập");
    private readonly TextBox password=Design.Input("Nhập mật khẩu");
    private readonly Label error=Design.Label("",9,Color.FromArgb(185,73,73));
    public LoginForm(StoreSession store)
    {
        this.store=store; Text="SmartMart · Xin chào bạn"; ClientSize=new Size(1040,680);
        MinimumSize=new Size(960,640); StartPosition=FormStartPosition.CenterScreen;
        BackColor=Design.Background; Font=Design.Font(); AutoScaleMode=AutoScaleMode.None;
        var layout=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=2,RowCount=1 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,46));layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,54));
        var brand=new Panel { Dock=DockStyle.Fill,BackColor=Design.Rail,Padding=new Padding(42) };
        var wordmark=Design.Label("◈  smartmart",25,Color.White,FontStyle.Bold); wordmark.SetBounds(42,45,360,60);
        var edition=Design.Label("CHẠM NHẸ, BÁN HÀNG THẢNH THƠI",9,Color.FromArgb(211,224,151),FontStyle.Bold);edition.SetBounds(45,164,340,30);
        var headline=Design.Label("Gọn việc bán.\nTrọn niềm vui.",31,Color.White,FontStyle.Bold);headline.SetBounds(39,205,390,135);
        var detail=Design.Label("Từ đơn đầu tiên đến những ngày đông khách.\nSmartMart luôn cùng bạn chăm chút cửa hàng.",11,Color.FromArgb(178,198,183));detail.SetBounds(44,354,370,70);
        var accent=new Surface { Fill=Color.FromArgb(37,70,57),Outline=false };accent.SetBounds(43,467,385,105);
        var a=Design.Label("Một nơi, gọn mọi việc.",12,Color.White,FontStyle.Bold);a.SetBounds(20,15,340,30);
        var b=Design.Label("Bán nhanh  /  Kho gọn  /  Thu chi rõ",9,Color.FromArgb(193,211,183));b.SetBounds(20,50,350,30);accent.Controls.AddRange([a,b]);
        brand.Controls.AddRange([wordmark,edition,headline,detail,accent]);
        var right=new Panel { Dock=DockStyle.Fill,Padding=new Padding(54,56,54,28) };
        var fields=new TableLayoutPanel { Dock=DockStyle.Top,ColumnCount=1,RowCount=11,Height=510 };
        foreach(int h in new[]{34,58,42,30,50,26,30,50,42,52,76})fields.RowStyles.Add(new RowStyle(SizeType.Absolute,h));
        var eyebrow=Design.Label("CỬA HÀNG CỦA BẠN, NHỊP SỐNG CỦA BẠN",9,Design.Accent,FontStyle.Bold);eyebrow.Dock=DockStyle.Fill;fields.Controls.Add(eyebrow,0,0);
        var welcome=Design.Label("Chào bạn trở lại",28,Design.Ink,FontStyle.Bold);welcome.Dock=DockStyle.Fill;fields.Controls.Add(welcome,0,1);
        var hint=Design.Label("Sẵn sàng cho một ngày buôn bán thật vui?",10,Design.Muted);hint.Dock=DockStyle.Fill;fields.Controls.Add(hint,0,2);
        var un=Design.Label("Tên đăng nhập",10,Design.Ink,FontStyle.Bold);un.Dock=DockStyle.Fill;fields.Controls.Add(un,0,3);
        var ui=Design.InputBox(username);ui.Dock=DockStyle.Fill;fields.Controls.Add(ui,0,4);
        var pw=Design.Label("Mật khẩu",10,Design.Ink,FontStyle.Bold);pw.Dock=DockStyle.Fill;fields.Controls.Add(pw,0,6);
        password.UseSystemPasswordChar=true;var pi=Design.InputBox(password);pi.Dock=DockStyle.Fill;fields.Controls.Add(pi,0,7);
        error.Dock=DockStyle.Fill;fields.Controls.Add(error,0,8);
        var signIn=Design.Button("Vào cửa hàng   →",SignIn,true);signIn.Dock=DockStyle.Fill;fields.Controls.Add(signIn,0,9);AcceptButton=signIn;
        var demo=Design.Label("TÀI KHOẢN DÙNG THỬ\nadmin / admin    ·    manager / manager\ncashier / cashier",9,Design.Muted);demo.Dock=DockStyle.Fill;fields.Controls.Add(demo,0,10);
        right.Controls.Add(fields);layout.Controls.Add(brand,0,0);layout.Controls.Add(right,1,0);Controls.Add(layout);
    }
    private void SignIn()
    {
        var user=store.Users.FirstOrDefault(x=>string.Equals(x.Username,username.Text.Trim(),StringComparison.OrdinalIgnoreCase));
        if(user is null || !user.Authenticate(password.Text)) { error.Text="Tên đăng nhập hoặc mật khẩu chưa đúng. Bạn thử lại nhé.";password.SelectAll();password.Focus();return; }
        error.Text="";password.Clear();Hide();
        using var main=new MainForm(store,user);main.ShowDialog();
        if(main.SignedOut) { Show();username.Focus(); } else Close();
    }
}
