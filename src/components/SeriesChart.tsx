import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp } from "lucide-react";
import type { Currency } from "./SeriesDetail";

interface SeriesChartProps {
  seriesId: string;
  currency: Currency;
  dateRange: { start: string; end: string };
}

interface Observation {
  date: string;
  value: number | null;
}

export const SeriesChart = ({ seriesId, currency, dateRange }: SeriesChartProps) => {
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ latest: number | null; change: number | null }>({
    latest: null,
    change: null,
  });

  useEffect(() => {
    const fetchObservations = async () => {
      setLoading(true);
      
      let valueColumn = "value";
      if (currency === "EUR") valueColumn = "value_eur";
      if (currency === "USD") valueColumn = "value_usd";

      let query = supabase
        .from("observations")
        .select(`date, ${valueColumn}`)
        .eq("series_id", seriesId)
        .order("date", { ascending: true });

      if (dateRange.start) {
        query = query.gte("date", dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte("date", dateRange.end);
      }

      const { data: observations, error } = await query;

      if (!error && observations) {
        const formattedData = observations.map((obs: any) => ({
          date: obs.date,
          value: obs[valueColumn],
        }));
        
        setData(formattedData);

        // Calculate stats
        if (formattedData.length > 0) {
          const latest = formattedData[formattedData.length - 1]?.value;
          const previous = formattedData.length > 1 ? formattedData[formattedData.length - 2]?.value : null;
          const change = latest && previous ? ((latest - previous) / previous) * 100 : null;
          
          setStats({ latest, change });
        }
      }
      
      setLoading(false);
    };

    fetchObservations();
  }, [seriesId, currency, dateRange]);

  if (loading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No data available for this time range</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Time Series Data</CardTitle>
          {stats.latest !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground font-mono">
                {stats.latest.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {stats.change !== null && (
                <p
                  className={`text-sm font-medium ${
                    stats.change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stats.change >= 0 ? "+" : ""}
                  {stats.change.toFixed(2)}%
                </p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { 
                month: 'short', 
                year: '2-digit' 
              })}
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
                "Value",
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
        <div className="mt-6 max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left font-medium text-muted-foreground">Date</th>
                <th className="py-2 px-4 text-right font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.slice().reverse().map((obs, idx) => (
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
      </CardContent>
    </Card>
  );
};
