using System.Globalization;
using System.Text.RegularExpressions;
using Brewbook.Api.Domain;

namespace Brewbook.Api.Features.Voice;

/// <summary>
/// Turns a spoken adjustment ("same but 93 degrees", "grind half a click finer", "ten grams more water")
/// into a delta on the ticket. Deterministic: the same transcript and params always give the same result.
/// Unrecognised speech applies nothing rather than guessing.
/// </summary>
public static partial class VoiceCommandParser
{
    public sealed record Result(BrewParams Params, IReadOnlyList<string> Changes, string Summary)
    {
        public bool Applied => Changes.Count > 0;
    }

    public static Result Parse(string transcript, BrewParams current)
    {
        var t = Normalise(transcript);
        var p = current;
        var changes = new List<string>();

        // "94 degrees", "93 c", "water 92", "temperature to 90"
        if (TempRx().Match(t) is { Success: true } m && TryNum(m.Groups["n"].Value, out var temp) && temp is >= 60 and <= 100)
        {
            if (p.TempC != temp) { p = p with { TempC = temp }; changes.Add($"water changed to {Fmt(temp)}°C"); }
        }
        else if (RelTempRx().Match(t) is { Success: true } rm && TryNum(rm.Groups["n"].Value, out var d))
        {
            var sign = IsDown(rm.Groups["dir"].Value) ? -1 : 1;
            var next = Math.Clamp(p.TempC + sign * d, 60, 100);
            if (next != p.TempC) { p = p with { TempC = next }; changes.Add($"water changed to {Fmt(next)}°C"); }
        }

        // "grind 4", "grind finer", "half a click coarser", "one click finer", "grind 0.5 finer"
        if (GrindAbsRx().Match(t) is { Success: true } g && TryNum(g.Groups["n"].Value, out var grind) && grind is >= 0 and <= 100)
        {
            if (p.Grind != grind) { p = p with { Grind = grind }; changes.Add($"grind set to {Fmt(grind)}"); }
        }
        else if (GrindRelRx().Match(t) is { Success: true } gr)
        {
            var step = gr.Groups["n"].Success && TryNum(gr.Groups["n"].Value, out var s) ? s : (gr.Groups["half"].Success ? 0.5m : 1m);
            if (gr.Groups["clicks"].Success && gr.Groups["clicks"].Value.Contains("half")) step = 0.5m;
            var finer = gr.Groups["dir"].Value.Contains("fine");
            var next = Math.Max(0, p.Grind + (finer ? -step : step));
            if (next != p.Grind) { p = p with { Grind = next }; changes.Add($"grind {Fmt(step)} {(finer ? "finer" : "coarser")} → {Fmt(next)}"); }
        }

        // "dose 16", "16 grams of coffee", "half a gram more coffee", "one gram less"
        if (DoseAbsRx().Match(t) is { Success: true } da && TryNum(da.Groups["n"].Value, out var dose) && dose is > 0 and <= 500)
        {
            if (p.DoseG != dose) { p = p with { DoseG = dose }; changes.Add($"dose set to {Fmt(dose)} g"); }
        }
        else if (DoseRelRx().Match(t) is { Success: true } dr && TryNum(dr.Groups["n"].Value, out var dd))
        {
            var next = Math.Max(0.1m, p.DoseG + (IsDown(dr.Groups["dir"].Value) ? -dd : dd));
            if (next != p.DoseG) { p = p with { DoseG = next }; changes.Add($"dose changed to {Fmt(next)} g"); }
        }

        // "yield 260", "250 grams out", "ten grams more water" (water in grams = yield, not temperature)
        if (YieldAbsRx().Match(t) is { Success: true } ya && TryNum(ya.Groups["n"].Value, out var yld) && yld is > 0 and <= 5000)
        {
            if (p.YieldG != yld) { p = p with { YieldG = yld }; changes.Add($"yield set to {Fmt(yld)} g"); }
        }
        else if (YieldRelRx().Match(t) is { Success: true } yr && TryNum(yr.Groups["n"].Value, out var yd))
        {
            var next = Math.Max(1, p.YieldG + (IsDown(yr.Groups["dir"].Value) ? -yd : yd));
            if (next != p.YieldG) { p = p with { YieldG = next }; changes.Add($"yield changed to {Fmt(next)} g"); }
        }

        if (p.Method == BrewMethod.Espresso)
        {
            // "pre-infusion 8 seconds", "no pre-infusion". Parsed first and cut out, so its seconds
            // are never also read as the shot time.
            if (PreInfusionNoneRx().Match(t) is { Success: true } pn)
            {
                t = t.Remove(pn.Index, pn.Length);
                if (p.PreInfusionS != 0) { p = p with { PreInfusionS = 0 }; changes.Add("no pre-infusion"); }
            }
            else if (PreInfusionRx().Match(t) is { Success: true } pi && TryNum(pi.Groups["n"].Value, out var pre) && pre is >= 0 and <= 60)
            {
                t = t.Remove(pi.Index, pi.Length);
                var n = (int)pre;
                if (p.PreInfusionS != n) { p = p with { PreInfusionS = n }; changes.Add($"pre-infusion set to {n} s"); }
            }

            // "shot 28 seconds", "28 second shot", "target 30"
            if (TryTime(t, ShotKeyRx(), out var shot, bareIsSeconds: true) && shot is > 0 and <= 3_600_000)
            {
                if (p.TargetMs != shot) { p = p with { TargetMs = shot }; changes.Add($"shot time set to {Clock(shot)}"); }
            }
        }
        else
        {
            // "two blooms", "one more bloom", "no bloom", "skip the bloom"
            if (BloomNoneRx().IsMatch(t))
            {
                if (p.Blooms != 0) { p = p with { Blooms = 0 }; changes.Add("no bloom"); }
            }
            else if (BloomAbsRx().Match(t) is { Success: true } ba && TryNum(ba.Groups["n"].Value, out var bl) && bl is >= 0 and <= 20)
            {
                var n = (int)bl;
                if (p.Blooms != n) { p = p with { Blooms = n }; changes.Add($"blooms set to ×{n}"); }
            }
            else if (BloomRelRx().Match(t) is { Success: true } br)
            {
                var n = Math.Clamp(p.Blooms + (IsDown(br.Groups["dir"].Value) ? -1 : 1), 0, 20);
                if (n != p.Blooms) { p = p with { Blooms = n }; changes.Add($"blooms changed to ×{n}"); }
            }


            // "target 2:30", "target two thirty", "two and a half minutes", "time 2 minutes 45"
            if (TryTime(t, TargetKeyRx(), out var target) && target is > 0 and <= 3_600_000)
            {
                if (p.TargetMs != target) { p = p with { TargetMs = target }; changes.Add($"target time set to {Clock(target)}"); }
            }
        }

        var summary = changes.Count == 0 ? "nothing recognised — ticket unchanged" : string.Join(" · ", changes);
        return new Result(p, changes, summary);
    }

