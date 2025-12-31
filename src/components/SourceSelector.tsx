import { Database, Globe, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataSource } from "@/lib/types";

interface SourceSelectorProps {
  value: DataSource;
  onChange: (source: DataSource) => void;
}

const sources: { value: DataSource; label: string; icon: typeof Globe }[] = [
  { value: "ALL", label: "All", icon: Globe },
  { value: "FRED", label: "FRED", icon: Database },
  { value: "ECB", label: "ECB", icon: Database },
  { value: "EUROSTAT", label: "Eurostat", icon: Database },
  { value: "OECD", label: "OECD", icon: Database },
  { value: "WORLDBANK", label: "World Bank", icon: Database },
  { value: "STATFIN", label: "StatFin", icon: Database },
];

export const SourceSelector = ({ value, onChange }: SourceSelectorProps) => {
  const selectedSource = sources.find((s) => s.value === value);
  const SelectedIcon = selectedSource?.icon || Globe;

  return (
    <Select value={value} onValueChange={(val) => onChange(val as DataSource)}>
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <SelectedIcon className="h-4 w-4" />
          <SelectValue placeholder="Select source" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {sources.map((source) => {
          const Icon = source.icon;
          return (
            <SelectItem key={source.value} value={source.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {source.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
