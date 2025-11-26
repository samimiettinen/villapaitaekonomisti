import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { DataSource } from "@/pages/Index";

interface Series {
  id: string;
  source: string;
  title: string;
  freq: string | null;
  currency_orig: string | null;
}

interface SeriesListProps {
  source: DataSource;
  searchQuery: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const SeriesList = ({ source, searchQuery, selectedId, onSelect }: SeriesListProps) => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      let query = supabase.from("series").select("id, source, title, freq, currency_orig");

      if (source !== "ALL") {
        query = query.eq("source", source);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order("title");

      if (!error && data) {
        setSeries(data);
      }
      setLoading(false);
    };

    fetchSeries();
  }, [source, searchQuery]);

  if (loading) {
    return (
      <Card className="flex h-[600px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (series.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-muted-foreground">
          No series found. Try adjusting your search or filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 text-sm text-muted-foreground">
        {series.length} series found
      </div>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {series.map((s) => (
          <Card
            key={s.id}
            className={`cursor-pointer p-4 transition-all hover:border-primary ${
              selectedId === s.id ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => onSelect(s.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground line-clamp-2">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{s.id}</p>
              </div>
              <Badge variant={s.source === "FRED" ? "default" : "secondary"} className="shrink-0">
                {s.source}
              </Badge>
            </div>
            {(s.freq || s.currency_orig) && (
              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                {s.freq && <span>Freq: {s.freq}</span>}
                {s.currency_orig && <span>Currency: {s.currency_orig}</span>}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
