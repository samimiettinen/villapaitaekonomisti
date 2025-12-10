// StatFin PxWeb API Utility Module
// Handles hierarchical navigation and data fetching from Statistics Finland

export interface StatFinNode {
  id: string;
  text: string;
  type: 'folder' | 'table';
  path: string[];
  updated?: string;
}

export interface StatFinVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  elimination?: boolean;
  time?: boolean;
}

export interface StatFinTableMetadata {
  title: string;
  variables: StatFinVariable[];
  updated?: string;
  source?: string;
  label?: string;
}

export interface StatFinDataResponse {
  columns: Array<{ code: string; text: string; type: string }>;
  comments: any[];
  data: Array<{ key: string[]; values: string[] }>;
}

export interface StatFinQuery {
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

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Known StatFin database prefixes
const KNOWN_DATABASES = [
  "StatFin",
  "Check", 
  "Hyvinvointialueet",
  "Kokeelliset_tilastot",
  "Kuntien_avainluvut",
  "Kuntien_talous_ja_toiminta",
  "Maahanmuuttajat_ja_kotoutuminen",
  "NOVI-fi",
  "Postinumeroalueittainen_avoin_tieto",
  "SDG",
  "StatFin_Passiivi"
];

/**
 * Fetch navigation nodes (folders and tables) at a given path
 */
export async function fetchNavigation(
  path: string[] = [],
  language: 'en' | 'fi' = 'en'
): Promise<StatFinNode[]> {
  const pathStr = path.length > 0 ? path.join('/') : 'StatFin';
  
  const url = new URL(`${SUPABASE_URL}/functions/v1/fetch-statfin`);
  url.searchParams.set('action', 'tables');
  url.searchParams.set('databasePath', pathStr);
  url.searchParams.set('language', language);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to fetch navigation: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Transform PxWeb response to our StatFinNode format
  return data.map((item: any) => ({
    id: item.id,
    text: item.text,
    type: item.type === 't' ? 'table' : 'folder', // 't' = table, 'l' = level/folder
    path: [...path, item.id],
    updated: item.updated,
  }));
}

/**
 * Fetch metadata for a specific table
 */
export async function fetchTableMetadata(
  tablePath: string[],
  language: 'en' | 'fi' = 'en'
): Promise<StatFinTableMetadata> {
  const pathStr = tablePath.join('/');
  
  const url = new URL(`${SUPABASE_URL}/functions/v1/fetch-statfin`);
  url.searchParams.set('action', 'metadata');
  url.searchParams.set('tablePath', pathStr);
  url.searchParams.set('language', language);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to fetch metadata: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    title: data.title || tablePath[tablePath.length - 1],
    variables: data.variables || [],
    updated: data.updated,
    source: data.source,
    label: data.label,
  };
}

/**
 * Build a default query that selects all time values and first/total values for other dimensions
 */
export function buildDefaultQuery(
  metadata: StatFinTableMetadata,
  maxTimeValues?: number
): StatFinQuery {
  const queryItems: StatFinQuery['query'] = [];
  
  for (const variable of metadata.variables) {
    // Detect if this is a time variable
    const isTimeVariable = 
      variable.time === true ||
      variable.code.toLowerCase().includes('vuosi') ||
      variable.code.toLowerCase().includes('aika') ||
      variable.code.toLowerCase().includes('kuukausi') ||
      variable.code.toLowerCase().includes('neljännes') ||
      variable.code.toLowerCase() === 'year' ||
      variable.code.toLowerCase() === 'time' ||
      variable.code.toLowerCase() === 'quarter' ||
      variable.code.toLowerCase() === 'month' ||
      /^\d{4}/.test(variable.values[0] || '');
    
    if (isTimeVariable) {
      // Select all or limited time values (most recent first if limiting)
      let timeValues = variable.values;
      if (maxTimeValues && timeValues.length > maxTimeValues) {
        timeValues = timeValues.slice(-maxTimeValues);
      }
      
      queryItems.push({
        code: variable.code,
        selection: {
          filter: 'item',
          values: timeValues,
        },
      });
    } else {
      // For non-time variables, try to select a sensible default
      let selectedValues: string[];
      
      // Look for "total" or aggregate values
      const totalIndex = variable.valueTexts.findIndex(
        (t) => 
          t.toLowerCase().includes('total') ||
          t.toLowerCase().includes('yhteensä') ||
          t.toLowerCase() === 'sss' ||
          t === 'SSS'
      );
      
      if (totalIndex >= 0) {
        selectedValues = [variable.values[totalIndex]];
      } else if (variable.elimination) {
        // Skip eliminated variables or select first value
        selectedValues = variable.values.length > 0 ? [variable.values[0]] : [];
      } else {
        // Select first value as default
        selectedValues = variable.values.length > 0 ? [variable.values[0]] : [];
      }
      
      if (selectedValues.length > 0) {
        queryItems.push({
          code: variable.code,
          selection: {
            filter: 'item',
            values: selectedValues,
          },
        });
      }
    }
  }
  
  return {
    query: queryItems,
    response: { format: 'json' },
  };
}

