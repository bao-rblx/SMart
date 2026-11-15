using System.Globalization;
using System.Text;
using SmartMart.Core;

namespace SmartMart.App;

public sealed partial class MainForm
{
    private Control BuildInventory()
    {
        var root=new Panel { Dock=DockStyle.Fill };
        var inventory=store.Inventory;
        var stats=Metrics(Metric("Mặt hàng",inventory.Products.Count.ToString(),$"{inventory.Products.Sum(x=>x.Stock)} sản phẩm trong kho"),
            Metric("Sắp hết hàng",inventory.GetLowStockAlerts().Count.ToString(),"Cần bổ sung để bán không gián đoạn"),
            Metric("Cảnh báo hạn dùng",inventory.GetExpiringSoon().Count.ToString(),"Đã hết hạn hoặc còn tối đa 7 ngày"));
        var body=new Surface { Dock=DockStyle.Fill,Padding=new Padding(20) };
        var toolbar=new Panel { Dock=DockStyle.Top,Height=66 };
        var input=Design.Input("Tìm sản phẩm, có dấu hoặc không dấu…");var inputBox=Design.InputBox(input);inputBox.SetBounds(0,4,290,43);
        var alerts=new CheckBox { Text="Cần chú ý",Font=Design.Font(10),ForeColor=Design.Muted,AutoSize=true,Location=new Point(310,15) };
        var add=Design.Button("+  Thêm mặt hàng",()=> { using var dialog=new ProductForm(inventory.Products.Select(x=>x.Id).DefaultIfEmpty().Max()+1);if(dialog.ShowDialog(this)==DialogResult.OK && dialog.Product is not null) { TryAction(()=>inventory.Add(dialog.Product,user));if(inventory.Find(dialog.Product.Id) is null)return;Save("Đã thêm mặt hàng mới.");Navigate("Inventory"); } },true);
        add.SetBounds(0,4,155,43);add.Anchor=AnchorStyles.Top|AnchorStyles.Right;toolbar.Resize+=(_,_)=>add.Left=toolbar.ClientSize.Width-add.Width;toolbar.Controls.AddRange([inputBox,alerts,add]);
        var grid=Design.Grid();foreach(var col in new[]{"Mã","Sản phẩm","Nhóm hàng","Giá bán","Tồn kho","Trạng thái","Chi tiết"})grid.Columns.Add(col,col);
        grid.Columns[0].FillWeight=35;grid.Columns[1].FillWeight=140;grid.Columns[3].FillWeight=90;grid.Columns[4].FillWeight=50;grid.Columns[6].FillWeight=145;
        void RefreshRows()
        {
            grid.Rows.Clear();
            foreach(var p in inventory.Products.Where(x=>(Vietnamese.Matches(x.Name,input.Text)||x.Id.ToString()==input.Text.Trim())&&(!alerts.Checked||x.IsLowStock||x is PerishableProduct { IsNearExpiry:true })))
            {
                string state=p is PerishableProduct { IsExpired:true }?"Hết hạn":p.Stock==0?"Hết hàng":p.IsLowStock?"Sắp hết hàng":p is PerishableProduct { IsNearExpiry:true }?"Sắp hết hạn":"Còn hàng";
                var index=grid.Rows.Add(p.Id,p.Name,p.Category.Label(),Money.Format(p.UnitPrice),p.Stock,state,p.DisplayInfo());grid.Rows[index].Tag=p;
                grid.Rows[index].Cells[5].Style.ForeColor=state=="Còn hàng"?Design.Green:Color.FromArgb(181,112,42);
            }
        }
        input.TextChanged+=(_,_)=>RefreshRows();alerts.CheckedChanged+=(_,_)=>RefreshRows();RefreshRows();
        var actions=new FlowLayoutPanel { Dock=DockStyle.Bottom,Height=64,Padding=new Padding(0,15,0,0) };
        Product? Selected() => grid.CurrentRow?.Tag as Product;
        var restock=Design.Button("+  Nhập hàng",()=>AdjustStock(Selected(),true));restock.Width=135;
        var remove=Design.Button("−  Xuất kho",()=>AdjustStock(Selected(),false));remove.Width=155;
        var price=Design.Button("Sửa giá bán",()=>
        {
            var p=Selected();if(p is null)return;
            using var dialog=new NumberForm("Cập nhật giá",$"Giá bán mới · {p.Name}",p.UnitPrice,0,1000000000,0);
            if(dialog.ShowDialog(this)==DialogResult.OK) { TryAction(()=>inventory.SetPrice(p.Id,dialog.Value,user));Save("Đã cập nhật giá. Hóa đơn cũ giữ nguyên giá đã bán.");RefreshRows(); }
        });
        actions.Controls.AddRange([restock,remove,price]);body.Controls.Add(grid);body.Controls.Add(toolbar);body.Controls.Add(actions);root.Controls.Add(body);root.Controls.Add(stats);return root;
    }
    private void AdjustStock(Product? product,bool add)
    {
        if(product is null)return;
        if(!add&&product.Stock==0) { UpdateStatus("Sản phẩm này đã hết hàng.");return; }
        using var dialog=new NumberForm(add?"Nhập thêm hàng":"Xuất bớt hàng",$"{product.Name} · {product.Stock} sản phẩm còn lại",1,1,add?100000:product.Stock,0);
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        TryAction(()=> { if(add)store.Inventory.Restock(product.Id,(int)dialog.Value,user);else store.Inventory.Withdraw(product.Id,(int)dialog.Value,user);Save("Đã cập nhật tồn kho.");Navigate("Inventory"); });
    }
    private Control BuildReports()
    {
        var root=new Panel { Dock=DockStyle.Fill };
        var filter=new Panel { Dock=DockStyle.Top,Height=58 };
        var range=new ComboBox { DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(11),Width=210,Location=new Point(0,7) };
        range.Items.AddRange(["Hôm nay","7 ngày qua","Toàn bộ"]);range.SelectedIndex=0;
        var explanation=Design.Label("Đơn đã hoàn tất · doanh thu đã gồm thuế",9,Design.Muted);explanation.SetBounds(230,4,490,35);
        filter.Controls.AddRange([range,explanation]);
        var statsHost=new Panel { Dock=DockStyle.Top,Height=112 };
        var body=new Surface { Dock=DockStyle.Fill,Padding=new Padding(20) };
        var grid=Design.Grid();foreach(var column in new[]{"Mã đơn","Thời gian","Số món","Thanh toán","Tổng cộng"})grid.Columns.Add(column,column);
        var chart=new Panel { Dock=DockStyle.Bottom,Height=226,BackColor=Color.White };
        var chartTitle=Design.Label("DOANH THU THEO NHÓM HÀNG · CHƯA THUẾ",8,Design.Muted,FontStyle.Bold);chartTitle.SetBounds(4,10,450,25);chart.Controls.Add(chartTitle);
        const int chartColumns=5;
        var bars=new TableLayoutPanel { Top=42,Left=0,Height=176,ColumnCount=chartColumns,RowCount=2,Anchor=AnchorStyles.Top|AnchorStyles.Left|AnchorStyles.Right,Width=950 };
        for(int col=0;col<chartColumns;col++)bars.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100f/chartColumns));
        bars.RowStyles.Add(new RowStyle(SizeType.Percent,50));bars.RowStyles.Add(new RowStyle(SizeType.Percent,50));chart.Controls.Add(bars);
        chart.Resize+=(_,_)=>bars.Width=chart.ClientSize.Width;
        var actions=new FlowLayoutPanel { Dock=DockStyle.Bottom,Height=62,Padding=new Padding(0,12,0,0) };
        List<Transaction> visible=[];
        var receipt=Design.Button("Xem hóa đơn",()=> { if(grid.CurrentRow?.Tag is Transaction transaction) { using var dialog=new ReceiptForm(transaction);dialog.ShowDialog(this); } });
        var export=Design.Button("Xuất CSV  ↗",()=>ExportSales(visible));actions.Controls.AddRange([receipt,export]);
        var empty=Design.Label("Chưa có đơn trong thời gian này. Đơn hoàn tất sẽ xuất hiện tại đây.",12,Design.Muted);empty.Dock=DockStyle.Top;empty.Height=58;
        void RefreshReport()
        {
            DateTime start=range.SelectedIndex switch { 0=>DateTime.Today,1=>DateTime.Today.AddDays(-6),_=>DateTime.MinValue };
            visible=store.Sales.Where(x=>x.Timestamp>=start).OrderByDescending(x=>x.Timestamp).ToList();
            foreach(Control c in statsHost.Controls.Cast<Control>().ToArray())c.Dispose();statsHost.Controls.Clear();
            statsHost.Controls.Add(Metrics(Metric("Tổng doanh thu",Money.Format(visible.Sum(x=>x.GrandTotal)),"Thanh toán đã ghi nhận"),Metric("Đơn hàng",visible.Count.ToString(),$"{visible.Sum(x=>x.Lines.Sum(l=>l.Quantity))} sản phẩm đã bán"),Metric("Trung bình mỗi đơn",Money.Format(visible.Count==0?0:visible.Average(x=>x.GrandTotal)),"Tính trên đơn đã hoàn tất")));
            grid.Rows.Clear();foreach(var sale in visible) { var row=grid.Rows.Add("#"+sale.OrderId,sale.Timestamp.ToString("dd/MM/yyyy · HH:mm"),sale.Lines.Sum(x=>x.Quantity),sale.Payment.Method.Label(),Money.Format(sale.GrandTotal));grid.Rows[row].Tag=sale; }
            empty.Visible=visible.Count==0;receipt.Enabled=visible.Count>0;export.Enabled=visible.Count>0;
            foreach(Control c in bars.Controls.Cast<Control>().ToArray())c.Dispose();bars.Controls.Clear();
            var totals=Enum.GetValues<Category>().Select(c=>(Category:c,Total:visible.SelectMany(x=>x.Lines).Where(x=>x.Category==c).Sum(x=>x.LineTotal))).ToArray();
            decimal max=Math.Max(1,totals.Max(x=>x.Total));int i=0;
            foreach(var data in totals)
            {
                var cell=new Panel { Dock=DockStyle.Fill,Margin=new Padding(4,0,16,12) };
                var amount=Design.Label(Money.Format(data.Total),13,Design.Ink,FontStyle.Bold);amount.Dock=DockStyle.Top;amount.Height=28;
                var label=Design.Label(data.Category.Label(),9,Design.Muted);label.Dock=DockStyle.Top;label.Height=25;
                var track=new Panel { Dock=DockStyle.Bottom,Height=7,BackColor=Design.Background };
                var fill=new Panel { Dock=DockStyle.Left,Width=1,BackColor=Design.Accent };track.Controls.Add(fill);track.Resize+=(_,_)=>fill.Width=(int)(track.Width*data.Total/max);
                cell.Controls.Add(label);cell.Controls.Add(amount);cell.Controls.Add(track);bars.Controls.Add(cell,i%chartColumns,i/chartColumns);i++;
            }
        }
        range.SelectedIndexChanged+=(_,_)=>RefreshReport();RefreshReport();
        body.Controls.Add(grid);body.Controls.Add(empty);body.Controls.Add(chart);body.Controls.Add(actions);
        root.Controls.Add(body);root.Controls.Add(statsHost);root.Controls.Add(filter);return root;
    }
    private void ExportSales(IEnumerable<Transaction> sales)
    {
        using var save=new SaveFileDialog { Title="Xuất báo cáo doanh thu",Filter="Bảng dữ liệu CSV (*.csv)|*.csv",FileName=$"SmartMart-doanh-thu-{DateTime.Today:yyyy-MM-dd}.csv" };
        if(save.ShowDialog(this)!=DialogResult.OK)return;
        try
        {
            var rows=new[]{"Mã đơn,Thời gian,Thanh toán,Số món,Tạm tính (VND),Giảm giá (VND),Thuế (VND),Tổng cộng (VND)"}.Concat(sales.Select(x=>string.Join(",",x.OrderId,x.Timestamp.ToString("dd/MM/yyyy HH:mm:ss"),x.Payment.Method.Label(),x.Lines.Sum(l=>l.Quantity),x.Subtotal.ToString(CultureInfo.InvariantCulture),(x.Subtotal-x.DiscountedTotal).ToString(CultureInfo.InvariantCulture),x.Tax.ToString(CultureInfo.InvariantCulture),x.GrandTotal.ToString(CultureInfo.InvariantCulture))));
            File.WriteAllLines(save.FileName,rows,Encoding.UTF8);UpdateStatus("Đã xuất báo cáo doanh thu.");
        }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException) { Design.Notify(this,"Không ghi được tệp. Hãy chọn thư mục khác và kiểm tra quyền truy cập.","Chưa xuất được báo cáo"); }
    }
    private Control BuildUsers()
    {
        var root=new Panel { Dock=DockStyle.Fill };
        var stats=Metrics(Metric("Nhân sự",store.Users.Count.ToString(),"Tài khoản của cửa hàng"),Metric("Quản trị viên",store.Users.Count(x=>x.Role==UserRole.Admin).ToString(),"Toàn quyền quản lý cửa hàng"),Metric("Vai trò của bạn",user.Role.Label(),"Đăng nhập với tên "+user.Username));
        var body=new Surface { Dock=DockStyle.Fill,Padding=new Padding(20) };
        var grid=Design.Grid();foreach(var column in new[]{"Tên đăng nhập","Vai trò","Quyền truy cập"})grid.Columns.Add(column,column);
        foreach(var member in store.Users) { int row=grid.Rows.Add(member.Username+(member==user?"  (bạn)":""),member.Role.Label(),string.Join("  ·  ",member.AllowedScreens().Select(Vietnamese.Screen)));grid.Rows[row].Tag=member; }
        var actions=new FlowLayoutPanel { Dock=DockStyle.Top,Height=64 };
        var add=Design.Button("+  Thêm nhân sự",()=>
        {
            using var dialog=new MemberForm(store.Users.Select(x=>x.Username));if(dialog.ShowDialog(this)==DialogResult.OK&&dialog.Member is not null) { TryAction(()=>store.AddUser(dialog.Member,user));Save("Đã thêm thành viên mới.");Navigate("Users"); }
        },true);add.Width=165;
        var role=Design.Button("Đổi vai trò",()=>
        {
            if(grid.CurrentRow?.Tag is not User selected)return;
            if(selected==user) { UpdateStatus("Hãy dùng tài khoản quản trị khác để thay đổi vai trò của bạn.");return; }
            using var dialog=new RoleForm(selected.Role);if(dialog.ShowDialog(this)!=DialogResult.OK)return;
            if(selected.Role==UserRole.Admin&&dialog.Role!=UserRole.Admin&&store.Users.Count(x=>x.Role==UserRole.Admin)<=1)return;
            store.ChangeRole(selected,dialog.Role,user);Save("Đã cập nhật vai trò.");Navigate("Users");
        });
        var remove=Design.Button("Xóa thành viên",()=>
        {
            if(grid.CurrentRow?.Tag is not User selected)return;
            if(selected==user) { UpdateStatus("Bạn không thể xóa tài khoản đang đăng nhập.");return; }
            if(!Design.Ask(this,$"Xóa tài khoản {selected.Username} khỏi cửa hàng?","Xóa thành viên"))return;
            store.RemoveUser(selected,user);Save("Đã xóa thành viên.");Navigate("Users");
        });remove.Width=160;
        actions.Controls.AddRange([add,role,remove]);body.Controls.Add(grid);body.Controls.Add(actions);root.Controls.Add(body);root.Controls.Add(stats);return root;
    }
}