    private static string Normalise(string s)
    {
        s = s.ToLowerInvariant().Replace("°", " degrees ").Replace("º", " degrees ");
        foreach (var (word, num) in Words) s = Regex.Replace(s, $@"\b{word}\b", num);
        // "ninety three" → "90 3" → "93"
        s = Regex.Replace(s, @"\b([2-9])0[ -]([1-9])\b", "$1$2");
        s = Regex.Replace(s, @"\s+", " ").Trim();
        return s;
    }

    private static readonly (string, string)[] Words =
    [
        ("a half", "0.5"), ("half a", "0.5"), ("half", "0.5"), ("zero", "0"), ("one", "1"), ("two", "2"), ("three", "3"), ("four", "4"),
        ("five", "5"), ("six", "6"), ("seven", "7"), ("eight", "8"), ("nine", "9"), ("ten", "10"), ("fifteen", "15"), ("twenty", "20"),
        ("thirty", "30"), ("forty", "40"), ("fifty", "50"), ("sixty", "60"), ("seventy", "70"), ("eighty", "80"), ("ninety", "90"),
    ];

    private static bool TryNum(string s, out decimal v)
    {
        return decimal.TryParse(s.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out v);
    }

    /// <summary>
    /// A spoken duration in ms. "2:30", "2 minutes 30", "two and a half minutes" and "150 seconds" stand
    /// on their own; a bare "2 30" needs the keyword in front, or it could be any two numbers.
    /// </summary>
    private static bool TryTime(string t, Regex keyword, out int ms, bool bareIsSeconds = false)
    {
        ms = 0;
        var k = keyword.Match(t);
        // "25 second shot" puts the keyword last; with nothing after it, the whole utterance is the time.
        var after = k.Success && k.Index + k.Length < t.Length ? t[(k.Index + k.Length)..] : t;
        if (ClockRx().Match(after) is { Success: true } c)
            return Set(int.Parse(c.Groups["m"].Value, CultureInfo.InvariantCulture), int.Parse(c.Groups["s"].Value, CultureInfo.InvariantCulture), out ms);
        if (MinutesRx().Match(after) is { Success: true } mn && TryNum(mn.Groups["m"].Value, out var mins))
        {
            var secs = mn.Groups["s"].Success ? int.Parse(mn.Groups["s"].Value, CultureInfo.InvariantCulture) : 0;
            if (mn.Groups["half"].Success) secs += 30;
            ms = (int)(mins * 60_000) + secs * 1000;
            return true;
        }
        if (k.Success && PairRx().Match(after) is { Success: true } pr)
            return Set(int.Parse(pr.Groups["m"].Value, CultureInfo.InvariantCulture), int.Parse(pr.Groups["s"].Value, CultureInfo.InvariantCulture), out ms);
        if (SecondsRx().Match(after) is { Success: true } sc && TryNum(sc.Groups["s"].Value, out var seconds))
        {
            ms = (int)(seconds * 1000);
            return true;
        }
        // "target 32" on espresso can only mean seconds; on filter a bare number is left alone.
        if (bareIsSeconds && k.Success && BareRx().Match(after) is { Success: true } bare && TryNum(bare.Groups["s"].Value, out var bareSeconds))
        {
            ms = (int)(bareSeconds * 1000);
            return true;
        }
        return false;

        static bool Set(int m, int s, out int ms) { ms = m * 60_000 + s * 1000; return s < 60; }
    }

