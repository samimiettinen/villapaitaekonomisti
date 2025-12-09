import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, Loader2 } from "lucide-react";
import { SeriesChart } from "./SeriesChart";
import { CurrencySelector } from "./CurrencySelector";
import { DateRangePicker } from "./DateRangePicker";

interface SeriesDetailProps {
  seriesId: string;
}

interface SeriesMetadata {
  id: string;
  source: string;
  title: string;
  description: string | null;
  freq: string | null;
  unit_original: string | null;
  currency_orig: string | null;
  geo: string | null;
}

import type { Currency } from "@/lib/types";
export type { Currency };

export const SeriesDetail = ({ seriesId }: SeriesDetailProps) => {
  const [metadata, setMetadata] = useState<SeriesMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>("original");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("series")
        .select("*")
        .eq("id", seriesId)
        .single();

      if (!error && data) {
        setMetadata(data as SeriesMetadata);
      }
      setLoading(false);
    };

    fetchMetadata();
  }, [seriesId]);

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!metadata) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <p className="text-muted-foreground">Series not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{metadata.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground font-mono">{metadata.id}</p>
            </div>
            <Badge variant={metadata.source === "FRED" ? "default" : "secondary"}>
              {metadata.source}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {metadata.description && (
            <p className="mb-4 text-sm text-foreground">{metadata.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            {metadata.freq && (
              <div>
                <p className="text-muted-foreground">Frequency</p>
                <p className="font-medium text-foreground">{metadata.freq}</p>
              </div>
            )}
            {metadata.unit_original && (
              <div>
                <p className="text-muted-foreground">Units</p>
                <p className="font-medium text-foreground">{metadata.unit_original}</p>
              </div>
            )}
            {metadata.currency_orig && (
              <div>
                <p className="text-muted-foreground">Original Currency</p>
                <p className="font-medium text-foreground">{metadata.currency_orig}</p>
              </div>
            )}
            {metadata.geo && (
              <div>
                <p className="text-muted-foreground">Geography</p>
                <p className="font-medium text-foreground">{metadata.geo}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CurrencySelector value={currency} onChange={setCurrency} />
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <SeriesChart seriesId={seriesId} currency={currency} dateRange={dateRange} />
    </div>
  );
};
