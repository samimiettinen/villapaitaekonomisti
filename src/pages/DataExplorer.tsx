import { useState } from "react";
import { TrendingUp, Search, Loader2, Download, X, ChevronLeft, ChevronRight, Database, Globe, Building2, Landmark, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/DateRangePicker";
import { fredApi, statfinApi, ecbApi, eurostatApi, oecdApi, worldbankApi } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "@/hooks/use-toast";

type SourceType = "FRED" | "STATFIN" | "ECB" | "EUROSTAT" | "OECD" | "WORLDBANK";

interface DataSeries {
  id: string;
  title: string;
  source: SourceType;
  frequency?: string;
  units?: string;
  path?: string;
  providerId?: string;
}

interface SelectedSeriesItem extends DataSeries {
  axis: "left" | "right";
  color: string;
}

type ChartDataPoint = {
  date: string;
  [key: string]: string | number | null;
};

interface StatFinItem {
  id: string;
  text: string;
  type: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 65%, 60%)",
];

const SOURCE_LABELS: Record<SourceType, string> = {
  FRED: "FRED",
  STATFIN: "StatFin",
  ECB: "ECB",
  EUROSTAT: "Eurostat",
  OECD: "OECD",
  WORLDBANK: "World Bank",
};

const DataExplorer = () => {
  const [activeTab, setActiveTab] = useState<string>("fred");
  
  // Search state for each source
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DataSeries[]>([]);
  const [searching, setSearching] = useState(false);

  // StatFin navigation state
  const [statfinItems, setStatfinItems] = useState<StatFinItem[]>([]);
  const [statfinPath, setStatfinPath] = useState<string[]>([]);
  const [statfinLoading, setStatfinLoading] = useState(false);

  // Shared state
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeriesItem[]>([]);
  const [dateRange, setDateRange] = useState({
    start: "2000-01-01",
    end: new Date().toISOString().split("T")[0],
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [seriesWithData, setSeriesWithData] = useState<Set<string>>(new Set());

  // Generic search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    
    try {
      let results: DataSeries[] = [];
      
      switch (activeTab) {
        case "fred": {
          const data = await fredApi.search(searchQuery);
          results = (data.results || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            source: "FRED" as SourceType,
            frequency: s.frequency_short,
            units: s.units,
          }));
          break;
        }
        case "ecb": {
          const data = await ecbApi.search(searchQuery);
          results = (data.results || []).map((s: any) => ({
            id: s.id,
            title: s.name,
            source: "ECB" as SourceType,
            providerId: s.id,
          }));
          break;
        }
        case "eurostat": {
          const data = await eurostatApi.search(searchQuery);
          results = (data.results || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            source: "EUROSTAT" as SourceType,
            providerId: s.id,
          }));
          break;
        }
        case "oecd": {
          const data = await oecdApi.search(searchQuery);
          results = (data.results || []).map((s: any) => ({
            id: s.id,
            title: s.name,
            source: "OECD" as SourceType,
            providerId: s.id,
          }));
          break;
        }
        case "worldbank": {
          const data = await worldbankApi.search(searchQuery);
          results = (data.results || []).map((s: any) => ({
            id: s.id,
            title: s.name,
            source: "WORLDBANK" as SourceType,
            providerId: s.id,
          }));
          break;
        }
      }
      
      setSearchResults(results);
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

  // StatFin navigation
  const loadStatfinDatabases = async () => {
    setStatfinLoading(true);
    try {
      const data = await statfinApi.listDatabases();
      setStatfinItems(data || []);
      setStatfinPath([]);
    } catch (error) {
      console.error("Error loading databases:", error);
      toast({
        title: "Failed to load databases",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
    setStatfinLoading(false);
  };

  const navigateStatfin = async (item: StatFinItem) => {
    setStatfinLoading(true);
    const newPath = [...statfinPath, item.id];
    
    try {
      const data = await statfinApi.listTables(newPath.join("/"));
      
      if (Array.isArray(data)) {
        setStatfinItems(data);
        setStatfinPath(newPath);
      } else if (item.type === "t") {
        const series: DataSeries = {
          id: `STATFIN_${newPath.join("_")}`,
          title: item.text,
          source: "STATFIN",
          path: newPath.join("/"),
        };
        handleSelectSeries(series);
      }
    } catch (error) {
      console.error("Navigation error:", error);
    }
    setStatfinLoading(false);
  };

  const goBackStatfin = async () => {
    if (statfinPath.length === 0) return;
    
    setStatfinLoading(true);
    const newPath = statfinPath.slice(0, -1);
    
    try {
      if (newPath.length === 0) {
        const data = await statfinApi.listDatabases();
        setStatfinItems(data || []);
      } else {
        const data = await statfinApi.listTables(newPath.join("/"));
        setStatfinItems(data || []);
      }
      setStatfinPath(newPath);
    } catch (error) {
      console.error("Navigation error:", error);
    }
    setStatfinLoading(false);
  };

  // Series selection
  const handleSelectSeries = (series: DataSeries) => {
    const normalizedId = series.source === "FRED" ? `FRED_${series.id}` : series.id;
    
    if (selectedSeries.find(s => s.id === normalizedId || s.id === series.id)) {
      toast({ title: "Series already added" });
      return;
    }
    if (selectedSeries.length >= 6) {
      toast({ title: "Maximum 6 series allowed", variant: "destructive" });
      return;
    }

    const newSeries: SelectedSeriesItem = {
      ...series,
      id: normalizedId,
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

  // Data fetching
  const fetchChartData = async () => {
    if (selectedSeries.length === 0) {
      setChartData([]);
      return;
    }

    setLoadingChart(true);
    const newSeriesWithData = new Set<string>();

    try {
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

      const dateMap = new Map<string, ChartDataPoint>();
      
      for (const seriesId in allData) {
        for (const obs of allData[seriesId]) {
          if (!dateMap.has(obs.date)) {
            dateMap.set(obs.date, { date: obs.date });
          }
          dateMap.get(obs.date)![seriesId] = obs.value;
        }
      }

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

  // Ingest data
  const handleIngestSeries = async (series: SelectedSeriesItem) => {
    setIngestingId(series.id);
    try {
      switch (series.source) {
        case "FRED": {
          const originalId = series.id.replace("FRED_", "");
          await fredApi.ingest(originalId);
          break;
        }
        case "STATFIN": {
          if (series.path) {
            await statfinApi.ingest(series.path, {
              query: [],
              response: { format: "json" }
            });
          }
          break;
        }
        case "ECB": {
          const dataflowId = series.providerId || series.id.replace("ECB_", "").split("_")[0];
          await ecbApi.ingest(dataflowId, "..", series.title);
          break;
        }
        case "EUROSTAT": {
          const datasetId = series.providerId || series.id.replace("EUROSTAT_", "").split("_")[0];
          await eurostatApi.ingest(datasetId, "", series.title);
          break;
        }
        case "OECD": {
          const dataflowId = series.providerId || series.id.replace("OECD_", "").split("_")[0];
          await oecdApi.ingest(dataflowId, "all", series.title);
          break;
        }
        case "WORLDBANK": {
          const indicatorId = series.providerId || series.id.replace("WB_", "").split("_")[0];
          await worldbankApi.ingest(indicatorId, "WLD", series.title);
          break;
        }
      }
      
      toast({
        title: "Data imported",
        description: `${series.title} has been added to the database`,
      });
      await fetchChartData();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
    setIngestingId(null);
  };

  // Load StatFin on tab switch
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchQuery("");
    setSearchResults([]);
    
    if (tab === "statfin" && statfinItems.length === 0) {
      loadStatfinDatabases();
    }
  };

  const leftAxisSeries = selectedSeries.filter(s => s.axis === "left");
  const rightAxisSeries = selectedSeries.filter(s => s.axis === "right");

  const filteredStatfinItems = searchQuery
    ? statfinItems.filter(item => 
        item.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : statfinItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Data Explorer</h1>
                <p className="text-sm text-muted-foreground">
                  FRED • ECB • Eurostat • OECD • World Bank • StatFin
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
          {/* Left Panel: Data Sources */}
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
                <TabsTrigger value="fred" className="text-xs px-2">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  FRED
                </TabsTrigger>
                <TabsTrigger value="ecb" className="text-xs px-2">
                  <Landmark className="h-3 w-3 mr-1" />
                  ECB
                </TabsTrigger>
                <TabsTrigger value="eurostat" className="text-xs px-2">
                  <Building2 className="h-3 w-3 mr-1" />
                  Eurostat
                </TabsTrigger>
                <TabsTrigger value="oecd" className="text-xs px-2">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  OECD
                </TabsTrigger>
                <TabsTrigger value="worldbank" className="text-xs px-2">
                  <Globe className="h-3 w-3 mr-1" />
                  WB
                </TabsTrigger>
                <TabsTrigger value="statfin" className="text-xs px-2">
                  <Database className="h-3 w-3 mr-1" />
                  StatFin
                </TabsTrigger>
              </TabsList>

              {/* Search-based sources */}
              {["fred", "ecb", "eurostat", "oecd", "worldbank"].map((source) => (
                <TabsContent key={source} value={source} className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Search {SOURCE_LABELS[source.toUpperCase() as SourceType] || source}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="GDP, inflation, employment..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={searching} size="icon">
                          {searching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

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
                                {series.id}
                                {series.frequency && ` • ${series.frequency}`}
                                {series.units && ` • ${series.units}`}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}

              {/* StatFin browse */}
              <TabsContent value="statfin" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Browse Statistics Finland</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statfinPath.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={goBackStatfin}>
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Back
                        </Button>
                        <span className="text-xs text-muted-foreground truncate">
                          {statfinPath.join(" / ")}
                        </span>
                      </div>
                    )}

                    <Input
                      placeholder="Filter..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {statfinLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {filteredStatfinItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => navigateStatfin(item)}
                            className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-between"
                          >
                            <span className="text-sm text-foreground truncate">
                              {item.text}
                            </span>
                            {item.type === "l" ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Table
                              </Badge>
                            )}
                          </button>
                        ))}
                        {filteredStatfinItems.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No items found
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Selected Series */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selected Series ({selectedSeries.length}/6)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedSeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No series selected. Search or browse to add data.
                  </p>
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
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {series.title}
                            </p>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {SOURCE_LABELS[series.source]}
                            </Badge>
                          </div>
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
                        {!seriesWithData.has(series.id) && !loadingChart && (
                          <Button
                            onClick={() => handleIngestSeries(series)}
                            disabled={ingestingId === series.id}
                            size="sm"
                            className="h-6 text-xs"
                          >
                            {ingestingId === series.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                Import
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {selectedSeries.length > 0 && (
                  <Button 
                    onClick={fetchChartData} 
                    className="w-full mt-2"
                    disabled={loadingChart}
                  >
                    {loadingChart ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Update Chart
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Time Period</CardTitle>
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
                      ? "Select data to visualize"
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
                  <div className="h-[500px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="text-center">
                      <Globe className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                      <p className="text-lg font-medium text-foreground">No data to display</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {selectedSeries.length > 0
                          ? "Click 'Import' on selected series to fetch data, then 'Update Chart'"
                          : "Search any source to add economic data series"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={500}>
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
                      {leftAxisSeries.length > 0 && (
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke={leftAxisSeries[0].color}
                          fontSize={12}
                          tickFormatter={(value) => value.toLocaleString()}
                        />
                      )}
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
                          return [value?.toLocaleString() ?? "N/A", series?.title || name];
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
                          stroke={series.color}
                          yAxisId={series.axis}
                          dot={false}
                          strokeWidth={2}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExplorer;
