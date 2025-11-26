import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  value: { start: string; end: string };
  onChange: (range: { start: string; end: string }) => void;
}

export const DateRangePicker = ({ value, onChange }: DateRangePickerProps) => {
  return (
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="start-date" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="start-date"
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="h-9 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="end-date" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="end-date"
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="h-9 w-36"
          />
        </div>
      </div>
    </div>
  );
};
