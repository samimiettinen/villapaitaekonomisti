import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  TrendingUp, 
  RefreshCw, 
  Download,
  Search,
  Filter,
  Table2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { 
  STATFIN_INDICATORS, 
  getCategories, 
  getIndicatorById,
  StatFinIndicator 
} from "@/lib/statfinIndicators";
import {
  StatFinTableMetadata,
  StatFinDataResponse,
  buildDefaultQuery,
  fetchTableData,
  detectFrequency,
  getTablePathString,
} from "@/lib/statfinPxweb";
import { transformPxWebResponse, StatFinTableData } from "@/lib/statfinTransform";
import StatFinChart from "@/components/statfin/StatFinChart";
import StatFinExplorer from "@/components/statfin/StatFinExplorer";
import StatFinResultView from "@/components/statfin/StatFinResultView";

interface TimeSeriesData {
  date: string;
  value: number;
}

interface IndicatorData {
  indicatorId: string;
  data: TimeSeriesData[];
  metadata: StatFinIndicator | { label: string; unit: string; frequency: string; category: string; description: string };
}

interface ExplorerTableResult {
  path: string[];
  metadata: StatFinTableMetadata;
  tableData: StatFinTableData;
  rawResponse: StatFinDataResponse;
}

const DATE_RANGE_OPTIONS = [
  { value: "5", label: "Last 5 years" },
  { value: "10", label: "Last 10 years" },
  { value: "20", label: "Last 20 years" },
  { value: "all", label: "All available" },
];

