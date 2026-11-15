using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace SmartMart.Core;

public enum Category { Grocery, Produce, Dairy, Electronics, Household, General, Beverages, Snacks, PersonalCare }
public enum PaymentMethod { Cash, Card, EWallet }
public enum UserRole { Cashier, Manager, Admin }

public static class Money
{
    public static decimal Round(decimal value) => decimal.Round(value, 0, MidpointRounding.AwayFromZero);
    public static string Format(decimal value) => Round(value).ToString("N0", Vietnamese.Culture) + " ₫";
}

public abstract class Product
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public Category Category { get; init; }
    public string CatalogKey { get; init; } = "";
    public string Barcode { get; init; } = "";
    private decimal _unitPrice;
    public decimal UnitPrice { get => _unitPrice; set => _unitPrice = value >= 0 ? Money.Round(value) : throw new ArgumentOutOfRangeException(nameof(value)); }
    public int Stock { get; private set; }
    public int LowStockThreshold { get; init; } = 5;
    public bool IsLowStock => Stock <= LowStockThreshold;
    public virtual bool CanSell => Stock > 0;
    protected Product(int stock = 0) => Stock = stock >= 0 ? stock : throw new ArgumentOutOfRangeException(nameof(stock));
    public void Restock(int qty) { if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty)); Stock = checked(Stock + qty); }
    public bool TrySell(int qty) { if (qty <= 0 || qty > Stock) return false; Stock -= qty; return true; }
    public abstract decimal ApplyDiscount();
    public virtual decimal CalculateTax() => Money.Round(ApplyDiscount() * .10m);
    public abstract string DisplayInfo();
}

public sealed class PerishableProduct(int stock = 0) : Product(stock)
{
    public DateOnly ExpiryDate { get; init; }
    public bool IsExpired => ExpiryDate < DateOnly.FromDateTime(DateTime.Today);
    public bool IsNearExpiry => ExpiryDate.DayNumber - DateOnly.FromDateTime(DateTime.Today).DayNumber <= 7;
    public override bool CanSell => base.CanSell && !IsExpired;
    public override decimal ApplyDiscount() => Money.Round(UnitPrice * (IsNearExpiry ? .70m : .95m));
    public override string DisplayInfo() => $"Hạn dùng: {ExpiryDate:dd/MM/yyyy}";
}

public sealed class ElectronicProduct(int stock = 0) : Product(stock)
{
    public int WarrantyMonths { get; init; }
    public string SerialNumber { get; init; } = "";
    public override decimal ApplyDiscount() => Money.Round(UnitPrice * .90m);
    public override decimal CalculateTax() => Money.Round(ApplyDiscount() * .12m);
    public override string DisplayInfo() => $"Bảo hành {WarrantyMonths} tháng";
}

public sealed class GeneralProduct(int stock = 0) : Product(stock)
{
    public string Supplier { get; init; } = "";
    public override decimal ApplyDiscount() => Money.Round(UnitPrice * .95m);
    public override string DisplayInfo() => $"Nhà cung cấp: {Supplier}";
}

public abstract class User
{
    public string Username { get; init; } = "";
    public UserRole Role { get; init; }
    internal string Credential { get; }
    protected User(string password, bool stored = false)
    {
        if (stored) { Credential = password; return; }
        var salt = RandomNumberGenerator.GetBytes(16);
        Credential = Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(Hash(password, salt));
    }
    public bool Authenticate(string password)
    {
        var parts = Credential.Split(':');
        return CryptographicOperations.FixedTimeEquals(Convert.FromBase64String(parts[1]), Hash(password, Convert.FromBase64String(parts[0])));
    }
    private static byte[] Hash(string password, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, 120_000, HashAlgorithmName.SHA256, 32);
    public abstract string[] AllowedScreens();
    internal static User Restore(string name, UserRole role, string credential) => role switch
    {
        UserRole.Admin => new Admin(credential, true) { Username = name },
        UserRole.Manager => new Manager(credential, true) { Username = name },
        _ => new Cashier(credential, true) { Username = name }
    };
}
public sealed class Cashier : User
{
    public Cashier(string password) : this(password, false) { }
    internal Cashier(string password, bool stored) : base(password, stored) { Role = UserRole.Cashier; }
    public override string[] AllowedScreens() => ["Checkout"];
}
public sealed class Manager : User
{
    public Manager(string password) : this(password, false) { }
    internal Manager(string password, bool stored) : base(password, stored) { Role = UserRole.Manager; }
    public override string[] AllowedScreens() => ["Checkout", "Inventory", "Reports"];
}
public sealed class Admin : User
{
    public Admin(string password) : this(password, false) { }
    internal Admin(string password, bool stored) : base(password, stored) { Role = UserRole.Admin; }
    public override string[] AllowedScreens() => ["Checkout", "Inventory", "Reports", "Users"];
}

