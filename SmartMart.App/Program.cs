using SmartMart.Core;

namespace SmartMart.App;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Vietnamese.Configure();
        ApplicationConfiguration.Initialize();
        Application.ApplicationExit+=(_,_)=>ProductImages.DisposeAll();
        using var store = new StoreSession();
        Application.Run(new LoginForm(store));
    }
}
