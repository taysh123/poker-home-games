namespace PokerApp.Application.Common;

/// <summary>
/// CSV field encoding hardened against spreadsheet formula injection (CWE-1236).
/// A cell whose first character is <c>= + - @</c> (or a tab/CR) is interpreted as a
/// formula by Excel / Google Sheets / LibreOffice, so a user-controlled value like
/// <c>=HYPERLINK(...)</c> in a username would execute on open. We neutralise such
/// values by prefixing a single quote, then always quote the field and double any
/// embedded quotes (RFC 4180).
/// </summary>
public static class CsvSafe
{
    private static readonly char[] FormulaTriggers = ['=', '+', '-', '@', '\t', '\r'];

    /// <summary>Encodes a single value as a safe, quoted CSV field.</summary>
    public static string Field(string? value)
    {
        var s = value ?? string.Empty;
        if (s.Length > 0 && Array.IndexOf(FormulaTriggers, s[0]) >= 0)
            s = "'" + s;
        return "\"" + s.Replace("\"", "\"\"") + "\"";
    }
}
