using SmartMart.Core;

namespace SmartMart.App;

internal static class ProductImages
{
    private static readonly Dictionary<string,Image?> cache=[];
    public static string Root => Path.Combine(AppContext.BaseDirectory,"Assets","Products");
    public static Image? Get(Product product)
    {
        var key=string.IsNullOrEmpty(product.CatalogKey)?CatalogSeed.LegacyImageKey(product):product.CatalogKey;
        if(string.IsNullOrEmpty(key)||key.Any(c=>!char.IsAsciiLetterOrDigit(c)&&c!='-'))return null;
        if(cache.TryGetValue(key,out var cached))return cached;
        try
        {
            var path=Path.Combine(Root,key+".jpg");
            if(!File.Exists(path))return cache[key]=null;
            using var stream=File.OpenRead(path);using var source=Image.FromStream(stream);
            return cache[key]=new Bitmap(source);
        }
        catch(Exception ex) when(ex is IOException or ArgumentException or OutOfMemoryException or UnauthorizedAccessException)
        { return cache[key]=null; }
    }
    public static void DisposeAll() { foreach(var image in cache.Values)image?.Dispose();cache.Clear(); }
    public static void ShowCredits(IWin32Window owner)
    {
        using var dialog=new WorkspaceDialog("Nguồn ảnh sản phẩm",650,760);
        var text=new TextBox { Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,BorderStyle=BorderStyle.None,
            Font=Design.Font(10),BackColor=Color.White,ForeColor=Design.Ink,Bounds=new Rectangle(30,90,700,480) };
        var file=Path.Combine(Root,"credits.txt");
        text.Text=File.Exists(file)?File.ReadAllText(file).Replace("\n",Environment.NewLine):"Thông tin nguồn ảnh nằm trong Assets/Products/credits.txt.";
        var close=Design.Button("Đóng",()=>dialog.Close(),true);close.SetBounds(550,590,180,42);
        dialog.Controls[0].Controls.AddRange([text,close]);dialog.Shown+=(_,_)=> { text.Select(0,0);close.Focus(); };dialog.ShowDialog(owner);
    }
}
