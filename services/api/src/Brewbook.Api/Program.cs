using System.Text.Json.Serialization;
using Brewbook.Api.Auth;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Achievements;
using Brewbook.Api.Features.Beans;
using Brewbook.Api.Features.Brews;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Profile;
using Brewbook.Api.Features.Users;
using Brewbook.Api.Features.Voice;
using Brewbook.Api.Integrations.Gemini;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Railway injects PORT; bind every interface (IPv6 included, which its private network needs).
if (builder.Configuration["PORT"] is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://*:{port}");

// ---- Composition root ------------------------------------------------------

builder.Services.Configure<ProxyIdentityOptions>(builder.Configuration.GetSection(ProxyIdentityOptions.SectionName));
builder.Services.Configure<GeminiOptions>(o =>
{
    builder.Configuration.GetSection(GeminiOptions.SectionName).Bind(o);
    // The key is an environment secret (Railway), never appsettings.
    o.ApiKey = builder.Configuration["GEMINI_API_KEY"] ?? o.ApiKey;
});
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
});
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<AchievementService>();

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

var app = builder.Build();

// ---- Pipeline --------------------------------------------------------------

app.UseExceptionHandler();
app.UseStatusCodePages();

// Liveness for Railway. Deliberately outside the identity gate: the proxy is not in front of it.
app.MapHealthChecks("/health");

var api = app.MapGroup("/api/v1");
api.MapUsers().MapBeans().MapBrews().MapVoice().MapProfile().MapAchievements();

// Only /api/* is user-facing; everything under it needs an identity from the proxy.
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"), branch => branch.UseMiddleware<ProxyIdentityMiddleware>());

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<BrewbookDbContext>().Database.MigrateAsync();
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
