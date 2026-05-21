using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Settings;

public class WebSettings : IWebSettings
{
    public string WebBaseUrl { get; set; } = string.Empty;
}
