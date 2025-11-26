import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PxWebQuery {
  query: Array<{
    code: string;
    selection: {
      filter: string;
      values: string[];
    };
  }>;
  response: {
    format: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const language = url.searchParams.get("language") || "en";

    console.log("StatFin API Request:", { action, language });

    const pxwebBaseUrl = `https://pxdata.stat.fi/PXWeb/api/v1/${language}`;

    // List databases
    if (action === "databases") {
      const response = await fetch(`${pxwebBaseUrl}`);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List tables in a database
    if (action === "tables") {
      const databasePath = url.searchParams.get("databasePath") || "StatFin";
      const response = await fetch(`${pxwebBaseUrl}/${databasePath}`);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get table metadata
    if (action === "metadata") {
      const tablePath = url.searchParams.get("tablePath");
      if (!tablePath) {
        throw new Error("tablePath required");
      }

      const response = await fetch(`${pxwebBaseUrl}/${tablePath}`);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch table data
    if (action === "data") {
      const tablePath = url.searchParams.get("tablePath");
      if (!tablePath) {
        throw new Error("tablePath required");
      }

      const body = await req.json();
      const query: PxWebQuery = body.query;

      const response = await fetch(`${pxwebBaseUrl}/${tablePath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ingest table into database
    if (action === "ingest") {
      const tablePath = url.searchParams.get("tablePath");
      if (!tablePath) {
        throw new Error("tablePath required");
      }

      const body = await req.json();
      const query: PxWebQuery = body.query;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch metadata
      const metaResponse = await fetch(`${pxwebBaseUrl}/${tablePath}`);
      const metadata = await metaResponse.json();

      // Fetch data
      const dataResponse = await fetch(`${pxwebBaseUrl}/${tablePath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      });

      const data = await dataResponse.json();

      // Extract series ID and title from metadata
      const seriesId = `STATFIN_${tablePath.replace(/\//g, "_")}`;
      const title = metadata.title || tablePath;

      // Insert or update series
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "STATFIN",
        provider_id: tablePath,
        title: title,
        description: null,
        freq: null,
        unit_original: data.columns?.[0]?.unit || null,
        currency_orig: "EUR",
        geo: "FI",
      });

      if (seriesError) throw seriesError;

      // Parse observations from PxWeb JSON format
      const observations: Array<{ date: string; value: number }> = [];
      
      if (data.data) {
        data.data.forEach((item: any) => {
          if (item.key && item.values) {
            // Extract date from key (format depends on PxWeb structure)
            const dateKey = item.key[0] || "";
            const value = parseFloat(item.values[0]);
            
            if (!isNaN(value)) {
              observations.push({
                date: dateKey,
                value: value,
              });
            }
          }
        });
      }

      // Insert observations
      if (observations.length > 0) {
        const obsToInsert = observations.map((obs) => ({
          series_id: seriesId,
          date: obs.date,
          value: obs.value,
          value_eur: obs.value,
          value_usd: null,
        }));

        const { error: obsError } = await supabase
          .from("observations")
          .upsert(obsToInsert, { onConflict: "series_id,date" });

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
    console.error("Error in fetch-statfin:", error);
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
