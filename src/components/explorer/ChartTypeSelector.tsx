import { LineChart, BarChart3, Circle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ChartType = "line" | "bar" | "scatter";

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (value: ChartType) => void;
}

export const ChartTypeSelector = ({ value, onChange }: ChartTypeSelectorProps) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as ChartType)}
      className="justify-start"
    >
      <ToggleGroupItem value="line" aria-label="Line chart" className="gap-1 px-3">
        <LineChart className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Line</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="bar" aria-label="Bar chart" className="gap-1 px-3">
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Bar</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="scatter" aria-label="Scatter plot" className="gap-1 px-3">
        <Circle className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Scatter</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
