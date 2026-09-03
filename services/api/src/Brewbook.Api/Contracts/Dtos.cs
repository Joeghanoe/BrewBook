using Brewbook.Api.Domain;
using Brewbook.Api.Integrations.GooglePlaces;

namespace Brewbook.Api.Contracts;

// Wire shapes. Versioned by route prefix (/api/v1). Add fields; never repurpose one.

public sealed record FeatureFlags(bool LabelReading, bool SpeechTranscription, bool Friends, bool EmailInvites);

public sealed record MeResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    FeatureFlags Features,
    DateTimeOffset? OnboardedAt,
    /// <summary>Whether a newly rated brew is visible to friends. Per-brew overrides sit on the brew.</summary>
    bool ShareRatedByDefault)
{
    public static MeResponse From(User u, FeatureFlags features) => new(u.Id, u.Email, u.DisplayName, features, u.OnboardedAt, u.ShareRatedByDefault);
}

public sealed record UpdateMeRequest(bool? ShareRatedByDefault);

/// <summary>
/// The ticket on the wire. <c>method</c> is <c>filter</c> or <c>espresso</c>; the trailing fields
/// default so an older client that only knows the five filter values still brews filter.
/// </summary>
public sealed record BrewParamsDto(decimal Grind, decimal DoseG, decimal YieldG, decimal TempC, int Blooms,
    BrewMethod Method = BrewMethod.Filter, int? PreInfusionS = null, int TargetMs = BrewParams.FilterTargetMs)
{
    public static BrewParamsDto From(BrewParams p) => new(p.Grind, p.DoseG, p.YieldG, p.TempC, p.Blooms, p.Method, p.PreInfusionS, p.TargetMs);
    public BrewParams ToDomain() => new(Method, Grind, DoseG, YieldG, TempC, Blooms, PreInfusionS, TargetMs);
}

public sealed record BeanResponse(
    Guid Id,
    string Name,
    string? Roaster,
    Guid? RoasterId,
    string? Origin,
    string? Process,
    DateOnly? RoastDate,
    string? Producer,
    string? Varietal,
    string? Altitude,
    string? RoastLevel,
    IReadOnlyList<string> DeclaredNotes,
    /// <summary>Net weight off the label, in grams. Null when the label did not say.</summary>
    decimal? WeightG,
    /// <summary>Rough brews left: weight minus the doses actually brewed, over the ticket's dose. Null without a weight.</summary>
    int? BrewsLeft,
    /// <summary>The bag is empty or over a year off roast, and has not been asked about yet (§7).</summary>
    bool AskToArchive,
    bool Archived,
    bool LabelKept,
    DateTimeOffset CreatedAt,
    int BrewCount,
    DateTimeOffset? LastBrewedAt,
    /// <summary>Params of the most recent brew, or the method defaults when the bean has none.</summary>
    BrewParamsDto LastParams,
    /// <summary>The linked roaster has a pin on the map.</summary>
    bool RoasterLocated,
    /// <summary>Somebody — the lookup or the user — has answered where the roaster is, even if the answer was "nowhere". False means the picker has not been offered yet.</summary>
    bool RoasterResolved)
{
    public static BeanResponse From(Bean b, int brewCount, Brew? last, decimal dosedG, DateTimeOffset now)
    {
        var next = last is null ? BrewParams.MethodDefaults : BrewParams.From(last);
        var left = BagCountdown.BrewsLeft(b.WeightG, dosedG, next.DoseG);
        // The roaster flags need the navigation loaded; a bean read without it reports "not yet", which is the safe answer.
        var roaster = b.LinkedRoaster;
        return new(
            b.Id, b.Name, b.Roaster, b.RoasterId, b.Origin, b.Process, b.RoastDate, b.Producer, b.Varietal, b.Altitude, b.RoastLevel,
            b.DeclaredNotes, b.WeightG, left, BagCountdown.AskToArchive(b, left, now), b.Archived, b.LabelScanId is not null,
            b.CreatedAt, brewCount, last?.BrewedAt, BrewParamsDto.From(next),
            roaster?.Located ?? false, roaster?.ResolvedAt is not null);
    }
}

