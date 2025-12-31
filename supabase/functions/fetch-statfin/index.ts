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

interface PxWebVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
}

interface PxWebMetadata {
  title: string;
  variables: PxWebVariable[];
  updated?: string;
  source?: string;
}

interface PxWebDataItem {
  key: string[];
  values: string[];
}

interface PxWebDataResponse {
  columns?: Array<{ code: string; text: string; type: string; unit?: string }>;
  comments?: any[];
  data?: PxWebDataItem[];
}

/**
 * Find the time variable in metadata
 */
function findTimeVariable(variables: PxWebVariable[]): { index: number; variable: PxWebVariable | null } {
  const idx = variables.findIndex(
    (v) =>
      v.time === true ||
      v.code.toLowerCase().includes('vuosi') ||
      v.code.toLowerCase().includes('aika') ||
      v.code.toLowerCase().includes('kuukausi') ||
      v.code.toLowerCase().includes('neljännes') ||
      v.code.toLowerCase() === 'year' ||
      v.code.toLowerCase() === 'time' ||
      v.code.toLowerCase() === 'quarter' ||
      v.code.toLowerCase() === 'month' ||
      (v.values.length > 0 && /^\d{4}/.test(v.values[0]))
  );
  return { index: idx, variable: idx >= 0 ? variables[idx] : null };
}

/**
 * Convert StatFin time values to ISO date format
 * - Annual: 2020 -> 2020-01-01
 * - Quarterly: 2020Q1 or 2020K1 -> 2020-01-01, Q2->04-01, Q3->07-01, Q4->10-01
 * - Monthly: 2020M01 or 2020-01 -> 2020-01-01
 */
