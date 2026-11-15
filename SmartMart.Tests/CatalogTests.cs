using Microsoft.Data.Sqlite;
using System.Text.Json;
using SmartMart.Core;

namespace SmartMart.Tests;

public class CatalogTests
{
    [Fact]
    public void ExpandedCatalogHasDistinctItemsAcrossAllCategories()
    {
        var products=SeedData.Products();
        Assert.Equal(72,products.Count);Assert.Equal(products.Count,products.Select(x=>x.Id).Distinct().Count());
        Assert.Equal(60,products.Count(x=>!string.IsNullOrEmpty(x.CatalogKey)));
        Assert.Equal(Enum.GetValues<Category>().Length,products.Select(x=>x.Category).Distinct().Count());
        Assert.All(products,x=> { Assert.True(x.UnitPrice>0);Assert.True(x.Stock>0);Assert.False(string.IsNullOrWhiteSpace(x.Name)); });
    }
    [Fact]
    public void CatalogSearchSupportsRealBarcodeVietnameseAndCategory()
    {
        var products=SeedData.Products();
        var noodle=Assert.Single(CatalogQuery.Find(products," 8934563138165 "));
        Assert.Equal("Mì Hảo Hảo tôm chua cay 75 g",noodle.Name);
        Assert.Contains(noodle,CatalogQuery.Find(products,"hao hao"));
        Assert.Empty(CatalogQuery.Find(products,"hao hao",Category.Dairy));
        Assert.All(CatalogQuery.Find(products,category:Category.Beverages),x=>Assert.Equal(Category.Beverages,x.Category));
    }
    [Fact]
    public void AvailabilityAndSortReflectSellableStockAndDiscountedPrice()
    {
        Product[] products=[new GeneralProduct(0) { Id=1,Name="Hết hàng",UnitPrice=100 },
            new PerishableProduct(5) { Id=2,Name="Hết hạn",UnitPrice=100,ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(-1)) },
            new GeneralProduct(2) { Id=3,Name="Giá thấp",UnitPrice=10000 },
            new GeneralProduct(2) { Id=4,Name="Giá cao",UnitPrice=20000 }];
        Assert.Equal(new[]{3,4},CatalogQuery.Find(products,availableOnly:true,sort:CatalogSort.PriceAscending).Select(x=>x.Id));
        Assert.Equal(new[]{4,3},CatalogQuery.Find(products,availableOnly:true,sort:CatalogSort.PriceDescending).Select(x=>x.Id));
    }
    [Fact]
    public void UpgradePreservesCustomItemsStockPricesAndReceiptsDespiteIdCollision()
    {
        var path=Path.Combine(Path.GetTempPath(),$"smartmart-catalog-{Guid.NewGuid():N}.db");string? backup=null;
        try
        {
            using(var store=new StoreSession(path))
            {
                var cart=new ShoppingCart();cart.AddItem(store.Inventory.Find(1)!);store.Sales.Add(cart.Checkout(PaymentMethod.Cash));store.Save();
            }
            using(var connection=new SqliteConnection($"Data Source={path}"))
            {
                connection.Open();using var read=connection.CreateCommand();read.CommandText="SELECT payload FROM app_state WHERE id=1";
                var state=JsonSerializer.Deserialize<StoreSession.SavedState>((string)read.ExecuteScalar()!)!;
                var kept=state.Products.Where(x=>x.Id<1000).Select(x=>x.Id==1?x with { Price=12345,Stock=7 }:x).ToList();
                kept.Add(new(1001,"Hàng riêng của cửa hàng",Category.General,32100,9,5,"general",default,0,"Nhà cung cấp riêng"));
                using var update=connection.CreateCommand();update.CommandText="UPDATE app_state SET payload=$payload WHERE id=1";
                update.Parameters.AddWithValue("$payload",JsonSerializer.Serialize(state with { Products=kept.ToArray(),CatalogRevision=0 }));update.ExecuteNonQuery();
            }
            string orderId;decimal total;
            using(var store=new StoreSession(path))
            {
                backup=store.CatalogBackupPath;Assert.NotNull(backup);Assert.True(File.Exists(backup));
                Assert.Equal(73,store.Inventory.Products.Count);Assert.Equal(12345,store.Inventory.Find(1)!.UnitPrice);Assert.Equal(7,store.Inventory.Find(1)!.Stock);
                Assert.Equal("Hàng riêng của cửa hàng",store.Inventory.Find(1001)!.Name);
                var noodle=Assert.Single(store.Inventory.Products,x=>x.CatalogKey=="off-8934563138165");Assert.NotEqual(1001,noodle.Id);
                var sale=Assert.Single(store.Sales);orderId=sale.OrderId;total=sale.GrandTotal;
                Assert.True(store.Users.Single(x=>x.Username=="admin").Authenticate("admin"));
            }
            using(var store=new StoreSession(path))
            {
                Assert.Null(store.CatalogBackupPath);Assert.Equal(73,store.Inventory.Products.Count);
                Assert.Equal(orderId,store.Sales[0].OrderId);Assert.Equal(total,store.Sales[0].GrandTotal);
            }
        }
        finally { SqliteConnection.ClearAllPools();File.Delete(path);if(backup is not null)File.Delete(backup); }
    }
}
