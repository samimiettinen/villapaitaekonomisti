import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OECD_BASE_URL = "https://sdmx.oecd.org/public/rest";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log("OECD API Request:", { action });

    // Search dataflows
    if (action === "search") {
      const query = url.searchParams.get("query") || "";
      const dataflowUrl = `${OECD_BASE_URL}/dataflow/OECD?format=json`;
      
      const response = await fetch(dataflowUrl, {
        headers: { "Accept": "application/vnd.sdmx.structure+json;version=1.0" }
      });
      
      if (!response.ok) {
        throw new Error(`OECD API error: ${response.status}`);
      }
      
      const data = await response.json();
      const dataflows = data?.data?.dataflows || [];
      
      // Filter by query
      const filtered = dataflows
        .filter((df: any) => {
          const name = df.name || df.names?.en || "";
          const id = df.id || "";
          const searchLower = query.toLowerCase();
          return name.toLowerCase().includes(searchLower) || id.toLowerCase().includes(searchLower);
        })
        .slice(0, 50)
        .map((df: any) => ({
          id: df.id,
          name: df.name || df.names?.en || df.id,
          agencyID: df.agencyID || "OECD",
        }));

      return new Response(
        JSON.stringify({ results: filtered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch observations
    if (action === "observations") {
      const dataflowId = url.searchParams.get("dataflowId");
      const key = url.searchParams.get("key") || "all";
      const startPeriod = url.searchParams.get("startPeriod");
      const endPeriod = url.searchParams.get("endPeriod");
      
      if (!dataflowId) throw new Error("dataflowId required");

      let obsUrl = `${OECD_BASE_URL}/data/OECD.SDD.TPS,DSD_${dataflowId}@DF_${dataflowId},1.0/${key}?format=json`;
      if (startPeriod) obsUrl += `&startPeriod=${startPeriod}`;
      if (endPeriod) obsUrl += `&endPeriod=${endPeriod}`;

      console.log("Fetching OECD data:", obsUrl);

      // Try alternative URL format if first fails
      let response = await fetch(obsUrl, {
        headers: { "Accept": "application/vnd.sdmx.data+json;version=1.0" }
      });
      
      if (!response.ok) {
        // Try simpler URL format
        obsUrl = `${OECD_BASE_URL}/data/${dataflowId}/${key}?format=json`;
        if (startPeriod) obsUrl += `&startPeriod=${startPeriod}`;
        if (endPeriod) obsUrl += `&endPeriod=${endPeriod}`;
        
        response = await fetch(obsUrl, {
          headers: { "Accept": "application/vnd.sdmx.data+json;version=1.0" }
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OECD API error:", errorText);
        throw new Error(`OECD API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse SDMX JSON format
      const observations: { date: string; value: number | null }[] = [];
      const timeDimension = data?.data?.structure?.dimensions?.observation?.find((d: any) => d.id === "TIME_PERIOD");
      const timePeriods = timeDimension?.values || [];
      
      const dataSets = data?.data?.dataSets || [];
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
      const key = url.searchParams.get("key") || "all";
      const title = url.searchParams.get("title") || dataflowId;
      const geo = url.searchParams.get("geo") || "OECD";
      
      if (!dataflowId) throw new Error("dataflowId required");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const seriesId = `OECD_${dataflowId}_${key.replace(/\./g, "_")}`;

      // Insert series metadata
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "OECD",
        provider_id: `${dataflowId}/${key}`,
        title: title,
        description: `OECD ${dataflowId} series`,
        freq: null,
        unit_original: null,
        currency_orig: null,
        geo: geo,
      });

      if (seriesError) throw seriesError;

      // Fetch observations
      let obsUrl = `${OECD_BASE_URL}/data/${dataflowId}/${key}?format=json`;
      const response = await fetch(obsUrl, {
        headers: { "Accept": "application/vnd.sdmx.data+json;version=1.0" }
      });
      
      if (!response.ok) {
        throw new Error(`OECD API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse observations
      const observations: { series_id: string; date: string; value: number | null }[] = [];
      const timeDimension = data?.data?.structure?.dimensions?.observation?.find((d: any) => d.id === "TIME_PERIOD");
      const timePeriods = timeDimension?.values || [];
      
      const dataSets = data?.data?.dataSets || [];
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
    console.error("Error in fetch-oecd:", error);
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
