import { Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataSource } from "@/pages/Index";

interface SourceSelectorProps {
  value: DataSource;
  onChange: (source: DataSource) => void;
}

export const SourceSelector = ({ value, onChange }: SourceSelectorProps) => {
  const sources: { value: DataSource; label: string; icon: typeof Globe }[] = [
    { value: "ALL", label: "All", icon: Globe },
    { value: "FRED", label: "FRED", icon: Database },
    { value: "ECB", label: "ECB", icon: Database },
    { value: "EUROSTAT", label: "Eurostat", icon: Database },
    { value: "OECD", label: "OECD", icon: Database },
    { value: "WORLDBANK", label: "World Bank", icon: Database },
    { value: "STATFIN", label: "StatFin", icon: Database },
  ];

  return (
    <div className="flex gap-2">
      {sources.map((source) => {
        const Icon = source.icon;
        return (
          <Button
            key={source.value}
            variant={value === source.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(source.value)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {source.label}
          </Button>
        );
      })}
    </div>
  );
};
