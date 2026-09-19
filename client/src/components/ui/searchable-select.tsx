import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  width?: string;
  sortAlphabetical?: boolean;
  emptyText?: string;
  clearable?: boolean;
}

export function SearchableSelect({
  value,
  defaultValue,
  onValueChange,
  options = [],
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  width = "w-full",
  sortAlphabetical = true,
  emptyText = "No results found.",
  clearable = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentValue = value !== undefined ? value : defaultValue;

  const sortedAndFilteredOptions = useMemo(() => {
    let list = [...options];

    if (sortAlphabetical) {
      list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }));
    }

    if (!search.trim()) return list;

    const q = search.toLowerCase().trim();
    return list.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, search, sortAlphabetical]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === currentValue),
    [options, currentValue]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal bg-background text-foreground border-input hover:bg-muted/40 transition-colors",
            !selectedOption && "text-muted-foreground",
            width,
            triggerClassName,
            className
          )}
        >
          <span className="truncate flex items-center gap-2">
            {selectedOption?.icon && (
              <span className="shrink-0">{selectedOption.icon}</span>
            )}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {clearable && currentValue && !disabled && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange("");
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0 z-[2100] shadow-xl border border-border bg-popover text-popover-foreground rounded-lg overflow-hidden",
          width,
          contentClassName
        )}
        align="start"
      >
        <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/20">
          <Search className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
          <input
            className="flex h-7 w-full rounded-md bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-0.5"
              onClick={() => setSearch("")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto p-1 text-xs divide-y divide-border/20">
          {sortedAndFilteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground italic">
              {emptyText}
            </div>
          ) : (
            sortedAndFilteredOptions.map((opt) => {
              const isSelected = opt.value === currentValue;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-colors select-none",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/80 text-foreground",
                    opt.disabled && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    if (opt.disabled) return;
                    onValueChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <div className="truncate text-xs">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary font-bold ml-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
