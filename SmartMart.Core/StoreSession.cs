using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace SmartMart.Core;

public sealed class StoreSession : IDisposable
{
    private SqliteConnection? connection;
    public Inventory Inventory { get; private set; } = new(SeedData.Products());
    public List<Transaction> Sales { get; } = [];
    public List<User> Users { get; } = SeedData.Users().ToList();
    public string? StorageWarning { get; private set; }
    public string? StorageNotice { get; private set; }
    public string? MigrationBackupPath { get; private set; }
    public string? CatalogBackupPath { get; private set; }
    public const decimal DemoUsdToVnd = 25000m;
    public string DatabasePath { get; }

    public StoreSession(string? path = null)
    {
        DatabasePath = path ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SmartMart", "smartmart.db");
        try
        {
            if (DatabasePath != ":memory:") Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(DatabasePath))!);
            connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = DatabasePath }.ToString());
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL); SELECT payload FROM app_state WHERE id = 1;";
            var payload = command.ExecuteScalar() as string;
            if (payload is not null)
            {
                var state = JsonSerializer.Deserialize<SavedState>(payload) ?? throw new InvalidDataException("Dữ liệu đã lưu không hợp lệ.");
                if (state.Currency is null or "USD")
                {
                    // Back up the original SQLite snapshot before touching monetary data.
                    if (DatabasePath != ":memory:")
                    {
                        MigrationBackupPath = DatabasePath + ".usd-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N")[..6] + ".bak";
                        using var backup = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = MigrationBackupPath }.ToString());
                        backup.Open(); connection.BackupDatabase(backup);
                    }
                    state = ConvertToVnd(state);
                    using var update = connection.CreateCommand();
                    update.CommandText = "UPDATE app_state SET payload=$payload WHERE id=1";
                    update.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(state));
                    update.ExecuteNonQuery();
                    StorageNotice = "Đã chuyển sang VNĐ · Tỷ lệ minh họa 1 USD = 25.000 ₫ · Đã sao lưu dữ liệu gốc";
                }
                else if (state.Currency != "VND") throw new InvalidDataException("Đơn vị tiền tệ chưa được hỗ trợ.");
                var products = state.Products.Select(x => x.ToProduct()).ToArray();
                var users = state.Users.Select(x => User.Restore(x.Username, x.Role, x.Credential)).ToArray();
                Inventory = new(products); Sales.AddRange(state.Sales); Users.Clear(); Users.AddRange(users);
                if (state.CatalogRevision < CatalogSeed.Revision)
                {
                    if (DatabasePath != ":memory:")
                    {
                        CatalogBackupPath = DatabasePath + ".catalog-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N")[..6] + ".bak";
                        using var backup = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource=CatalogBackupPath }.ToString());
                        backup.Open();connection.BackupDatabase(backup);
                    }
                    var keys=Inventory.Products.Select(x=>x.CatalogKey).ToHashSet(StringComparer.Ordinal);
                    int added=0;
                    foreach(var item in CatalogSeed.Items.Where(x=>!keys.Contains(x.Key)))
                    {
                        int id=Inventory.Find(item.Id) is null?item.Id:Inventory.Products.Max(x=>x.Id)+1;
                        // Đây là đường nạp danh mục lúc mở cửa hàng, chưa có ai đăng
                        // nhập, nên không có người thực hiện để kiểm tra quyền.
                        Inventory.AddUnchecked(item.CreateProduct(id));added++;
                    }
                    Save();
                    if(added>0)StorageNotice=$"Đã bổ sung {added} mặt hàng · Giữ nguyên giá, tồn kho và hóa đơn hiện có";
                }
            }
            else Save();
        }
        catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException or JsonException or InvalidDataException or ArgumentException)
        {
            StorageWarning = "Không mở được dữ liệu trên máy. Thay đổi chỉ tồn tại trong phiên này.";
            connection?.Dispose(); connection = null;
        }
    }

    public bool Save()
    {
        if (connection is null) return false;
        try
        {
            var state = new SavedState(Inventory.Products.Select(ProductData.From).ToArray(), Sales.ToArray(), Users.Select(x => new UserData(x.Username, x.Role, x.Credential)).ToArray(), "VND", 2, CatalogSeed.Revision);
            using var command = connection.CreateCommand();
            command.CommandText = "INSERT INTO app_state(id,payload) VALUES(1,$payload) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload;";
            command.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(state));
            command.ExecuteNonQuery(); StorageWarning = null; return true;
        }
        catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException)
        {
            StorageWarning = "Chưa lưu được thay đổi. Hãy giữ ứng dụng mở và thử lại."; return false;
        }
    }
    public void Dispose() => connection?.Dispose();

    /// <summary>
    /// Quản lý nhân sự chỉ dành cho người được vào màn hình Nhân sự. Kiểm tra
    /// ở đây chứ không chỉ ẩn nút, vì lời gọi trực tiếp vẫn phải bị từ chối.
    /// </summary>
    private static void RequireAdmin(User? actor, string action)
    {
        if (actor is null) throw new UnauthorizedAccessException($"Không xác định được người thực hiện, nên không thể {action}.");
        if (!actor.AllowedScreens().Contains("Users")) throw new UnauthorizedAccessException($"Tài khoản \"{actor.Username}\" không có quyền {action}. Chỉ quản trị viên mới làm được việc này.");
    }

    public void ChangeRole(User user, UserRole role, User? actor)
    {
        RequireAdmin(actor, "đổi vai trò");
        int index = Users.IndexOf(user);
        if (index < 0) throw new ArgumentException("Không tìm thấy tài khoản.");
        Users[index] = User.Restore(user.Username, role, user.Credential);
    }

    public void AddUser(User member, User? actor)
    {
        RequireAdmin(actor, "thêm nhân sự");
        if (Users.Any(x => string.Equals(x.Username, member.Username, StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Tên đăng nhập đã có người dùng.");
        Users.Add(member);
    }

    public void RemoveUser(User member, User? actor)
    {
        RequireAdmin(actor, "xoá nhân sự");
        if (!Users.Remove(member)) throw new ArgumentException("Không tìm thấy tài khoản.");
    }
    public sealed record SavedState(ProductData[] Products, Transaction[] Sales, UserData[] Users, string? Currency = null, int Version = 1, int CatalogRevision = 0);
    private static SavedState ConvertToVnd(SavedState state)
    {
        static decimal Convert(decimal value) => Money.Round(value * DemoUsdToVnd);
        return state with
        {
            Currency = "VND", Version = 2,
            Products = state.Products.Select(p => p with { Price = Convert(p.Price), Name = Vietnamese.SeedName(p.Name) }).ToArray(),
            Sales = state.Sales.Select(s => s with
            {
                Lines = s.Lines.Select(l => l with
                {
                    Name = Vietnamese.SeedName(l.Name), UnitPrice = Convert(l.UnitPrice),
                    DiscountedUnitPrice = Convert(l.DiscountedUnitPrice), TaxPerUnit = Convert(l.TaxPerUnit)
                }).ToArray(),
                Subtotal = Convert(s.Subtotal), DiscountedTotal = Convert(s.DiscountedTotal), Tax = Convert(s.Tax),
                Payment = new PaymentDetails(s.Payment.Method, Convert(s.Payment.Amount))
            }).ToArray()
        };
    }
    public sealed record UserData(string Username, UserRole Role, string Credential);
    public sealed record ProductData(int Id, string Name, Category Category, decimal Price, int Stock, int Threshold, string Kind, DateOnly Expiry, int Warranty, string Detail, string CatalogKey="", string Barcode="")
    {
        public static ProductData From(Product p) => new(p.Id, p.Name, p.Category, p.UnitPrice, p.Stock, p.LowStockThreshold,
            p is PerishableProduct ? "perishable" : p is ElectronicProduct ? "electronic" : "general",
            p is PerishableProduct food ? food.ExpiryDate : default,
            p is ElectronicProduct electronic ? electronic.WarrantyMonths : 0,
            p is ElectronicProduct e ? e.SerialNumber : p is GeneralProduct g ? g.Supplier : "",p.CatalogKey,p.Barcode);
        public Product ToProduct() => Kind switch
        {
            "perishable" => new PerishableProduct(Stock) { Id=Id, Name=Name, Category=Category, UnitPrice=Price, LowStockThreshold=Threshold, ExpiryDate=Expiry,CatalogKey=CatalogKey,Barcode=Barcode },
            "electronic" => new ElectronicProduct(Stock) { Id=Id, Name=Name, Category=Category, UnitPrice=Price, LowStockThreshold=Threshold, WarrantyMonths=Warranty, SerialNumber=Detail,CatalogKey=CatalogKey,Barcode=Barcode },
            _ => new GeneralProduct(Stock) { Id=Id, Name=Name, Category=Category, UnitPrice=Price, LowStockThreshold=Threshold, Supplier=Detail,CatalogKey=CatalogKey,Barcode=Barcode }
        };
    }
}
