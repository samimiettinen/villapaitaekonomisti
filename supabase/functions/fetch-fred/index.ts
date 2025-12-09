import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FredSeriesSearchResult {
  id: string;
  title: string;
  frequency_short?: string;
  units?: string;
}

interface FredObservation {
  date: string;
  value: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const fredApiKey = Deno.env.get("FRED_API_KEY");
    if (!fredApiKey) {
      throw new Error("FRED_API_KEY not configured");
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const seriesId = url.searchParams.get("seriesId");

    console.log("FRED API Request:", { action, seriesId });

    const fredBaseUrl = "https://api.stlouisfed.org/fred";

    // Search for series
    if (action === "search") {
      const query = url.searchParams.get("query") || "";
      const searchUrl = `${fredBaseUrl}/series/search?search_text=${encodeURIComponent(
        query
      )}&api_key=${fredApiKey}&file_type=json&limit=50`;

      console.log("FRED Search URL (without key):", searchUrl.replace(fredApiKey, "***"));
      const response = await fetch(searchUrl);
      const data = await response.json();
      console.log("FRED Search Response status:", response.status);
      console.log("FRED Search Response data:", JSON.stringify(data).substring(0, 500));

      return new Response(
        JSON.stringify({
          results: data.seriess || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch series metadata
    if (action === "metadata" && seriesId) {
      const metadataUrl = `${fredBaseUrl}/series?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`;

      const response = await fetch(metadataUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data.seriess?.[0] || null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch series observations
    if (action === "observations" && seriesId) {
      const startDate = url.searchParams.get("startDate") || "";
      const endDate = url.searchParams.get("endDate") || "";

      let obsUrl = `${fredBaseUrl}/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`;
      if (startDate) obsUrl += `&observation_start=${startDate}`;
      if (endDate) obsUrl += `&observation_end=${endDate}`;

      const response = await fetch(obsUrl);
      const data = await response.json();

      return new Response(
        JSON.stringify({
          observations: data.observations || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ingest series into database
    if (action === "ingest" && seriesId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch metadata
      const metadataUrl = `${fredBaseUrl}/series?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`;
      console.log("Fetching metadata for:", seriesId);
      const metaResponse = await fetch(metadataUrl);
      const metaData = await metaResponse.json();
      const series = metaData.seriess?.[0];

      if (!series) {
        throw new Error("Series not found");
      }

      // Insert or update series
      const { error: seriesError } = await supabase.from("series").upsert({
        id: `FRED_${seriesId}`,
        source: "FRED",
        provider_id: seriesId,
        title: series.title,
        description: series.notes || null,
        freq: series.frequency_short || null,
        unit_original: series.units || null,
        currency_orig: series.units?.includes("USD") ? "USD" : null,
        geo: "US",
      });

      if (seriesError) throw seriesError;

      // Fetch observations - limit to last 10 years for efficiency
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const startDate = tenYearsAgo.toISOString().split('T')[0];
      
      const obsUrl = `${fredBaseUrl}/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&observation_start=${startDate}`;
      console.log("Fetching observations for:", seriesId, "from:", startDate);
      const obsResponse = await fetch(obsUrl);
      const obsData = await obsResponse.json();
      const observations = obsData.observations || [];
      console.log("Received", observations.length, "observations");

      // Insert observations without FX conversion to save resources
      // FX conversion can be done client-side or via a separate process
      const obsToInsert = observations
        .filter((obs: FredObservation) => obs.value !== ".")
        .map((obs: FredObservation) => {
          const value = parseFloat(obs.value);
          const isUSD = series.units?.includes("USD") || series.units?.includes("Dollars");
          
          return {
            series_id: `FRED_${seriesId}`,
            date: obs.date,
            value,
            value_usd: isUSD ? value : null,
            value_eur: null, // Skip FX conversion to save resources
          };
        });

      if (obsToInsert.length > 0) {
        // Insert in batches to avoid memory issues
        const batchSize = 500;
        for (let i = 0; i < obsToInsert.length; i += batchSize) {
          const batch = obsToInsert.slice(i, i + batchSize);
          const { error: obsError } = await supabase
            .from("observations")
            .upsert(batch, { onConflict: "series_id,date" });

          if (obsError) throw obsError;
        }
      }

      console.log("Successfully ingested", obsToInsert.length, "observations for", seriesId);
      return new Response(
        JSON.stringify({
          success: true,
          seriesId: `FRED_${seriesId}`,
          observationCount: obsToInsert.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-fred:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
