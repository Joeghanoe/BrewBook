using Brewbook.Api.Contracts;
using Brewbook.Api.Features.Labels;

namespace Brewbook.Api.Tests;

public class GeminiLabelExtractorTests
{
    private const string Sample = """
        {"roaster":{"value":"Gesha Village","confidence":"extracted"},
         "bean":{"value":"Kiiro","confidence":"extracted"},
         "origin":{"value":"Bench Maji, Ethiopia","confidence":"partial"},
         "process":{"value":"Natural","confidence":"extracted"},
         "roast_date":{"value":null,"confidence":"missing"},
         "producer":{"value":"","confidence":"missing"},
         "varietal":{"value":"Gori Gesha","confidence":"extracted"},
         "altitude":{"value":"2000 m","confidence":"partial"},
         "roast_level":{"value":"guess","confidence":"unknown"},
         "declared_notes":["Jasmine","Peach","complex acidity"," Peach "]}
        """;

    [Fact]
    public void Maps_model_json_onto_the_ledger_with_provenance()
    {
        var r = GeminiLabelExtractor.Map("scan1", Sample);
        Assert.True(r.Extracted);
        Assert.Equal("scan1", r.ScanId);
        Assert.Equal(new ExtractedField("Gesha Village", Provenance.Extracted), r.Roaster);
        Assert.Equal(new ExtractedField("Bench Maji, Ethiopia", Provenance.Partial), r.Origin);
        Assert.Equal(Provenance.Missing, r.RoastDate.Provenance);
        Assert.Equal(Provenance.Missing, r.Producer.Provenance);
        // An unknown confidence never smuggles a value through.
        Assert.Equal(new ExtractedField(null, Provenance.Missing), r.RoastLevel);
    }

    [Fact]
    public void Declared_notes_are_deduplicated_and_categorised()
    {
        var r = GeminiLabelExtractor.Map("s", Sample);
        Assert.Equal(["Jasmine", "Peach", "complex acidity"], r.DeclaredNotes.Select(n => n.Text));
        Assert.Equal("FLORAL", r.DeclaredNotes[0].Category);
        Assert.Equal("FRUITY", r.DeclaredNotes[1].Category);
        Assert.Null(r.DeclaredNotes[2].Category);
    }
}