function normalizeTimeToISO(timeKey: string): string {
  if (!timeKey) return '';
  
  // Quarterly format: 2024Q1, 2024K1, 2024Q3
  const quarterMatch = timeKey.match(/^(\d{4})[QK](\d)$/i);
  if (quarterMatch) {
    const year = quarterMatch[1];
    const quarter = parseInt(quarterMatch[2]);
    const monthMap: Record<number, string> = { 1: '01', 2: '04', 3: '07', 4: '10' };
    const month = monthMap[quarter] || '01';
    return `${year}-${month}-01`;
  }
  
  // Monthly format: 2024M01
  const monthMatch = timeKey.match(/^(\d{4})M(\d{2})$/i);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}-01`;
  }
  
  // Monthly format: 2024-01
  const monthDashMatch = timeKey.match(/^(\d{4})-(\d{2})$/);
  if (monthDashMatch) {
    return `${monthDashMatch[1]}-${monthDashMatch[2]}-01`;
  }
  
  // Already ISO format: 2024-01-01
  if (/^\d{4}-\d{2}-\d{2}$/.test(timeKey)) {
    return timeKey;
  }
  
  // Annual format: 2024 -> 2024-01-01
  if (/^\d{4}$/.test(timeKey)) {
    return `${timeKey}-01-01`;
  }
  
  // Fallback: return as is
  return timeKey;
}

/**
 * Determine frequency from time values
 */
function detectFrequency(timeValues: string[]): string {
  if (timeValues.length === 0) return 'A';
  const sample = timeValues[0];
  if (/[QK]\d/i.test(sample)) return 'Q';
  if (/M\d{2}/i.test(sample) || /^\d{4}-\d{2}$/.test(sample)) return 'M';
  return 'A';
}

/**
 * Flatten PxWeb response to observations array
 * Deduplicate by date - if multiple values exist for same date, take the first one
 */
function flattenPxWebToObservations(
  data: PxWebDataResponse,
  metadata: PxWebMetadata,
  seriesId: string
): Array<{ series_id: string; date: string; value: number | null; value_eur: number | null }> {
  const observationMap = new Map<string, { series_id: string; date: string; value: number | null; value_eur: number | null }>();
  
  if (!data.data || !Array.isArray(data.data)) {
    console.log("No data array in PxWeb response");
    return [];
  }
  
  const { index: timeIndex, variable: timeVar } = findTimeVariable(metadata.variables);
  console.log(`Time variable found at index ${timeIndex}:`, timeVar?.code);
  
  if (timeIndex < 0) {
    console.warn("No time variable found in metadata, attempting position-based extraction");
  }
  
  // Build lookup for time values -> ISO dates
  const timeValueToISO: Record<string, string> = {};
  if (timeVar) {
    timeVar.values.forEach((val) => {
      timeValueToISO[val] = normalizeTimeToISO(val);
    });
  }
  
  // Process each data item
  data.data.forEach((item) => {
    if (!item.key || !item.values || item.values.length === 0) return;
    
    // Get time value from the key at timeIndex, or assume first key is time
    const timeKey = timeIndex >= 0 ? item.key[timeIndex] : item.key[0];
    const date = timeValueToISO[timeKey] || normalizeTimeToISO(timeKey);
    
    if (!date) {
      console.warn("Could not parse date from:", timeKey);
      return;
    }
    
    // Skip if we already have an observation for this date (deduplicate)
    if (observationMap.has(date)) {
      return;
    }
    
    // Parse value (handle ".." as null)
    const rawValue = item.values[0];
    let value: number | null = null;
    if (rawValue !== '..' && rawValue !== '.' && rawValue !== '' && rawValue !== null && rawValue !== undefined) {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }
    
    observationMap.set(date, {
      series_id: seriesId,
      date,
      value,
      value_eur: value, // StatFin data is in EUR
    });
  });
  
  const observations = Array.from(observationMap.values());
  console.log(`Flattened ${observations.length} observations (deduplicated from ${data.data.length} items)`);
  return observations;
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
      let databasePath = url.searchParams.get("databasePath") || "StatFin";
      databasePath = databasePath.replace(/^\/+|\/+$/g, '');
      
      const apiUrl = `${pxwebBaseUrl}/${databasePath}`;
      console.log("Fetching tables from:", apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("StatFin API error:", response.status, errorText);
        throw new Error(`StatFin API returned ${response.status}: ${errorText}`);
      }
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get table metadata
    if (action === "metadata") {
      let tablePath = url.searchParams.get("tablePath");
      if (!tablePath) {
        throw new Error("tablePath required");
      }
      tablePath = tablePath.replace(/^\/+/, '');
      if (!tablePath.includes("/") || !["StatFin", "Check", "Hyvinvointialueet", "Kokeelliset_tilastot", "Kuntien_avainluvut", "Kuntien_talous_ja_toiminta", "Maahanmuuttajat_ja_kotoutuminen", "NOVI-fi", "Postinumeroalueittainen_avoin_tieto", "SDG", "StatFin_Passiivi"].some(db => tablePath!.startsWith(db))) {
        tablePath = `StatFin/${tablePath}`;
      }

      const apiUrl = `${pxwebBaseUrl}/${tablePath}`;
      console.log("Fetching metadata from:", apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("StatFin API error:", response.status, errorText);
        throw new Error(`StatFin API returned ${response.status}: ${errorText}`);
      }
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch table data
    if (action === "data") {
      let tablePath = url.searchParams.get("tablePath");
      if (!tablePath) {
        throw new Error("tablePath required");
      }
      tablePath = tablePath.replace(/^\/+/, '');
      if (!tablePath.includes("/") || !["StatFin", "Check", "Hyvinvointialueet", "Kokeelliset_tilastot", "Kuntien_avainluvut", "Kuntien_talous_ja_toiminta", "Maahanmuuttajat_ja_kotoutuminen", "NOVI-fi", "Postinumeroalueittainen_avoin_tieto", "SDG", "StatFin_Passiivi"].some(db => tablePath!.startsWith(db))) {
        tablePath = `StatFin/${tablePath}`;
      }

      const body = await req.json();
      const query: PxWebQuery = body.query;

      const apiUrl = `${pxwebBaseUrl}/${tablePath}`;
      console.log("Fetching data from:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("StatFin API error:", response.status, errorText);
        throw new Error(`StatFin API returned ${response.status}: ${errorText}`);
      }
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ingest table into database - IMPROVED VERSION
    if (action === "ingest") {
      let tablePath = url.searchParams.get("tablePath");
      const seriesIdParam = url.searchParams.get("seriesId"); // Optional custom series ID
      
      if (!tablePath) {
        throw new Error("tablePath required");
      }
      tablePath = tablePath.replace(/^\/+/, '');
      if (!tablePath.includes("/") || !["StatFin", "Check", "Hyvinvointialueet", "Kokeelliset_tilastot", "Kuntien_avainluvut", "Kuntien_talous_ja_toiminta", "Maahanmuuttajat_ja_kotoutuminen", "NOVI-fi", "Postinumeroalueittainen_avoin_tieto", "SDG", "StatFin_Passiivi"].some(db => tablePath!.startsWith(db))) {
        tablePath = `StatFin/${tablePath}`;
      }

      const body = await req.json();
      const query: PxWebQuery = body.query;
      const customTitle = body.title as string | undefined;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const apiUrl = `${pxwebBaseUrl}/${tablePath}`;
      console.log("Ingesting from:", apiUrl);

      // Fetch metadata first
      const metaResponse = await fetch(apiUrl);
      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        console.error("StatFin metadata error:", metaResponse.status, errorText);
        throw new Error(`StatFin API returned ${metaResponse.status}: ${errorText}`);
      }
      const metadata: PxWebMetadata = await metaResponse.json();
      console.log("Metadata title:", metadata.title);
      console.log("Variables:", metadata.variables?.map(v => `${v.code} (${v.values.length} values)`).join(', '));

      // Fetch data
      const dataResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      });

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error("StatFin data error:", dataResponse.status, errorText);
        throw new Error(`StatFin API returned ${dataResponse.status}: ${errorText}`);
      }
      const data: PxWebDataResponse = await dataResponse.json();
      console.log("Data items received:", data.data?.length || 0);

      // Generate series ID
      const seriesId = seriesIdParam || `STATFIN_${tablePath.replace(/\//g, "_").replace(/\.px$/, '')}`;
      const title = customTitle || metadata.title || tablePath;

      // Detect frequency from time variable
      const { variable: timeVar } = findTimeVariable(metadata.variables);
      const freq = timeVar ? detectFrequency(timeVar.values) : 'A';

      // Extract unit from response columns or metadata
      const unit = data.columns?.find(c => c.type === 'c')?.unit || 
                   data.columns?.find(c => c.type === 'c')?.text || 
                   null;

      // Upsert series
      const { error: seriesError } = await supabase.from("series").upsert({
        id: seriesId,
        source: "STATFIN",
        provider_id: tablePath,
        title: title,
        description: metadata.source || null,
        freq: freq,
        unit_original: unit,
        currency_orig: "EUR",
        geo: "FI",
      });

      if (seriesError) {
        console.error("Series upsert error:", seriesError);
        throw seriesError;
      }
      console.log("Series upserted:", seriesId);

      // Flatten observations
      const observations = flattenPxWebToObservations(data, metadata, seriesId);
      
      if (observations.length === 0) {
        console.warn("No observations extracted from data");
        return new Response(
          JSON.stringify({
            success: true,
            seriesId,
            observationCount: 0,
            warning: "No observations could be extracted from the data",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log first few observations for debugging
      console.log("Sample observations:", observations.slice(0, 3));

      // Upsert observations in batches
      const batchSize = 500;
      let insertedCount = 0;
      
      for (let i = 0; i < observations.length; i += batchSize) {
        const batch = observations.slice(i, i + batchSize);
        const { error: obsError } = await supabase
          .from("observations")
          .upsert(batch, { onConflict: "series_id,date" });

        if (obsError) {
          console.error("Observations upsert error:", obsError);
          throw obsError;
        }
        insertedCount += batch.length;
      }

      console.log(`Upserted ${insertedCount} observations for ${seriesId}`);

      return new Response(
        JSON.stringify({
          success: true,
          seriesId,
          title,
          freq,
          observationCount: insertedCount,
          sampleDates: observations.slice(0, 5).map(o => o.date),
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
