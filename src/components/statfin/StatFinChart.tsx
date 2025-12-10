import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { StatFinIndicator } from "@/lib/statfinIndicators";

interface TimeSeriesData {
  date: string;
  value: number;
}

interface IndicatorData {
  indicatorId: string;
  data: TimeSeriesData[];
  metadata: StatFinIndicator;
}

interface StatFinChartProps {
  data: TimeSeriesData[];
  metadata: StatFinIndicator;
  multipleData?: IndicatorData[];
  title?: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function StatFinChart({ data, metadata, multipleData, title }: StatFinChartProps) {
  // Combined chart for multiple indicators
  if (multipleData && multipleData.length > 0) {
    // Merge all data by date
    const allDates = new Set<string>();
    multipleData.forEach(d => d.data.forEach(p => allDates.add(p.date)));
    const sortedDates = Array.from(allDates).sort();
    
    const chartData = sortedDates.map(date => {
      const point: any = { date };
      multipleData.forEach((d, i) => {
        const value = d.data.find(p => p.date === date)?.value;
        point[`series_${i}`] = value;
      });
      return point;
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || "Combined View"}</CardTitle>
          <CardDescription>
            Comparing {multipleData.length} indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.substring(0, 7)}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => {
                    const index = parseInt(name.replace("series_", ""));
                    const indicator = multipleData[index];
                    return [
                      value?.toLocaleString() ?? "N/A",
                      indicator?.metadata.label.split(",")[0] || name
                    ];
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    const index = parseInt(value.replace("series_", ""));
                    return multipleData[index]?.metadata.label.split(",")[0] || value;
                  }}
                />
                {multipleData.map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`series_${i}`}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single indicator chart
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  const latestValue = data[data.length - 1];
  const previousValue = data.length > 1 ? data[data.length - 2] : null;
  const change = previousValue 
    ? ((latestValue.value - previousValue.value) / previousValue.value * 100).toFixed(2)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{metadata.label}</CardTitle>
            <CardDescription>{metadata.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {latestValue.value.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {metadata.unit}
              </span>
            </div>
            {change && (
              <Badge variant={parseFloat(change) >= 0 ? "default" : "destructive"}>
                {parseFloat(change) >= 0 ? "+" : ""}{change}%
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="secondary">{metadata.category}</Badge>
          <Badge variant="outline">
            {metadata.frequency === "Q" ? "Quarterly" : metadata.frequency === "M" ? "Monthly" : "Annual"}
          </Badge>
          <Badge variant="outline">StatFin</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.substring(0, 7)}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                width={80}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} ${metadata.unit}`,
                  metadata.label.split(",")[0]
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted-foreground mt-4 text-center">
          Source: Statistics Finland (StatFin) | {data.length} data points | 
          Latest: {latestValue.date}
        </div>
      </CardContent>
    </Card>
  );
}
