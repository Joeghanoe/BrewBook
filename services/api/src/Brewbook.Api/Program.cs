using System.Text.Json.Serialization;
using Anthropic;
using Brewbook.Api.Auth;
using Brewbook.Api.Data;
using Brewbook.Api.Features.Beans;
using Brewbook.Api.Features.Brews;
using Brewbook.Api.Features.Labels;
using Brewbook.Api.Features.Users;
using Brewbook.Api.Features.Voice;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Railway injects PORT; bind every interface (IPv6 included, which its private network needs).
if (builder.Configuration["PORT"] is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://*:{port}");

// ---- Composition root ------------------------------------------------------

builder.Services.Configure<ProxyIdentityOptions>(builder.Configuration.GetSection(ProxyIdentityOptions.SectionName));
builder.Services.Configure<LabelExtractionOptions>(builder.Configuration.GetSection(LabelExtractionOptions.SectionName));
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
});
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<CurrentUser>();

var connectionString = ConnectionStrings.Resolve(builder.Configuration);
builder.Services.AddDbContext<BrewbookDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddHealthChecks().AddDbContextCheck<BrewbookDbContext>("postgres");

var anthropicKey = builder.Configuration["ANTHROPIC_API_KEY"];
if (string.IsNullOrWhiteSpace(anthropicKey))
{
    builder.Services.AddSingleton<ILabelExtractor, UnconfiguredLabelExtractor>();
}
else
{
    builder.Services.AddSingleton(new AnthropicClient { ApiKey = anthropicKey });
    builder.Services.AddSingleton<ILabelExtractor, AnthropicLabelExtractor>();
}

var app = builder.Build();

// ---- Pipeline --------------------------------------------------------------

app.UseExceptionHandler();
app.UseStatusCodePages();

// Liveness for Railway. Deliberately outside the identity gate: the proxy is not in front of it.
app.MapHealthChecks("/health");

var api = app.MapGroup("/api/v1");
api.MapUsers().MapBeans().MapBrews().MapVoice();

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
