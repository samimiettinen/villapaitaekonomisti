// Shared types for data sources and series
export type DataSource = "ALL" | "FRED" | "STATFIN" | "ECB" | "EUROSTAT" | "OECD" | "WORLDBANK";

export interface Series {
  id: string;
  source: string;
  title: string;
  freq: string | null;
  currency_orig: string | null;
}

export interface SelectedSeries {
  id: string;
  source: string;
  title: string;
  freq?: string | null;
  currency_orig: string | null;
}

export type Currency = "original" | "EUR" | "USD";

export type Transformation = {
  id: string;
  name: string;
  type: "divide" | "multiply" | "add" | "subtract";
  seriesA: string;
  seriesB: string;
};
