import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ECB SDMX REST API
const ECB_BASE_URL = "https://data-api.ecb.europa.eu/service";

interface ECBDataflow {
  id: string;
  name: string;
  agencyID: string;
}

interface ECBObservation {
  date: string;
  value: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log("ECB API Request:", { action });

    // Search dataflows (datasets)
    if (action === "search") {
      const query = url.searchParams.get("query") || "";
      const dataflowUrl = `${ECB_BASE_URL}/dataflow/ECB?format=jsondata`;
      
      const response = await fetch(dataflowUrl, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }
      
      const data = await response.json();
      const dataflows = data?.data?.dataflows || [];
      
      // Filter by query
      const filtered = dataflows
        .filter((df: any) => {
          const name = df.name || "";
          const id = df.id || "";
          const searchLower = query.toLowerCase();
          return name.toLowerCase().includes(searchLower) || id.toLowerCase().includes(searchLower);
        })
        .slice(0, 50)
        .map((df: any) => ({
          id: df.id,
          name: df.name,
          agencyID: df.agencyID || "ECB",
        }));

      return new Response(
        JSON.stringify({ results: filtered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List dimensions for a dataflow
    if (action === "dimensions") {
      const dataflowId = url.searchParams.get("dataflowId");
      if (!dataflowId) throw new Error("dataflowId required");

      const structureUrl = `${ECB_BASE_URL}/datastructure/ECB/${dataflowId}?format=jsondata&references=children`;
      
      const response = await fetch(structureUrl, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch observations
    if (action === "observations") {
      const dataflowId = url.searchParams.get("dataflowId");
      const seriesKey = url.searchParams.get("seriesKey") || "..";
      const startPeriod = url.searchParams.get("startPeriod");
      const endPeriod = url.searchParams.get("endPeriod");
      
      if (!dataflowId) throw new Error("dataflowId required");

      let obsUrl = `${ECB_BASE_URL}/data/${dataflowId}/${seriesKey}?format=jsondata`;
      if (startPeriod) obsUrl += `&startPeriod=${startPeriod}`;
      if (endPeriod) obsUrl += `&endPeriod=${endPeriod}`;

      console.log("Fetching ECB data:", obsUrl);

      const response = await fetch(obsUrl, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ECB API error:", errorText);
        throw new Error(`ECB API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse SDMX JSON format
      const observations: ECBObservation[] = [];
      const dataSets = data?.data?.dataSets || [];
      const timePeriods = data?.data?.structure?.dimensions?.observation?.[0]?.values || [];
      
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
      const dataflowId = url.searchParams.get("dataflowId");
      const seriesKey = url.searchParams.get("seriesKey") || "..";
      const title = url.searchParams.get("title") || dataflowId;
      const customSeriesId = url.searchParams.get("seriesId"); // Allow custom series ID
      
      if (!dataflowId) throw new Error("dataflowId required");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Use custom seriesId if provided, otherwise generate from dataflow/key
      const seriesId = customSeriesId || `ECB_${dataflowId}_${seriesKey.replace(/\./g, "_")}`;
      const providerId = `${dataflowId}/${seriesKey}`;
      
      console.log("ECB ingest:", { dataflowId, seriesKey, seriesId, title });

      // Check if series exists with this provider_id (may have different id)
      const { data: existingSeries } = await supabase
        .from("series")
        .select("id")
        .eq("source", "ECB")
        .eq("provider_id", providerId)
        .maybeSingle();

      // If exists with different ID, delete the old one first to avoid conflict
      if (existingSeries && existingSeries.id !== seriesId) {
        console.log(`Replacing series ${existingSeries.id} with ${seriesId}`);
        // Delete old observations first
        await supabase.from("observations").delete().eq("series_id", existingSeries.id);
        // Delete old series
        await supabase.from("series").delete().eq("id", existingSeries.id);
      }

      // Upsert series metadata using id as conflict target
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "ECB",
        provider_id: providerId,
        title: title,
        description: `ECB ${dataflowId} series`,
        freq: null,
        unit_original: null,
        currency_orig: "EUR",
        geo: "EU",
      }, { onConflict: "id" });

      if (seriesError) throw seriesError;

      // Fetch observations
      const obsUrl = `${ECB_BASE_URL}/data/${dataflowId}/${seriesKey}?format=jsondata`;
      const response = await fetch(obsUrl, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse observations
      const observations: { series_id: string; date: string; value: number | null; value_eur: number | null }[] = [];
      const dataSets = data?.data?.dataSets || [];
      const timePeriods = data?.data?.structure?.dimensions?.observation?.[0]?.values || [];
      
      if (dataSets.length > 0 && dataSets[0].series) {
        const firstSeriesKey = Object.keys(dataSets[0].series)[0];
        const seriesObs = dataSets[0].series[firstSeriesKey]?.observations || {};
        
        for (const [idx, values] of Object.entries(seriesObs)) {
          const period = timePeriods[parseInt(idx)]?.id;
          const value = (values as number[])[0];
          if (period) {
            // Convert period to date format (YYYY-MM-DD)
            let dateStr = period;
            if (period.match(/^\d{4}$/)) {
              dateStr = `${period}-01-01`;
            } else if (period.match(/^\d{4}-\d{2}$/)) {
              dateStr = `${period}-01`;
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
    console.error("Error in fetch-ecb:", error);
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
