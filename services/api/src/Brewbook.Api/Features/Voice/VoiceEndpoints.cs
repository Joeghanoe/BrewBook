using Brewbook.Api.Contracts;

namespace Brewbook.Api.Features.Voice;

public static class VoiceEndpoints
{
    public static RouteGroupBuilder MapVoice(this RouteGroupBuilder api)
    {
        // Speech-to-text runs in the browser (Web Speech API). The server owns the parse so the
        // interpretation is deterministic, testable, and identical across devices.
        api.MapPost("/voice/parse", (VoiceParseRequest req) =>
        {
            var transcript = req.Transcript?.Trim() ?? "";
            if (transcript.Length == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["transcript"] = ["Nothing was heard."] });
            if (transcript.Length > 500) transcript = transcript[..500];

            var r = VoiceCommandParser.Parse(transcript, req.Current.ToDomain());
            return Results.Ok(new VoiceParseResponse(r.Applied, transcript, BrewParamsDto.From(r.Params), r.Changes, r.Summary));
        });
        return api;
    }
}
