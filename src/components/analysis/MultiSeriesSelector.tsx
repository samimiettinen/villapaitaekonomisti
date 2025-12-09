import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SourceSelector } from "@/components/SourceSelector";
import type { DataSource, SelectedSeries } from "@/lib/types";

interface Series {
  id: string;
  source: string;
  title: string;
  freq: string | null;
  currency_orig: string | null;
}

interface MultiSeriesSelectorProps {
  selectedSeries: SelectedSeries[];
  onSelectionChange: (series: SelectedSeries[]) => void;
}

export const MultiSeriesSelector = ({
  selectedSeries,
  onSelectionChange,
}: MultiSeriesSelectorProps) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [source, setSource] = useState<DataSource>("ALL");

  useEffect(() => {
    fetchSeries();
  }, [source, searchQuery]);

  const fetchSeries = async () => {
    setLoading(true);
    try {
      let query = supabase.from("series").select("id, source, title, freq, currency_orig");

      if (source !== "ALL") {
        query = query.eq("source", source);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order("title", { ascending: true }).limit(50);

      if (error) throw error;
      setSeries(data || []);
    } catch (error) {
      console.error("Error fetching series:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeries = (s: Series) => {
    const isSelected = selectedSeries.some((sel) => sel.id === s.id);
    if (isSelected) {
      onSelectionChange(selectedSeries.filter((sel) => sel.id !== s.id));
    } else {
      onSelectionChange([...selectedSeries, s]);
    }
  };

  const removeSeries = (id: string) => {
    onSelectionChange(selectedSeries.filter((s) => s.id !== id));
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Select Series</h3>

      {/* Selected Series */}
      {selectedSeries.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-muted-foreground">Selected ({selectedSeries.length}):</p>
          <div className="space-y-1">
            {selectedSeries.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded bg-primary/10 px-2 py-1"
              >
                <span className="flex-1 text-xs text-foreground truncate">{s.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSeries(s.id)}
                  className="h-5 w-5 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Source Filter */}
      <div className="mb-4">
        <SourceSelector value={source} onChange={setSource} />
      </div>

      {/* Available Series */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground">No series found</p>
        ) : (
          series.map((s) => {
            const isSelected = selectedSeries.some((sel) => sel.id === s.id);
            return (
              <Card
                key={s.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                  isSelected ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => toggleSeries(s)}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{s.title}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {s.source}
                    </Badge>
                    {s.freq && (
                      <Badge variant="outline" className="text-xs">
                        {s.freq}
                      </Badge>
                    )}
                    {s.currency_orig && (
                      <Badge variant="outline" className="text-xs">
                        {s.currency_orig}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
};