public sealed record CartLine(Product Product, int Quantity)
{
    public decimal LineTotal => Product.ApplyDiscount() * Quantity;
    public decimal DiscountPercent => Product.UnitPrice == 0 ? 0 : (1 - Product.ApplyDiscount() / Product.UnitPrice) * 100;
}

public sealed class ShoppingCart
{
    private readonly List<CartLine> _lines = [];
    public IReadOnlyList<CartLine> Lines => _lines.AsReadOnly();
    public void AddItem(Product product, int qty = 1)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty));
        var current = _lines.FirstOrDefault(x => x.Product.Id == product.Id);
        SetQuantity(product, checked((current?.Quantity ?? 0) + qty));
    }
    public void SetQuantity(Product product, int quantity)
    {
        if (quantity < 0) throw new ArgumentOutOfRangeException(nameof(quantity));
        if (quantity == 0) { RemoveItem(product.Id); return; }
        if (!product.CanSell || quantity > product.Stock) throw new InvalidOperationException("Số lượng không khả dụng. Bạn kiểm tra tồn kho và hạn dùng nhé.");
        var index = _lines.FindIndex(x => x.Product.Id == product.Id);
        if (index < 0) _lines.Add(new(product, quantity)); else _lines[index] = new(product, quantity);
    }
    public void RemoveItem(int productId) => _lines.RemoveAll(x => x.Product.Id == productId);
    public decimal GetSubtotal() => _lines.Sum(x => x.Product.UnitPrice * x.Quantity);
    public decimal GetDiscountedTotal() => _lines.Sum(x => x.LineTotal);
    public decimal GetTax() => _lines.Sum(x => x.Product.CalculateTax() * x.Quantity);
    public Transaction Checkout(PaymentMethod method)
    {
        if (_lines.Count == 0) throw new InvalidOperationException("Hãy thêm sản phẩm trước khi thanh toán.");
        if (!Enum.IsDefined(method)) throw new ArgumentOutOfRangeException(nameof(method));
        // Validate the entire order before changing stock; browsing a cart never reserves inventory.
        if (_lines.Any(x => !x.Product.CanSell || x.Quantity > x.Product.Stock)) throw new InvalidOperationException("Tồn kho đã thay đổi. Hãy kiểm tra đơn trước khi thanh toán.");
        var transaction = new Transaction(Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(), DateTime.Now,
            _lines.Select(x => new SaleLine(x.Product.Id, x.Product.Name, x.Product.Category, x.Quantity, x.Product.UnitPrice, x.Product.ApplyDiscount(), x.Product.CalculateTax())).ToArray(),
            GetSubtotal(), GetDiscountedTotal(), GetTax(), new PaymentDetails(method, GetDiscountedTotal() + GetTax()));
        foreach (var line in _lines) line.Product.TrySell(line.Quantity);
        _lines.Clear();
        return transaction;
    }
    public void Clear() => _lines.Clear();
}

