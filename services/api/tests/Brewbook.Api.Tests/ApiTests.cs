using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Brewbook.Api.Contracts;
using Brewbook.Api.Domain;

namespace Brewbook.Api.Tests;

public class ApiTests
{
    private static readonly BrewParamsDto Defaults = new(4.5m, 15.0m, 250m, 94m, 2);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) } };

    [Fact]
    public async Task Requests_without_proxy_identity_are_rejected()
    {
        using var f = new ApiFactory();
        var anon = f.CreateClient();
        var res = await anon.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Health_does_not_need_identity()
    {
        using var f = new ApiFactory();
        var res = await f.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task First_request_provisions_the_user_by_email()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("Ada@Example.com");
        var me = await c.GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.NotNull(me);
        Assert.Equal("ada@example.com", me.Email);
        var again = await c.GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.Equal(me.Id, again!.Id);
    }

    [Fact]
    public async Task Brew_numbers_are_a_per_user_sequence()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");
        var adaBean = await CreateBean(ada, "El Carmen");
        var bobBean = await CreateBean(bob, "Kiiro");

        var a1 = await CreateBrew(ada, adaBean.Id);
        var a2 = await CreateBrew(ada, adaBean.Id);
        var b1 = await CreateBrew(bob, bobBean.Id);

        Assert.Equal(1, a1.Number);
        Assert.Equal(2, a2.Number);
        Assert.Equal(1, b1.Number);
    }

    [Fact]
    public async Task Users_cannot_see_or_brew_each_others_beans()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bob = f.ClientFor("bob@example.com");
        var adaBean = await CreateBean(ada, "El Carmen");

        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/v1/beans/{adaBean.Id}")).StatusCode);
        var res = await bob.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(adaBean.Id, Defaults, 150_000, null));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Empty((await bob.GetFromJsonAsync<List<BeanResponse>>("/api/v1/beans"))!);
    }

    [Fact]
    public async Task Bean_reports_last_brew_params_as_the_next_baseline()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        Assert.Equal(Defaults, bean.LastParams);
        Assert.Equal(0, bean.BrewCount);

        await CreateBrew(c, bean.Id, Defaults with { TempC = 93 });
        var after = await c.GetFromJsonAsync<BeanResponse>($"/api/v1/beans/{bean.Id}");
        Assert.Equal(93, after!.LastParams.TempC);
        Assert.Equal(1, after.BrewCount);
    }

    [Fact]
    public async Task Rating_defects_and_tags_attach_to_a_brew()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        var brew = await CreateBrew(c, bean.Id);

        var rated = await (await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}/rating", new RateBrewRequest(4, ["Sour"]))).Content.ReadFromJsonAsync<BrewResponse>();
        Assert.Equal(4, rated!.Rating);
        Assert.Equal(["Sour"], rated.Defects);

        var bad = await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}/rating", new RateBrewRequest(6, null));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var tagged = await (await c.PutAsJsonAsync($"/api/v1/brews/{brew.Id}/tags",
            new TagBrewRequest([new("Blackberry", 1), new("Peach", 1), new("Smoky", -1)]))).Content.ReadFromJsonAsync<BrewResponse>();
        Assert.Equal(3, tagged!.FlavourTags.Count);
        Assert.Contains(tagged.FlavourTags, t => t.Flavour == "Smoky" && t.Polarity == -1);

        var replaced = await (await c.PutAsJsonAsync($"/api/v1/brews/{brew.Id}/tags", new TagBrewRequest([new("Peach", 1)]))).Content.ReadFromJsonAsync<BrewResponse>();
        Assert.Single(replaced!.FlavourTags);
    }

    [Fact]
    public async Task Any_brew_can_be_deleted_and_the_number_gap_stays()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        var b1 = await CreateBrew(c, bean.Id);
        var b2 = await CreateBrew(c, bean.Id);

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/brews/{b1.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.DeleteAsync($"/api/v1/brews/{b1.Id}")).StatusCode);
        var b3 = await CreateBrew(c, bean.Id);
        Assert.Equal(3, b3.Number);
        var left = await c.GetFromJsonAsync<List<BrewResponse>>("/api/v1/brews", Json);
        Assert.Equal([3, 2], left!.Select(b => b.Number).ToArray());
        Assert.Equal(b2.Id, left![1].Id);

        var bob = f.ClientFor("bob@example.com");
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/api/v1/brews/{b2.Id}")).StatusCode);
    }

    [Fact]
    public async Task Editing_a_brew_updates_params_duration_and_brewed_at()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        var brew = await CreateBrew(c, bean.Id);
        var at = new DateTimeOffset(2026, 9, 1, 8, 2, 0, TimeSpan.Zero);

        var res = await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(
            DurationMs: 171_000,
            Params: Defaults with { TempC = 93m, Grind = 4.0m, Method = BrewMethod.Espresso, PreInfusionS = 8 },
            BrewedAt: at, Rating: 4, Defects: ["Bitter"]), Json);
        res.EnsureSuccessStatusCode();
        var edited = (await res.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal(171_000, edited.DurationMs);
        Assert.Equal(93m, edited.Params.TempC);
        Assert.Equal(BrewMethod.Espresso, edited.Params.Method);
        Assert.Equal(0, edited.Params.Blooms);
        Assert.Equal(8, edited.Params.PreInfusionS);
        Assert.Equal(at, edited.BrewedAt);
        Assert.Equal(4, edited.Rating);
        Assert.Equal(["Bitter"], edited.Defects);
        Assert.Equal(brew.Number, edited.Number);

        var future = await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(BrewedAt: DateTimeOffset.UtcNow.AddDays(2)), Json);
        Assert.Equal(HttpStatusCode.BadRequest, future.StatusCode);
        var badDefect = await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(Defects: ["Muddy"]), Json);
        Assert.Equal(HttpStatusCode.BadRequest, badDefect.StatusCode);

        var bob = f.ClientFor("bob@example.com");
        var other = await bob.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(Rating: 5), Json);
        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode);
    }

    [Fact]
    public async Task Rating_zero_unrates()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        var brew = await CreateBrew(c, bean.Id);
        var rated = (await (await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(Rating: 3), Json)).Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal(3, rated.Rating);
        var unrated = (await (await c.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(Rating: 0), Json)).Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal(0, unrated.Rating);
    }

    [Fact]
    public async Task Voice_parse_returns_the_delta()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var res = await (await c.PostAsJsonAsync("/api/v1/voice/parse", new VoiceParseRequest("same but 93 degrees", Defaults))).Content.ReadFromJsonAsync<VoiceParseResponse>();
        Assert.True(res!.Applied);
        Assert.Equal(93, res.Params.TempC);
    }

    [Fact]
    public async Task Me_reports_which_integrations_are_configured()
    {
        using var f = new ApiFactory();
        var me = await f.ClientFor("ada@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.False(me!.Features.LabelReading);
        Assert.False(me.Features.SpeechTranscription);
    }

    [Fact]
    public async Task Onboarding_is_stamped_once_per_user()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var fresh = await ada.GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.Null(fresh!.OnboardedAt);

        var stamped = await (await ada.PostAsync("/api/v1/me/onboarded", null)).Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(stamped!.OnboardedAt);
        var again = await ada.GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.Equal(stamped.OnboardedAt, again!.OnboardedAt);

        var second = await (await ada.PostAsync("/api/v1/me/onboarded", null)).Content.ReadFromJsonAsync<MeResponse>();
        Assert.Equal(stamped.OnboardedAt, second!.OnboardedAt);

        var bob = await f.ClientFor("bob@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.Null(bob!.OnboardedAt);
    }

    [Fact]
    public async Task Transcribe_without_a_provider_is_unavailable()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        using var form = new MultipartFormDataContent
        {
            { new ByteArrayContent([1, 2, 3]), "audio", "clip.webm" },
            { new StringContent("{\"grind\":4.5,\"doseG\":15,\"yieldG\":250,\"tempC\":94,\"blooms\":2}"), "current" },
        };
        var res = await c.PostAsync("/api/v1/voice/transcribe", form);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
    }

    [Fact]
    public async Task Label_scan_without_a_provider_is_honest_about_it()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        using var form = new MultipartFormDataContent { { new ByteArrayContent([1, 2, 3]), "image", "label.jpg" } };
        var res = await (await c.PostAsync("/api/v1/beans/scan", form)).Content.ReadFromJsonAsync<LabelScanResponse>(Json);
        Assert.False(res!.Extracted);
        Assert.NotNull(res.Reason);
        Assert.Equal(Provenance.Missing, res.RoastDate.Provenance);
    }

    [Fact]
    public async Task Espresso_brew_keeps_pre_infusion_and_has_no_blooms()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "Kiiro");
        var espresso = new BrewParamsDto(2.0m, 18m, 36m, 93m, 2, Method: BrewMethod.Espresso, PreInfusionS: 8, TargetMs: 28_000);
        var brew = await CreateBrew(ada, bean.Id, espresso);
        Assert.Equal(BrewMethod.Espresso, brew.Params.Method);
        Assert.Equal(0, brew.Params.Blooms);
        Assert.Equal(8, brew.Params.PreInfusionS);
        Assert.Equal(28_000, brew.Params.TargetMs);

        // The bag's ticket now carries the espresso numbers, method included.
        var beans = (await ada.GetFromJsonAsync<List<BeanResponse>>("/api/v1/beans", Json))!;
        Assert.Equal(brew.Params, beans.Single().LastParams);
    }

    [Fact]
    public async Task Filter_brew_drops_pre_infusion()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "Kiiro");
        var brew = await CreateBrew(ada, bean.Id, Defaults with { PreInfusionS = 8 });
        Assert.Equal(BrewMethod.Filter, brew.Params.Method);
        Assert.Null(brew.Params.PreInfusionS);
        Assert.Equal(150_000, brew.Params.TargetMs);
    }

    [Fact]
    public async Task Unknown_method_is_rejected()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "Kiiro");
        var res = await ada.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(bean.Id, Defaults with { Method = (BrewMethod)7 }, 150_000, null), Json);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Untimed_brew_is_logged_then_timed_afterwards()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "Kiiro");
        var res = await ada.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(bean.Id, Defaults, null, null), Json);
        res.EnsureSuccessStatusCode();
        var brew = (await res.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal(0, brew.DurationMs);

        var patched = await ada.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(161_000), Json);
        patched.EnsureSuccessStatusCode();
        var timed = (await patched.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal(161_000, timed.DurationMs);

        var tooLong = await ada.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(4_000_000), Json);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        var bob = f.ClientFor("bob@example.com");
        var other = await bob.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(1_000), Json);
        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode);
    }

    [Fact]
    public async Task Steps_round_trip_and_fill_pour_markers()
    {
        using var f = new ApiFactory();
        var ada = f.ClientFor("ada@example.com");
        var bean = await CreateBean(ada, "Kiiro");

        // Labelled steps arrive out of order and with a label that needs trimming; they come back sorted and clean.
        var res = await ada.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(bean.Id, Defaults, 150_000, null,
            [new(45_000, "second pour"), new(0, "  first bloom "), new(-5, "lost"), new(90_000, "")]), Json);
        res.EnsureSuccessStatusCode();
        var brew = (await res.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal([new(0, "first bloom"), new(45_000, "second pour"), new(90_000, "pour")], brew.Steps);
        Assert.Equal([0, 45_000, 90_000], brew.PourMarkersMs);

        // A read comes back from the JSON column with the same shape.
        var listed = (await ada.GetFromJsonAsync<List<BrewResponse>>("/api/v1/brews", Json))!.Single(b => b.Id == brew.Id);
        Assert.Equal(brew.Steps, listed.Steps);

        // Removing a step through the edit endpoint keeps the marker list in step.
        var patched = await ada.PatchAsJsonAsync($"/api/v1/brews/{brew.Id}", new UpdateBrewRequest(Steps: [new(0, "first bloom"), new(90_000, "pour")]), Json);
        patched.EnsureSuccessStatusCode();
        var edited = (await patched.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
        Assert.Equal([0, 90_000], edited.PourMarkersMs);
        Assert.Equal(2, edited.Steps.Count);

        // A client that only knows pourMarkersMs still gets steps, labelled as pours.
        var legacy = await CreateBrew(ada, bean.Id);
        Assert.Equal([new(30_000, "pour")], legacy.Steps);

        var tooLate = await ada.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(bean.Id, Defaults, 150_000, null, [new(4_000_000, "pour")]), Json);
        Assert.Equal(HttpStatusCode.BadRequest, tooLate.StatusCode);
    }

    private static async Task<BeanResponse> CreateBean(HttpClient c, string name)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans", new CreateBeanRequest(name, "Symple", "Huila, Colombia", "Washed", null, null, null, null, null, ["Blackberry"], null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task<BrewResponse> CreateBrew(HttpClient c, Guid beanId, BrewParamsDto? p = null)
    {
        var res = await c.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(beanId, p ?? Defaults, 150_000, [30_000]), Json);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BrewResponse>(Json))!;
    }
}
