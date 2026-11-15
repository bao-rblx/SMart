using System.Globalization;
using System.Text;

namespace SmartMart.Core;

public static class Vietnamese
{
    public static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("vi-VN");
    public static void Configure()
    {
        CultureInfo.DefaultThreadCurrentCulture = Culture;
        CultureInfo.DefaultThreadCurrentUICulture = Culture;
        CultureInfo.CurrentCulture = Culture;
        CultureInfo.CurrentUICulture = Culture;
    }
    public static string Label(this Category category) => category switch
    {
        Category.Grocery => "Thực phẩm", Category.Produce => "Rau củ",
        Category.Dairy => "Sữa & bơ", Category.Electronics => "Điện tử",
        Category.Household => "Gia dụng", Category.Beverages => "Đồ uống",
        Category.Snacks => "Bánh kẹo", Category.PersonalCare => "Cá nhân", _ => "Khác"
    };
    public static string Label(this UserRole role) => role switch
    {
        UserRole.Cashier => "Thu ngân", UserRole.Manager => "Quản lý", _ => "Quản trị viên"
    };
    public static string Label(this PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Tiền mặt", PaymentMethod.Card => "Thẻ ngân hàng", _ => "Ví điện tử"
    };
    public static string Screen(string screen) => screen switch
    {
        "Checkout" => "Bán hàng", "Inventory" => "Kho hàng", "Reports" => "Doanh thu", "Users" => "Nhân sự", _ => screen
    };
    public static bool Matches(string value, string query)
    {
        static string Normalize(string text) => string.Concat(text.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
            .Replace('đ', 'd').Replace('Đ', 'D');
        return Normalize(value).Contains(Normalize(query.Trim()), StringComparison.OrdinalIgnoreCase);
    }
    public static string SeedName(string name) => name switch
    {
        "Fresh Milk" => "Sữa tươi", "Pasta Salad" => "Nui trộn rau củ", "Wireless Scanner" => "Máy quét không dây",
        "USB-C Charger" => "Củ sạc USB-C", "Paper Towels" => "Khăn giấy", "Shopping Bag" => "Túi mua sắm",
        "House Blend Coffee" => "Cà phê rang xay", "Green Apples" => "Táo xanh", "Greek Yogurt" => "Sữa chua Hy Lạp",
        "Sourdough Crackers" => "Bánh quy men tự nhiên", "Hand Wash" => "Nước rửa tay", "Mineral Water" => "Nước khoáng", _ => name
    };
}
