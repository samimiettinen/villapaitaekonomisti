import { useState, useEffect } from "react";
import { TrendingUp, Search, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { fredApi } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/hooks/use-toast";

interface FredSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
}

interface Observation {
  date: string;
  value: number | null;
}

const FredExplorer = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FredSeries[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<FredSeries | null>(null);
  const [dateRange, setDateRange] = useState({
    start: "2000-01-01",
    end: new Date().toISOString().split("T")[0],
  });
  const [chartData, setChartData] = useState<Observation[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  // Load example: US GDP per capita
  useEffect(() => {
    loadExampleSeries();
  }, []);

  const loadExampleSeries = async () => {
    // Try to load US GDP per capita if it exists in our database
    const { data: series } = await supabase
      .from("series")
      .select("*")
      .ilike("title", "%GDP per capita%")
      .eq("source", "FRED")
      .limit(1);

    if (series && series.length > 0) {
      setSelectedSeries({
        id: series[0].id,
        title: series[0].title,
        frequency: series[0].freq || "Quarterly",
        units: series[0].unit_original || "Dollars",
      });
    } else {
      // Set default example series info
      setSelectedSeries({
        id: "A939RC0Q052SBEA",
        title: "GDP per capita (current dollars)",
        frequency: "Quarterly",
        units: "Dollars",
      });
    }
  };

  // Fetch chart data when series or date range changes
  useEffect(() => {
    if (selectedSeries) {
      fetchChartData();
    }
  }, [selectedSeries, dateRange]);

  const fetchChartData = async () => {
    if (!selectedSeries) return;

    setLoadingChart(true);
    
    const { data, error } = await supabase
      .from("observations")
      .select("date, value")
      .eq("series_id", selectedSeries.id)
      .gte("date", dateRange.start)
      .lte("date", dateRange.end)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching data:", error);
      setChartData([]);
    } else {
      setChartData(data || []);
    }
    
    setLoadingChart(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await fredApi.search(searchQuery);
      setSearchResults(results.seriess || []);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
    setSearching(false);
  };

  const handleSelectSeries = async (series: FredSeries) => {
    setSelectedSeries(series);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleIngestSeries = async () => {
    if (!selectedSeries) return;

    setIngesting(true);
    try {
      await fredApi.ingest(selectedSeries.id);
      toast({
        title: "Series ingested",
        description: `${selectedSeries.title} has been added to the database`,
      });
      // Refresh chart data
      await fetchChartData();
    } catch (error) {
      toast({
        title: "Ingest failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
    setIngesting(false);
  };

  const stats = chartData.length > 0 ? {
    latest: chartData[chartData.length - 1]?.value,
    previous: chartData.length > 1 ? chartData[chartData.length - 2]?.value : null,
  } : null;

  const change = stats?.latest && stats?.previous 
    ? ((stats.latest - stats.previous) / stats.previous) * 100 
    : null;

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
                <h1 className="text-xl font-bold text-foreground">FRED Explorer</h1>
                <p className="text-sm text-muted-foreground">
                  Federal Reserve Economic Data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="text-sm text-muted-foreground hover:text-primary">
                Dashboard
              </a>
              <a href="/analysis" className="text-sm text-muted-foreground hover:text-primary">
                Analysis
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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Panel: Search & Selection */}
          <div className="space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search FRED Series</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. GDP, unemployment, inflation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {searchResults.map((series) => (
                      <button
                        key={series.id}
                        onClick={() => handleSelectSeries(series)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        <p className="font-medium text-sm text-foreground truncate">
                          {series.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {series.id} • {series.frequency} • {series.units}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Series */}
            {selectedSeries && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Selected Series</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium text-foreground">{selectedSeries.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ID: {selectedSeries.id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedSeries.frequency} • {selectedSeries.units}
                    </p>
                  </div>
                  
                  {chartData.length === 0 && !loadingChart && (
                    <Button
                      onClick={handleIngestSeries}
                      disabled={ingesting}
                      className="w-full"
                    >
                      {ingesting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Import Data from FRED
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Date Range */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Time Period</CardTitle>
              </CardHeader>
              <CardContent>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Chart */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedSeries?.title || "Select a series"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dateRange.start} to {dateRange.end}
                    </p>
                  </div>
                  {stats?.latest && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground font-mono">
                        {stats.latest.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      {change !== null && (
                        <p className={`text-sm font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingChart ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium text-foreground">No data available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedSeries 
                          ? "Click 'Import Data from FRED' to load this series" 
                          : "Search and select a series to view data"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => 
                            new Date(value).toLocaleDateString(undefined, { 
                              month: 'short', 
                              year: '2-digit' 
                            })
                          }
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => value.toLocaleString()}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                          formatter={(value: number) => [
                            value.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            selectedSeries?.units || "Value",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Data Table */}
                    <div className="mt-6 max-h-48 overflow-y-auto border border-border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr className="border-b border-border">
                            <th className="py-2 px-4 text-left font-medium text-muted-foreground">Date</th>
                            <th className="py-2 px-4 text-right font-medium text-muted-foreground">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.slice().reverse().slice(0, 50).map((obs, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0">
                              <td className="py-2 px-4 text-foreground font-mono">
                                {new Date(obs.date).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-4 text-right font-mono text-foreground">
                                {obs.value?.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FredExplorer;
