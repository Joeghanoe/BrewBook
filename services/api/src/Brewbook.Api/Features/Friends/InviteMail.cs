namespace Brewbook.Api.Features.Friends;

/// <summary>
/// What an invitation says. Pure so it can be read and tested without a network: one sentence
/// about what Brewbook is, one link, and nothing that pretends to know more about the sender
/// than their name.
/// </summary>
public static class InviteMail
{
    public static string Url(string publicUrl, string token) =>
        $"{publicUrl.TrimEnd('/')}/?invite={Uri.EscapeDataString(token)}";

    public static string Subject(string fromName) => $"{fromName} wants to swap coffee notes on Brewbook";

    public static string Text(string fromName, string url) =>
        $"""
         {fromName} invited you to Brewbook, a personal coffee brew log.

         Accept and both of your maps carry both sets of roasters, with the numbers behind
         every brew you each rated. Nothing of yours is visible until you accept.

         {url}

         The link expires in 30 days. If you were not expecting this, ignore it — nothing
         happens until you open it.
         """;

    /// <summary>The same words with a link that can be clicked. Deliberately plain: no images, no tracking, no styling to break.</summary>
    public static string Html(string fromName, string url) =>
        $"""
         <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1c1a21">
           <p><strong>{Escape(fromName)}</strong> invited you to Brewbook, a personal coffee brew log.</p>
           <p>Accept and both of your maps carry both sets of roasters, with the numbers behind every
              brew you each rated. Nothing of yours is visible until you accept.</p>
           <p><a href="{Escape(url)}" style="color:#8a5a2b">Open the invitation</a></p>
           <p style="color:#6b6570;font-size:13px">The link expires in 30 days. If you were not expecting
              this, ignore it — nothing happens until you open it.</p>
         </div>
         """;

    private static string Escape(string s) => s
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
}
