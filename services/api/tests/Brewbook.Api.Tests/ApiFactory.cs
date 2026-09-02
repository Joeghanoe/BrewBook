using Brewbook.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Brewbook.Api.Tests;

/// <summary>The real composition root on an in-memory SQLite database. One database per factory, so tests do not share state.</summary>
public sealed class ApiFactory(Action<IServiceCollection>? configure = null) : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _conn = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _conn.Open();
        builder.UseSetting("DATABASE_URL", "postgres://test:test@localhost/unused");
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<BrewbookDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<BrewbookDbContext>>();
            services.RemoveAll<BrewbookDbContext>();
            services.AddDbContext<BrewbookDbContext>(o => o.UseSqlite(_conn));
            configure?.Invoke(services);
            using var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            scope.ServiceProvider.GetRequiredService<BrewbookDbContext>().Database.EnsureCreated();
        });
    }

    public HttpClient ClientFor(string email)
    {
        var c = CreateClient();
        c.DefaultRequestHeaders.Add("X-Forwarded-Email", email);
        c.DefaultRequestHeaders.Add("X-Forwarded-User", email.Split('@')[0]);
        return c;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _conn.Dispose();
    }
}