public sealed record SaleLine(int ProductId, string Name, Category Category, int Quantity, decimal UnitPrice, decimal DiscountedUnitPrice, decimal TaxPerUnit)
{
    public decimal LineTotal => DiscountedUnitPrice * Quantity;
}
public sealed record PaymentDetails
{
    public PaymentMethod Method { get; }
    public decimal Amount { get; }
    public PaymentDetails(PaymentMethod method, decimal amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Method = method; Amount = amount;
    }
}
public sealed record Transaction(string OrderId, DateTime Timestamp, IReadOnlyList<SaleLine> Lines, decimal Subtotal, decimal DiscountedTotal, decimal Tax, PaymentDetails Payment)
{
    public decimal GrandTotal => DiscountedTotal + Tax;
    public string GenerateInvoice() => $"SMARTMART\nGọn việc bán. Trọn niềm vui.\n\nHÓA ĐƠN #{OrderId}\n{Timestamp:dd/MM/yyyy, HH:mm}\n{new string('─', 38)}\n" +
        string.Join("\n", Lines.Select(x => $"{x.Name}\n  {x.Quantity} × {Money.Format(x.DiscountedUnitPrice)}    {Money.Format(x.LineTotal)}")) +
        $"\n{new string('─', 38)}\nTạm tính       {Money.Format(Subtotal)}\nTiết kiệm       -{Money.Format(Subtotal - DiscountedTotal)}\nThuế            {Money.Format(Tax)}\nTỔNG CỘNG      {Money.Format(GrandTotal)}\n\nThanh toán: {Payment.Method.Label()}\n\nCảm ơn bạn. Hẹn gặp lại nhé!\n";
}

public interface IInventory
{
    Product? Find(int id);
    IReadOnlyList<Product> Products { get; }
    /// <summary>Nhập kho; bắt buộc kèm người thực hiện để kiểm tra quyền.</summary>
    void Restock(int id, int qty, User? actor);
    IReadOnlyList<Product> GetLowStockAlerts();
    IReadOnlyList<PerishableProduct> GetExpiringSoon();
}
public sealed class Inventory(IEnumerable<Product> products) : IInventory
{
    private readonly List<Product> _products = products.ToList();
    public IReadOnlyList<Product> Products => _products.AsReadOnly();
    public Product? Find(int id) => _products.FirstOrDefault(x => x.Id == id);

    /// <summary>
    /// Màn hình mà người thao tác phải được vào thì mới sửa được kho.
    /// Đây là chốt chặn ở tầng nghiệp vụ: giao diện chỉ ẩn nút, còn lời gọi
    /// trực tiếp vào Inventory vẫn phải bị từ chối.
    /// </summary>
    private const string InventoryScreen = "Inventory";

    private static void RequireManager(User? actor, string action)
    {
        if (actor is null) throw new UnauthorizedAccessException($"Không xác định được người thực hiện, nên không thể {action}.");
        if (!actor.AllowedScreens().Contains(InventoryScreen)) throw new UnauthorizedAccessException($"Tài khoản \"{actor.Username}\" không có quyền {action}.");
    }

    /// <summary>
    /// Thêm mặt hàng cho người dùng thật. Kiểm tra quyền TRƯỚC mọi kiểm tra
    /// khác, để một tài khoản không có quyền không dò được kho qua thông báo lỗi.
    /// Phần nghiệp vụ thuần nằm ở AddUnchecked để đường nạp danh mục dùng lại
    /// đúng một luật duy nhất, không chép lại điều kiện.
    /// </summary>
    public void Add(Product product, User? actor)
    {
        RequireManager(actor, "thêm mặt hàng");
        AddUnchecked(product);
    }

    /// <summary>
    /// Thêm không kiểm tra quyền. Chỉ dùng cho đường nạp danh mục mẫu lúc mở
    /// cửa hàng (chưa có ai đăng nhập). Vẫn giữ nguyên kiểm tra dữ liệu.
    /// </summary>
    internal void AddUnchecked(Product product)
    {
        if (string.IsNullOrWhiteSpace(product.Name) || Find(product.Id) is not null) throw new ArgumentException("Mã hàng phải duy nhất và tên sản phẩm không được để trống.");
        _products.Add(product);
    }

    /// <summary>Nhập thêm hàng cho người dùng thật — có kiểm tra quyền.</summary>
    public void Restock(int id, int qty, User? actor)
    {
        RequireManager(actor, "nhập kho");
        RestockUnchecked(id, qty);
    }

    /// <summary>Nhập hàng không kiểm tra quyền: dành cho nạp dữ liệu mẫu.</summary>
    internal void RestockUnchecked(int id, int qty) => (Find(id) ?? throw new KeyNotFoundException()).Restock(qty);

