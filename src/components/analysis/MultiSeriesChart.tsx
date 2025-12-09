import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { SelectedSeries, Transformation, Currency } from "@/lib/types";

interface MultiSeriesChartProps {
  selectedSeries: SelectedSeries[];
  transformations: Transformation[];
  dateRange: { start: string; end: string };
  currency: Currency;
}

type ObservationPoint = {
  date: string;
  [key: string]: number | string | null;
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const MultiSeriesChart = ({
  selectedSeries,
  transformations,
  dateRange,
  currency,
}: MultiSeriesChartProps) => {
  const [data, setData] = useState<ObservationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAndMergeData();
  }, [selectedSeries, transformations, dateRange, currency]);

  const fetchAndMergeData = async () => {
    if (selectedSeries.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const allObservations: { [seriesId: string]: { [date: string]: number | null } } = {};

      for (const series of selectedSeries) {
        const valueColumn = currency === "EUR" ? "value_eur" : currency === "USD" ? "value_usd" : "value";

        const { data: obs, error } = await supabase
          .from("observations")
          .select(`date, ${valueColumn}`)
          .eq("series_id", series.id)
          .gte("date", dateRange.start)
          .lte("date", dateRange.end)
          .order("date", { ascending: true });

        if (error) throw error;

        allObservations[series.id] = {};
        obs?.forEach((o: any) => {
          allObservations[series.id][o.date] = o[valueColumn];
        });
      }

      const allDates = new Set<string>();
      Object.values(allObservations).forEach((obs) => {
        Object.keys(obs).forEach((date) => allDates.add(date));
      });

      const sortedDates = Array.from(allDates).sort();

      const mergedData: ObservationPoint[] = sortedDates.map((date) => {
        const point: ObservationPoint = { date };

        selectedSeries.forEach((series) => {
          point[series.id] = allObservations[series.id]?.[date] ?? null;
        });

        transformations.forEach((t) => {
          const valA = point[t.seriesA] as number | null;
          const valB = point[t.seriesB] as number | null;

          if (valA !== null && valB !== null) {
            switch (t.type) {
              case "divide":
                point[t.id] = valB !== 0 ? valA / valB : null;
                break;
              case "multiply":
                point[t.id] = valA * valB;
                break;
              case "add":
                point[t.id] = valA + valB;
                break;
              case "subtract":
                point[t.id] = valA - valB;
                break;
            }
          } else {
            point[t.id] = null;
          }
        });

        return point;
      });

      setData(mergedData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">Loading chart...</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No data available for selected range</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Series Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            {selectedSeries.map((series, idx) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.id}
                name={series.title}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
            {transformations.map((t, idx) => (
              <Line
                key={t.id}
                type="monotone"
                dataKey={t.id}
                name={t.name}
                stroke={COLORS[(selectedSeries.length + idx) % COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
