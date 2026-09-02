using System.Text.Json.Serialization;
using Brewbook.Api.Auth;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Achievements;
using Brewbook.Api.Features;
using Brewbook.Api.Features.Beans;
using Brewbook.Api.Features.Brews;
using Brewbook.Api.Features.Friends;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Profile;
using Brewbook.Api.Features.Roasters;
using Brewbook.Api.Features.Users;
using Brewbook.Api.Features.Voice;
using Brewbook.Api.Integrations.CloudflareEmail;
using Brewbook.Api.Integrations.Gemini;
using Brewbook.Api.Integrations.GooglePlaces;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Railway injects PORT; bind every interface (IPv6 included, which its private network needs).
if (builder.Configuration["PORT"] is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://*:{port}");

// ---- Composition root ------------------------------------------------------

builder.Services.Configure<ProxyIdentityOptions>(builder.Configuration.GetSection(ProxyIdentityOptions.SectionName));
builder.Services.Configure<FeatureOptions>(builder.Configuration.GetSection(FeatureOptions.SectionName));
builder.Services.Configure<GeminiOptions>(o =>
{
    builder.Configuration.GetSection(GeminiOptions.SectionName).Bind(o);
    // The key is an environment secret (Railway), never appsettings.
    o.ApiKey = builder.Configuration["GEMINI_API_KEY"] ?? o.ApiKey;
});
builder.Services.Configure<CloudflareEmailOptions>(o =>
{
    builder.Configuration.GetSection(CloudflareEmailOptions.SectionName).Bind(o);
    // The token is an environment secret (Railway), never appsettings.
    o.ApiToken = builder.Configuration["CLOUDFLARE_EMAIL_TOKEN"] ?? o.ApiToken;
});
builder.Services.Configure<GoogleMapsOptions>(o =>
{
    builder.Configuration.GetSection(GoogleMapsOptions.SectionName).Bind(o);
    // Both keys are environment secrets (Railway), never appsettings.
    o.ServerKey = builder.Configuration["GOOGLE_MAPS_SERVER_KEY"] ?? o.ServerKey;
    o.BrowserKey = builder.Configuration["GOOGLE_MAPS_BROWSER_KEY"] ?? o.BrowserKey;
});
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
});
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<AchievementService>();
builder.Services.AddScoped<Capabilities>();

var connectionString = ConnectionStrings.Resolve(builder.Configuration);
builder.Services.AddDbContext<BrewbookDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddHealthChecks().AddDbContextCheck<BrewbookDbContext>("postgres");

var gemini = new GeminiOptions();
builder.Configuration.GetSection(GeminiOptions.SectionName).Bind(gemini);
gemini.ApiKey = builder.Configuration["GEMINI_API_KEY"] ?? gemini.ApiKey;
if (gemini.Configured)
{
    builder.Services.AddHttpClient<GeminiClient>(c => c.Timeout = TimeSpan.FromSeconds(gemini.TimeoutSeconds));
    builder.Services.AddScoped<ILabelExtractor, GeminiLabelExtractor>();
    builder.Services.AddScoped<ISpeechTranscriber, GeminiSpeechTranscriber>();
}
else
{
    builder.Services.AddSingleton<ILabelExtractor, UnconfiguredLabelExtractor>();
    builder.Services.AddSingleton<ISpeechTranscriber, UnconfiguredSpeechTranscriber>();
}

var features = new FeatureOptions();
builder.Configuration.GetSection(FeatureOptions.SectionName).Bind(features);

var email = new CloudflareEmailOptions();
builder.Configuration.GetSection(CloudflareEmailOptions.SectionName).Bind(email);
email.ApiToken = builder.Configuration["CLOUDFLARE_EMAIL_TOKEN"] ?? email.ApiToken;
// No friends, no invitations, so nothing to post either.
if (features.Friends && email.Configured)
    builder.Services.AddHttpClient<IInviteMailer, CloudflareInviteMailer>(c => c.Timeout = TimeSpan.FromSeconds(email.TimeoutSeconds));
else
    builder.Services.AddSingleton<IInviteMailer, UnconfiguredInviteMailer>();

var maps = new GoogleMapsOptions();
builder.Configuration.GetSection(GoogleMapsOptions.SectionName).Bind(maps);
maps.ServerKey = builder.Configuration["GOOGLE_MAPS_SERVER_KEY"] ?? maps.ServerKey;
if (maps.ServerConfigured)
    builder.Services.AddHttpClient<IRoasterLocator, GooglePlacesLocator>(c => c.Timeout = TimeSpan.FromSeconds(maps.TimeoutSeconds));
else
    builder.Services.AddSingleton<IRoasterLocator, UnconfiguredRoasterLocator>();

var app = builder.Build();

// ---- Pipeline --------------------------------------------------------------

app.UseExceptionHandler();
app.UseStatusCodePages();

// Liveness for Railway. Deliberately outside the identity gate: the proxy is not in front of it.
app.MapHealthChecks("/health");

var api = app.MapGroup("/api/v1");
api.MapUsers().MapBeans().MapBrews().MapVoice().MapProfile().MapRoasters().MapAchievements();
// Unmapped rather than guarded: a disabled capability has no routes at all.
if (features.Friends) api.MapFriends();

// Only /api/* is user-facing; everything under it needs an identity from the proxy.
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"), branch => branch.UseMiddleware<ProxyIdentityMiddleware>());

{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<BrewbookDbContext>();
    if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
        await db.Database.MigrateAsync();
    // Bags added before roasters existed as rows get linked once; afterwards there is nothing to do.
    var linked = await RoasterLinker.BackfillAsync(db, TimeProvider.System, CancellationToken.None);
    if (linked > 0) app.Logger.LogInformation("Linked {Count} bags to roasters", linked);
}

app.Run();

/// <summary>Exposed so the test host can spin up the same composition with a different database.</summary>
public partial class Program;

static class ConnectionStrings
{
    /// <summary>
    /// Railway hands Postgres over as a URL in DATABASE_URL; Npgsql wants key=value. Accept both,
    /// and prefer an explicit ConnectionStrings:Brewbook when set.
    /// </summary>
    public static string Resolve(IConfiguration cfg)
    {
        var explicitCs = cfg.GetConnectionString("Brewbook");
        if (!string.IsNullOrWhiteSpace(explicitCs)) return explicitCs;

        var url = cfg["DATABASE_URL"];
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("Set DATABASE_URL (postgres://…) or ConnectionStrings__Brewbook.");
        if (!url.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return url;

        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        var b = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            Database = uri.AbsolutePath.TrimStart('/'),
            SslMode = Npgsql.SslMode.Prefer,
        };
        return b.ConnectionString;
    }
}
