import React from "react";
import { Button } from "@/components/ui/button";

interface RadiusSelectorProps {
  radiiKm: number[];
  selectedRadiusKm: number;
  onRadiusChange: (radius: number) => void;
  disabled?: boolean;
}

export function RadiusSelector({
  radiiKm = [1, 3, 5, 10, 25],
  selectedRadiusKm,
  onRadiusChange,
  disabled = false
}: RadiusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm font-medium text-muted-foreground mr-2">Analysis Radius:</span>
      {radiiKm.map((km) => (
        <Button
          key={km}
          variant={selectedRadiusKm === km ? "default" : "outline"}
          size="sm"
          className="rounded-full px-4"
          onClick={() => onRadiusChange(km)}
          disabled={disabled}
        >
          {km} km
        </Button>
      ))}
    </div>
  );
}
