import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface FeaturedIndicator {
  seriesId: string;
  label: string;
  source: "FRED" | "STATFIN" | "ECB" | "EUROSTAT" | "OECD" | "WORLDBANK";
  currency?: "original" | "EUR" | "USD";
}

interface SeriesMetadata {
  title: string;
  description: string | null;
  unit_original: string | null;
  currency_orig: string | null;
  updated_at: string;
  geo: string | null;
}

interface Observation {
  date: string;
  value: number | null;
}

export const FeaturedIndicatorCard = ({ indicator }: { indicator: FeaturedIndicator }) => {
  const [metadata, setMetadata] = useState<SeriesMetadata | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch series metadata
        const { data: seriesData, error: seriesError } = await supabase
          .from("series")
          .select("title, description, unit_original, currency_orig, updated_at, geo")
          .eq("id", indicator.seriesId)
          .maybeSingle();

        if (seriesError) throw seriesError;
        if (!seriesData) {
          setError("Series not found");
          setLoading(false);
          return;
        }

        setMetadata(seriesData);

        // Determine value column based on currency preference
        let valueColumn = "value";
        if (indicator.currency === "EUR") valueColumn = "value_eur";
        if (indicator.currency === "USD") valueColumn = "value_usd";

        // Fetch last 12 observations for sparkline
        const { data: obsData, error: obsError } = await supabase
          .from("observations")
          .select(`date, ${valueColumn}`)
          .eq("series_id", indicator.seriesId)
          .order("date", { ascending: false })
          .limit(12);

        if (obsError) throw obsError;

        const formattedObs = (obsData || [])
          .map((obs: any) => ({
            date: obs.date,
            value: obs[valueColumn],
          }))
          .reverse();

        setObservations(formattedObs);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [indicator.seriesId, indicator.currency]);

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !metadata) {
    return (
      <Card className="overflow-hidden opacity-60">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">{indicator.label}</p>
          <p className="text-xs text-destructive">{error || "No data"}</p>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-xs">
            {indicator.source}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const latestValue = observations.length > 0 ? observations[observations.length - 1]?.value : null;
  const previousValue = observations.length > 1 ? observations[observations.length - 2]?.value : null;
  const change = latestValue && previousValue ? ((latestValue - previousValue) / previousValue) * 100 : null;
  const latestDate = observations.length > 0 ? observations[observations.length - 1]?.date : null;

  const TrendIcon = change === null ? Minus : change >= 0 ? TrendingUp : TrendingDown;
  const trendColor = change === null ? "text-muted-foreground" : change >= 0 ? "text-green-600" : "text-red-600";
  const sparklineColor = change === null ? "hsl(var(--muted-foreground))" : change >= 0 ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)";

  const formatValue = (val: number | null) => {
    if (val === null) return "—";
    if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" title={metadata.title}>
              {indicator.label}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={metadata.title}>
              {metadata.title}
            </p>
          </div>
          <Badge 
            variant="secondary" 
            className="text-xs shrink-0"
          >
            {indicator.source}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatValue(latestValue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon className={`h-3 w-3 ${trendColor}`} />
              <span className={`text-xs font-medium ${trendColor}`}>
                {change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
              </span>
            </div>
          </div>
          
          {/* Sparkline */}
          {observations.length > 1 && (
            <div className="w-24 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={observations}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparklineColor}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {latestDate ? new Date(latestDate).toLocaleDateString(undefined, { 
              month: 'short', 
              year: 'numeric' 
            }) : "—"}
          </span>
          <span>
            Updated: {new Date(metadata.updated_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
