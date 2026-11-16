using Microsoft.Data.Sqlite;
using System.Text.Json;
using SmartMart.Core;

namespace SmartMart.Tests;

public class LocalizationTests
{
    [Theory]
    [InlineData("Sữa tươi", "sua tuoi")]
    [InlineData("Cà phê rang xay", "CA PHE")]
    [InlineData("Máy quét không dây", "khong day")]
    [InlineData("ĐỒ GIA DỤNG", "do gia dung")]
    [InlineData("Sữa chua Hy Lạp", "sữa chua")]
    public void SearchAcceptsAccentsAndUnaccentedVietnamese(string name,string query) => Assert.True(Vietnamese.Matches(name,query));

    [Fact]
    public void VndFormattingAndReceiptUseVietnamese()
    {
        Assert.Equal("1.250.000 ₫",Money.Format(1250000));
        var cart=new ShoppingCart();cart.AddItem(new GeneralProduct(1) { Id=1,Name="Cà phê",UnitPrice=10000 });
        var sale=cart.Checkout(PaymentMethod.EWallet);var receipt=sale.GenerateInvoice();
        Assert.Contains("HÓA ĐƠN",receipt);Assert.Contains("Ví điện tử",receipt);Assert.Contains("10.450 ₫",receipt);
        Assert.DoesNotContain("EWallet",receipt);Assert.DoesNotContain("$",receipt);
        Assert.Equal("Điện tử",Category.Electronics.Label());Assert.Equal("Quản trị viên",UserRole.Admin.Label());
    }

    [Fact]
    public void LegacyDollarsAreBackedUpAndConvertedExactlyOnce()
    {
        string path=Path.Combine(Path.GetTempPath(),$"smartmart-vnd-{Guid.NewGuid():N}.db");string? backup=null;
        var legacy=new StoreSession.SavedState(
            [new(1,"Fresh Milk",Category.Dairy,2.49m,11,5,"perishable",DateOnly.FromDateTime(DateTime.Today.AddDays(3)),0,"")],
            [new Transaction("OLD001",DateTime.Today,[new SaleLine(1,"Fresh Milk",Category.Dairy,2,2.49m,1.74m,.17m)],4.98m,3.48m,.34m,new PaymentDetails(PaymentMethod.Card,3.82m))],[]);
        var original=JsonSerializer.Serialize(legacy);
        try
        {
            Write(path,original);
            using(var store=new StoreSession(path))
            {
                Assert.Null(store.StorageWarning);backup=store.MigrationBackupPath;Assert.NotNull(backup);Assert.True(File.Exists(backup));
                Assert.Equal(62250m,store.Inventory.Find(1)!.UnitPrice);Assert.Equal("Sữa tươi",store.Inventory.Find(1)!.Name);
                var sale=Assert.Single(store.Sales);Assert.Equal(95500m,sale.GrandTotal);Assert.Equal(sale.GrandTotal,sale.Payment.Amount);
                Assert.Equal(87000m,sale.Lines.Sum(x=>x.LineTotal));Assert.Equal(8500m,sale.Tax);Assert.Equal("OLD001",sale.OrderId);
                Assert.Equal(original,Read(backup!));Assert.True(store.Save());
            }
            using(var reopened=new StoreSession(path))
            {
                Assert.Null(reopened.MigrationBackupPath);Assert.Null(reopened.StorageWarning);
                Assert.Equal(62250m,reopened.Inventory.Find(1)!.UnitPrice);Assert.Equal(95500m,reopened.Sales[0].GrandTotal);
                Assert.Equal("VND",JsonSerializer.Deserialize<StoreSession.SavedState>(Read(path))!.Currency);
            }
        }
        finally { SqliteConnection.ClearAllPools();File.Delete(path);if(backup is not null)File.Delete(backup); }
    }
    [Fact]
    public void NewDatabaseStartsInVndAndKeepsPricesOnReopen()
    {
        string path=Path.Combine(Path.GetTempPath(),$"smartmart-new-{Guid.NewGuid():N}.db");
        try
        {
            using(var store=new StoreSession(path)) { Assert.Null(store.MigrationBackupPath);Assert.Equal(62250m,store.Inventory.Find(1)!.UnitPrice); }
            using(var store=new StoreSession(path)) { Assert.Null(store.MigrationBackupPath);Assert.Equal(62250m,store.Inventory.Find(1)!.UnitPrice); }
        }
        finally { SqliteConnection.ClearAllPools();File.Delete(path); }
    }
    private static void Write(string path,string payload)
    {
        using var connection=new SqliteConnection($"Data Source={path}");connection.Open();using var command=connection.CreateCommand();
        command.CommandText="CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); INSERT INTO app_state VALUES(1,$payload)";
        command.Parameters.AddWithValue("$payload",payload);command.ExecuteNonQuery();
    }
    private static string Read(string path)
    {
        using var connection=new SqliteConnection($"Data Source={path};Mode=ReadOnly");connection.Open();using var command=connection.CreateCommand();
        command.CommandText="SELECT payload FROM app_state WHERE id=1";return (string)command.ExecuteScalar()!;
    }
}
