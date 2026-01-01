import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// StatFin birth statistics table
const BIRTHS_TABLE_URL = "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/synt/statfin_synt_pxt_12dl.px";

// ========== Types ==========

interface PxVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
}

interface StatFinTableMeta {
  title: string;
  variables: PxVariable[];
  source?: string;
  updated?: string;
}

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

interface BirthDataRow {
  year: string;
  month: string;
  info: string;
  infoText: string;
  value: number | null;
}

interface JsonStat2Response {
  version: string;
  class: string;
  label: string;
  source: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, {
    label: string;
    category: {
      index: Record<string, number>;
      label: Record<string, string>;
    };
  }>;
  value: (number | null)[];
}

// ========== Helper Functions ==========

/**
 * Parse metadata response from PxWeb
 */
function parseMetadata(data: any): StatFinTableMeta {
  return {
    title: data.title || "",
    source: data.source || null,
    updated: data.updated || null,
    variables: (data.variables || []).map((v: any) => ({
      code: v.code,
      text: v.text,
      values: v.values || [],
      valueTexts: v.valueTexts || [],
      time: v.time || false,
    })),
  };
}

/**
 * Find time variable (year/month) from metadata
 */
function findTimeVariable(variables: PxVariable[]): PxVariable | undefined {
  return variables.find(v => 
    v.time === true || 
    v.code.toLowerCase().includes('vuosi') ||
    v.code.toLowerCase().includes('year') ||
    v.code.toLowerCase().includes('kuukausi') ||
    v.code.toLowerCase().includes('month')
  );
}

/**
 * Find content/data variable from metadata
 */
function findContentVariable(variables: PxVariable[]): PxVariable | undefined {
  return variables.find(v => 
    v.code.toLowerCase() === 'tiedot' ||
    v.code.toLowerCase() === 'contentsCode' ||
    v.code.toLowerCase().includes('info')
  ) || variables[variables.length - 1];
}

/**
 * Build PxWeb query dynamically from parameters
 */
function buildQuery(
  meta: StatFinTableMeta,
  years?: string[],
  months?: string[],
  infoCodes?: string[]
): PxWebQuery {
  const query: PxWebQuery["query"] = [];

  for (const variable of meta.variables) {
    const code = variable.code;
    let values: string[] = [];

    // Year variable (Vuosi)
    if (code === "Vuosi" || code.toLowerCase().includes("year")) {
      values = years && years.length > 0 
        ? years.filter(y => variable.values.includes(y))
        : variable.values.slice(-10); // Last 10 years by default
    }
    // Month variable (Kuukausi or Kuun)
    else if (code === "Kuukausi" || code === "Kuun" || code.toLowerCase().includes("month")) {
      values = months && months.length > 0
        ? months.filter(m => variable.values.includes(m))
        : variable.values; // All months by default
    }
    // Info/Data variable (Tiedot)
    else if (code === "Tiedot" || code.toLowerCase().includes("info")) {
      values = infoCodes && infoCodes.length > 0
        ? infoCodes.filter(i => variable.values.includes(i))
        : variable.values.slice(0, 1); // First info code by default
    }
    // Other variables - take all values
    else {
      values = variable.values;
    }

    if (values.length > 0) {
      query.push({
        code,
        selection: {
          filter: "item",
          values,
        },
      });
    }
  }

  return {
    query,
    response: { format: "json-stat2" },
  };
}

/**
 * Parse JSON-stat2 response into data rows
 */
function parseJsonStat2Response(data: JsonStat2Response, meta: StatFinTableMeta): BirthDataRow[] {
  const rows: BirthDataRow[] = [];
  
  const dimensionIds = data.id;
  const sizes = data.size;
  const values = data.value;

  // Build dimension lookup
  const dimensions: Record<string, { codes: string[]; labels: Record<string, string> }> = {};
  
  for (const dimId of dimensionIds) {
    const dim = data.dimension[dimId];
    if (dim) {
      const codes = Object.keys(dim.category.index).sort((a, b) => 
        dim.category.index[a] - dim.category.index[b]
      );
      dimensions[dimId] = {
        codes,
        labels: dim.category.label,
      };
    }
  }

  // Calculate strides for multi-dimensional indexing
  const strides: number[] = [];
  let stride = 1;
  for (let i = dimensionIds.length - 1; i >= 0; i--) {
    strides.unshift(stride);
    stride *= sizes[i];
  }

  // Iterate through all values
  for (let i = 0; i < values.length; i++) {
    const indices: number[] = [];
    let remaining = i;
    
    for (let d = 0; d < dimensionIds.length; d++) {
      indices.push(Math.floor(remaining / strides[d]));
      remaining = remaining % strides[d];
    }

    // Extract dimension values
    let year = "";
    let month = "";
    let info = "";
    let infoText = "";

    for (let d = 0; d < dimensionIds.length; d++) {
      const dimId = dimensionIds[d];
      const dim = dimensions[dimId];
      const code = dim.codes[indices[d]];
      const label = dim.labels[code] || code;

      if (dimId === "Vuosi" || dimId.toLowerCase().includes("year")) {
        year = code;
      } else if (dimId === "Kuukausi" || dimId === "Kuun" || dimId.toLowerCase().includes("month")) {
        month = code;
      } else if (dimId === "Tiedot" || dimId.toLowerCase().includes("info")) {
        info = code;
        infoText = label;
      }
    }

    rows.push({
      year,
      month,
      info,
      infoText,
      value: values[i],
    });
  }

  return rows;
}

