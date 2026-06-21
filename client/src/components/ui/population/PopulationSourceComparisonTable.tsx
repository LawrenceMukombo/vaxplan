import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export interface PopulationSourceData {
  source: string;
  totalPopulation: number;
  under5Population: number;
  method: string;
  confidence: string;
  year: number;
}

interface PopulationSourceComparisonTableProps {
  sources: PopulationSourceData[];
  selectedSource?: string;
  onSelectSource?: (source: PopulationSourceData) => void;
}

export function PopulationSourceComparisonTable({ sources, selectedSource, onSelectSource }: PopulationSourceComparisonTableProps) {
  
  if (!sources || sources.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No population sources available.</p>;
  }

  const sortedSources = [...sources].sort((a, b) => b.totalPopulation - a.totalPopulation);

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Total Pop</TableHead>
            <TableHead className="text-right">Under-5 Pop</TableHead>
            <TableHead className="text-center">Confidence</TableHead>
            <TableHead className="text-center">Year</TableHead>
            {onSelectSource && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSources.map((source, i) => (
            <TableRow key={i} className={selectedSource === source.source ? "bg-primary/5" : ""}>
              <TableCell className="font-medium">
                {source.source}
                {selectedSource === source.source && (
                  <Badge variant="secondary" className="ml-2 text-[10px] bg-primary/20 text-primary">Selected</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">{source.method}</TableCell>
              <TableCell className="text-right font-semibold">{source.totalPopulation.toLocaleString()}</TableCell>
              <TableCell className="text-right text-muted-foreground">{source.under5Population.toLocaleString()}</TableCell>
              <TableCell className="text-center">
                <Badge variant={source.confidence === "High" ? "default" : source.confidence === "Moderate" ? "secondary" : "outline"} className="text-xs">
                  {source.confidence}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">{source.year}</TableCell>
              {onSelectSource && (
                <TableCell className="text-right">
                  <Button
                    variant={selectedSource === source.source ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => onSelectSource(source)}
                  >
                    {selectedSource === source.source ? (
                      <>
                        <Check className="h-3 w-3 mr-1.5" />
                        Selected
                      </>
                    ) : (
                      "Use Denominator"
                    )}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
