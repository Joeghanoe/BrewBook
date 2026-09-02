using System.Net;
using System.Net.Http.Json;
using Brewbook.Api.Auth;
using Brewbook.Api.Contracts;

namespace Brewbook.Api.Tests;

/// <summary>A bag is edited after the fact: a roast date the label did not carry, a name read wrong (§7).</summary>
public class BeanEditTests
{
    [Fact]
    public async Task A_roast_date_can_be_set_after_the_bag_was_added()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var bean = await Add(c, "Cata Reserva", "Kolibri Coffee Roasters", roastDate: null);
        Assert.Null(bean.RoastDate);

        var edited = await Patch(c, bean.Id, new UpdateBeanRequest(RoastDate: new DateOnly(2026, 8, 24)));
        Assert.Equal(new DateOnly(2026, 8, 24), edited.RoastDate);

        // And taken back off, which a null cannot say on its own.
        Assert.Null((await Patch(c, bean.Id, new UpdateBeanRequest(ClearRoastDate: true))).RoastDate);
    }

    [Fact]
    public async Task Null_leaves_a_field_alone_and_an_empty_string_clears_it()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var bean = await Add(c, "Cata Reserva", "Kolibri", roastDate: new DateOnly(2026, 8, 1));

        var untouched = await Patch(c, bean.Id, new UpdateBeanRequest(Name: "Cata Reserva Lote 2"));
        Assert.Equal("Cata Reserva Lote 2", untouched.Name);
        Assert.Equal("Kolibri", untouched.Roaster);
        Assert.Equal(new DateOnly(2026, 8, 1), untouched.RoastDate);

        Assert.Null((await Patch(c, bean.Id, new UpdateBeanRequest(Origin: ""))).Origin);
    }

    [Fact]
    public async Task A_bag_still_needs_a_name()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var bean = await Add(c, "Cata Reserva", null, null);
        var res = await c.PatchAsJsonAsync($"/api/v1/beans/{bean.Id}", new UpdateBeanRequest(Name: "   "));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Correcting_the_roaster_moves_the_bag_to_the_other_roaster()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var bean = await Add(c, "Cata Reserva", "Kolibri Cofee Roasters", null);
        var before = Assert.Single((await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters"))!);

        var edited = await Patch(c, bean.Id, new UpdateBeanRequest(Roaster: "Kolibri Coffee Roasters"));
        Assert.Equal("Kolibri Coffee Roasters", edited.Roaster);
        Assert.NotEqual(before.Id, edited.RoasterId);

        var after = Assert.Single((await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters"))!);
        Assert.Equal("Kolibri Coffee Roasters", after.Name);
    }

    [Fact]
    public async Task A_weight_added_later_starts_the_countdown()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var bean = await Add(c, "Cata Reserva", null, null);
        Assert.Null(bean.BrewsLeft);

        var edited = await Patch(c, bean.Id, new UpdateBeanRequest(WeightG: 250m));
        Assert.Equal(16, edited.BrewsLeft);
        Assert.Null((await Patch(c, bean.Id, new UpdateBeanRequest(ClearWeight: true))).BrewsLeft);
    }

    [Fact]
    public async Task Another_users_bag_does_not_exist()
    {
        using var f = new ApiFactory();
        var bean = await Add(f.ClientFor("sam@example.com"), "Cata Reserva", null, null);
        var res = await f.ClientFor("kim@example.com").PatchAsJsonAsync($"/api/v1/beans/{bean.Id}", new UpdateBeanRequest(Name: "Mine now"));
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    private static async Task<BeanResponse> Add(HttpClient c, string name, string? roaster, DateOnly? roastDate)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans",
            new CreateBeanRequest(name, roaster, "Huila, Colombia", "Washed", roastDate, null, null, null, null, null, null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task<BeanResponse> Patch(HttpClient c, Guid id, UpdateBeanRequest req)
    {
        var res = await c.PatchAsJsonAsync($"/api/v1/beans/{id}", req);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }
}

public class ProxyIdentityNameTests
{
    [Theory]
    [InlineData("112910105556369790904", null)]   // Google's subject claim, not a name
    [InlineData("sam@example.com", null)]
    [InlineData("2f1c9a0e-6b1d-4f6a-9f5e-1a2b3c4d5e6f", null)]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    [InlineData("  Sam Okafor ", "Sam Okafor")]
    [InlineData("sam", "sam")]
    public void An_identifier_is_never_a_display_name(string? raw, string? expected)
        => Assert.Equal(expected, ProxyIdentity.CleanDisplayName(raw));
}
