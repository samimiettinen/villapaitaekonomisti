import { useState, useEffect } from "react";
import { TrendingUp, Search, Loader2, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { fredApi } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "@/hooks/use-toast";

interface FredSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
}

interface SelectedSeriesItem extends FredSeries {
  axis: "left" | "right";
  color: string;
}

type ChartDataPoint = {
  date: string;
  [key: string]: string | number | null;
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 65%, 60%)",
];

const FredExplorer = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FredSeries[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeriesItem[]>([]);
  const [dateRange, setDateRange] = useState({
    start: "2000-01-01",
    end: new Date().toISOString().split("T")[0],
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [seriesWithData, setSeriesWithData] = useState<Set<string>>(new Set());

  // Load example: US GDP per capita
  useEffect(() => {
    loadExampleSeries();
  }, []);

  const loadExampleSeries = async () => {
    const { data: series } = await supabase
      .from("series")
      .select("*")
      .ilike("title", "%GDP per capita%")
      .eq("source", "FRED")
      .limit(1);

    if (series && series.length > 0) {
      setSelectedSeries([{
        id: series[0].id,
        title: series[0].title,
        frequency: series[0].freq || "Quarterly",
        units: series[0].unit_original || "Dollars",
        axis: "left",
        color: COLORS[0],
      }]);
    } else {
      setSelectedSeries([{
        id: "A939RC0Q052SBEA",
        title: "GDP per capita (current dollars)",
        frequency: "Quarterly",
        units: "Dollars",
        axis: "left",
        color: COLORS[0],
      }]);
    }
  };

  // Fetch chart data when series or date range changes
  useEffect(() => {
    if (selectedSeries.length > 0) {
      fetchChartData();
    } else {
      setChartData([]);
    }
  }, [selectedSeries, dateRange]);

  const fetchChartData = async () => {
    if (selectedSeries.length === 0) return;

    setLoadingChart(true);
    const newSeriesWithData = new Set<string>();

    try {
      // Fetch data for all selected series
      const allData: { [seriesId: string]: { date: string; value: number | null }[] } = {};
      
      for (const series of selectedSeries) {
        const { data, error } = await supabase
          .from("observations")
          .select("date, value")
          .eq("series_id", series.id)
          .gte("date", dateRange.start)
          .lte("date", dateRange.end)
          .order("date", { ascending: true });

        if (!error && data && data.length > 0) {
          allData[series.id] = data;
          newSeriesWithData.add(series.id);
        }
      }

      setSeriesWithData(newSeriesWithData);

      // Merge all data by date
      const dateMap = new Map<string, ChartDataPoint>();
      
      for (const seriesId in allData) {
        for (const obs of allData[seriesId]) {
          if (!dateMap.has(obs.date)) {
            dateMap.set(obs.date, { date: obs.date });
          }
          dateMap.get(obs.date)![seriesId] = obs.value;
        }
      }

      // Sort by date
      const merged = Array.from(dateMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setChartData(merged);
    } catch (error) {
      console.error("Error fetching data:", error);
      setChartData([]);
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

  const handleSelectSeries = (series: FredSeries) => {
    if (selectedSeries.find(s => s.id === series.id)) {
      toast({ title: "Series already added" });
      return;
    }
    if (selectedSeries.length >= 6) {
      toast({ title: "Maximum 6 series allowed", variant: "destructive" });
      return;
    }

    const newSeries: SelectedSeriesItem = {
      ...series,
      axis: selectedSeries.length === 0 ? "left" : "right",
      color: COLORS[selectedSeries.length % COLORS.length],
    };
    
    setSelectedSeries([...selectedSeries, newSeries]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleRemoveSeries = (id: string) => {
    setSelectedSeries(selectedSeries.filter(s => s.id !== id));
  };

  const toggleAxis = (id: string) => {
    setSelectedSeries(selectedSeries.map(s => 
      s.id === id ? { ...s, axis: s.axis === "left" ? "right" : "left" } : s
    ));
  };

  const handleIngestSeries = async (series: SelectedSeriesItem) => {
    setIngestingId(series.id);
    try {
      await fredApi.ingest(series.id);
      toast({
        title: "Series ingested",
        description: `${series.title} has been added to the database`,
      });
      await fetchChartData();
    } catch (error) {
      toast({
        title: "Ingest failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
    setIngestingId(null);
  };

  const leftAxisSeries = selectedSeries.filter(s => s.axis === "left");
  const rightAxisSeries = selectedSeries.filter(s => s.axis === "right");

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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selected Series ({selectedSeries.length}/6)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedSeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No series selected</p>
                ) : (
                  selectedSeries.map((series) => (
                    <div
                      key={series.id}
                      className="p-3 rounded-lg border border-border space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: series.color }}
                          />
                          <p className="font-medium text-sm text-foreground truncate">
                            {series.title}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => handleRemoveSeries(series.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {series.id}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={() => toggleAxis(series.id)}
                        >
                          {series.axis === "left" ? (
                            <>
                              <ChevronLeft className="h-3 w-3" />
                              Left Y
                            </>
                          ) : (
                            <>
                              Right Y
                              <ChevronRight className="h-3 w-3" />
                            </>
                          )}
                        </Button>
                      </div>
                      {!seriesWithData.has(series.id) && !loadingChart && (
                        <Button
                          onClick={() => handleIngestSeries(series)}
                          disabled={ingestingId === series.id}
                          size="sm"
                          className="w-full h-7 text-xs"
                        >
                          {ingestingId === series.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3 mr-1" />
                              Import from FRED
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

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
                <div>
                  <CardTitle>
                    {selectedSeries.length === 0
                      ? "Select a series"
                      : selectedSeries.length === 1
                      ? selectedSeries[0].title
                      : `Comparing ${selectedSeries.length} series`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dateRange.start} to {dateRange.end}
                  </p>
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
                        {selectedSeries.length > 0
                          ? "Import data from FRED for selected series"
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
                              month: "short",
                              year: "2-digit",
                            })
                          }
                        />
                        {/* Left Y-Axis */}
                        {leftAxisSeries.length > 0 && (
                          <YAxis
                            yAxisId="left"
                            orientation="left"
                            stroke={leftAxisSeries[0].color}
                            fontSize={12}
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                        )}
                        {/* Right Y-Axis */}
                        {rightAxisSeries.length > 0 && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke={rightAxisSeries[0].color}
                            fontSize={12}
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                          formatter={(value: number, name: string) => {
                            const series = selectedSeries.find(s => s.id === name);
                            return [
                              value?.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }) || "N/A",
                              series?.title || name,
                            ];
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            const series = selectedSeries.find(s => s.id === value);
                            return series?.title || value;
                          }}
                        />
                        {selectedSeries.map((series) => (
                          <Line
                            key={series.id}
                            type="monotone"
                            dataKey={series.id}
                            yAxisId={series.axis}
                            stroke={series.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Data Table */}
                    <div className="mt-6 max-h-48 overflow-y-auto border border-border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr className="border-b border-border">
                            <th className="py-2 px-4 text-left font-medium text-muted-foreground">Date</th>
                            {selectedSeries.map((series) => (
                              <th
                                key={series.id}
                                className="py-2 px-4 text-right font-medium text-muted-foreground"
                                style={{ color: series.color }}
                              >
                                {series.id}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.slice().reverse().slice(0, 50).map((obs, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0">
                              <td className="py-2 px-4 text-foreground font-mono">
                                {new Date(obs.date).toLocaleDateString()}
                              </td>
                              {selectedSeries.map((series) => (
                                <td
                                  key={series.id}
                                  className="py-2 px-4 text-right font-mono text-foreground"
                                >
                                  {(obs[series.id] as number)?.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }) || "—"}
                                </td>
                              ))}
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