export default function StatFinDashboard() {
  const [activeTab, setActiveTab] = useState<string>("explorer");
  
  // Curated indicators state
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("10");
  const [fetchedData, setFetchedData] = useState<Map<string, IndicatorData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  
  // Explorer state - now stores table data for table-first view
  const [explorerResults, setExplorerResults] = useState<ExplorerTableResult[]>([]);
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);

  const categories = useMemo(() => getCategories(), []);

  const filteredIndicators = useMemo(() => {
    return STATFIN_INDICATORS.filter(ind => {
      const matchesSearch = ind.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ind.labelFi.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ind.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || ind.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, categoryFilter]);

  const toggleIndicator = (id: string) => {
    setSelectedIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // Handle table selection from explorer - now transforms to table data
  const handleExplorerTableSelected = async (
    tablePath: string[], 
    metadata: StatFinTableMetadata
  ) => {
    setIsLoadingExplorer(true);
    
    try {
      // Build a default query
      const query = buildDefaultQuery(metadata, 100); // Last 100 time periods
      
      // Fetch the raw data
      const rawResponse = await fetchTableData(tablePath, query);
      
      // Transform to normalized table structure
      const tableData = transformPxWebResponse(rawResponse, metadata);
      
      if (tableData.rows.length === 0) {
        toast({
          title: "No data",
          description: "The selected table returned no data with the default query.",
          variant: "destructive",
        });
        return;
      }
      
      // Add to explorer results
      setExplorerResults(prev => [
        ...prev,
        { path: tablePath, metadata, tableData, rawResponse }
      ]);
      
      toast({
        title: "Table loaded",
        description: `Loaded ${tableData.rows.length} rows from "${metadata.title}"`,
      });
    } catch (error) {
      console.error("Failed to load table data:", error);
      toast({
        title: "Error loading data",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingExplorer(false);
    }
  };

  const removeExplorerResult = (index: number) => {
    setExplorerResults(prev => prev.filter((_, i) => i !== index));
  };

  const fetchIndicatorData = async (indicator: StatFinIndicator): Promise<TimeSeriesData[]> => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // First get metadata to find available time periods
    const metadataUrl = `${SUPABASE_URL}/functions/v1/fetch-statfin?action=metadata&tablePath=${encodeURIComponent(indicator.tablePath)}`;
    const metaResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    
    if (!metaResponse.ok) {
      const error = await metaResponse.json().catch(() => ({}));
      throw new Error(error.error || `Failed to fetch metadata for ${indicator.label}`);
    }
    
    const metadata = await metaResponse.json();
    
    // Find the time variable and its values
    const timeVariable = metadata.variables?.find((v: any) => 
      v.code === "Vuosineljännes" || v.code === "Kuukausi" || v.code === "Vuosi" ||
      v.code.toLowerCase().includes("aika") || v.time === true
    );
    
    if (!timeVariable) {
      throw new Error(`No time variable found for ${indicator.label}`);
    }
    
    // Filter time values based on date range
    let timeValues = timeVariable.values || [];
    if (dateRange !== "all") {
      const yearsBack = parseInt(dateRange);
      const currentYear = new Date().getFullYear();
      const minYear = currentYear - yearsBack;
      
      timeValues = timeValues.filter((t: string) => {
        const year = parseInt(t.substring(0, 4));
        return year >= minYear;
      });
    }
    
    // Build the query with time selection
    const query = {
      query: [
        ...indicator.query,
        {
          code: timeVariable.code,
          selection: {
            filter: "item",
            values: timeValues
          }
        }
      ],
      response: { format: "json" }
    };
    
    // Fetch data
    const dataUrl = `${SUPABASE_URL}/functions/v1/fetch-statfin?action=data&tablePath=${encodeURIComponent(indicator.tablePath)}`;
    const dataResponse = await fetch(dataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ query }),
    });
    
    if (!dataResponse.ok) {
      const error = await dataResponse.json();
      throw new Error(error.error || `Failed to fetch data for ${indicator.label}`);
    }
    
    const data = await dataResponse.json();
    
    // Parse response into time series
    const timeSeries: TimeSeriesData[] = [];
    
    if (data.data) {
      data.data.forEach((item: any) => {
        if (item.key && item.values) {
          // Find the time key in the response
          const timeKey = item.key.find((k: string) => 
            /^\d{4}[QMK]?\d*$/.test(k) || /^\d{4}$/.test(k)
          ) || item.key[item.key.length - 1];
          
          const value = parseFloat(item.values[0]);
          
          if (!isNaN(value) && timeKey) {
            // Normalize date format
            let date = timeKey;
            if (timeKey.includes("Q") || timeKey.includes("K")) {
              // Quarterly format: 2024Q1 -> 2024-01
              const match = timeKey.match(/^(\d{4})[QK](\d)$/);
              if (match) {
                const [, year, quarter] = match;
                const month = (parseInt(quarter) - 1) * 3 + 1;
                date = `${year}-${month.toString().padStart(2, "0")}`;
              }
            } else if (timeKey.includes("M")) {
              // Monthly format: 2024M01 -> 2024-01
              date = timeKey.replace("M", "-");
            } else if (/^\d{4}$/.test(timeKey)) {
              // Annual: 2024 -> 2024-01
              date = `${timeKey}-01`;
            }
            
            timeSeries.push({ date, value });
          }
        }
      });
    }
    
    // Sort by date
    timeSeries.sort((a, b) => a.date.localeCompare(b.date));
    
    return timeSeries;
  };

  const handleFetchData = async () => {
    if (selectedIndicators.length === 0) {
      toast({
        title: "No indicators selected",
        description: "Please select at least one indicator to fetch data.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    const newData = new Map(fetchedData);
    let successCount = 0;
    let errorCount = 0;
    
    for (const indicatorId of selectedIndicators) {
      const indicator = getIndicatorById(indicatorId);
      if (!indicator) continue;
      
      try {
        const data = await fetchIndicatorData(indicator);
        newData.set(indicatorId, {
          indicatorId,
          data,
          metadata: indicator
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to fetch ${indicatorId}:`, error);
        errorCount++;
      }
    }
    
    setFetchedData(newData);
    setIsLoading(false);
    
    toast({
      title: "Data fetched",
      description: `Successfully fetched ${successCount} indicator(s)${errorCount > 0 ? `, ${errorCount} failed` : ""}.`,
    });
  };

  const exportToCsv = () => {
    // Export from curated indicators
    const allData = Array.from(fetchedData.values());
    
    if (allData.length === 0) return;
    
    const allDates = new Set<string>();
    allData.forEach(d => d.data.forEach(p => allDates.add(p.date)));
    const sortedDates = Array.from(allDates).sort();
    
    const headers = ["Date", ...allData.map(d => d.metadata.label)];
    const rows = sortedDates.map(date => {
      const values = allData.map(d => {
        const point = d.data.find(p => p.date === date);
        return point?.value ?? "";
      });
      return [date, ...values];
    });
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statfin_data.csv";
    a.click();
  };

  const hasData = fetchedData.size > 0 || explorerResults.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  StatFin Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Finnish Economic Indicators from Statistics Finland
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fetchedData.size > 0 && (
                <Button variant="outline" onClick={exportToCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Curated CSV
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="explorer" className="flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Browse All Tables
            </TabsTrigger>
            <TabsTrigger value="curated" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Curated Indicators
            </TabsTrigger>
          </TabsList>

          {/* Explorer Tab - Table-first view */}
          <TabsContent value="explorer" className="space-y-6">
            <StatFinExplorer 
              onTableSelected={handleExplorerTableSelected}
              onError={(err) => {
                toast({
                  title: "Explorer error",
                  description: err.message,
                  variant: "destructive",
                });
              }}
            />

            {/* Explorer Loading State */}
            {isLoadingExplorer && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading table data...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Explorer Results - Table-first view */}
            {explorerResults.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Selected Tables ({explorerResults.length})</h2>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setExplorerResults([])}
                  >
                    Clear All
                  </Button>
                </div>
                
                {explorerResults.map((result, index) => (
                  <div key={`${getTablePathString(result.path)}-${index}`} className="relative">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="absolute right-2 top-2 z-10"
                      onClick={() => removeExplorerResult(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <StatFinResultView tableData={result.tableData} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Curated Indicators Tab */}
          <TabsContent value="curated">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Panel - Indicator Selection */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Select Indicators
                    </CardTitle>
                    <CardDescription>
                      Choose economic indicators to visualize
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search indicators..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <Label>Date Range</Label>
                      <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_RANGE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Indicator List */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredIndicators.map(ind => (
                        <div
                          key={ind.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={ind.id}
                            checked={selectedIndicators.includes(ind.id)}
                            onCheckedChange={() => toggleIndicator(ind.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label 
                              htmlFor={ind.id} 
                              className="text-sm font-medium cursor-pointer block"
                            >
                              {ind.label}
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {ind.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {ind.frequency === "Q" ? "Quarterly" : ind.frequency === "M" ? "Monthly" : "Annual"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Fetch Button */}
                    <Button 
                      onClick={handleFetchData} 
                      className="w-full"
                      disabled={selectedIndicators.length === 0 || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Fetch Data ({selectedIndicators.length})
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Selected Summary */}
                {selectedIndicators.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Selected ({selectedIndicators.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {selectedIndicators.map(id => {
                          const ind = getIndicatorById(id);
                          return (
                            <Badge 
                              key={id} 
                              variant="default"
                              className="cursor-pointer"
                              onClick={() => toggleIndicator(id)}
                            >
                              {ind?.label.split(",")[0]}
                              <span className="ml-1">×</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Main Content - Charts */}
              <div className="lg:col-span-3 space-y-6">
                {isLoading && (
                  <Card>
                    <CardContent className="py-12">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Fetching data from Statistics Finland...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!isLoading && fetchedData.size === 0 && (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
                        <p>Select indicators from the left panel and click "Fetch Data" to visualize.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!isLoading && fetchedData.size > 0 && (
                  <>
                    {/* Individual Charts */}
                    {Array.from(fetchedData.values()).map(indicatorData => (
                      <StatFinChart
                        key={indicatorData.indicatorId}
                        data={indicatorData.data}
                        metadata={indicatorData.metadata as StatFinIndicator}
                      />
                    ))}

                    {/* Combined Chart if multiple indicators */}
                    {fetchedData.size > 1 && (
                      <StatFinChart
                        data={[]}
                        metadata={null as any}
                        multipleData={Array.from(fetchedData.values()).filter(d => 'id' in d.metadata) as any}
                        title="Combined View"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
