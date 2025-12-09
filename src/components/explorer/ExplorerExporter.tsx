import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface SelectedSeriesItem {
  id: string;
  title: string;
}

interface ExplorerExporterProps {
  data: Array<{ date: string; [key: string]: number | string | null }>;
  selectedSeries: SelectedSeriesItem[];
}

export const ExplorerExporter = ({ data, selectedSeries }: ExplorerExporterProps) => {
  const formatValue = (val: number | string | null): string | number => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    return val;
  };

  const prepareExportData = () => {
    return data.map((row) => {
      const exportRow: { [key: string]: string | number } = {
        Date: row.date,
      };

      selectedSeries.forEach((series) => {
        exportRow[series.title] = formatValue(row[series.id]);
      });

      return exportRow;
    });
  };

  const exportToCSV = () => {
    const exportData = prepareExportData();
    if (exportData.length === 0) return;

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers.map((header) => {
          const value = row[header];
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `data_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const exportData = prepareExportData();
    if (exportData.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Export");

    const colWidths = Object.keys(exportData[0]).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `data_export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (data.length === 0) return null;

  return (
    <div className="flex gap-2">
      <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
    </div>
  );
};
