import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statfinApi } from "@/lib/api";
import { STATFIN_GDP_CONFIG } from "@/components/dashboard/EconomicDashboard";

interface Observation {
  date: string;
  value: number | null;
  value_eur: number | null;
  value_usd: number | null;
}

interface SeriesInfo {
  id: string;
  source: string;
  title: string;
  freq: string | null;
  currency_orig: string | null;
  unit_original: string | null;
  geo: string | null;
}

const StatFinDebug = () => {
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<any>(null);

  const handleIngestGDP = async () => {
    setIngesting(true);
    setError(null);
    setIngestResult(null);
    
    try {
      const result = await statfinApi.ingest(
        STATFIN_GDP_CONFIG.tablePath,
        STATFIN_GDP_CONFIG.query,
        STATFIN_GDP_CONFIG.seriesId,
        STATFIN_GDP_CONFIG.title
      );
      setIngestResult(result);
      // After ingesting, fetch the data
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to ingest StatFin GDP");
    } finally {
      setIngesting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch series info
      const { data: seriesData, error: seriesError } = await supabase
        .from("series")
        .select("id, source, title, freq, currency_orig, unit_original, geo")
        .eq("id", STATFIN_GDP_CONFIG.seriesId)
        .maybeSingle();

      if (seriesError) throw seriesError;

      if (seriesData) {
        setSeries(seriesData);

        // Fetch first 10 observations
        const { data: obsData, error: obsError } = await supabase
          .from("observations")
          .select("date, value, value_eur, value_usd")
          .eq("series_id", STATFIN_GDP_CONFIG.seriesId)
          .order("date", { ascending: false })
          .limit(10);

        if (obsError) throw obsError;
        setObservations(obsData || []);
      } else {
        setSeries(null);
        setObservations([]);
        setError("Series not found. Click 'Ingest StatFin GDP' to load the data.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">StatFin Debug View</h1>
          <p className="text-sm text-muted-foreground">
            Test PxWeb JSON → observations table → chart payload mapping
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleIngestGDP} disabled={ingesting}>
            {ingesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Ingest StatFin GDP
          </Button>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Fetch Current Data
          </Button>
        </div>

        {/* Ingest Result */}
        {ingestResult && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Ingest Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(ingestResult, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Series Info */}
        {series && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Series Metadata</CardTitle>
              <CardDescription>From the series table</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">ID</dt>
                <dd className="font-mono">{series.id}</dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd>{series.source}</dd>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{series.title}</dd>
                <dt className="text-muted-foreground">Frequency</dt>
                <dd>{series.freq || "—"}</dd>
                <dt className="text-muted-foreground">Currency</dt>
                <dd>{series.currency_orig || "—"}</dd>
                <dt className="text-muted-foreground">Unit</dt>
                <dd>{series.unit_original || "—"}</dd>
                <dt className="text-muted-foreground">Geo</dt>
                <dd>{series.geo || "—"}</dd>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        {observations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">First 10 Observations</CardTitle>
              <CardDescription>
                From the observations table (sorted by date descending)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Value</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Value EUR</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Value USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((obs, idx) => (
                      <tr key={idx} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 font-mono">{obs.date}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {obs.value?.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {obs.value_eur?.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {obs.value_usd?.toLocaleString() ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart Payload Preview */}
        {observations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chart Payload Preview</CardTitle>
              <CardDescription>
                Format: {'{ date: string, value: number }[]'} for recharts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto max-h-64">
                {JSON.stringify(
                  observations
                    .filter(o => o.value !== null)
                    .map(o => ({ date: o.date, value: o.value }))
                    .reverse(),
                  null,
                  2
                )}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StatFinDebug;
