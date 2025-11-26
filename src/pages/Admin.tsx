import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fredApi, statfinApi } from "@/lib/api";

const Admin = () => {
  const { toast } = useToast();
  const [fredSeriesId, setFredSeriesId] = useState("GDPC1");
  const [fredLoading, setFredLoading] = useState(false);
  const [fredResult, setFredResult] = useState<any>(null);

  const [statfinTablePath, setStatfinTablePath] = useState("StatFin/kbar/statfin_kbar_pxt_11cc.px");
  const [statfinQuery, setStatfinQuery] = useState(`{
  "query": [
    {
      "code": "Vuosi",
      "selection": {
        "filter": "item",
        "values": ["2020", "2021", "2022", "2023"]
      }
    }
  ],
  "response": {
    "format": "json"
  }
}`);
  const [statfinLoading, setStatfinLoading] = useState(false);
  const [statfinResult, setStatfinResult] = useState<any>(null);

  const handleFredIngest = async () => {
    setFredLoading(true);
    setFredResult(null);
    try {
      const result = await fredApi.ingest(fredSeriesId);
      setFredResult(result);
      toast({
        title: "Success",
        description: `Ingested ${result.observationCount} observations for ${result.seriesId}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to ingest";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setFredResult({ error: errorMessage });
    } finally {
      setFredLoading(false);
    }
  };

  const handleStatFinIngest = async () => {
    setStatfinLoading(true);
    setStatfinResult(null);
    try {
      const query = JSON.parse(statfinQuery);
      const result = await statfinApi.ingest(statfinTablePath, query);
      setStatfinResult(result);
      toast({
        title: "Success",
        description: `Ingested ${result.observationCount} observations for ${result.seriesId}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to ingest";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setStatfinResult({ error: errorMessage });
    } finally {
      setStatfinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Database className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Data Ingestion</h1>
              <p className="text-sm text-muted-foreground">Import data from FRED and StatFin</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* FRED Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>FRED (Federal Reserve Economic Data)</CardTitle>
            <CardDescription>
              Import time series from the Federal Reserve Economic Data API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fred-series-id">Series ID</Label>
              <Input
                id="fred-series-id"
                value={fredSeriesId}
                onChange={(e) => setFredSeriesId(e.target.value)}
                placeholder="e.g., GDPC1 (US Real GDP)"
              />
              <p className="text-xs text-muted-foreground">
                Examples: GDPC1 (US Real GDP), UNRATE (Unemployment Rate), CPIAUCSL (CPI)
              </p>
            </div>

            <Button onClick={handleFredIngest} disabled={fredLoading || !fredSeriesId}>
              {fredLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingest FRED Series
            </Button>

            {fredResult && (
              <div
                className={`rounded-lg border p-4 ${
                  fredResult.error ? "border-destructive bg-destructive/10" : "border-green-600 bg-green-50 dark:bg-green-950"
                }`}
              >
                <div className="flex items-start gap-2">
                  {fredResult.error ? (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <pre className="text-sm font-mono overflow-x-auto">
                      {JSON.stringify(fredResult, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* StatFin Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics Finland (StatFin)</CardTitle>
            <CardDescription>
              Import data from Statistics Finland via PxWeb API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="statfin-table-path">Table Path</Label>
              <Input
                id="statfin-table-path"
                value={statfinTablePath}
                onChange={(e) => setStatfinTablePath(e.target.value)}
                placeholder="e.g., StatFin/kbar/statfin_kbar_pxt_11cc.px"
              />
              <p className="text-xs text-muted-foreground">
                Full path to the PxWeb table
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statfin-query">Query (JSON)</Label>
              <Textarea
                id="statfin-query"
                value={statfinQuery}
                onChange={(e) => setStatfinQuery(e.target.value)}
                className="font-mono text-sm"
                rows={12}
              />
              <p className="text-xs text-muted-foreground">
                PxWeb query JSON specifying dimensions and values
              </p>
            </div>

            <Button onClick={handleStatFinIngest} disabled={statfinLoading || !statfinTablePath}>
              {statfinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingest StatFin Table
            </Button>

            {statfinResult && (
              <div
                className={`rounded-lg border p-4 ${
                  statfinResult.error ? "border-destructive bg-destructive/10" : "border-green-600 bg-green-50 dark:bg-green-950"
                }`}
              >
                <div className="flex items-start gap-2">
                  {statfinResult.error ? (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <pre className="text-sm font-mono overflow-x-auto">
                      {JSON.stringify(statfinResult, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <a
                href="https://fred.stlouisfed.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                FRED Website →
              </a>
              <p className="text-muted-foreground">Search for series IDs</p>
            </div>
            <div>
              <a
                href="https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                StatFin Database →
              </a>
              <p className="text-muted-foreground">Browse available tables</p>
            </div>
            <div>
              <a
                href="/"
                className="text-primary hover:underline"
              >
                Back to Dashboard →
              </a>
              <p className="text-muted-foreground">View ingested data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
