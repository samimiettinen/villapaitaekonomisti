import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator } from "lucide-react";

interface StatsData {
  seriesId: string;
  seriesTitle: string;
  color: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

interface StatsSummaryProps {
  stats: StatsData[];
}

const formatNumber = (value: number): string => {
  if (Math.abs(value) >= 1e9) {
    return (value / 1e9).toFixed(2) + "B";
  } else if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(2) + "M";
  } else if (Math.abs(value) >= 1e3) {
    return (value / 1e3).toFixed(2) + "K";
  } else if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const StatsSummary = ({ stats }: StatsSummaryProps) => {
  if (stats.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Summary Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Series</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Count</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Mean</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Median</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Min</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Max</th>
                <th className="py-2 px-3 text-right font-medium text-muted-foreground">Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.seriesId} className="border-b border-border last:border-0">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="text-foreground truncate max-w-[150px]" title={stat.seriesTitle}>
                        {stat.seriesTitle}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{stat.count}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{formatNumber(stat.mean)}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{formatNumber(stat.median)}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{formatNumber(stat.min)}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{formatNumber(stat.max)}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{formatNumber(stat.stdDev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