    /// <summary>Xuất kho cho người dùng thật — có kiểm tra quyền.</summary>
    public void Withdraw(int id, int qty, User? actor)
    {
        RequireManager(actor, "xuất kho");
        WithdrawUnchecked(id, qty);
    }

    /// <summary>
    /// Xuất kho không kiểm tra quyền. Vẫn dùng TrySell() của Product vì đó là
    /// nơi duy nhất biết luật "hàng hết hạn thì không bán được".
    /// </summary>
    internal void WithdrawUnchecked(int id, int qty)
    {
        var product = Find(id) ?? throw new KeyNotFoundException();
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty));
        if (qty > product.Stock) throw new InvalidOperationException("Số lượng trong kho không đủ.");
        if (!product.TrySell(qty)) throw new InvalidOperationException("Không thể xuất kho: mặt hàng đã hết hạn hoặc ngừng bán.");
    }

    /// <summary>Đổi giá bán cho người dùng thật — có kiểm tra quyền.</summary>
    public void SetPrice(int id, decimal price, User? actor)
    {
        RequireManager(actor, "đổi giá bán");
        SetPriceUnchecked(id, price);
    }

    /// <summary>Đổi giá không kiểm tra quyền: dành cho nạp dữ liệu mẫu.</summary>
    internal void SetPriceUnchecked(int id, decimal price) => (Find(id) ?? throw new KeyNotFoundException()).UnitPrice = price;

    public IReadOnlyList<Product> GetLowStockAlerts() => _products.Where(x => x.IsLowStock).ToList();
    public IReadOnlyList<PerishableProduct> GetExpiringSoon() => _products.OfType<PerishableProduct>().Where(x => x.IsNearExpiry).ToList();
}

public static class SeedData
{
    public static List<Product> Products() => OriginalProducts().Concat(CatalogSeed.Additions()).ToList();
    public static List<Product> OriginalProducts() =>
    [
        new PerishableProduct(12) { Id=1, Name="Sữa tươi", Category=Category.Dairy, UnitPrice=62250m, ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(3)) },
        new PerishableProduct(3) { Id=2, Name="Nui trộn rau củ", Category=Category.Produce, UnitPrice=149750m, ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(12)) },
        new ElectronicProduct(4) { Id=3, Name="Máy quét không dây", Category=Category.Electronics, UnitPrice=1249750m, WarrantyMonths=12, SerialNumber="SM-SCAN-001" },
        new ElectronicProduct(8) { Id=4, Name="Củ sạc USB-C", Category=Category.Electronics, UnitPrice=499750m, WarrantyMonths=24, SerialNumber="SM-CHG-001" },
        new GeneralProduct(25) { Id=5, Name="Khăn giấy", Category=Category.Household, UnitPrice=162250m, Supplier="CleanCo" },
        new GeneralProduct(2) { Id=6, Name="Túi mua sắm", Category=Category.General, UnitPrice=6250m, Supplier="PackRight" },
        new GeneralProduct(32) { Id=7, Name="Cà phê rang xay", Category=Category.Grocery, UnitPrice=312500m, Supplier="Morning Roasters" },
        new PerishableProduct(18) { Id=8, Name="Táo xanh", Category=Category.Produce, UnitPrice=95000m, ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(14)) },
        new PerishableProduct(16) { Id=9, Name="Sữa chua Hy Lạp", Category=Category.Dairy, UnitPrice=105000m, ExpiryDate=DateOnly.FromDateTime(DateTime.Today.AddDays(6)) },
        new GeneralProduct(28) { Id=10, Name="Bánh quy men tự nhiên", Category=Category.Grocery, UnitPrice=122500m, Supplier="The Bakehouse" },
        new GeneralProduct(14) { Id=11, Name="Nước rửa tay", Category=Category.Household, UnitPrice=187500m, Supplier="Everyday Essentials" },
        new GeneralProduct(20) { Id=12, Name="Nước khoáng", Category=Category.Grocery, UnitPrice=45000m, Supplier="Pure Spring" }
    ];
    public static IReadOnlyList<User> Users() => [new Admin("admin") { Username="admin" }, new Manager("manager") { Username="manager" }, new Cashier("cashier") { Username="cashier" }];
}
