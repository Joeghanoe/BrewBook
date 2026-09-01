using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Brewbook.Api.Contracts;

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
    public async Task Only_the_latest_brew_can_be_undone()
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("ada@example.com");
        var bean = await CreateBean(c, "El Carmen");
        var b1 = await CreateBrew(c, bean.Id);
        var b2 = await CreateBrew(c, bean.Id);

        Assert.Equal(HttpStatusCode.Conflict, (await c.DeleteAsync($"/api/v1/brews/{b1.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/brews/{b2.Id}")).StatusCode);
        var b3 = await CreateBrew(c, bean.Id);
        Assert.Equal(2, b3.Number);
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

    private static async Task<BeanResponse> CreateBean(HttpClient c, string name)
    {
        var res = await c.PostAsJsonAsync("/api/v1/beans", new CreateBeanRequest(name, "Symple", "Huila, Colombia", "Washed", null, null, null, null, null, ["Blackberry"], null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BeanResponse>())!;
    }

    private static async Task<BrewResponse> CreateBrew(HttpClient c, Guid beanId, BrewParamsDto? p = null)
    {
        var res = await c.PostAsJsonAsync("/api/v1/brews", new CreateBrewRequest(beanId, p ?? Defaults, 150_000, [30_000]));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<BrewResponse>())!;
    }
}
