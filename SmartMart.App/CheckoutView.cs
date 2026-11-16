using SmartMart.Core;

namespace SmartMart.App;

public sealed partial class MainForm
{
    private TextBox search=null!;
    private FlowLayoutPanel products=null!;
    private FlowLayoutPanel orderLines=null!;
    private Label orderCount=null!,subtotal=null!,discount=null!,tax=null!,grandTotal=null!;
    private ActionButton payButton=null!;
    private string category="Tất cả";
    private readonly Dictionary<string,ActionButton> categoryButtons=[];

    private const int PageSize=12;
    private int catalogPage;
    private ComboBox sortProducts=null!;
    private CheckBox availableProducts=null!;
    private Label pageInfo=null!,pageNumber=null!;
    private ActionButton previousPage=null!,nextPage=null!;

    private Control BuildCheckout()
    {
        category="Tất cả";catalogPage=0;categoryButtons.Clear();
        var layout=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,348));
        var catalog=new Panel { Dock=DockStyle.Fill,Padding=new Padding(0,0,20,0) };
        var top=new Panel { Dock=DockStyle.Top,Height=244 };
        var title=Design.Label($"Chọn món, lên đơn · {store.Inventory.Products.Count} mặt hàng",16,Design.Ink,FontStyle.Bold);title.SetBounds(0,0,650,34);
        var sales=store.Sales.Where(x=>x.Timestamp.Date==DateTime.Today).ToArray();
        var today=Design.Label($"Hôm nay: {sales.Length} đơn hoàn tất · {Money.Format(sales.Sum(x=>x.GrandTotal))}",9,Design.Muted);today.SetBounds(2,34,650,25);
        top.Controls.AddRange([title,today]);
        search=Design.Input("Tìm tên, mã hàng hoặc quét mã vạch…    Ctrl+K");search.AccessibleName="Tìm sản phẩm";
        var searchBox=Design.InputBox(search);searchBox.SetBounds(0,66,600,46);searchBox.Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right;top.Controls.Add(searchBox);
        search.TextChanged+=(_,_)=> { catalogPage=0;RefreshProducts(); };
        search.KeyDown+=(_,e)=> { if(e.KeyCode==Keys.Enter) { var matches=FilteredProducts();if(matches.Count==1)AddProduct(matches[0]);e.SuppressKeyPress=true; } };
        var filters=new FlowLayoutPanel { Top=122,Left=0,Height=76,WrapContents=true,Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right,Width=600 };
        foreach(var name in new[]{"Tất cả"}.Concat(Enum.GetNames<Category>()))
        {
            var button=Design.Button(name=="Tất cả"?name:Enum.Parse<Category>(name).Label(),()=>
            {
                category=name;catalogPage=0;
                foreach(var pair in categoryButtons) { pair.Value.Selected=pair.Key==name;pair.Value.Invalidate(); }
                RefreshProducts();
            });
            button.Width=name=="Grocery"?100:85;button.Height=32;button.Margin=new Padding(0,0,6,6);button.Font=Design.Font(9);button.Selected=name==category;categoryButtons[name]=button;filters.Controls.Add(button);
        }
        top.Controls.Add(filters);
        var options=new Panel { Left=0,Top=202,Width=600,Height=36,Anchor=AnchorStyles.Left|AnchorStyles.Top|AnchorStyles.Right };
        availableProducts=new CheckBox { Text="Chỉ hàng còn bán",AutoSize=true,Font=Design.Font(9),ForeColor=Design.Muted,Location=new Point(2,7) };
        sortProducts=new ComboBox { DropDownStyle=ComboBoxStyle.DropDownList,Font=Design.Font(9),Width=165,Anchor=AnchorStyles.Top|AnchorStyles.Right };
        sortProducts.Items.AddRange(["Gợi ý hôm nay","Tên A → Z","Giá thấp → cao","Giá cao → thấp"]);sortProducts.SelectedIndex=0;
        var credits=Design.Button("Nguồn ảnh",()=>ProductImages.ShowCredits(this));credits.Font=Design.Font(8);credits.Width=90;credits.Height=28;
        options.Controls.AddRange([availableProducts,sortProducts,credits]);
        options.Resize+=(_,_)=> { sortProducts.Left=options.Width-sortProducts.Width;credits.Left=sortProducts.Left-100; };
        top.Controls.Add(options);
        top.Resize+=(_,_)=>
        {
            searchBox.Width=top.ClientSize.Width;filters.Width=top.ClientSize.Width;options.Width=top.ClientSize.Width;
            filters.Height=filters.Controls.Cast<Control>().Sum(x=>x.Width+x.Margin.Horizontal)>filters.Width?76:38;
            options.Top=filters.Bottom+2;
            int targetH=options.Bottom+6;
            if(top.Height!=targetH)top.Height=targetH;
        };
        var pager=new Panel { Dock=DockStyle.Bottom,Height=44 };
        pageInfo=Design.Label("",9,Design.Muted);pageInfo.SetBounds(0,7,240,30);
        previousPage=Design.Button("←",()=> { catalogPage--;RefreshProducts(); });previousPage.SetBounds(0,5,38,32);previousPage.AccessibleName="Trang trước";
        nextPage=Design.Button("→",()=> { catalogPage++;RefreshProducts(); });nextPage.SetBounds(0,5,38,32);nextPage.AccessibleName="Trang sau";
        pageNumber=Design.Label("",9,Design.Ink,FontStyle.Bold);pageNumber.Size=new Size(68,30);pageNumber.Top=6;pageNumber.TextAlign=ContentAlignment.MiddleCenter;
        pager.Controls.AddRange([pageInfo,previousPage,pageNumber,nextPage]);
        pager.Resize+=(_,_)=> { nextPage.Left=pager.Width-38;pageNumber.Left=nextPage.Left-68;previousPage.Left=pageNumber.Left-38; };
        products=new FlowLayoutPanel { Dock=DockStyle.Fill,AutoScroll=true,BackColor=Design.Background,Padding=new Padding(0,6,0,0) };
        products.Resize+=(_,_)=>SizeProductCards();
        availableProducts.CheckedChanged+=(_,_)=> { catalogPage=0;RefreshProducts(); };
        sortProducts.SelectedIndexChanged+=(_,_)=> { catalogPage=0;RefreshProducts(); };
        catalog.Controls.Add(products);catalog.Controls.Add(pager);catalog.Controls.Add(top);layout.Controls.Add(catalog,0,0);
        layout.Controls.Add(BuildOrder(),1,0);RefreshProducts();RefreshOrder();return layout;
    }
    private IReadOnlyList<Product> FilteredProducts() => CatalogQuery.Find(store.Inventory.Products,search.Text,
        category=="Tất cả"?null:Enum.Parse<Category>(category),availableProducts.Checked,(CatalogSort)sortProducts.SelectedIndex);
    private void RefreshProducts()
    {
        if(products is null||products.IsDisposed||sortProducts is null)return;
        var matches=FilteredProducts();int pages=Math.Max(1,(matches.Count+PageSize-1)/PageSize);catalogPage=Math.Clamp(catalogPage,0,pages-1);
        products.SuspendLayout();products.AutoScrollPosition=Point.Empty;
        foreach(Control c in products.Controls.Cast<Control>().ToArray())c.Dispose();products.Controls.Clear();
        foreach(var product in matches.Skip(catalogPage*PageSize).Take(PageSize)) { var tile=new ProductCard(product);tile.Click+=(_,_)=>AddProduct(product);products.Controls.Add(tile); }
        if(matches.Count==0) { var empty=Design.Label("Chưa tìm thấy sản phẩm.\nThử tên, mã vạch hoặc nhóm hàng khác nhé.",12,Design.Muted);empty.Size=new Size(360,100);products.Controls.Add(empty); }
        pageInfo.Text=matches.Count==0?"0 mặt hàng":$"{catalogPage*PageSize+1}–{Math.Min((catalogPage+1)*PageSize,matches.Count)} / {matches.Count} mặt hàng · Ảnh minh họa";
        pageNumber.Text=$"{catalogPage+1} / {pages}";previousPage.Enabled=catalogPage>0;nextPage.Enabled=catalogPage<pages-1;
        SizeProductCards();products.ResumeLayout();
    }
    private void SizeProductCards()
    {
        var available=products.ClientSize.Width-SystemInformation.VerticalScrollBarWidth-2;
        int columns=Math.Max(1,available/195);int width=Math.Max(160,available/columns-16);
        foreach(var card in products.Controls.OfType<ProductCard>())card.Width=width;
    }
    private void AddProduct(Product product) => TryAction(()=> { cart.AddItem(product);RefreshOrder();UpdateStatus($"Đã thêm {product.Name} vào đơn."); });
    private Control BuildOrder()
    {
        var panel=new Surface { Dock=DockStyle.Fill,Padding=new Padding(20),Margin=Padding.Empty };
        var header=new Panel { Dock=DockStyle.Top,Height=74 };
        var title=Design.Label("Đơn hiện tại",17,Design.Ink,FontStyle.Bold);title.SetBounds(0,0,215,32);
        orderCount=Design.Label("",9,Design.Muted);orderCount.SetBounds(0,35,210,25);
        var clear=Design.Button("Xóa hết",()=> { if(cart.Lines.Count==0)return;cart.Clear();RefreshOrder(); });clear.SetBounds(240,1,63,32);clear.Font=Design.Font(9);clear.CustomText=Design.Muted;
        header.Controls.AddRange([title,orderCount,clear]);
        var bottom=new Panel { Dock=DockStyle.Bottom,Height=242 };
        subtotal=SummaryRow(bottom,"Tạm tính",0);discount=SummaryRow(bottom,"Tiết kiệm",31,Design.Green);tax=SummaryRow(bottom,"Thuế",62);
        var line=new Panel { BackColor=Design.Border,Left=0,Top=101,Width=306,Height=1 };bottom.Controls.Add(line);
        var totalLabel=Design.Label("Tổng",14,Design.Ink,FontStyle.Bold);totalLabel.SetBounds(0,112,85,35);bottom.Controls.Add(totalLabel);
        grandTotal=Design.Label("",21,Design.Ink,FontStyle.Bold);grandTotal.SetBounds(90,106,217,47);grandTotal.TextAlign=ContentAlignment.MiddleRight;bottom.Controls.Add(grandTotal);
        payButton=Design.Button("Thanh toán  →",Pay,true);payButton.SetBounds(0,164,307,49);bottom.Controls.Add(payButton);
        var hint=Design.Label("F9 thanh toán  ·  Tự áp dụng ưu đãi",8,Design.Muted);hint.SetBounds(0,216,309,24);hint.TextAlign=ContentAlignment.MiddleCenter;bottom.Controls.Add(hint);
        orderLines=new FlowLayoutPanel { Dock=DockStyle.Fill,AutoScroll=true,FlowDirection=FlowDirection.TopDown,WrapContents=false,BackColor=Color.White };
        panel.Controls.Add(orderLines);panel.Controls.Add(bottom);panel.Controls.Add(header);return panel;
    }
    private static Label SummaryRow(Panel panel,string title,int y,Color? color=null)
    {
        var label=Design.Label(title,10,color??Design.Muted);label.SetBounds(0,y,150,28);
        var value=Design.Label("",10,color??Design.Ink,FontStyle.Bold);value.SetBounds(154,y,151,28);value.TextAlign=ContentAlignment.MiddleRight;panel.Controls.AddRange([label,value]);return value;
    }
    private void RefreshOrder()
    {
        orderLines.SuspendLayout();foreach(Control c in orderLines.Controls.Cast<Control>().ToArray())c.Dispose();orderLines.Controls.Clear();
        orderCount.Text=$"{cart.Lines.Sum(x=>x.Quantity)} món  ·  Khách mua lẻ";
        if(cart.Lines.Count==0)
        {
            var empty=new Panel { Width=285,Height=205 };
            var icon=Design.Label("＋",39,Design.Accent);icon.SetBounds(0,24,285,60);icon.TextAlign=ContentAlignment.MiddleCenter;
            var title=Design.Label("Lên đơn thôi nào",15,Design.Ink,FontStyle.Bold);title.SetBounds(0,98,285,32);title.TextAlign=ContentAlignment.MiddleCenter;
            var note=Design.Label("Chọn món khách yêu thích.\nSmartMart tính giúp bạn phần còn lại.",10,Design.Muted);note.SetBounds(0,136,285,53);note.TextAlign=ContentAlignment.MiddleCenter;empty.Controls.AddRange([icon,title,note]);orderLines.Controls.Add(empty);
        }
        foreach(var line in cart.Lines)
        {
            var row=new Panel { Width=286,Height=112,Margin=new Padding(0,0,0,10),BackColor=Color.White };
            var name=Design.Label(line.Product.Name,11,Design.Ink,FontStyle.Bold);name.SetBounds(0,2,234,24);
            var detail=Design.Label($"{Money.Format(line.Product.UnitPrice)} / món  ·  −{line.DiscountPercent:0}%",9,Design.Green);detail.SetBounds(0,30,250,23);
            var remove=Design.Button("×",()=> { cart.RemoveItem(line.Product.Id);RefreshOrder(); });remove.SetBounds(251,0,30,28);remove.CustomText=Design.Muted;
            var minus=Design.Button("−",()=>TryAction(()=> { cart.SetQuantity(line.Product,line.Quantity-1);RefreshOrder(); }));minus.SetBounds(0,65,32,31);minus.CustomFill=Design.Background;
            var qty=Design.Label(line.Quantity.ToString(),10,Design.Ink,FontStyle.Bold);qty.SetBounds(34,65,34,31);qty.TextAlign=ContentAlignment.MiddleCenter;
            var plus=Design.Button("+",()=>AddProduct(line.Product));plus.SetBounds(70,65,32,31);plus.CustomFill=Design.Pale;plus.CustomText=Design.Accent;
            var price=Design.Label(Money.Format(line.LineTotal),11,Design.Ink,FontStyle.Bold);price.SetBounds(115,65,166,31);price.TextAlign=ContentAlignment.MiddleRight;
            var separator=new Panel { Left=0,Top=108,Width=282,Height=1,BackColor=Design.Border };row.Controls.AddRange([name,detail,remove,minus,qty,plus,price,separator]);orderLines.Controls.Add(row);
        }
        subtotal.Text=Money.Format(cart.GetSubtotal());discount.Text="−"+Money.Format(cart.GetSubtotal()-cart.GetDiscountedTotal());tax.Text=Money.Format(cart.GetTax());grandTotal.Text=Money.Format(cart.GetDiscountedTotal()+cart.GetTax());
        payButton.Enabled=cart.Lines.Count>0;orderLines.ResumeLayout();
    }
    private void Pay()
    {
        if(cart.Lines.Count==0)return;
        using var dialog=new PaymentForm(cart.GetDiscountedTotal()+cart.GetTax());if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        TryAction(()=>
        {
            var transaction=cart.Checkout(dialog.Method);store.Sales.Add(transaction);store.Save();Navigate("Checkout");
            using var receipt=new ReceiptForm(transaction);receipt.ShowDialog(this);UpdateStatus($"Đơn #{transaction.OrderId} đã hoàn tất và lưu lại.");
        });
    }
}