// ========== Request Handler ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log("StatFin Births API Request:", { action });

    // ===== GET /meta - Fetch table metadata =====
    if (action === "meta") {
      const response = await fetch(BIRTHS_TABLE_URL, {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("StatFin metadata error:", response.status, errorText);
        throw new Error(`StatFin API returned ${response.status}: ${errorText}`);
      }

      const rawData = await response.json();
      const meta = parseMetadata(rawData);

      console.log("Fetched metadata:", meta.title, "Variables:", meta.variables.length);

      return new Response(
        JSON.stringify({
          success: true,
          meta,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== POST /data - Fetch birth statistics data =====
    if (action === "data") {
      // Parse request body
      let body: { years?: string[]; months?: string[]; infoCodes?: string[] } = {};
      
      if (req.method === "POST") {
        try {
          body = await req.json();
        } catch {
          // Use defaults if no body
        }
      }

      const { years, months, infoCodes } = body;

      console.log("Fetching births data:", { years, months, infoCodes });

      // First fetch metadata to build query dynamically
      const metaResponse = await fetch(BIRTHS_TABLE_URL, {
        headers: { "Accept": "application/json" },
      });

      if (!metaResponse.ok) {
        throw new Error(`Failed to fetch metadata: ${metaResponse.status}`);
      }

      const rawMeta = await metaResponse.json();
      const meta = parseMetadata(rawMeta);

      // Build query dynamically from metadata
      const query = buildQuery(meta, years, months, infoCodes);

      console.log("Built PxWeb query:", JSON.stringify(query, null, 2));

      // Fetch data with POST
      const dataResponse = await fetch(BIRTHS_TABLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(query),
      });

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error("StatFin data error:", dataResponse.status, errorText);
        throw new Error(`StatFin API returned ${dataResponse.status}: ${errorText}`);
      }

      const jsonStatData = await dataResponse.json() as JsonStat2Response;
      
      console.log("Received JSON-stat2 data, dimensions:", jsonStatData.id);

      // Parse JSON-stat2 response
      const rows = parseJsonStat2Response(jsonStatData, meta);

      console.log(`Parsed ${rows.length} data rows`);

      return new Response(
        JSON.stringify({
          success: true,
          meta: {
            title: jsonStatData.label,
            source: jsonStatData.source,
            updated: jsonStatData.updated,
          },
          data: rows,
          rowCount: rows.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== POST /ingest - Ingest birth data into database =====
    if (action === "ingest") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Parse request body for custom parameters
      let body: { years?: string[]; months?: string[]; infoCodes?: string[]; seriesId?: string; title?: string } = {};
      
      if (req.method === "POST") {
        try {
          body = await req.json();
        } catch {
          // Use defaults
        }
      }

      const seriesId = body.seriesId || "STATFIN_BIRTHS";
      const customTitle = body.title || "Finnish Live Births, Monthly";

      console.log("Ingesting births data:", { seriesId, customTitle });

      // Fetch metadata
      const metaResponse = await fetch(BIRTHS_TABLE_URL);
      if (!metaResponse.ok) throw new Error(`Metadata fetch failed: ${metaResponse.status}`);
      
      const rawMeta = await metaResponse.json();
      const meta = parseMetadata(rawMeta);

      // Build query - get all available data
      const query = buildQuery(meta, body.years, body.months, body.infoCodes);

      // Fetch data
      const dataResponse = await fetch(BIRTHS_TABLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        throw new Error(`Data fetch failed: ${dataResponse.status} - ${errorText}`);
      }

      const jsonStatData = await dataResponse.json() as JsonStat2Response;
      const rows = parseJsonStat2Response(jsonStatData, meta);

      // Upsert series
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "STATFIN",
        provider_id: "StatFin/synt/statfin_synt_pxt_12dl.px",
        title: customTitle,
        description: meta.title,
        freq: "M",
        unit_original: "Count",
        currency_orig: null,
        geo: "FI",
      }, { onConflict: "id" });

      if (seriesError) throw seriesError;

      // Convert to observations and upsert
      const observations = rows
        .filter(row => row.value !== null && row.year && row.month)
        .map(row => {
          // Convert month to 2-digit format
          const monthNum = parseInt(row.month, 10);
          const monthStr = monthNum.toString().padStart(2, "0");
          const date = `${row.year}-${monthStr}-01`;

          return {
            series_id: seriesId,
            date,
            value: row.value,
            value_eur: null,
          };
        });

      // Deduplicate by date (keep first)
      const uniqueObs = new Map<string, typeof observations[0]>();
      for (const obs of observations) {
        if (!uniqueObs.has(obs.date)) {
          uniqueObs.set(obs.date, obs);
        }
      }

      const dedupedObs = Array.from(uniqueObs.values());

      if (dedupedObs.length > 0) {
        // Batch upsert
        const batchSize = 500;
        for (let i = 0; i < dedupedObs.length; i += batchSize) {
          const batch = dedupedObs.slice(i, i + batchSize);
          const { error: obsError } = await supabase
            .from("observations")
            .upsert(batch, { onConflict: "series_id,date" });

          if (obsError) throw obsError;
        }
      }

      console.log(`Ingested ${dedupedObs.length} observations for ${seriesId}`);

      return new Response(
        JSON.stringify({
          success: true,
          seriesId,
          observationCount: dedupedObs.length,
          sampleDates: dedupedObs.slice(0, 5).map(o => o.date),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: meta, data, or ingest" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in fetch-statfin-births:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
