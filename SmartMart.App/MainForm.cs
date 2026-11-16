using SmartMart.Core;

namespace SmartMart.App;

public sealed partial class MainForm : Form
{
    private readonly StoreSession store;
    private readonly User user;
    private readonly ShoppingCart cart=new();
    private readonly Panel content=new() { Dock=DockStyle.Fill,Padding=new Padding(26,0,26,12) };
    private readonly Label heading=Design.Label("",25,Design.Ink,FontStyle.Bold);
    private readonly Label subtitle=Design.Label("",10,Design.Muted);
    private readonly Label status=Design.Label("",9,Design.Muted);
    private readonly Dictionary<string,ActionButton> navigation=[];
    private string currentScreen="Checkout";
    public bool SignedOut { get; private set; }

    public MainForm(StoreSession store,User user)
    {
        this.store=store;this.user=user;Text="SmartMart · Quản lý cửa hàng";
        var workingArea=Screen.PrimaryScreen?.WorkingArea??new Rectangle(0,0,1440,900);
        int targetW=Math.Clamp(workingArea.Width-40,1024,1440);
        int targetH=Math.Clamp(workingArea.Height-40,640,880);
        ClientSize=new Size(targetW,targetH);MinimumSize=new Size(1024,640);StartPosition=FormStartPosition.CenterScreen;
        if(workingArea.Width<=1366||workingArea.Height<=768)WindowState=FormWindowState.Maximized;
        BackColor=Design.Background;Font=Design.Font();AutoScaleMode=AutoScaleMode.None;KeyPreview=true;
        var shell=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty };
        shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,208));shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        shell.Controls.Add(BuildNavigation(),0,0);
        var workspace=new Panel { Dock=DockStyle.Fill };
        var header=new Panel { Dock=DockStyle.Top,Height=110,Padding=new Padding(26,18,26,12) };
        heading.SetBounds(26,19,600,43);subtitle.SetBounds(29,65,650,27);
        var date=Design.Label(DateTime.Now.ToString("dddd, dd/MM/yyyy", Vietnamese.Culture),10,Design.Muted);date.Width=195;date.Dock=DockStyle.Right;date.TextAlign=ContentAlignment.MiddleRight;
        header.Controls.AddRange([heading,subtitle,date]);
        var footer=new Panel { Dock=DockStyle.Bottom,Height=34,Padding=new Padding(29,0,26,0) };status.Dock=DockStyle.Fill;footer.Controls.Add(status);
        workspace.Controls.Add(content);workspace.Controls.Add(header);workspace.Controls.Add(footer);shell.Controls.Add(workspace,1,0);Controls.Add(shell);
        Navigate("Checkout");
        KeyDown+=(_,e)=> { if(e.Control&&e.KeyCode==Keys.K&&currentScreen=="Checkout") { search.Focus();e.SuppressKeyPress=true; } if(e.KeyCode==Keys.F9&&currentScreen=="Checkout") { Pay();e.SuppressKeyPress=true; } };
        FormClosing+=(_,e)=>
        {
            if(cart.Lines.Count>0 && !Design.Ask(this,"Đơn hàng này chưa thanh toán. Bạn muốn bỏ đơn và thoát?","Rời cửa hàng")) { e.Cancel=true;SignedOut=false;return; }
            store.Save();
        };
    }
    private Panel BuildNavigation()
    {
        var rail=new Panel { Dock=DockStyle.Fill,BackColor=Design.Rail,Padding=new Padding(16) };
        var mark=Design.Label("smartmart",20,Color.White,FontStyle.Bold);mark.SetBounds(24,29,178,50);
        var storeLabel=Design.Label("CỬA HÀNG / 01",8,Color.FromArgb(148,176,156),FontStyle.Bold);storeLabel.SetBounds(25,113,170,26);
        rail.Controls.AddRange([mark,storeLabel]);
        string[] screens=user.AllowedScreens();int y=156;
        foreach(var screen in screens)
        {
            string title=screen switch { "Checkout"=>"▦    Bán hàng", "Inventory"=>"▤    Kho hàng", "Reports"=>"◷    Doanh thu", _=>"♙    Nhân sự" };
            var button=Design.Button(title,()=>Navigate(screen));button.SetBounds(15,y,178,48);button.CustomText=Color.FromArgb(185,204,188);button.CustomFill=rail.BackColor;
            navigation[screen]=button;rail.Controls.Add(button);y+=58;
        }
        var bottom=new Panel { Dock=DockStyle.Bottom,Height=180 };
        var note=Design.Label("CHĂM CHÚT TỪNG NGÀY\nGọn việc bán. Trọn niềm vui.",8,Color.FromArgb(148,176,156));note.SetBounds(9,4,170,42);
        var name=Design.Label(user.Username,12,Color.White,FontStyle.Bold);name.SetBounds(12,52,160,26);
        var role=Design.Label(user.Role.Label(),9,Color.FromArgb(180,204,166));role.SetBounds(12,80,160,22);
        var exit=Design.Button("Đăng xuất  ↗",()=> { SignedOut=true;Close(); });exit.SetBounds(4,120,173,38);exit.CustomFill=Color.FromArgb(37,70,57);exit.CustomText=Color.FromArgb(208,223,202);
        bottom.Controls.AddRange([note,name,role,exit]);rail.Controls.Add(bottom);return rail;
    }
    private void Navigate(string screen)
    {
        if(!user.AllowedScreens().Contains(screen))return;
        currentScreen=screen;
        foreach(var pair in navigation) { pair.Value.CustomFill=pair.Key==screen?Design.Accent:Design.Rail;pair.Value.CustomText=pair.Key==screen?Color.White:Color.FromArgb(185,204,188);pair.Value.Invalidate(); }
        foreach(Control child in content.Controls.Cast<Control>().ToArray())child.Dispose();
        content.Controls.Clear();
        heading.Text=screen switch { "Checkout"=>"Bán hàng", "Inventory"=>"Kho hàng", "Reports"=>"Doanh thu", _=>"Nhân sự" };
        subtitle.Text=screen switch { "Checkout"=>"Thêm chút tận tâm, thêm một vị khách hài lòng.", "Inventory"=>"Nắm rõ từng mặt hàng, chủ động mỗi ngày.", "Reports"=>"Từng đơn hàng nhỏ, một hành trình lớn.", _=>"Cùng một đội ngũ, cùng chăm chút cửa hàng." };
        content.Controls.Add(screen switch { "Checkout"=>BuildCheckout(), "Inventory"=>BuildInventory(), "Reports"=>BuildReports(), _=>BuildUsers() });
        UpdateStatus();
    }
    private void UpdateStatus(string? message=null)
    {
        status.Text=store.StorageWarning??message??store.StorageNotice??"●  Sẵn sàng bán hàng     ·     Việt Nam đồng (₫)     ·     Dữ liệu lưu trên máy";
        status.ForeColor=store.StorageWarning is null?Design.Muted:Color.FromArgb(173,108,35);
    }
    private void Save(string message) { store.Save();UpdateStatus(message); }
    private void TryAction(Action action) { try { action(); } catch(Exception ex) when(ex is InvalidOperationException or ArgumentException or OverflowException) { Design.Notify(this,ex is OverflowException ? "Số lượng vượt giới hạn. Hãy nhập số nhỏ hơn." : ex is ArgumentException ? "Giá trị chưa hợp lệ. Vui lòng kiểm tra lại." : ex.Message,"SmartMart"); } }
    private static Surface Metric(string title,string value,string note)
    {
        var card=new Surface { Dock=DockStyle.Fill,Margin=new Padding(0,0,14,0) };
        var t=Design.Label(title.ToUpperInvariant(),8,Design.Muted,FontStyle.Bold);t.SetBounds(18,11,230,21);
        var v=Design.Label(value,19,Design.Ink,FontStyle.Bold);v.SetBounds(16,32,210,39);
        var n=Design.Label(note,8,Design.Muted);n.SetBounds(18,72,250,20);card.Controls.AddRange([t,v,n]);return card;
    }
    private static TableLayoutPanel Metrics(params Surface[] cards)
    {
        var table=new TableLayoutPanel { Dock=DockStyle.Top,Height=112,ColumnCount=cards.Length,RowCount=1,Padding=new Padding(0,0,0,12) };
        for(int i=0;i<cards.Length;i++) { table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f/cards.Length));table.Controls.Add(cards[i],i,0); }
        return table;
    }
}
