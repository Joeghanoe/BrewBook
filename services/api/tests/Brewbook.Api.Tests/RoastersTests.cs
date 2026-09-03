using System.Net;
using System.Net.Http.Json;
using Brewbook.Api.Contracts;
using Brewbook.Api.Data;
using Brewbook.Api.Domain;
using Brewbook.Api.Features.Roasters;
using Brewbook.Api.Integrations.GooglePlaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Brewbook.Api.Tests;

public class RoasterNameTests
{
    [Theory]
    [InlineData("Symple", "symple")]
    [InlineData("  Symple  Coffee\tRoasters ", "symple coffee roasters")]
    [InlineData("TIM WENDELBOE", "tim wendelboe")]
    [InlineData("Café Ünïon", "café ünïon")]
    public void Normalises_case_and_whitespace(string raw, string expected) => Assert.Equal(expected, RoasterName.Normalise(raw));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \t ")]
    public void Empty_text_is_no_roaster(string? raw)
    {
        Assert.Null(RoasterName.Normalise(raw));
        Assert.Null(RoasterName.Display(raw));
    }

    [Fact]
    public void Display_keeps_case_but_collapses_spaces() => Assert.Equal("Symple Coffee", RoasterName.Display("  Symple   Coffee "));
}

public class GooglePlacesLocatorTests
{
    [Theory]
    [InlineData("NL", "NL")]
    [InlineData(" nl ", "NL")]
    [InlineData("Netherlands", null)]   // a country name is not a CLDR region
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Only_a_two_letter_region_is_sent_as_one(string? raw, string? expected)
        => Assert.Equal(expected, GooglePlacesLocator.Region(raw));

    [Fact]
    public void Query_steers_towards_roasters_and_appends_the_hint()
    {
        // The roaster's name and nothing else. Where the beans grew says nothing about where
        // they were roasted, and a bean's origin used to drag every search to the growing country.
        Assert.Equal("Symple coffee roaster", GooglePlacesLocator.BuildQuery("Symple"));
        Assert.Equal("Tim Wendelboe coffee roaster", GooglePlacesLocator.BuildQuery(" Tim Wendelboe "));
        Assert.Equal("Square Mile Coffee Roasters", GooglePlacesLocator.BuildQuery("Square Mile Coffee Roasters"));
    }

    [Fact]
    public void Maps_the_first_place_and_nothing_else()
    {
        var res = new GooglePlacesLocator.Response([
            new("ChIJ1", new("Symple Coffee", "en"), "Carrera 7, Bogotá", new(4.65, -74.05), "https://symple.co"),
            new("ChIJ2", new("Other", "en"), null, new(0, 0), null),
        ]);
        var r = GooglePlacesLocator.Map(res);
        Assert.Equal(LocateStatus.Located, r.Status);
        Assert.Equal("ChIJ1", r.Place!.PlaceId);
        Assert.Equal("Symple Coffee", r.Place.DisplayName);
        Assert.Equal(4.65, r.Place.Lat);
        Assert.Equal("https://symple.co", r.Place.Website);
    }

    [Fact]
    public void Search_sorts_candidates_by_distance_from_the_drinker()
    {
        // Two "Symple"s: one in Amsterdam, one in Bogotá. Standing in Utrecht, Amsterdam comes first whatever Places ranked.
        var res = new GooglePlacesLocator.Response([
            new("bog", new("Symple Coffee", "en"), "Carrera 7, Bogotá", new(4.65, -74.05), null),
            new("ams", new("Symple Roasters", "en"), "Amsterdam", new(52.37, 4.90), null),
            new("skip", new("No location", null), null, null, null),
        ]);
        var r = GooglePlacesLocator.MapMany(res, 52.09, 5.12);
        Assert.Equal(LocateStatus.Located, r.Status);
        Assert.Equal(["ams", "bog"], r.Candidates.Select(c => c.PlaceId));
        Assert.InRange(r.Candidates[0].DistanceKm!.Value, 30, 40);
        Assert.True(r.Candidates[1].DistanceKm > 8000);
    }

    [Fact]
    public void Search_without_a_position_keeps_the_providers_order_and_no_distances()
    {
        var res = new GooglePlacesLocator.Response([
            new("bog", new("Symple Coffee", "en"), null, new(4.65, -74.05), null),
            new("ams", new("Symple Roasters", "en"), null, new(52.37, 4.90), null),
        ]);
        var r = GooglePlacesLocator.MapMany(res, null, null);
        Assert.Equal(["bog", "ams"], r.Candidates.Select(c => c.PlaceId));
        Assert.All(r.Candidates, c => Assert.Null(c.DistanceKm));
        Assert.Equal(LocateStatus.NotFound, GooglePlacesLocator.MapMany(new GooglePlacesLocator.Response([]), null, null).Status);
    }

