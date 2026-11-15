namespace SmartMart.Core;

public enum CatalogSort { Featured, Name, PriceAscending, PriceDescending }

public static class CatalogQuery
{
    private static readonly int[] featured=[1001,1011,1003,1029,1039,1005,1041,1043,1059];
    public static IReadOnlyList<Product> Find(IEnumerable<Product> products,string query="",Category? category=null,bool availableOnly=false,CatalogSort sort=CatalogSort.Featured)
    {
        var matches=products.Where(x=>(category is null||x.Category==category)&&(!availableOnly||x.CanSell)&&
            (string.IsNullOrWhiteSpace(query)||Vietnamese.Matches(x.Name,query)||x.Id.ToString()==query.Trim()||(!string.IsNullOrEmpty(x.Barcode)&&x.Barcode==query.Trim())));
        return (sort switch
        {
            CatalogSort.Name => matches.OrderBy(x=>x.Name,StringComparer.Create(Vietnamese.Culture,true)),
            CatalogSort.PriceAscending => matches.OrderBy(x=>x.ApplyDiscount()).ThenBy(x=>x.Id),
            CatalogSort.PriceDescending => matches.OrderByDescending(x=>x.ApplyDiscount()).ThenBy(x=>x.Id),
            _ => matches.OrderBy(x=>{int rank=Array.IndexOf(featured,x.Id);return rank<0?1000:rank;}).ThenBy(x=>x.Id)
        }).ToList();
    }
}
