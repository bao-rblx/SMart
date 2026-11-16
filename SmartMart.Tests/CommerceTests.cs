using SmartMart.Core;

namespace SmartMart.Tests;

public class CommerceTests
{
    [Fact]
    public void EditingAndClearingCartDoesNotConsumeStock()
    {
        var product=new GeneralProduct(8) { Id=1,UnitPrice=10 };
        var cart=new ShoppingCart();cart.AddItem(product,3);cart.SetQuantity(product,2);cart.RemoveItem(1);cart.AddItem(product);cart.Clear();
        Assert.Equal(8,product.Stock);Assert.Empty(cart.Lines);
    }
    [Fact]
    public void CheckoutConsumesStockOnceAndSnapshotsPrices()
    {
        var product=new GeneralProduct(8) { Id=1,Name="Cà phê",UnitPrice=10000 };
        var cart=new ShoppingCart();cart.AddItem(product,2);var sale=cart.Checkout(PaymentMethod.Card);
        product.UnitPrice=100000;Assert.Equal(6,product.Stock);Assert.Empty(cart.Lines);Assert.Equal(19000,sale.Lines[0].LineTotal);Assert.Equal(20900m,sale.GrandTotal);
        Assert.Throws<InvalidOperationException>(()=>cart.Checkout(PaymentMethod.Card));
    }
    [Fact]
    public void ChangedStockRejectsEntireOrderWithoutPartialSale()
    {
        var a=new GeneralProduct(5) { Id=1 };var b=new GeneralProduct(2) { Id=2 };var cart=new ShoppingCart();cart.AddItem(a);cart.AddItem(b,2);b.TrySell(1);
        Assert.Throws<InvalidOperationException>(()=>cart.Checkout(PaymentMethod.Cash));Assert.Equal(5,a.Stock);Assert.Equal(2,cart.Lines.Count);
    }
    [Fact]
    public void DiscountsAndTaxesUseProductPolicyAndRoundToWholeDong()
    {
        var milk=new PerishableProduct(3) { Id=1,UnitPrice=62250m,ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(3)) };
        var electronic=new ElectronicProduct(3) { Id=2,UnitPrice=499750m };
        var regular=new GeneralProduct(3) { Id=3,UnitPrice=162250m };
        Assert.Equal(43575m,milk.ApplyDiscount());Assert.Equal(449775m,electronic.ApplyDiscount());Assert.Equal(154138m,regular.ApplyDiscount());
        var cart=new ShoppingCart();cart.AddItem(milk);cart.AddItem(electronic);cart.AddItem(regular);
        Assert.Equal(647488m,cart.GetDiscountedTotal());Assert.Equal(73745m,cart.GetTax());
    }
    [Fact]
    public void ExpiredProductsAndUnavailableQuantitiesAreRejected()
    {
        var expired=new PerishableProduct(5) { Id=1,ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(-1)) };
        var regular=new GeneralProduct(1) { Id=2 };var cart=new ShoppingCart();
        Assert.Throws<InvalidOperationException>(()=>cart.AddItem(expired));Assert.Throws<InvalidOperationException>(()=>cart.AddItem(regular,2));
        Assert.Throws<ArgumentOutOfRangeException>(()=>cart.AddItem(regular,0));Assert.Throws<ArgumentOutOfRangeException>(()=>cart.SetQuantity(regular,-1));
    }
    [Fact]
    public void StockAndPricingEnforceBoundaries()
    {
        var p=new GeneralProduct(2);Assert.False(p.TrySell(3));Assert.False(p.TrySell(0));Assert.Equal(2,p.Stock);
        Assert.Throws<ArgumentOutOfRangeException>(()=>p.Restock(0));Assert.Throws<ArgumentOutOfRangeException>(()=>p.UnitPrice=-1);
        p.Restock(2);Assert.True(p.TrySell(4));Assert.Equal(0,p.Stock);
    }
    [Fact]
    public void InventoryAlertsIncludeLowStockAndNearExpiry()
    {
        var inv=new Inventory(SeedData.Products());Assert.Contains(inv.GetLowStockAlerts(),x=>x.Id==2);Assert.Contains(inv.GetExpiringSoon(),x=>x.Id==1);
        Assert.DoesNotContain(inv.GetExpiringSoon(),x=>x.Id==2);
    }
    [Fact]
    public void AuthenticationAndRolesAreEnforced()
    {
        var cashier=new Cashier("secret");Assert.True(cashier.Authenticate("secret"));Assert.False(cashier.Authenticate("wrong"));
        Assert.Equal(new[]{"Checkout"},cashier.AllowedScreens());Assert.Contains("Users",new Admin("test").AllowedScreens());
    }
    [Fact]
    public void DatabaseRoundTripPreservesStockReceiptsAndAccounts()
    {
        string path=Path.Combine(Path.GetTempPath(),$"smartmart-test-{Guid.NewGuid():N}.db");
        try
        {
            using(var store=new StoreSession(path))
            {
                var cart=new ShoppingCart();cart.AddItem(store.Inventory.Find(1)!);store.Sales.Add(cart.Checkout(PaymentMethod.EWallet));
                var admin=store.Users.Single(x=>x.Role==UserRole.Admin);
                store.AddUser(new Cashier("password") { Username="test" },admin);store.ChangeRole(store.Users.Last(),UserRole.Manager,admin);Assert.True(store.Save());
            }
            using(var restored=new StoreSession(path))
            {
                Assert.Null(restored.StorageWarning);Assert.Equal(11,restored.Inventory.Find(1)!.Stock);Assert.Single(restored.Sales);
                Assert.Equal(PaymentMethod.EWallet,restored.Sales[0].Payment.Method);Assert.Contains("Sữa tươi",restored.Sales[0].GenerateInvoice());
                var account=restored.Users.Single(x=>x.Username=="test");Assert.True(account.Authenticate("password"));Assert.Equal(UserRole.Manager,account.Role);
            }
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();File.Delete(path); }
    }

    // -----------------------------------------------------------------------
    // Phân quyền ở tầng nghiệp vụ — ẩn nút trên giao diện là chưa đủ
    // -----------------------------------------------------------------------

    [Fact]
    public void CashierCannotChangeInventoryEvenWhenCallingCoreDirectly()
    {
        var inventory=new Inventory(SeedData.Products());
        var cashier=new Cashier("password") { Username="cashier" };
        int before=inventory.Find(1)!.Stock;

        Assert.Throws<UnauthorizedAccessException>(()=>inventory.Restock(1,5,cashier));
        Assert.Throws<UnauthorizedAccessException>(()=>inventory.Withdraw(1,1,cashier));
        Assert.Throws<UnauthorizedAccessException>(()=>inventory.SetPrice(1,1000,cashier));
        Assert.Throws<UnauthorizedAccessException>(()=>inventory.Add(new GeneralProduct(5) { Id=999,Name="Hàng lạ" },cashier));
        Assert.Equal(before,inventory.Find(1)!.Stock);
        Assert.Null(inventory.Find(999));
    }

    [Fact]
    public void MissingActorIsRejectedRatherThanAllowedByDefault()
    {
        var inventory=new Inventory(SeedData.Products());
        Assert.Throws<UnauthorizedAccessException>(()=>inventory.Restock(1,5,null));
        Assert.Throws<UnauthorizedAccessException>(()=>inventory.SetPrice(1,1000,null));
        Assert.Equal(12,inventory.Find(1)!.Stock);
    }

    [Fact]
    public void ManagerCanManageInventory()
    {
        var inventory=new Inventory(SeedData.Products());
        var manager=new Manager("password") { Username="manager" };
        inventory.Restock(1,5,manager);
        Assert.Equal(17,inventory.Find(1)!.Stock);
        inventory.Withdraw(1,7,manager);
        Assert.Equal(10,inventory.Find(1)!.Stock);
        inventory.SetPrice(1,25000,manager);
        Assert.Equal(25000,inventory.Find(1)!.UnitPrice);
    }

    [Fact]
    public void CashierAndManagerCannotManageStaffButAdminCan()
    {
        using var store=new StoreSession(":memory:");
        var cashier=new Cashier("password") { Username="cashier" };
        var manager=new Manager("password") { Username="manager" };
        var admin=store.Users.Single(x=>x.Role==UserRole.Admin);
        var target=store.Users.Single(x=>x.Username=="cashier");

        Assert.Throws<UnauthorizedAccessException>(()=>store.AddUser(new Cashier("password") { Username="lua" },cashier));
        Assert.Throws<UnauthorizedAccessException>(()=>store.ChangeRole(target,UserRole.Manager,manager));
        Assert.Throws<UnauthorizedAccessException>(()=>store.RemoveUser(target,manager));
        Assert.Equal(3,store.Users.Count);
        Assert.Equal(UserRole.Cashier,target.Role);

        store.AddUser(new Cashier("password") { Username="moi" },admin);
        Assert.Equal(4,store.Users.Count);
        store.ChangeRole(store.Users.Single(x=>x.Username=="moi"),UserRole.Manager,admin);
        Assert.Equal(UserRole.Manager,store.Users.Single(x=>x.Username=="moi").Role);
        store.RemoveUser(store.Users.Single(x=>x.Username=="moi"),admin);
        Assert.Equal(3,store.Users.Count);
    }
}