public sealed record CreateBeanRequest(
    string Name,
    string? Roaster,
    string? Origin,
    string? Process,
    DateOnly? RoastDate,
    string? Producer,
    string? Varietal,
    string? Altitude,
    string? RoastLevel,
    IReadOnlyList<string>? DeclaredNotes,
    decimal? WeightG,
    string? LabelScanId);

/// <summary>
/// Editing a bag after the fact — a roast date the label did not carry, a name read wrong (§7).
/// Every field is optional and null means "leave it alone"; an empty string clears the field, so a
/// wrong value can be taken back off. Archiving is always the user's word, and
/// <c>ArchivePromptAnswered</c> records that the bag was asked about whatever the answer.
/// </summary>
public sealed record UpdateBeanRequest(
    bool? Archived = null,
    bool? ArchivePromptAnswered = null,
    string? Name = null,
    string? Roaster = null,
    string? Origin = null,
    string? Process = null,
    /// <summary>The date itself, or <c>ClearRoastDate</c> to take it back off.</summary>
    DateOnly? RoastDate = null,
    bool? ClearRoastDate = null,
    string? Producer = null,
    string? Varietal = null,
    string? Altitude = null,
    string? RoastLevel = null,
    IReadOnlyList<string>? DeclaredNotes = null,
    decimal? WeightG = null,
    bool? ClearWeight = null);

/// <summary>
/// One person's word on a roaster. Ratings stay attributed and are never averaged across people
/// (§4): a roaster three friends disagree about carries three of these, with three ratings.
/// </summary>
public sealed record RoasterVoice(
    Guid UserId,
    string Name,
    /// <summary>One or two letters for the pin. Whose it is has to be readable at map scale.</summary>
    string Initials,
    bool IsMe,
    int Bags,
    int Brews,
    double? AvgRating,
    IReadOnlyList<string> TopFlavours,
    IReadOnlyList<string> DislikedFlavours,
    int? MatchCount);

/// <summary>Everything the map needs. Location fields are null until the roaster is located; <c>Located</c> says which.</summary>
public sealed record RoasterResponse(
    Guid Id,
    string Name,
    string? Address,
    double? Lat,
    double? Lng,
    bool Located,
    string? Website,
    int Bags,
    int Brews,
    /// <summary>Mean of the user's rated brews of this roaster's bags, one decimal. Null when none is rated.</summary>
    double? AvgRating,
    IReadOnlyList<string> TopFlavours,
    IReadOnlyList<string> DislikedFlavours,
    /// <summary>How many of the requested <c>flavours</c> this roaster's liked flavours contain. Null when no filter was given.</summary>
    int? MatchCount,
    /// <summary>Everyone in scope who has drunk this roaster — the user first, then friends. Each keeps its own rating.</summary>
    IReadOnlyList<RoasterVoice> Voices,
    /// <summary>The user has a bag from here. False for a roaster that is only on the map through a friend.</summary>
    bool Mine,
    /// <summary>Pinned as somewhere to go (§4). Clears itself once a bag from here is in the library.</summary>
    bool Wished);

/// <summary>A friend's rated brew, which is all a recipe is (§5): the five values, the time, the stars and the tags.</summary>
public sealed record SharedBrewDto(
    Guid Id,
    Guid FromUserId,
    string FromName,
    int Number,
    string BeanName,
    string? Origin,
    string? Process,
    IReadOnlyList<string> DeclaredNotes,
    BrewParamsDto Params,
    int DurationMs,
    int Rating,
    IReadOnlyList<FlavourTagDto> FlavourTags,
    DateTimeOffset BrewedAt);

public sealed record FriendDto(Guid UserId, string Name, string Initials, string? Email, DateTimeOffset Since, int Roasters, int SharedBrews);

