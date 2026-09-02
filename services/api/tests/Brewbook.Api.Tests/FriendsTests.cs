using System.Net;
using System.Net.Http.Json;
using Brewbook.Api.Contracts;

namespace Brewbook.Api.Tests;

/// <summary>
/// The friendship rules from §5 and §12: a link is the only way in, both sides accept, and until
/// they do the invitee sees the invitation and nothing else.
/// </summary>
public class FriendsTests
{
    [Fact]
    public async Task A_link_makes_a_friendship_only_once_it_is_accepted()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");

        var invite = (await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest(null))).Invite;

        // Before acceptance: nobody is on anybody's map.
        Assert.Empty((await Get<FriendsResponse>(sam, "/api/v1/friends")).Friends);
        Assert.Empty((await Get<FriendsResponse>(jo, "/api/v1/friends")).Friends);

        var accepted = await jo.PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

        // Friendship is mutual: both sides carry it, with no following and no one-way view.
        Assert.Equal("jo", Assert.Single((await Get<FriendsResponse>(sam, "/api/v1/friends")).Friends).Name);
        Assert.Equal("sam", Assert.Single((await Get<FriendsResponse>(jo, "/api/v1/friends")).Friends).Name);
    }

    [Fact]
    public async Task An_invitation_can_be_read_before_it_is_accepted_and_nothing_else_can()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");
        await Bean(sam, "El Carmen", "Symple");
        await Rated(sam, "El Carmen", 5);

        var invite = (await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest(null))).Invite;

        var preview = await Get<FriendInviteDto>(jo, $"/api/v1/friends/invites/{invite.Token}");
        Assert.Equal("sam", preview.FromName);

        // No roasters, no recipes, no preview of the log.
        Assert.Empty(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=both"));
    }

    [Fact]
    public async Task An_invitation_is_used_once()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var invite = (await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest(null))).Invite;

        Assert.Equal(HttpStatusCode.OK, (await f.ClientFor("jo@example.com").PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Gone, (await f.ClientFor("kim@example.com").PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task An_addressed_invitation_only_opens_for_that_address()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var invite = (await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest("jo@example.com"))).Invite;

        Assert.Equal(HttpStatusCode.Forbidden, (await f.ClientFor("kim@example.com").PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.ClientFor("jo@example.com").PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task An_addressed_invitation_is_waiting_for_the_person_it_names()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest("JO@example.com"));

        var jo = await Get<FriendsResponse>(f.ClientFor("jo@example.com"), "/api/v1/friends");
        Assert.Equal("sam", Assert.Single(jo.Received).FromName);
        Assert.Single((await Get<FriendsResponse>(sam, "/api/v1/friends")).Sent);
    }

    [Fact]
    public async Task You_cannot_accept_your_own_invitation()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var invite = (await Post<CreatedInviteResponse>(sam, "/api/v1/friends/invites", new CreateFriendInviteRequest(null))).Invite;
        Assert.Equal(HttpStatusCode.Conflict, (await sam.PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).StatusCode);
    }

    [Fact]
    public async Task A_friends_roaster_lands_on_the_map_with_their_rating_beside_the_users_own()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");
        await Befriend(f, sam, jo);

        await Bean(sam, "El Carmen", "Symple");
        await Rated(sam, "El Carmen", 5);
        await Bean(jo, "Kieni", "Symple");
        await Rated(jo, "Kieni", 3);

        var mine = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters"));
        Assert.Equal(3.0, mine.AvgRating);
        Assert.True(mine.Mine);
        Assert.Single(mine.Voices);

        var both = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=both"));
        Assert.Equal(2, both.Voices.Count);
        // Never averaged into one score: each person keeps their own, and their own name.
        Assert.Equal([3.0, 5.0], both.Voices.Select(v => v.AvgRating).Order());
        Assert.Equal("jo", both.Voices[0].Name);
        Assert.True(both.Voices[0].IsMe);
        Assert.Contains(both.Voices, v => !v.IsMe && v.Name == "sam" && v.Initials == "S");

        var theirs = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=friends"));
        Assert.False(theirs.Mine);
        Assert.Equal("sam", Assert.Single(theirs.Voices).Name);
    }

    [Fact]
    public async Task A_friend_shares_what_they_rated_and_nothing_else()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");
        await Befriend(f, sam, jo);

        await Bean(sam, "El Carmen", "Symple");
        var unrated = await Brew(sam, "El Carmen");
        var rated = await Rated(sam, "El Carmen", 4);
        var withdrawn = await Rated(sam, "El Carmen", 5);
        await sam.PatchAsJsonAsync($"/api/v1/brews/{withdrawn.Id}/privacy", new SetBrewPrivacyRequest(true));

        var roaster = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=friends"));
        var recipes = await Get<List<SharedBrewDto>>(jo, $"/api/v1/roasters/{roaster.Id}/recipes?userId={Assert.Single(roaster.Voices).UserId}");

        var shared = Assert.Single(recipes);
        Assert.Equal(rated.Number, shared.Number);
        Assert.Equal("El Carmen", shared.BeanName);
        Assert.Equal(4, shared.Rating);
        Assert.DoesNotContain(recipes, r => r.Number == unrated.Number || r.Number == withdrawn.Number);
        // The rating on the pin follows: only what they stood behind counts.
        Assert.Equal(4.0, Assert.Single(roaster.Voices).AvgRating);
    }

    [Fact]
    public async Task A_stranger_reads_nothing()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var kim = f.ClientFor("kim@example.com");
        await Bean(sam, "El Carmen", "Symple");
        await Rated(sam, "El Carmen", 5);

        var mySam = Assert.Single(await Get<List<RoasterResponse>>(sam, "/api/v1/roasters"));
        Assert.Empty(await Get<List<RoasterResponse>>(kim, "/api/v1/roasters?scope=both"));
        var res = await kim.GetAsync($"/api/v1/roasters/{mySam.Id}/recipes?userId={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Rated_brews_are_shared_by_default_and_the_default_can_be_flipped()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        await Bean(sam, "El Carmen", "Symple");
        Assert.False((await Rated(sam, "El Carmen", 4)).IsPrivate);

        var me = await Patch<MeResponse>(sam, "/api/v1/me", new UpdateMeRequest(ShareRatedByDefault: false));
        Assert.False(me.ShareRatedByDefault);
        Assert.True((await Rated(sam, "El Carmen", 4)).IsPrivate);
    }

    [Fact]
    public async Task A_wished_roaster_sits_on_the_map_and_a_bag_from_it_clears_the_pin()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");
        await Befriend(f, sam, jo);
        await Bean(sam, "El Carmen", "Symple");
        await Rated(sam, "El Carmen", 5);

        var theirs = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=friends"));
        Assert.Equal(HttpStatusCode.NoContent, (await jo.PutAsync($"/api/v1/roasters/{theirs.Id}/wish", null)).StatusCode);

        // Wanting a roaster puts it on the user's own map without adding anything to the library (§5).
        var wished = Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters"));
        Assert.True(wished.Wished);
        Assert.False(wished.Mine);
        Assert.Empty(await Get<List<BeanResponse>>(jo, "/api/v1/beans"));

        await Bean(jo, "Kieni", "Symple");
        Assert.False(Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters")).Wished);
    }

    [Fact]
    public async Task The_palate_filter_reaches_across_friends()
    {
        using var f = ApiFactory.WithFriends();
        var sam = f.ClientFor("sam@example.com");
        var jo = f.ClientFor("jo@example.com");
        await Befriend(f, sam, jo);
        await Bean(sam, "El Carmen", "Symple");
        var brew = await Rated(sam, "El Carmen", 5);
        await sam.PutAsJsonAsync($"/api/v1/brews/{brew.Id}/tags", new TagBrewRequest([new FlavourTagDto("Blackberry", 1)]));

        Assert.Single(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=both&flavours=Blackberry"));
        Assert.Empty(await Get<List<RoasterResponse>>(jo, "/api/v1/roasters?scope=both&flavours=Jasmine"));
    }

    // --- helpers ---------------------------------------------------------

    private static async Task Befriend(ApiFactory f, HttpClient a, HttpClient b)
    {
        var invite = (await Post<CreatedInviteResponse>(a, "/api/v1/friends/invites", new CreateFriendInviteRequest(null))).Invite;
        (await b.PostAsync($"/api/v1/friends/invites/{invite.Token}/accept", null)).EnsureSuccessStatusCode();
    }

    private static Task<BeanResponse> Bean(HttpClient c, string name, string roaster) =>
        Post<BeanResponse>(c, "/api/v1/beans", new CreateBeanRequest(name, roaster, null, null, null, null, null, null, null, null, 250m, null));

    private static async Task<BrewResponse> Brew(HttpClient c, string beanName)
    {
        var bean = (await Get<List<BeanResponse>>(c, "/api/v1/beans")).Single(b => b.Name == beanName);
        return await Post<BrewResponse>(c, "/api/v1/brews", new CreateBrewRequest(bean.Id, new BrewParamsDto(4.5m, 15m, 250m, 94m, 2), 150_000, null));
    }

    private static async Task<BrewResponse> Rated(HttpClient c, string beanName, int stars)
    {
        var brew = await Brew(c, beanName);
        return await Patch<BrewResponse>(c, $"/api/v1/brews/{brew.Id}/rating", new RateBrewRequest(stars, null));
    }

    private static async Task<T> Get<T>(HttpClient c, string url)
    {
        var res = await c.GetAsync(url);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>())!;
    }

    private static async Task<T> Post<T>(HttpClient c, string url, object body)
    {
        var res = await c.PostAsJsonAsync(url, body);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>())!;
    }

    private static async Task<T> Patch<T>(HttpClient c, string url, object body)
    {
        var res = await c.PatchAsJsonAsync(url, body);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>())!;
    }
}
