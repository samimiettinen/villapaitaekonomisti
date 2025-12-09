import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SelectedSeriesItem {
  id: string;
  title: string;
  color: string;
}

interface ExplorerDataTableProps {
  data: Array<{ date: string; [key: string]: string | number | null }>;
  selectedSeries: SelectedSeriesItem[];
}

const formatValue = (value: number | string | null): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const ExplorerDataTable = ({ data, selectedSeries }: ExplorerDataTableProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (data.length === 0 || selectedSeries.length === 0) return null;

  const displayData = expanded ? data : data.slice(-20);

  const copyToClipboard = () => {
    const headers = ["Date", ...selectedSeries.map((s) => s.title)];
    const rows = data.map((row) => [
      row.date,
      ...selectedSeries.map((s) => {
        const val = row[s.id];
        return val !== null && val !== undefined ? String(val) : "";
      }),
    ]);

    const tsv = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Data can be pasted into spreadsheets" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Table className="h-4 w-4" />
            Data Table ({data.length} rows)
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-1"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Copy
            </Button>
            {data.length > 20 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left font-medium text-muted-foreground">Date</th>
                {selectedSeries.map((series) => (
                  <th key={series.id} className="py-2 px-3 text-right font-medium text-muted-foreground">
                    <div className="flex items-center justify-end gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="truncate max-w-[120px]" title={series.title}>
                        {series.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="py-2 px-3 font-mono text-foreground">
                    {new Date(row.date).toLocaleDateString()}
                  </td>
                  {selectedSeries.map((series) => (
                    <td key={series.id} className="py-2 px-3 text-right font-mono text-foreground">
                      {formatValue(row[series.id] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!expanded && data.length > 20 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Showing last 20 of {data.length} rows
          </p>
        )}
      </CardContent>
    </Card>
  );
};
