import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Clock, X, Check, Eye } from "lucide-react";
import { format } from "date-fns";

interface ViewAsOfDateControlProps {
  asOfDate: string | null;
  onAsOfDateChange: (date: string | null) => void;
  entityName?: string;
}

export const ViewAsOfDateControl: React.FC<ViewAsOfDateControlProps> = ({
  asOfDate,
  onAsOfDateChange,
  entityName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    asOfDate || new Date().toISOString().split("T")[0]
  );

  const handleApply = () => {
    onAsOfDateChange(selectedDate);
    setIsOpen(false);
  };

  const handleReset = () => {
    onAsOfDateChange(null);
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setIsOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-2">
      {asOfDate ? (
        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm animate-in fade-in">
          <Eye className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          <span>
            Viewing as of <strong>{format(new Date(asOfDate), "dd MMM yyyy")}</strong>
          </span>
          <button
            onClick={handleReset}
            className="ml-1 p-0.5 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
            title="Reset to active current view"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-dashed">
              <Clock className="w-3.5 h-3.5 text-primary" />
              View As Of Date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 space-y-3" align="end">
            <div className="space-y-1">
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" /> Point-In-Time State Resolution
              </div>
              <p className="text-[11px] text-muted-foreground">
                Select a historical date to view {entityName || "this entity"} as it existed on that date.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Target Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs px-2">
                Reset to Current
              </Button>
              <Button size="sm" onClick={handleApply} className="h-7 text-xs gap-1 px-3">
                <Check className="w-3.5 h-3.5" /> Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
