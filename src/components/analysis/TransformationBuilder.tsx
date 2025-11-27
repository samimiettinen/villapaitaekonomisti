import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectedSeries, Transformation } from "@/pages/Analysis";

interface TransformationBuilderProps {
  selectedSeries: SelectedSeries[];
  transformations: Transformation[];
  onTransformationsChange: (transformations: Transformation[]) => void;
}

export const TransformationBuilder = ({
  selectedSeries,
  transformations,
  onTransformationsChange,
}: TransformationBuilderProps) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<"divide" | "multiply" | "add" | "subtract">("divide");
  const [seriesA, setSeriesA] = useState("");
  const [seriesB, setSeriesB] = useState("");

  const addTransformation = () => {
    if (!name || !seriesA || !seriesB) return;

    const newTransformation: Transformation = {
      id: `derived_${Date.now()}`,
      name,
      type,
      seriesA,
      seriesB,
    };

    onTransformationsChange([...transformations, newTransformation]);
    setName("");
    setSeriesA("");
    setSeriesB("");
  };

  const removeTransformation = (id: string) => {
    onTransformationsChange(transformations.filter((t) => t.id !== id));
  };

  const getOperatorSymbol = (type: string) => {
    switch (type) {
      case "divide":
        return "÷";
      case "multiply":
        return "×";
      case "add":
        return "+";
      case "subtract":
        return "−";
      default:
        return "";
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Derived Series</h3>

      {/* Existing Transformations */}
      {transformations.length > 0 && (
        <div className="mb-4 space-y-2">
          {transformations.map((t) => {
            const seriesATitle = selectedSeries.find((s) => s.id === t.seriesA)?.title || t.seriesA;
            const seriesBTitle = selectedSeries.find((s) => s.id === t.seriesB)?.title || t.seriesB;
            return (
              <div key={t.id} className="rounded border border-border bg-muted/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">{t.name}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {seriesATitle} {getOperatorSymbol(t.type)} {seriesBTitle}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTransformation(t.id)}
                    className="h-6 w-6 p-0 shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Transformation */}
      {selectedSeries.length >= 2 && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="transform-name" className="text-xs">
              Name
            </Label>
            <Input
              id="transform-name"
              placeholder="GDP per capita"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>

          <div>
            <Label htmlFor="operation" className="text-xs">
              Operation
            </Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger id="operation" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="divide">Divide (÷)</SelectItem>
                <SelectItem value="multiply">Multiply (×)</SelectItem>
                <SelectItem value="add">Add (+)</SelectItem>
                <SelectItem value="subtract">Subtract (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="series-a" className="text-xs">
              Series A
            </Label>
            <Select value={seriesA} onValueChange={setSeriesA}>
              <SelectTrigger id="series-a" className="h-9">
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {selectedSeries.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="series-b" className="text-xs">
              Series B
            </Label>
            <Select value={seriesB} onValueChange={setSeriesB}>
              <SelectTrigger id="series-b" className="h-9">
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {selectedSeries.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={addTransformation} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Derived Series
          </Button>
        </div>
      )}

      {selectedSeries.length < 2 && (
        <p className="text-xs text-muted-foreground">
          Select at least 2 series to create derived series
        </p>
      )}
    </Card>
  );
};
