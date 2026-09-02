using System.Net;
using System.Net.Http.Json;
using Brewbook.Api.Contracts;
using Brewbook.Api.Features.Friends;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Brewbook.Api.Tests;

public class InviteMailTests
{
    [Fact]
    public void The_link_carries_the_token_and_survives_a_trailing_slash()
    {
        Assert.Equal("https://brewbook.app/?invite=abc-123", InviteMail.Url("https://brewbook.app/", "abc-123"));
        Assert.Equal("https://brewbook.app/?invite=a%2Fb", InviteMail.Url("https://brewbook.app", "a/b"));
    }

    [Fact]
    public void The_message_names_the_sender_and_nothing_else_about_them()
    {
        var url = InviteMail.Url("https://brewbook.app", "tok");
        var text = InviteMail.Text("Sam Okafor", url);
        Assert.Contains("Sam Okafor", text);
        Assert.Contains(url, text);
        Assert.Contains("expires", text, StringComparison.OrdinalIgnoreCase);
        // What the invitee gets before accepting is a name and a link, and no preview of the log.
        Assert.Contains("Nothing of yours is visible until you accept", text);
    }

    [Fact]
    public void A_sender_name_cannot_carry_markup_into_the_html()
    {
        var html = InviteMail.Html("<script>alert(1)</script>", "https://brewbook.app/?invite=t");
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public async Task An_addressed_invitation_is_posted_when_a_mailer_is_configured()
    {
        var mailer = new RecordingMailer(sends: true);
        using var f = ApiFactory.WithFriends(s => { s.RemoveAll<IInviteMailer>(); s.AddSingleton<IInviteMailer>(mailer); });
        var sam = f.ClientFor("sam@example.com");

        var res = await sam.PostAsJsonAsync("/api/v1/friends/invites", new CreateFriendInviteRequest("jo@example.com"));
        var created = (await res.Content.ReadFromJsonAsync<CreatedInviteResponse>())!;

        Assert.True(created.Posted);
        Assert.Equal(("jo@example.com", "sam", created.Invite.Token), Assert.Single(mailer.Sent));
    }

    [Fact]
    public async Task A_plain_link_is_never_posted_to_anyone()
    {
        var mailer = new RecordingMailer(sends: true);
        using var f = ApiFactory.WithFriends(s => { s.RemoveAll<IInviteMailer>(); s.AddSingleton<IInviteMailer>(mailer); });
        var sam = f.ClientFor("sam@example.com");

        var res = await sam.PostAsJsonAsync("/api/v1/friends/invites", new CreateFriendInviteRequest(null));
        var created = (await res.Content.ReadFromJsonAsync<CreatedInviteResponse>())!;

        Assert.False(created.Posted);
        Assert.Empty(mailer.Sent);
    }

    [Fact]
    public async Task A_refused_send_still_leaves_a_usable_invitation()
    {
        var mailer = new RecordingMailer(sends: false);
        using var f = ApiFactory.WithFriends(s => { s.RemoveAll<IInviteMailer>(); s.AddSingleton<IInviteMailer>(mailer); });
        var sam = f.ClientFor("sam@example.com");

        var res = await sam.PostAsJsonAsync("/api/v1/friends/invites", new CreateFriendInviteRequest("jo@example.com"));
        var created = (await res.Content.ReadFromJsonAsync<CreatedInviteResponse>())!;
        Assert.False(created.Posted);

        // The link is the invitation; the post is only a way of handing it over.
        var accepted = await f.ClientFor("jo@example.com").PostAsync($"/api/v1/friends/invites/{created.Invite.Token}/accept", null);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
    }

    [Fact]
    public async Task Me_says_whether_invitations_can_be_posted_at_all()
    {
        using var off = ApiFactory.WithFriends();
        Assert.False((await off.ClientFor("sam@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me"))!.Features.EmailInvites);

        using var on = ApiFactory.WithFriends(s => { s.RemoveAll<IInviteMailer>(); s.AddSingleton<IInviteMailer>(new RecordingMailer(sends: true)); });
        Assert.True((await on.ClientFor("sam@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me"))!.Features.EmailInvites);
    }

    [Fact]
    public async Task Nothing_is_posted_while_friends_are_switched_off()
    {
        // A mailer that would send is irrelevant: with no invitations there is nothing to post.
        var mailer = new RecordingMailer(sends: true);
        using var f = new ApiFactory(s => { s.RemoveAll<IInviteMailer>(); s.AddSingleton<IInviteMailer>(mailer); });
        var me = await f.ClientFor("sam@example.com").GetFromJsonAsync<MeResponse>("/api/v1/me");

        Assert.False(me!.Features.EmailInvites);
        Assert.Empty(mailer.Sent);
    }

    private sealed class RecordingMailer(bool sends) : IInviteMailer
    {
        public List<(string To, string From, string Token)> Sent { get; } = [];
        public bool Configured => true;

        public Task<bool> SendAsync(string toEmail, string fromName, string token, CancellationToken ct)
        {
            if (sends) Sent.Add((toEmail, fromName, token));
            return Task.FromResult(sends);
        }
    }
}
