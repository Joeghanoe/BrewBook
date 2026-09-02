using System.Net;
using System.Net.Http.Json;
using Brewbook.Api.Contracts;

namespace Brewbook.Api.Tests;

/// <summary>
/// Friends, invitations and shared recipes are one capability behind one switch, off unless a
/// deployment asks for it. Off means the routes are not there — not that they answer politely.
/// </summary>
public class FeatureToggleTests
{
    [Fact]
    public async Task Friends_are_off_unless_a_deployment_turns_them_on()
    {
        using var f = new ApiFactory();
        var me = await f.ClientFor("sam@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me");
        Assert.False(me!.Features.Friends);

        using var on = ApiFactory.WithFriends();
        Assert.True((await on.ClientFor("sam@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me"))!.Features.Friends);
    }

    [Theory]
    [InlineData("GET", "/api/v1/friends")]
    [InlineData("POST", "/api/v1/friends/invites")]
    [InlineData("GET", "/api/v1/friends/invites/anything")]
    [InlineData("POST", "/api/v1/friends/invites/anything/accept")]
    [InlineData("DELETE", "/api/v1/friends/invites/anything")]
    public async Task Every_friends_route_is_gone_while_the_capability_is_off(string method, string path)
    {
        using var f = new ApiFactory();
        var c = f.ClientFor("sam@example.com");
        var res = await c.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task The_map_stays_the_users_own_whatever_the_scope_asks_for()
    {
        using var f = new ApiFactory();
        var sam = f.ClientFor("sam@example.com");
        var bean = await Post<BeanResponse>(sam, "/api/v1/beans",
            new CreateBeanRequest("El Carmen", "Symple", null, null, null, null, null, null, null, null, 250m, null));
        await Post<BrewResponse>(sam, "/api/v1/brews", new CreateBrewRequest(bean.Id, new BrewParamsDto(4.5m, 15m, 250m, 94m, 2), 150_000, null));

        foreach (var scope in new[] { "mine", "friends", "both" })
        {
            var roasters = await sam.GetFromJsonAsync<List<RoasterResponse>>($"/api/v1/roasters?scope={scope}");
            var only = Assert.Single(roasters!);
            Assert.True(only.Mine);
            Assert.True(Assert.Single(only.Voices).IsMe);
        }
    }

    [Fact]
    public async Task Recipes_are_unreadable_while_the_capability_is_off()
    {
        using var f = new ApiFactory();
        var res = await f.ClientFor("sam@example.com").GetAsync($"/api/v1/roasters/{Guid.NewGuid()}/recipes?userId={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    private static async Task<T> Post<T>(HttpClient c, string url, object body)
    {
        var res = await c.PostAsJsonAsync(url, body);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>())!;
    }
}
