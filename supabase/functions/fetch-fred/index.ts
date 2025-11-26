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

      const response = await fetch(searchUrl);
      const data = await response.json();

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

      // Fetch observations
      const obsUrl = `${fredBaseUrl}/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`;
      const obsResponse = await fetch(obsUrl);
      const obsData = await obsResponse.json();
      const observations = obsData.observations || [];

      // Fetch EUR/USD exchange rate for normalization
      const fxUrl = `${fredBaseUrl}/series/observations?series_id=DEXUSEU&api_key=${fredApiKey}&file_type=json`;
      const fxResponse = await fetch(fxUrl);
      const fxData = await fxResponse.json();
      const fxRates: { [key: string]: number } = {};
      
      (fxData.observations || []).forEach((obs: FredObservation) => {
        if (obs.value !== ".") {
          fxRates[obs.date] = parseFloat(obs.value);
        }
      });

      // Insert observations
      const obsToInsert = observations
        .filter((obs: FredObservation) => obs.value !== ".")
        .map((obs: FredObservation) => {
          const value = parseFloat(obs.value);
          const fxRate = fxRates[obs.date] || 1.0;
          
          return {
            series_id: `FRED_${seriesId}`,
            date: obs.date,
            value,
            value_usd: series.units?.includes("USD") ? value : null,
            value_eur: series.units?.includes("USD") && fxRate ? value / fxRate : null,
          };
        });

      if (obsToInsert.length > 0) {
        const { error: obsError } = await supabase
          .from("observations")
          .upsert(obsToInsert, { onConflict: "series_id,date" });

        if (obsError) throw obsError;
      }

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