    [Fact]
    public void No_places_is_not_found_never_a_fake_location()
    {
        Assert.Equal(LocateStatus.NotFound, GooglePlacesLocator.Map(new GooglePlacesLocator.Response([])).Status);
        Assert.Equal(LocateStatus.NotFound, GooglePlacesLocator.Map(null).Status);
        Assert.Equal(LocateStatus.NotFound, GooglePlacesLocator.Map(new GooglePlacesLocator.Response([new("x", new("No location", null), null, null, null)])).Status);
    }
}

public class RoasterLinkerTests
{
    private static readonly TimeProvider Clock = TimeProvider.System;

    [Fact]
    public async Task Unavailable_provider_leaves_the_row_untouched()
    {
        var row = new Roaster { Id = Guid.NewGuid(), Name = "Symple", NormalisedName = "symple" };
        var changed = await RoasterLinker.ResolveAsync(row, "Symple", new UnconfiguredRoasterLocator(), Clock, CancellationToken.None);
        Assert.False(changed);
        Assert.Null(row.ResolvedAt);
        Assert.False(row.Located);
    }

    [Fact]
    public async Task Not_found_is_remembered_so_it_is_not_retried()
    {
        var row = new Roaster { Id = Guid.NewGuid(), Name = "Symple", NormalisedName = "symple" };
        var changed = await RoasterLinker.ResolveAsync(row, "Symple", new FakeLocator(LocateResult.NotFound), Clock, CancellationToken.None);
        Assert.True(changed);
        Assert.NotNull(row.ResolvedAt);
        Assert.False(row.Located);
    }

    [Fact]
    public async Task Located_fills_the_row()
    {
        var row = new Roaster { Id = Guid.NewGuid(), Name = "Symple", NormalisedName = "symple" };
        var place = new RoasterPlace("ChIJ1", "Symple Coffee", "Bogotá", 4.65, -74.05, null);
        await RoasterLinker.ResolveAsync(row, "Symple", new FakeLocator(new LocateResult(LocateStatus.Located, place)), Clock, CancellationToken.None);
        Assert.True(row.Located);
        Assert.Equal("ChIJ1", row.GooglePlaceId);
        Assert.Equal("Bogotá", row.FormattedAddress);
        Assert.Equal(4.65, row.Lat);
        Assert.Equal(-74.05, row.Lng);
    }
}

public class RoastersApiTests
{
    private static readonly BrewParamsDto Defaults = new(4.5m, 15.0m, 250m, 94m, 2);

    [Fact]
    public async Task Bags_link_to_one_shared_roaster_by_normalised_name()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");

        var a = await CreateBean(ada, "El Carmen", "Symple");
        var b = await CreateBean(ada, "La Palma", "  symple  ");
        var c = await CreateBean(bob, "Kiiro", "SYMPLE");
        var d = await CreateBean(ada, "Nano", "Tim Wendelboe");
        var e = await CreateBean(ada, "Blank", "   ");

