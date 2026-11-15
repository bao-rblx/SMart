using System.Text.Json;
using System.Text.Json.Serialization;

namespace SmartMart.Core;

public static class CatalogSeed
{
    public const int Revision = 1;
    private static readonly Lazy<IReadOnlyList<CatalogItem>> catalog = new(() =>
    {
        using var stream = typeof(CatalogSeed).Assembly.GetManifestResourceStream("SmartMart.Core.catalog.json")
            ?? throw new InvalidDataException("Không tìm thấy danh mục mẫu.");
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        options.Converters.Add(new JsonStringEnumConverter());
        return JsonSerializer.Deserialize<CatalogItem[]>(stream,options) ?? [];
    });
    public static IReadOnlyList<CatalogItem> Items => catalog.Value;
    public static IEnumerable<Product> Additions() => Items.Select(x=>x.CreateProduct());
    public static string LegacyImageKey(Product product)
    {
        // IDs alone cannot identify user-created items; verify the original seed name too.
        var original=SeedData.OriginalProducts().FirstOrDefault(x=>x.Id==product.Id&&x.Name==product.Name);
        return original is null ? "" : $"original-{product.Id:00}";
    }
    public sealed record CatalogItem(int Id,string Key,string Name,Category Category,decimal Price,int Stock,string Kind,string Barcode="",int ShelfLifeDays=30)
    {
        public Product CreateProduct(int? id=null) => Kind switch
        {
            "perishable" => new PerishableProduct(Stock) { Id=id??Id,Name=Name,Category=Category,UnitPrice=Price,CatalogKey=Key,Barcode=Barcode,ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(ShelfLifeDays)) },
            "electronic" => new ElectronicProduct(Stock) { Id=id??Id,Name=Name,Category=Category,UnitPrice=Price,CatalogKey=Key,Barcode=Barcode,WarrantyMonths=12,SerialNumber=$"SM-{id??Id}" },
            _ => new GeneralProduct(Stock) { Id=id??Id,Name=Name,Category=Category,UnitPrice=Price,CatalogKey=Key,Barcode=Barcode,Supplier="Nhà phân phối trong nước" }
        };
    }
}
