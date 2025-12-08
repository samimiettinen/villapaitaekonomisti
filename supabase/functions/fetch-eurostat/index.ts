import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EUROSTAT_BASE_URL = "https://ec.europa.eu/eurostat/api/dissemination";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log("Eurostat API Request:", { action });

    // Search datasets
    if (action === "search") {
      const query = url.searchParams.get("query") || "";
      const searchUrl = `${EUROSTAT_BASE_URL}/catalogue/toc/txt?lang=EN`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Eurostat API error: ${response.status}`);
      }
      
      const text = await response.text();
      const lines = text.split("\n");
      
      // Parse the TSV format and filter
      const results: { id: string; title: string }[] = [];
      const queryLower = query.toLowerCase();
      
      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const id = parts[0].trim();
          const title = parts[1].trim();
          
          if (id && title && 
              (id.toLowerCase().includes(queryLower) || 
               title.toLowerCase().includes(queryLower))) {
            results.push({ id, title });
            if (results.length >= 50) break;
          }
        }
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get dataset metadata
    if (action === "metadata") {
      const datasetId = url.searchParams.get("datasetId");
      if (!datasetId) throw new Error("datasetId required");

      const metaUrl = `${EUROSTAT_BASE_URL}/sdmx/2.1/datastructure/ESTAT/${datasetId}?format=JSON`;
      
      const response = await fetch(metaUrl);
      
      if (!response.ok) {
        throw new Error(`Eurostat API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch observations
    if (action === "observations") {
      const datasetId = url.searchParams.get("datasetId");
      const filters = url.searchParams.get("filters") || "";
      
      if (!datasetId) throw new Error("datasetId required");

      const obsUrl = `${EUROSTAT_BASE_URL}/sdmx/2.1/data/${datasetId}/${filters}?format=JSON`;

      console.log("Fetching Eurostat data:", obsUrl);

      const response = await fetch(obsUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Eurostat API error:", errorText);
        throw new Error(`Eurostat API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse SDMX JSON format
      const observations: { date: string; value: number | null }[] = [];
      const timeDimension = data?.structure?.dimensions?.observation?.find((d: any) => d.id === "TIME_PERIOD");
      const timePeriods = timeDimension?.values || [];
      
      const dataSets = data?.dataSets || [];
      if (dataSets.length > 0 && dataSets[0].series) {
        const firstSeriesKey = Object.keys(dataSets[0].series)[0];
        const seriesObs = dataSets[0].series[firstSeriesKey]?.observations || {};
        
        for (const [idx, values] of Object.entries(seriesObs)) {
          const period = timePeriods[parseInt(idx)]?.id;
          const value = (values as number[])[0];
          if (period) {
            observations.push({
              date: period,
              value: value ?? null,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ observations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ingest series into database
    if (action === "ingest") {
      const datasetId = url.searchParams.get("datasetId");
      const filters = url.searchParams.get("filters") || "";
      const title = url.searchParams.get("title") || datasetId;
      const geo = url.searchParams.get("geo") || "EU";
      
      if (!datasetId) throw new Error("datasetId required");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const seriesId = `EUROSTAT_${datasetId}_${filters.replace(/\./g, "_") || "default"}`;

      // Insert series metadata
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "EUROSTAT",
        provider_id: `${datasetId}/${filters}`,
        title: title,
        description: `Eurostat ${datasetId} series`,
        freq: null,
        unit_original: null,
        currency_orig: "EUR",
        geo: geo,
      });

      if (seriesError) throw seriesError;

      // Fetch observations
      const obsUrl = `${EUROSTAT_BASE_URL}/sdmx/2.1/data/${datasetId}/${filters}?format=JSON`;
      const response = await fetch(obsUrl);
      
      if (!response.ok) {
        throw new Error(`Eurostat API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse observations
      const observations: { series_id: string; date: string; value: number | null; value_eur: number | null }[] = [];
      const timeDimension = data?.structure?.dimensions?.observation?.find((d: any) => d.id === "TIME_PERIOD");
      const timePeriods = timeDimension?.values || [];
      
      const dataSets = data?.dataSets || [];
      if (dataSets.length > 0 && dataSets[0].series) {
        const firstSeriesKey = Object.keys(dataSets[0].series)[0];
        const seriesObs = dataSets[0].series[firstSeriesKey]?.observations || {};
        
        for (const [idx, values] of Object.entries(seriesObs)) {
          const period = timePeriods[parseInt(idx)]?.id;
          const value = (values as number[])[0];
          if (period) {
            let dateStr = period;
            if (period.match(/^\d{4}$/)) {
              dateStr = `${period}-01-01`;
            } else if (period.match(/^\d{4}-\d{2}$/)) {
              dateStr = `${period}-01`;
            } else if (period.match(/^\d{4}Q\d$/)) {
              const year = period.substring(0, 4);
              const quarter = parseInt(period.substring(5));
              const month = String((quarter - 1) * 3 + 1).padStart(2, "0");
              dateStr = `${year}-${month}-01`;
            }
            
            observations.push({
              series_id: seriesId,
              date: dateStr,
              value: value ?? null,
              value_eur: value ?? null,
            });
          }
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
    console.error("Error in fetch-eurostat:", error);
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