/// <summary>An open invitation. The token is the whole key; there is no directory and nobody is discoverable (§5).</summary>
public sealed record FriendInviteDto(string Token, string FromName, string? ToEmail, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

public sealed record FriendsResponse(
    IReadOnlyList<FriendDto> Friends,
    /// <summary>Invitations the user sent that nobody has accepted yet.</summary>
    IReadOnlyList<FriendInviteDto> Sent,
    /// <summary>Invitations addressed to this user's email, waiting on them.</summary>
    IReadOnlyList<FriendInviteDto> Received);

public sealed record CreateFriendInviteRequest(string? Email);

/// <summary>
/// A new invitation. <c>Posted</c> says whether it actually went out by mail — an invitation is a
/// row and a token first, and the link works either way.
/// </summary>
public sealed record CreatedInviteResponse(FriendInviteDto Invite, bool Posted);

public sealed record RelocateRoasterRequest(string? Query);

/// <summary>One place a roaster name might mean. <c>DistanceKm</c> is from the position the client sent, null without one.</summary>
public sealed record RoasterCandidateDto(string PlaceId, string Name, string? Address, double Lat, double Lng, string? Website, double? DistanceKm)
{
    public static RoasterCandidateDto From(RoasterCandidate c) => new(c.PlaceId, c.DisplayName, c.FormattedAddress, c.Lat, c.Lng, c.Website, c.DistanceKm is { } km ? Math.Round(km, 1) : null);
}

/// <summary><c>Available</c> is false when no lookup is configured or it did not answer; an empty list with it true means nothing matched.</summary>
public sealed record RoasterSearchResponse(bool Available, IReadOnlyList<RoasterCandidateDto> Candidates);

/// <summary>
/// The user's answer to "which of these is it?". A null <c>PlaceId</c> is "none of these": the
/// roaster stays off the map and the lookup stops asking. The place fields are the candidate's own,
/// copied back rather than fetched again: one Places call per search, not two.
/// </summary>
public sealed record PlaceRoasterRequest(string? PlaceId, string? Name, string? Address, double? Lat, double? Lng, string? Website);

public sealed record ConfigResponse(string? MapsBrowserKey);

public sealed record FlavourTagDto(string Flavour, int Polarity);

/// <summary>A passport stamp earned by the write that produced this response.</summary>
public sealed record UnlockedDto(string Key, string Title);

/// <summary>A named moment in the brew. <c>label</c> is what was said ("first bloom") or "pour".</summary>
public sealed record BrewStepDto(int AtMs, string Label);

public sealed record BrewResponse(
    Guid Id,
    Guid BeanId,
    int Number,
    BrewParamsDto Params,
    int DurationMs,
    /// <summary>Step times alone. Older field; <c>steps</c> carries the same moments with labels.</summary>
    IReadOnlyList<int> PourMarkersMs,
    IReadOnlyList<BrewStepDto> Steps,
    int Rating,
    IReadOnlyList<string> Defects,
    IReadOnlyList<FlavourTagDto> FlavourTags,
    DateTimeOffset BrewedAt,
    /// <summary>Kept out of friends' view. An unrated brew is never shared whatever this says.</summary>
    bool IsPrivate,
    /// <summary>Stamps this write earned. Empty on reads and on writes that earned none.</summary>
    IReadOnlyList<UnlockedDto> NewlyUnlocked)
{
    public static BrewResponse From(Brew b, IReadOnlyList<UnlockedDto>? newlyUnlocked = null) => new(
        b.Id, b.BeanId, b.Number, BrewParamsDto.From(BrewParams.From(b)), b.DurationMs, b.PourMarkersMs,
        b.Steps.OrderBy(st => st.AtMs).Select(st => new BrewStepDto(st.AtMs, st.Label)).ToList(), b.Rating, b.Defects,
        b.FlavourTags.OrderBy(t => t.Flavour).Select(t => new FlavourTagDto(t.Flavour, t.Polarity)).ToList(), b.BrewedAt,
        b.IsPrivate, newlyUnlocked ?? []);
}

public sealed record SetBrewPrivacyRequest(bool IsPrivate);

/// <summary>
/// <c>durationMs</c> null or 0 logs the brew untimed; the time can be entered afterwards.
/// <c>steps</c> are the labelled moments; <c>pourMarkersMs</c> is the older unlabelled form and is
/// only read when <c>steps</c> is absent.
/// </summary>
public sealed record CreateBrewRequest(Guid BeanId, BrewParamsDto Params, int? DurationMs, IReadOnlyList<int>? PourMarkersMs, IReadOnlyList<BrewStepDto>? Steps = null);

/// <summary>A brew after the fact. Every field is optional; null leaves it as it was. Rating 0 unrates.</summary>
public sealed record UpdateBrewRequest(
    int? DurationMs = null,
    BrewParamsDto? Params = null,
    DateTimeOffset? BrewedAt = null,
    int? Rating = null,
    IReadOnlyList<string>? Defects = null,
    bool? IsPrivate = null,
    IReadOnlyList<BrewStepDto>? Steps = null);

public sealed record RateBrewRequest(int? Rating, IReadOnlyList<string>? Defects);

public sealed record TagBrewRequest(IReadOnlyList<FlavourTagDto> Tags);

public sealed record ProgressDto(int Have, int Of);

public sealed record AchievementDto(string Key, string Title, string Subtitle, bool Unlocked, DateTimeOffset? UnlockedAt, ProgressDto Progress);

public sealed record LeafCoverageDto(string Flavour, string Category, string Group, bool Tasted, DateTimeOffset? LastTaggedAt);

public sealed record CategoryCoverageDto(string Name, int Tasted, int Of);

public sealed record CoverageDto(IReadOnlyList<LeafCoverageDto> Leaves, IReadOnlyList<CategoryCoverageDto> Categories);

public sealed record AchievementsResponse(IReadOnlyList<AchievementDto> Achievements, CoverageDto Coverage);

// Taste profile: derived from the user's brews and tags on every read, never stored.

public sealed record ProfileFlavour(string Flavour, string Category, int Likes, int Dislikes, DateTimeOffset LastTaggedAt);

public sealed record ProfileCategory(string Category, int Likes, int Dislikes);

public sealed record ProfileFlavours(
    IReadOnlyList<ProfileFlavour> Leaves,
    /// <summary>Every wheel category in wheel order, zeros included.</summary>
    IReadOnlyList<ProfileCategory> Categories,
    IReadOnlyList<ProfileFlavour> TopLiked,
    IReadOnlyList<ProfileFlavour> TopDisliked);

public sealed record ProfileDefect(string Defect, int Count);

public sealed record ProfilePreferences(
    /// <summary>Medians over brews rated 4 or 5. Null until one exists.</summary>
    BrewParamsDto? Preferred,
    /// <summary>Medians over every brew. Null until one exists.</summary>
    BrewParamsDto? Overall,
    int RatedBrews,
    int LikedBrews,
    int? TypicalDurationMs,
    IReadOnlyList<ProfileDefect> Defects);

public sealed record ProfileBean(Guid BeanId, string Name, string? Roaster, bool Archived, int Brews, decimal? AvgRating, Guid? BestBrewId);

public sealed record ProfileRoaster(string Roaster, int Bags, int Brews, decimal? AvgRating, IReadOnlyList<string> TopFlavours);

public sealed record ProfileCounts(int Brews, int Bags, int Flavours, int DaysLogging);

public sealed record ProfileResponse(
    string Email,
    string? DisplayName,
    ProfileCounts Counts,
    ProfileFlavours Flavours,
    ProfilePreferences Preferences,
    IReadOnlyList<ProfileBean> Beans,
    IReadOnlyList<ProfileBean> TopBeans,
    IReadOnlyList<ProfileRoaster> Roasters);

public sealed record VoiceParseRequest(string Transcript, BrewParamsDto Current);

public sealed record VoiceParseResponse(bool Applied, string Transcript, BrewParamsDto Params, IReadOnlyList<string> Changes, string Summary);

public enum Provenance { Extracted, Partial, Missing }

public sealed record ExtractedField(string? Value, Provenance Provenance);

public sealed record DeclaredNote(string Text, string? Category);

public sealed record LabelScanResponse(
    string ScanId,
    bool Extracted,
    string? Reason,
    ExtractedField Roaster,
    ExtractedField Bean,
    ExtractedField Origin,
    ExtractedField Process,
    ExtractedField RoastDate,
    ExtractedField Producer,
    ExtractedField Varietal,
    ExtractedField Altitude,
    ExtractedField RoastLevel,
    /// <summary>Net weight in grams as printed. Skippable like any other field; no weight, no countdown (§7).</summary>
    ExtractedField Weight,
    IReadOnlyList<DeclaredNote> DeclaredNotes);
