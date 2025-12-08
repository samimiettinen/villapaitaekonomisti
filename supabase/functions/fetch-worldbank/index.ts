import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WB_BASE_URL = "https://api.worldbank.org/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log("World Bank API Request:", { action });

    // Search indicators
    if (action === "search") {
      const query = url.searchParams.get("query") || "";
      const searchUrl = `${WB_BASE_URL}/indicator?format=json&per_page=50&source=2`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`World Bank API error: ${response.status}`);
      }
      
      const data = await response.json();
      const indicators = data[1] || [];
      
      // Filter by query
      const queryLower = query.toLowerCase();
      const filtered = indicators
        .filter((ind: any) => {
          const name = ind.name || "";
          const id = ind.id || "";
          return name.toLowerCase().includes(queryLower) || id.toLowerCase().includes(queryLower);
        })
        .slice(0, 50)
        .map((ind: any) => ({
          id: ind.id,
          name: ind.name,
          sourceNote: ind.sourceNote,
          sourceOrganization: ind.sourceOrganization,
        }));

      return new Response(
        JSON.stringify({ results: filtered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List countries
    if (action === "countries") {
      const countriesUrl = `${WB_BASE_URL}/country?format=json&per_page=300`;
      
      const response = await fetch(countriesUrl);
      
      if (!response.ok) {
        throw new Error(`World Bank API error: ${response.status}`);
      }
      
      const data = await response.json();
      const countries = (data[1] || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        region: c.region?.value,
        incomeLevel: c.incomeLevel?.value,
      }));

      return new Response(
        JSON.stringify({ countries }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch observations
    if (action === "observations") {
      const indicatorId = url.searchParams.get("indicatorId");
      const country = url.searchParams.get("country") || "WLD";
      const startYear = url.searchParams.get("startYear") || "1960";
      const endYear = url.searchParams.get("endYear") || new Date().getFullYear().toString();
      
      if (!indicatorId) throw new Error("indicatorId required");

      const obsUrl = `${WB_BASE_URL}/country/${country}/indicator/${indicatorId}?format=json&date=${startYear}:${endYear}&per_page=1000`;

      console.log("Fetching World Bank data:", obsUrl);

      const response = await fetch(obsUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("World Bank API error:", errorText);
        throw new Error(`World Bank API error: ${response.status}`);
      }
      
      const data = await response.json();
      const observations = (data[1] || [])
        .filter((obs: any) => obs.value !== null)
        .map((obs: any) => ({
          date: obs.date,
          value: obs.value,
          country: obs.country?.value,
          countryCode: obs.countryiso3code,
        }));

      return new Response(
        JSON.stringify({ observations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ingest series into database
    if (action === "ingest") {
      const indicatorId = url.searchParams.get("indicatorId");
      const country = url.searchParams.get("country") || "WLD";
      const title = url.searchParams.get("title") || indicatorId;
      
      if (!indicatorId) throw new Error("indicatorId required");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const seriesId = `WB_${indicatorId}_${country}`;

      // Insert series metadata
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "WORLDBANK",
        provider_id: `${indicatorId}/${country}`,
        title: title,
        description: `World Bank ${indicatorId} for ${country}`,
        freq: "A",
        unit_original: null,
        currency_orig: null,
        geo: country,
      });

      if (seriesError) throw seriesError;

      // Fetch observations
      const obsUrl = `${WB_BASE_URL}/country/${country}/indicator/${indicatorId}?format=json&date=1960:${new Date().getFullYear()}&per_page=1000`;
      const response = await fetch(obsUrl);
      
      if (!response.ok) {
        throw new Error(`World Bank API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse observations
      const observations: { series_id: string; date: string; value: number | null }[] = [];
      
      for (const obs of (data[1] || [])) {
        if (obs.value !== null) {
          observations.push({
            series_id: seriesId,
            date: `${obs.date}-01-01`,
            value: obs.value,
          });
        }
      }

      if (observations.length > 0) {
        const { error: obsError } = await supabase
          .from("observations")
          .upsert(observations, { onConflict: "series_id,date" });

        if (obsError) throw obsError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          seriesId,
          observationCount: observations.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-worldbank:", error);
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
