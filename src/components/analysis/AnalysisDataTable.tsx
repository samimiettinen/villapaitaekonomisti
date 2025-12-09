import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { DataExporter } from "./DataExporter";
import type { SelectedSeries, Transformation, Currency } from "@/lib/types";

interface AnalysisDataTableProps {
  selectedSeries: SelectedSeries[];
  transformations: Transformation[];
  dateRange: { start: string; end: string };
  currency: Currency;
}

type ObservationPoint = {
  date: string;
  [key: string]: number | string | null;
};

export const AnalysisDataTable = ({
  selectedSeries,
  transformations,
  dateRange,
  currency,
}: AnalysisDataTableProps) => {
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

  const formatValue = (val: number | string | null): string => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "string") return val;
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">Loading data...</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Table</CardTitle>
          <DataExporter
            data={data}
            selectedSeries={selectedSeries}
            transformations={transformations}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Date</TableHead>
                {selectedSeries.map((series) => (
                  <TableHead key={series.id} className="min-w-[150px]">
                    {series.title}
                  </TableHead>
                ))}
                {transformations.map((t) => (
                  <TableHead key={t.id} className="min-w-[150px]">
                    {t.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.date}>
                  <TableCell className="sticky left-0 bg-card font-medium">{row.date}</TableCell>
                  {selectedSeries.map((series) => (
                    <TableCell key={series.id}>{formatValue(row[series.id])}</TableCell>
                  ))}
                  {transformations.map((t) => (
                    <TableCell key={t.id} className="font-medium">
                      {formatValue(row[t.id])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
