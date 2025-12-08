import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GeoOption {
  id: string;
  name: string;
  region?: string;
}

interface GeoSelectorProps {
  options: GeoOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export const GeoSelector = ({
  options,
  value,
  onChange,
  placeholder = "Select country/region",
  loading = false,
}: GeoSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-sm"
          disabled={loading}
        >
          <div className="flex items-center gap-2 truncate">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedOption ? selectedOption.name : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search countries..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.id} ${option.name}`}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.name}</span>
                    {option.region && (
                      <span className="text-xs text-muted-foreground">
                        {option.region}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Common country lists for quick selection
export const EUROSTAT_COUNTRIES = [
  { id: "EU27_2020", name: "European Union (27)", region: "Aggregate" },
  { id: "EA20", name: "Euro Area (20)", region: "Aggregate" },
  { id: "AT", name: "Austria", region: "Western Europe" },
  { id: "BE", name: "Belgium", region: "Western Europe" },
  { id: "BG", name: "Bulgaria", region: "Eastern Europe" },
  { id: "HR", name: "Croatia", region: "Southern Europe" },
  { id: "CY", name: "Cyprus", region: "Southern Europe" },
  { id: "CZ", name: "Czechia", region: "Central Europe" },
  { id: "DK", name: "Denmark", region: "Northern Europe" },
  { id: "EE", name: "Estonia", region: "Northern Europe" },
  { id: "FI", name: "Finland", region: "Northern Europe" },
  { id: "FR", name: "France", region: "Western Europe" },
  { id: "DE", name: "Germany", region: "Western Europe" },
  { id: "EL", name: "Greece", region: "Southern Europe" },
  { id: "HU", name: "Hungary", region: "Central Europe" },
  { id: "IE", name: "Ireland", region: "Western Europe" },
  { id: "IT", name: "Italy", region: "Southern Europe" },
  { id: "LV", name: "Latvia", region: "Northern Europe" },
  { id: "LT", name: "Lithuania", region: "Northern Europe" },
  { id: "LU", name: "Luxembourg", region: "Western Europe" },
  { id: "MT", name: "Malta", region: "Southern Europe" },
  { id: "NL", name: "Netherlands", region: "Western Europe" },
  { id: "PL", name: "Poland", region: "Central Europe" },
  { id: "PT", name: "Portugal", region: "Southern Europe" },
  { id: "RO", name: "Romania", region: "Eastern Europe" },
  { id: "SK", name: "Slovakia", region: "Central Europe" },
  { id: "SI", name: "Slovenia", region: "Central Europe" },
  { id: "ES", name: "Spain", region: "Southern Europe" },
  { id: "SE", name: "Sweden", region: "Northern Europe" },
  { id: "NO", name: "Norway", region: "EFTA" },
  { id: "CH", name: "Switzerland", region: "EFTA" },
  { id: "IS", name: "Iceland", region: "EFTA" },
  { id: "UK", name: "United Kingdom", region: "Other" },
];

export const WORLDBANK_REGIONS = [
  { id: "WLD", name: "World", region: "Aggregate" },
  { id: "EUU", name: "European Union", region: "Aggregate" },
  { id: "EAS", name: "East Asia & Pacific", region: "Region" },
  { id: "ECS", name: "Europe & Central Asia", region: "Region" },
  { id: "LCN", name: "Latin America & Caribbean", region: "Region" },
  { id: "MEA", name: "Middle East & North Africa", region: "Region" },
  { id: "NAC", name: "North America", region: "Region" },
  { id: "SAS", name: "South Asia", region: "Region" },
  { id: "SSF", name: "Sub-Saharan Africa", region: "Region" },
];
