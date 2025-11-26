import { DollarSign, Euro, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Currency } from "./SeriesDetail";

interface CurrencySelectorProps {
  value: Currency;
  onChange: (currency: Currency) => void;
}

export const CurrencySelector = ({ value, onChange }: CurrencySelectorProps) => {
  const currencies: { value: Currency; label: string; icon: typeof Coins }[] = [
    { value: "original", label: "Original", icon: Coins },
    { value: "EUR", label: "EUR", icon: Euro },
    { value: "USD", label: "USD", icon: DollarSign },
  ];

  return (
    <div className="flex gap-2">
      {currencies.map((curr) => {
        const Icon = curr.icon;
        return (
          <Button
            key={curr.value}
            variant={value === curr.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(curr.value)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {curr.label}
          </Button>
        );
      })}
    </div>
  );
};
