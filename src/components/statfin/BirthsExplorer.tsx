import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { RefreshCw, Download, Baby, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { 
  BirthsMetaResponse, 
  BirthsDataResponse, 
  BirthDataRow,
  PxVariable,
  StatFinTableMeta 
} from "@/lib/pxwebTypes";
import { formatBirthDataForChart, calculateYearlyTotals, getMonthName } from "@/lib/pxwebTypes";

const MONTHS = [
  { value: "1", label: "Tammikuu" },
  { value: "2", label: "Helmikuu" },
  { value: "3", label: "Maaliskuu" },
  { value: "4", label: "Huhtikuu" },
  { value: "5", label: "Toukokuu" },
  { value: "6", label: "Kesäkuu" },
  { value: "7", label: "Heinäkuu" },
  { value: "8", label: "Elokuu" },
  { value: "9", label: "Syyskuu" },
  { value: "10", label: "Lokakuu" },
  { value: "11", label: "Marraskuu" },
  { value: "12", label: "Joulukuu" },
];

export const BirthsExplorer = () => {
  const { toast } = useToast();
  const [meta, setMeta] = useState<StatFinTableMeta | null>(null);
  const [data, setData] = useState<BirthDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedInfoCode, setSelectedInfoCode] = useState<string>("");
  const [chartType, setChartType] = useState<"monthly" | "yearly">("monthly");

  // Available years from metadata
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableInfoCodes, setAvailableInfoCodes] = useState<{ code: string; text: string }[]>([]);

  // Fetch metadata on mount
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    setMetaLoading(true);
    setError(null);

    try {
      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        "fetch-statfin-births",
        { 
          body: null,
          method: "GET",
        }
      );

      // Also try with action parameter
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-statfin-births?action=meta`,
        {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`);
      }

      const result = await response.json() as BirthsMetaResponse;
      
      if (!result.success || !result.meta) {
        throw new Error("Invalid metadata response");
      }

      setMeta(result.meta);

      // Extract available years
      const yearVar = result.meta.variables.find(
        (v) => v.code === "Vuosi" || v.code.toLowerCase().includes("year")
      );
      if (yearVar) {
        setAvailableYears(yearVar.values);
        // Default to last 5 years
        setSelectedYears(yearVar.values.slice(-5));
      }

      // Extract available info codes
      const infoVar = result.meta.variables.find(
        (v) => v.code === "Tiedot" || v.code.toLowerCase().includes("info")
      );
      if (infoVar) {
        const codes = infoVar.values.map((val, idx) => ({
          code: val,
          text: infoVar.valueTexts[idx] || val,
        }));
        setAvailableInfoCodes(codes);
        if (codes.length > 0) {
          setSelectedInfoCode(codes[0].code);
        }
      }
    } catch (err: any) {
      console.error("Metadata fetch error:", err);
      setError(err.message || "Failed to load metadata");
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchData = async () => {
    if (selectedYears.length === 0) {
      toast({ title: "Valitse vähintään yksi vuosi", variant: "destructive" });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-statfin-births?action=data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            years: selectedYears,
            months: selectedMonths.length > 0 ? selectedMonths : undefined,
            infoCodes: selectedInfoCode ? [selectedInfoCode] : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result = await response.json() as BirthsDataResponse;

      if (!result.success) {
        throw new Error("Data fetch failed");
      }

      setData(result.data);
      toast({ 
        title: "Tiedot haettu", 
        description: `${result.rowCount} riviä ladattu` 
      });
    } catch (err: any) {
      console.error("Data fetch error:", err);
      setError(err.message || "Failed to load data");
      toast({ title: "Virhe", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleYearToggle = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const handleMonthToggle = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const exportToCsv = () => {
    if (data.length === 0) return;

    const headers = ["Vuosi", "Kuukausi", "Tieto", "Arvo"];
    const rows = data.map((row) => [
      row.year,
      getMonthName(row.month),
      row.infoText,
      row.value?.toString() || "",
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `syntyneet_${selectedYears.join("-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const chartData = chartType === "monthly" 
    ? formatBirthDataForChart(data)
    : calculateYearlyTotals(data).map((t) => ({ 
        date: t.year, 
        label: t.year, 
        value: t.total 
      }));

  // Calculate summary stats
  const totalBirths = data.reduce((sum, row) => sum + (row.value || 0), 0);
  const avgMonthly = data.length > 0 ? Math.round(totalBirths / data.filter(r => r.value !== null).length) : 0;
  const latestValue = data.length > 0 ? data[data.length - 1]?.value : null;

  if (metaLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Baby className="h-5 w-5" />
                Syntyneet - Elävänä syntyneet kuukausittain
              </CardTitle>
              <CardDescription>
                {meta?.title || "StatFin syntymätilasto"}
              </CardDescription>
            </div>
            <Badge variant="secondary">StatFin</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suodattimet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Years */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Vuodet</Label>
            <div className="flex flex-wrap gap-2">
              {availableYears.slice(-20).map((year) => (
                <Button
                  key={year}
                  variant={selectedYears.includes(year) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleYearToggle(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedYears(availableYears.slice(-5))}
              >
                Viimeiset 5 vuotta
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedYears(availableYears.slice(-10))}
              >
                Viimeiset 10 vuotta
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedYears([])}
              >
                Tyhjennä
              </Button>
            </div>
          </div>

          {/* Months */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Kuukaudet (tyhjä = kaikki)</Label>
            <div className="grid grid-cols-6 gap-2">
              {MONTHS.map((month) => (
                <div key={month.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`month-${month.value}`}
                    checked={selectedMonths.includes(month.value)}
                    onCheckedChange={() => handleMonthToggle(month.value)}
                  />
                  <Label htmlFor={`month-${month.value}`} className="text-sm">
                    {month.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Info code */}
          {availableInfoCodes.length > 1 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Tieto</Label>
              <Select value={selectedInfoCode} onValueChange={setSelectedInfoCode}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Valitse tieto" />
                </SelectTrigger>
                <SelectContent>
                  {availableInfoCodes.map((info) => (
                    <SelectItem key={info.code} value={info.code}>
                      {info.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={fetchData} disabled={loading || selectedYears.length === 0}>
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Hae tiedot
            </Button>
            <Button variant="outline" onClick={exportToCsv} disabled={data.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Vie CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Yhteensä</div>
              <div className="text-2xl font-bold">{totalBirths.toLocaleString("fi-FI")}</div>
              <div className="text-xs text-muted-foreground">
                {selectedYears.length} vuotta
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Kuukausikeskiarvo</div>
              <div className="text-2xl font-bold">{avgMonthly.toLocaleString("fi-FI")}</div>
              <div className="text-xs text-muted-foreground">syntynyttä/kk</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Viimeisin arvo</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {latestValue?.toLocaleString("fi-FI") || "—"}
                {data.length > 1 && latestValue !== null && (
                  latestValue < (data[data.length - 2]?.value || 0) 
                    ? <TrendingDown className="h-4 w-4 text-red-500" />
                    : <TrendingUp className="h-4 w-4 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Syntyneet</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant={chartType === "monthly" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setChartType("monthly")}
                >
                  Kuukausittain
                </Button>
                <Button 
                  variant={chartType === "yearly" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setChartType("yearly")}
                >
                  Vuosittain
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "monthly" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => val.slice(0, 7)}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => val.toLocaleString("fi-FI")}
                    />
                    <Tooltip 
                      formatter={(val: number) => [val.toLocaleString("fi-FI"), "Syntyneitä"]}
                      labelFormatter={(label) => chartData.find(d => d.date === label)?.label || label}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => val.toLocaleString("fi-FI")}
                    />
                    <Tooltip 
                      formatter={(val: number) => [val.toLocaleString("fi-FI"), "Syntyneitä"]}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tiedot ({data.length} riviä)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2">Vuosi</th>
                    <th className="text-left p-2">Kuukausi</th>
                    <th className="text-left p-2">Tieto</th>
                    <th className="text-right p-2">Arvo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2">{row.year}</td>
                      <td className="p-2">{getMonthName(row.month)}</td>
                      <td className="p-2 text-muted-foreground">{row.infoText}</td>
                      <td className="p-2 text-right font-mono">
                        {row.value?.toLocaleString("fi-FI") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 100 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Näytetään 100 / {data.length} riviä
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