    private static string Clock(int ms) => $"{ms / 60_000}:{ms % 60_000 / 1000:00}";

    private static bool IsDown(string dir) => dir is "less" or "lower" or "down" or "fewer" or "minus" or "colder" or "cooler";
    private static string Fmt(decimal v) => v.ToString(v == Math.Truncate(v) ? "0" : "0.0#", CultureInfo.InvariantCulture);

    private const string Num = @"(?<n>\d+(?:[.,]\d+)?)";
    private const string Dir = @"(?<dir>more|less|higher|lower|up|down|plus|minus|hotter|colder|cooler|warmer|fewer)";

    [GeneratedRegex($@"(?:(?:water|temp(?:erature)?)\s*(?:to|at|of)?\s*{Num}\s*(?:degrees|c\b|celsius)?|{Num}\s*(?:degrees|celsius|c\b))")]
    private static partial Regex TempRx();
    [GeneratedRegex($@"{Num}\s*(?:degrees?)\s*{Dir}|{Dir}\s*(?:by\s*)?{Num}\s*degrees?")]
    private static partial Regex RelTempRx();

    [GeneratedRegex($@"grind\s*(?:to|at|of|setting)?\s*{Num}(?!\s*(?:clicks?|finer|coarser|step))")]
    private static partial Regex GrindAbsRx();
    [GeneratedRegex($@"(?:(?<n>\d+(?:[.,]\d+)?)\s*)?(?<clicks>(?:0\.5 )?(?:clicks?|steps?|notch(?:es)?)\s*)?(?<dir>finer|coarser)")]
    private static partial Regex GrindRelRx();

    [GeneratedRegex($@"(?:dose\s*(?:to|of|at)?\s*{Num}|{Num}\s*(?:grams?|g)\s*(?:of\s*)?(?:coffee|dose|beans|in\b))")]
    private static partial Regex DoseAbsRx();
    [GeneratedRegex($@"{Num}\s*(?:grams?|g)\s*{Dir}\s*(?:coffee|dose|beans)")]
    private static partial Regex DoseRelRx();

    [GeneratedRegex($@"(?:yield\s*(?:to|of|at)?\s*{Num}|{Num}\s*(?:grams?|g)\s*(?:of\s*)?(?:water|out|yield|brew))")]
    private static partial Regex YieldAbsRx();
    [GeneratedRegex($@"{Num}\s*(?:grams?|g)\s*{Dir}\s*(?:water|out|yield)")]
    private static partial Regex YieldRelRx();

    [GeneratedRegex(@"\bno pre[- ]?infusion\b")]
    private static partial Regex PreInfusionNoneRx();
    [GeneratedRegex($@"pre[- ]?infus(?:e|ion)\s*(?:to|of|at|for)?\s*{Num}\s*(?:seconds?|secs?|s\b)?")]
    private static partial Regex PreInfusionRx();
    [GeneratedRegex(@"(?:shot(?: time)?|target(?: time)?|total time|time)\s*(?:to|of|at|for)?\s*")]
    private static partial Regex ShotKeyRx();
    [GeneratedRegex(@"(?:target(?: time)?|total time|brew time|time)\s*(?:to|of|at|for)?\s*")]
    private static partial Regex TargetKeyRx();
    [GeneratedRegex(@"^\s*(?<m>\d{1,2}):(?<s>\d{2})\b")]
    private static partial Regex ClockRx();
    [GeneratedRegex(@"(?<m>\d+(?:[.,]\d+)?)\s*(?<half>and 0\.5\s*)?min(?:ute)?s?\b(?:\s*(?:and\s*)?(?<s>\d{1,2})\b(?:\s*(?:seconds?|secs?|s\b))?)?")]
    private static partial Regex MinutesRx();
    [GeneratedRegex(@"^\s*(?<m>\d{1,2})\s+(?<s>\d{2})\b")]
    private static partial Regex PairRx();
    [GeneratedRegex(@"(?<s>\d+(?:[.,]\d+)?)\s*(?:seconds?|secs?|s\b)")]
    private static partial Regex SecondsRx();
    [GeneratedRegex(@"^\s*(?<s>\d+(?:[.,]\d+)?)\s*$")]
    private static partial Regex BareRx();

    [GeneratedRegex(@"\b(?:no|skip(?: the)?|without|0)\s*blooms?\b")]
    private static partial Regex BloomNoneRx();
    [GeneratedRegex($@"(?:{Num}\s*blooms?|blooms?\s*(?:to|of|at|times)?\s*{Num})")]
    private static partial Regex BloomAbsRx();
    [GeneratedRegex($@"(?:1\s*)?{Dir}\s*blooms?|blooms?\s*{Dir}")]
    private static partial Regex BloomRelRx();
}
