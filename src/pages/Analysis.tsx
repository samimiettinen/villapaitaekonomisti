import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { MultiSeriesSelector } from "@/components/analysis/MultiSeriesSelector";
import { TransformationBuilder } from "@/components/analysis/TransformationBuilder";
import { MultiSeriesChart } from "@/components/analysis/MultiSeriesChart";
import { AnalysisDataTable } from "@/components/analysis/AnalysisDataTable";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CurrencySelector } from "@/components/CurrencySelector";
import type { Currency } from "@/components/SeriesDetail";

export type SelectedSeries = {
  id: string;
  title: string;
  source: string;
  currency_orig: string | null;
};

export type Transformation = {
  id: string;
  name: string;
  type: "divide" | "multiply" | "add" | "subtract";
  seriesA: string;
  seriesB: string;
};

const Analysis = () => {
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeries[]>([]);
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [dateRange, setDateRange] = useState({
    start: "1970-01-01",
    end: new Date().toISOString().split("T")[0],
  });
  const [currency, setCurrency] = useState<Currency>("original");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Analysis Builder</h1>
                <p className="text-sm text-muted-foreground">Multi-series time-series analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="text-sm text-muted-foreground hover:text-primary">
                Dashboard
              </a>
              <a href="/admin" className="text-sm text-muted-foreground hover:text-primary">
                Admin
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Left Panel: Series Selection & Transformations */}
          <div className="lg:col-span-1 space-y-6">
            <MultiSeriesSelector
              selectedSeries={selectedSeries}
              onSelectionChange={setSelectedSeries}
            />
            <TransformationBuilder
              selectedSeries={selectedSeries}
              transformations={transformations}
              onTransformationsChange={setTransformations}
            />
          </div>

          {/* Right Panel: Chart & Table */}
          <div className="lg:col-span-3 space-y-6">
            {/* Controls */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <CurrencySelector value={currency} onChange={setCurrency} />
              </div>
            </div>

            {/* Chart */}
            {selectedSeries.length > 0 ? (
              <>
                <MultiSeriesChart
                  selectedSeries={selectedSeries}
                  transformations={transformations}
                  dateRange={dateRange}
                  currency={currency}
                />
                <AnalysisDataTable
                  selectedSeries={selectedSeries}
                  transformations={transformations}
                  dateRange={dateRange}
                  currency={currency}
                />
              </>
            ) : (
              <div className="flex h-[600px] items-center justify-center rounded-lg border border-border bg-card">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium text-foreground">Select series to begin</p>
                  <p className="text-sm text-muted-foreground">
                    Choose one or more series from the left panel
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