/**
 * Fetch data from a StatFin table
 */
export async function fetchTableData(
  tablePath: string[],
  query: StatFinQuery,
  language: 'en' | 'fi' = 'en'
): Promise<StatFinDataResponse> {
  const pathStr = tablePath.join('/');
  
  const url = new URL(`${SUPABASE_URL}/functions/v1/fetch-statfin`);
  url.searchParams.set('action', 'data');
  url.searchParams.set('tablePath', pathStr);
  url.searchParams.set('language', language);
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ query }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to fetch data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Parse PxWeb JSON response into time series data
 */
export function parseTimeSeriesData(
  data: StatFinDataResponse,
  metadata: StatFinTableMetadata
): TimeSeriesPoint[] {
  const timeSeries: TimeSeriesPoint[] = [];
  
  // Find the time variable index
  const timeVarIndex = metadata.variables.findIndex(
    (v) =>
      v.time === true ||
      v.code.toLowerCase().includes('vuosi') ||
      v.code.toLowerCase().includes('aika') ||
      v.code.toLowerCase().includes('kuukausi') ||
      v.code.toLowerCase().includes('neljännes') ||
      v.code.toLowerCase() === 'year' ||
      v.code.toLowerCase() === 'time' ||
      /^\d{4}/.test(v.values[0] || '')
  );
  
  if (!data.data || data.data.length === 0) {
    return timeSeries;
  }
  
  for (const item of data.data) {
    if (!item.key || !item.values || item.values.length === 0) continue;
    
    // Find the time key
    let timeKey: string;
    if (timeVarIndex >= 0 && timeVarIndex < item.key.length) {
      timeKey = item.key[timeVarIndex];
    } else {
      // Try to find a time-like key
      timeKey = item.key.find((k) => /^\d{4}[QMK]?\d*$/.test(k)) || item.key[item.key.length - 1];
    }
    
    const valueStr = item.values[0];
    if (valueStr === '..' || valueStr === '.' || valueStr === '') continue;
    
    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;
    
    // Normalize date format
    let date = normalizeTimeKey(timeKey);
    
    timeSeries.push({
      date,
      value,
      label: timeKey,
    });
  }
  
  // Sort by date
  timeSeries.sort((a, b) => a.date.localeCompare(b.date));
  
  return timeSeries;
}

/**
 * Normalize various time key formats to ISO date string
 */
function normalizeTimeKey(timeKey: string): string {
  // Quarterly format: 2024Q1 or 2024K1 -> 2024-01-01
  if (/^\d{4}[QK]\d$/.test(timeKey)) {
    const year = timeKey.substring(0, 4);
    const quarter = parseInt(timeKey.substring(5));
    const month = ((quarter - 1) * 3 + 1).toString().padStart(2, '0');
    return `${year}-${month}-01`;
  }
  
  // Monthly format: 2024M01 or 2024-01 -> 2024-01-01
  if (/^\d{4}M\d{2}$/.test(timeKey)) {
    const year = timeKey.substring(0, 4);
    const month = timeKey.substring(5, 7);
    return `${year}-${month}-01`;
  }
  
  if (/^\d{4}-\d{2}$/.test(timeKey)) {
    return `${timeKey}-01`;
  }
  
  // Annual format: 2024 -> 2024-01-01
  if (/^\d{4}$/.test(timeKey)) {
    return `${timeKey}-01-01`;
  }
  
  // Already a date format
  if (/^\d{4}-\d{2}-\d{2}$/.test(timeKey)) {
    return timeKey;
  }
  
  // Default: return as-is
  return timeKey;
}

/**
 * Get the frequency from metadata
 */
export function detectFrequency(metadata: StatFinTableMetadata): 'Q' | 'M' | 'A' | 'unknown' {
  for (const variable of metadata.variables) {
    if (variable.values.length > 0) {
      const sample = variable.values[0];
      if (/^\d{4}[QK]\d$/.test(sample)) return 'Q';
      if (/^\d{4}M\d{2}$/.test(sample)) return 'M';
      if (/^\d{4}$/.test(sample)) return 'A';
    }
  }
  return 'unknown';
}

/**
 * Format a path array as a breadcrumb string
 */
export function formatBreadcrumb(path: string[]): string {
  return path.join(' / ');
}

/**
 * Get the full table path string
 */
export function getTablePathString(path: string[]): string {
  return path.join('/');
}
