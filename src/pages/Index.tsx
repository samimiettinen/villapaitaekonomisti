import { useState } from "react";
import { Database, TrendingUp } from "lucide-react";
import { SeriesList } from "@/components/SeriesList";
import { SeriesDetail } from "@/components/SeriesDetail";
import { SearchBar } from "@/components/SearchBar";
import { SourceSelector } from "@/components/SourceSelector";

export type DataSource = "ALL" | "FRED" | "STATFIN";

const Index = () => {
  const [selectedSource, setSelectedSource] = useState<DataSource>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

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
                <h1 className="text-xl font-bold text-foreground">MacroData Warehouse</h1>
                <p className="text-sm text-muted-foreground">Economic time series analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-sm text-muted-foreground hover:text-primary">
                Admin
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>FRED + StatFin</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <SourceSelector value={selectedSource} onChange={setSelectedSource} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Series List */}
          <div className="lg:col-span-1">
            <SeriesList
              source={selectedSource}
              searchQuery={searchQuery}
              selectedId={selectedSeriesId}
              onSelect={setSelectedSeriesId}
            />
          </div>

          {/* Series Detail */}
          <div className="lg:col-span-2">
            {selectedSeriesId ? (
              <SeriesDetail seriesId={selectedSeriesId} />
            ) : (
              <div className="flex h-[600px] items-center justify-center rounded-lg border border-border bg-card">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium text-foreground">Select a series</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a time series from the list to view details
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

export default Index;