        Assert.NotNull(a.RoasterId);
        Assert.Equal(a.RoasterId, b.RoasterId);
        Assert.Equal(a.RoasterId, c.RoasterId);
        Assert.NotEqual(a.RoasterId, d.RoasterId);
        Assert.Null(e.RoasterId);
        Assert.Null(e.Roaster);
        Assert.Equal("symple", b.Roaster);
    }

    [Fact]
    public async Task Startup_backfill_links_existing_bags_once()
    {
        using var f = new ApiFactory();
        var user = new User { Id = Guid.NewGuid(), Email = "old@example.com", CreatedAt = DateTimeOffset.UtcNow };
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BrewbookDbContext>();
            db.Users.Add(user);
            db.Beans.Add(new Bean { Id = Guid.NewGuid(), UserId = user.Id, Name = "Old bag", Roaster = "Symple", CreatedAt = DateTimeOffset.UtcNow });
            db.Beans.Add(new Bean { Id = Guid.NewGuid(), UserId = user.Id, Name = "Older bag", Roaster = "symple ", CreatedAt = DateTimeOffset.UtcNow });
            db.Beans.Add(new Bean { Id = Guid.NewGuid(), UserId = user.Id, Name = "No roaster", CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BrewbookDbContext>();
            Assert.Equal(2, await RoasterLinker.BackfillAsync(db, TimeProvider.System, CancellationToken.None));
        }
        using (var scope = f.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BrewbookDbContext>();
            Assert.Equal(0, await RoasterLinker.BackfillAsync(db, TimeProvider.System, CancellationToken.None));
            Assert.Single(db.Roasters);
        }

        var beans = await f.ClientFor("old@example.com").GetFromJsonAsync<List<BeanResponse>>("/api/v1/beans");
        Assert.NotNull(beans);
        Assert.Equal(2, beans.Count(b => b.RoasterId is not null));
        Assert.Single(beans, b => b.RoasterId is null);
    }

    [Fact]
    public async Task Roasters_aggregate_the_users_own_bags_brews_and_tags()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");

        var s1 = await CreateBean(ada, "El Carmen", "Symple");
        var s2 = await CreateBean(ada, "La Palma", "Symple");
        var t1 = await CreateBean(ada, "Nano", "Tim Wendelboe");
        await CreateBean(ada, "Unnamed", null);

        await RateAndTag(ada, s1.Id, 5, [("Peach", 1), ("Jasmine", 1)]);
        await RateAndTag(ada, s1.Id, 4, [("Peach", 1), ("Smoky", -1)]);
        await RateAndTag(ada, s2.Id, 0, [("Honey", 1)]);
        await RateAndTag(ada, t1.Id, 3, [("Dark chocolate", 1), ("Peach", -1)]);

        // Bob logs the same roaster; his ratings must not leak into Ada's view.
        var bobBag = await CreateBean(bob, "Kiiro", "symple");
        await RateAndTag(bob, bobBag.Id, 1, [("Ashy", 1)]);

        var list = await ada.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters");
        Assert.Equal(2, list!.Count);

        var symple = list.Single(r => r.Name == "Symple");
        Assert.Equal(2, symple.Bags);
        Assert.Equal(3, symple.Brews);
        Assert.Equal(4.5, symple.AvgRating);
        Assert.Equal(["Peach", "Honey", "Jasmine"], symple.TopFlavours);
        Assert.Equal(["Smoky"], symple.DislikedFlavours);
        Assert.Null(symple.MatchCount);
        Assert.False(symple.Located);
        Assert.Null(symple.Lat);

        var tim = list.Single(r => r.Name == "Tim Wendelboe");
        Assert.Equal(3, tim.AvgRating);
        Assert.Equal(["Dark chocolate"], tim.TopFlavours);
        Assert.Equal(["Peach"], tim.DislikedFlavours);

        // Highest rated first when nothing is filtered.
        Assert.Equal("Symple", list[0].Name);

        var bobs = await bob.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters");
        var bobsSymple = Assert.Single(bobs!);
        Assert.Equal(symple.Id, bobsSymple.Id);
        Assert.Equal(1, bobsSymple.AvgRating);
        Assert.Equal(["Ashy"], bobsSymple.TopFlavours);
    }

    [Fact]
    public async Task Flavour_filter_keeps_roasters_whose_liked_flavours_match_and_counts_the_matches()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var s = await CreateBean(c, "El Carmen", "Symple");
        var t = await CreateBean(c, "Nano", "Tim Wendelboe");
        var u = await CreateBean(c, "Aricha", "Unfiltered Roasters");
        await RateAndTag(c, s.Id, 5, [("Peach", 1), ("Jasmine", 1)]);
        await RateAndTag(c, t.Id, 4, [("Jasmine", 1), ("Peach", -1)]);
        await RateAndTag(c, u.Id, 5, [("Ashy", 1)]);

        var list = await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters?flavours=peach,Jasmine");
        Assert.NotNull(list);
        Assert.Equal(["Symple", "Tim Wendelboe"], list.Select(r => r.Name));
        Assert.Equal(2, list[0].MatchCount);
        Assert.Equal(1, list[1].MatchCount);

        var none = await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters?flavours=Rose");
        Assert.Empty(none!);

        var unfiltered = await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters?flavours=");
        Assert.Equal(3, unfiltered!.Count);
    }

    [Fact]
    public async Task Without_a_server_key_roasters_stay_unlocated_and_relocate_says_so()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen", "Symple");

        var list = await c.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters");
        var r = Assert.Single(list!);
        Assert.False(r.Located);
        Assert.Null(r.Address);

        var res = await c.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/relocate", new RelocateRoasterRequest("Symple Bogotá"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);

        var cfg = await c.GetFromJsonAsync<ConfigResponse>("/api/v1/config");
        Assert.Null(cfg!.MapsBrowserKey);
    }

    [Fact]
    public async Task Config_hands_the_browser_key_to_the_client()
    {
        using var f = new ApiFactory(s => s.Configure<GoogleMapsOptions>(o => o.BrowserKey = "browser-key"));
        var cfg = await f.ClientFor("ada@example.com").GetFromJsonAsync<ConfigResponse>("/api/v1/config");
        Assert.Equal("browser-key", cfg!.MapsBrowserKey);
    }

    [Fact]
    public async Task With_a_locator_the_list_resolves_lazily_once_and_relocate_moves_the_pin()
    {
        var locator = new FakeLocator(new LocateResult(LocateStatus.Located, new RoasterPlace("ChIJ1", "Symple Coffee", "Bogotá, Colombia", 4.65, -74.05, "https://symple.co")));
        using var f = new ApiFactory(s => s.Replace(ServiceDescriptor.Singleton<IRoasterLocator>(locator)));
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");
        var bean = await CreateBean(ada, "El Carmen", "Symple");

        var first = Assert.Single((await ada.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters"))!);
        Assert.True(first.Located);
        Assert.Equal("Bogotá, Colombia", first.Address);
        Assert.Equal(4.65, first.Lat);
        Assert.Equal("https://symple.co", first.Website);
        // Asked by name and nothing else: the bag's origin is where the coffee grew, not where
        // it was roasted, and it used to drag the search to the growing country.
        Assert.Equal("Symple", Assert.Single(locator.Queries));

        // Second list call: the answer is on the row, the locator is not asked again.
        await ada.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters");
        Assert.Single(locator.Queries);

        locator.Next = new LocateResult(LocateStatus.Located, new RoasterPlace("ChIJ2", "Symple Roastery", "Medellín, Colombia", 6.25, -75.56, null));
        var movedRes = await ada.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/relocate", new RelocateRoasterRequest("Symple roastery Medellín"));
        movedRes.EnsureSuccessStatusCode();
        var moved = (await movedRes.Content.ReadFromJsonAsync<RoasterResponse>())!;
        Assert.Equal("Medellín, Colombia", moved.Address);
        Assert.Equal(6.25, moved.Lat);
        Assert.Equal("Symple roastery Medellín", locator.Queries.Last());

        // Bob never logged this roaster: to him it does not exist.
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/relocate", new RelocateRoasterRequest(null))).StatusCode);
    }

    [Fact]
    public async Task Unconfigured_search_says_so_instead_of_guessing()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var r = await c.GetFromJsonAsync<RoasterSearchResponse>("/api/v1/roasters/search?q=Symple");
        Assert.False(r!.Available);
        Assert.Empty(r.Candidates);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/roasters/search?q=")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/roasters/search?q=Symple&lat=52")).StatusCode);
    }

    [Fact]
    public async Task Search_hands_the_position_to_the_locator_and_returns_its_candidates()
    {
        var locator = new FakeLocator(LocateResult.NotFound)
        {
            NextSearch = new SearchResult(LocateStatus.Located, [
                new RoasterCandidate("ams", "Symple Roasters", "Amsterdam", 52.37, 4.90, "https://symple.nl", 34.26),
                new RoasterCandidate("bog", "Symple Coffee", "Bogotá", 4.65, -74.05, null, 9012.4),
            ]),
        };
        using var f = new ApiFactory(s => s.Replace(ServiceDescriptor.Singleton<IRoasterLocator>(locator)));
        var c = f.ClientFor("ada@example.com");
        var r = await c.GetFromJsonAsync<RoasterSearchResponse>("/api/v1/roasters/search?q=Symple&lat=52.09&lng=5.12");
        Assert.True(r!.Available);
        Assert.Equal(["ams", "bog"], r.Candidates.Select(x => x.PlaceId));
        Assert.Equal(34.3, r.Candidates[0].DistanceKm);
        Assert.Equal(("Symple", 52.09, 5.12), Assert.Single(locator.Searches));
    }

    [Fact]
    public async Task Placing_a_roaster_pins_it_and_the_list_does_not_look_it_up_again()
    {
        var locator = new FakeLocator(new LocateResult(LocateStatus.Located, new RoasterPlace("wrong", "Symple Coffee", "Bogotá", 4.65, -74.05, null)));
        using var f = new ApiFactory(s => s.Replace(ServiceDescriptor.Singleton<IRoasterLocator>(locator)));
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");

        var bean = await CreateBean(ada, "El Carmen", "Symple");
        Assert.False(bean.RoasterResolved);
        Assert.False(bean.RoasterLocated);

        var res = await ada.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/place", new PlaceRoasterRequest("ams", "Symple Roasters", "Amsterdam", 52.37, 4.90, "https://symple.nl"));
        res.EnsureSuccessStatusCode();
        var placed = (await res.Content.ReadFromJsonAsync<RoasterResponse>())!;
        Assert.True(placed.Located);
        Assert.Equal("Amsterdam", placed.Address);
        Assert.Equal(52.37, placed.Lat);
        Assert.Equal("https://symple.nl", placed.Website);

        // The user's answer holds: the list call finds the row resolved and never asks the locator.
        var listed = Assert.Single((await ada.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters"))!);
        Assert.Equal("Amsterdam", listed.Address);
        Assert.Empty(locator.Queries);

        var again = (await ada.GetFromJsonAsync<List<BeanResponse>>("/api/v1/beans"))!.Single();
        Assert.True(again.RoasterResolved);
        Assert.True(again.RoasterLocated);

        // Someone who never logged this roaster cannot move it.
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/place", new PlaceRoasterRequest(null, null, null, null, null, null))).StatusCode);
        // A place needs a position.
        Assert.Equal(HttpStatusCode.BadRequest, (await ada.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/place", new PlaceRoasterRequest("x", "X", null, null, null, null))).StatusCode);
    }

    [Fact]
    public async Task None_of_these_leaves_the_roaster_off_the_map_on_purpose()
    {
        var locator = new FakeLocator(new LocateResult(LocateStatus.Located, new RoasterPlace("wrong", "Symple Coffee", "Bogotá", 4.65, -74.05, null)));
        using var f = new ApiFactory(s => s.Replace(ServiceDescriptor.Singleton<IRoasterLocator>(locator)));
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "El Carmen", "Symple");

        var res = await ada.PostAsJsonAsync($"/api/v1/roasters/{bean.RoasterId}/place", new PlaceRoasterRequest(null, null, null, null, null, null));
        res.EnsureSuccessStatusCode();
        var placed = (await res.Content.ReadFromJsonAsync<RoasterResponse>())!;
        Assert.False(placed.Located);

        var listed = Assert.Single((await ada.GetFromJsonAsync<List<RoasterResponse>>("/api/v1/roasters"))!);
        Assert.False(listed.Located);
        Assert.Empty(locator.Queries);

        var again = (await ada.GetFromJsonAsync<List<BeanResponse>>("/api/v1/beans"))!.Single();
        Assert.True(again.RoasterResolved);
        Assert.False(again.RoasterLocated);
    }

    private static async Task<BeanResponse> CreateBean(HttpClient c, string name, string? roaster)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans", new CreateBeanRequest(name, roaster, "Huila, Colombia", "Washed", null, null, null, null, null, null, null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task RateAndTag(HttpClient c, Guid beanId, int rating, (string flavour, int polarity)[] tags)
    {
        var res = await c.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(beanId, Defaults, 150_000, null));
        res.EnsureSuccessStatusCode();
        var brew = (await res.Content.ReadFromJsonAsync<BrewResponse>())!;
        if (rating > 0) (await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}/rating", new RateBrewRequest(rating, null))).EnsureSuccessStatusCode();
        (await c.PutAsJsonAsync($"/api/v1/brews/{brew.Id}/tags", new TagBrewRequest(tags.Select(t => new FlavourTagDto(t.flavour, t.polarity)).ToList()))).EnsureSuccessStatusCode();
    }
}

/// <summary>A configured locator with a scripted answer; records what it was asked.</summary>
file sealed class FakeLocator(LocateResult next) : IRoasterLocator
{
    public LocateResult Next { get; set; } = next;
    public SearchResult NextSearch { get; set; } = new(LocateStatus.NotFound, []);
    public List<string> Queries { get; } = [];
    public List<(string Query, double? Lat, double? Lng)> Searches { get; } = [];
    public bool Configured => true;

    public Task<LocateResult> LocateAsync(string query, CancellationToken ct)
    {
        Queries.Add(query);
        return Task.FromResult(Next);
    }

    public Task<SearchResult> SearchAsync(string query, double? lat, double? lng, int pageSize, CancellationToken ct)
    {
        Searches.Add((query, lat, lng));
        return Task.FromResult(NextSearch);
    }
}
