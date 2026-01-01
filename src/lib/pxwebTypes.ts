// ========== PxWeb API Types ==========

/**
 * A variable (dimension) in a PxWeb table
 */
export interface PxVariable {
  /** Variable code (e.g., "Vuosi", "Kuukausi", "Tiedot") */
  code: string;
  /** Human-readable text label */
  text: string;
  /** Array of value codes */
  values: string[];
  /** Array of value labels (same order as values) */
  valueTexts: string[];
  /** Whether this is a time variable */
  time?: boolean;
}

/**
 * Metadata for a StatFin table
 */
export interface StatFinTableMeta {
  /** Table title */
  title: string;
  /** Variables (dimensions) in the table */
  variables: PxVariable[];
  /** Data source */
  source?: string;
  /** Last updated timestamp */
  updated?: string;
}

/**
 * PxWeb query structure for POST requests
 */
export interface PxWebQuery {
  query: Array<{
    code: string;
    selection: {
      filter: "item" | "all" | "top" | "agg";
      values: string[];
    };
  }>;
  response: {
    format: "json" | "json-stat2" | "csv" | "px";
  };
}

/**
 * A single birth data row
 */
export interface BirthDataRow {
  /** Year (e.g., "2024") */
  year: string;
  /** Month number (e.g., "1" for January) */
  month: string;
  /** Info code (e.g., "vm01") */
  info: string;
  /** Human-readable info label */
  infoText: string;
  /** The actual value (number of births) */
  value: number | null;
}

/**
 * Response from /meta endpoint
 */
export interface BirthsMetaResponse {
  success: boolean;
  meta: StatFinTableMeta;
}

/**
 * Response from /data endpoint
 */
export interface BirthsDataResponse {
  success: boolean;
  meta: {
    title: string;
    source: string;
    updated: string;
  };
  data: BirthDataRow[];
  rowCount: number;
}

/**
 * Request body for /data endpoint
 */
export interface BirthsDataRequest {
  /** Filter by years (e.g., ["2020", "2021", "2022"]) */
  years?: string[];
  /** Filter by months (e.g., ["1", "2", "3"]) */
  months?: string[];
  /** Filter by info codes (e.g., ["vm01"]) */
  infoCodes?: string[];
}

/**
 * Response from /ingest endpoint
 */
export interface BirthsIngestResponse {
  success: boolean;
  seriesId: string;
  observationCount: number;
  sampleDates: string[];
}

// ========== Utility Functions ==========

/**
 * Get month name from month number
 */
export function getMonthName(month: string | number, locale: string = "fi-FI"): string {
  const monthNum = typeof month === "string" ? parseInt(month, 10) : month;
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return String(month);
  
  const date = new Date(2024, monthNum - 1, 1);
  return date.toLocaleString(locale, { month: "long" });
}

/**
 * Format birth data for chart display
 */
export function formatBirthDataForChart(data: BirthDataRow[]): Array<{
  date: string;
  label: string;
  value: number;
}> {
  return data
    .filter(row => row.value !== null)
    .map(row => {
      const monthNum = parseInt(row.month, 10);
      const monthStr = monthNum.toString().padStart(2, "0");
      return {
        date: `${row.year}-${monthStr}`,
        label: `${getMonthName(row.month)} ${row.year}`,
        value: row.value as number,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group birth data by year
 */
export function groupBirthDataByYear(data: BirthDataRow[]): Map<string, BirthDataRow[]> {
  const grouped = new Map<string, BirthDataRow[]>();
  
  for (const row of data) {
    const existing = grouped.get(row.year) || [];
    existing.push(row);
    grouped.set(row.year, existing);
  }
  
  return grouped;
}

/**
 * Calculate yearly totals from monthly data
 */
export function calculateYearlyTotals(data: BirthDataRow[]): Array<{
  year: string;
  total: number;
  monthCount: number;
}> {
  const grouped = groupBirthDataByYear(data);
  const totals: Array<{ year: string; total: number; monthCount: number }> = [];
  
  for (const [year, rows] of grouped) {
    const validRows = rows.filter(r => r.value !== null);
    const total = validRows.reduce((sum, r) => sum + (r.value || 0), 0);
    totals.push({
      year,
      total,
      monthCount: validRows.length,
    });
  }
  
  return totals.sort((a, b) => a.year.localeCompare(b.year));
}
