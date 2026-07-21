import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export interface TimelineEvent {
  id: number;
  versionNumber: number;
  event: string;
  summary: string;
  reason?: string | null;
  status: string;
  isCurrent?: boolean;
  validFrom: string | Date;
  validTo?: string | Date | null;
  recordedAt: string | Date;
  createdBy?: string | null;
  approvedBy?: string | null;
  sourceType?: string | null;
  sourceReference?: string | null;
  sourceDocumentUrl?: string | null;
  snapshot?: Record<string, any>;
}

interface TimelineComponentProps {
  events: TimelineEvent[];
  onSelectEvent?: (event: TimelineEvent) => void;
  onCompareEvents?: (eventA: TimelineEvent, eventB: TimelineEvent) => void;
}

export const TimelineComponent: React.FC<TimelineComponentProps> = ({
  events,
  onSelectEvent,
  onCompareEvents,
}) => {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
        No historical version events recorded for this entity yet.
      </div>
    );
  }

  const getStatusBadge = (status: string, isCurrent?: boolean) => {
    if (isCurrent) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Current Active</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-300">Active</Badge>;
      case "superseded":
        return <Badge variant="secondary" className="text-muted-foreground">Superseded</Badge>;
      case "pending_review":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Pending Review</Badge>;
      case "draft":
        return <Badge variant="outline" className="text-amber-600 border-amber-300">Draft</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "corrected":
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Corrected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
      {events.map((evt, idx) => {
        const dateStr = evt.validFrom ? format(new Date(evt.validFrom), "dd MMM yyyy, HH:mm") : "N/A";
        const recordedStr = evt.recordedAt ? format(new Date(evt.recordedAt), "dd MMM yyyy") : null;

        return (
          <div key={evt.id || idx} className="relative group">
            {/* Dot Indicator */}
            <div
              className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-background transition-transform group-hover:scale-125 ${
                evt.isCurrent
                  ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  : evt.status === "pending_review"
                  ? "border-amber-500 bg-amber-500"
                  : "border-primary/60"
              }`}
            />

            {/* Event Card */}
            <div className="p-4 rounded-xl border bg-card hover:shadow-md transition-all space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-muted">
                    v{evt.versionNumber}
                  </span>
                  <span className="font-semibold text-sm capitalize">{evt.event?.replace("_", " ")}</span>
                  {getStatusBadge(evt.status, evt.isCurrent)}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Effective: <strong>{dateStr}</strong></span>
                </div>
              </div>

              <div className="text-sm font-medium text-foreground">{evt.summary}</div>

              {evt.reason && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-md border border-border/40 italic">
                  &ldquo;{evt.reason}&rdquo;
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 gap-2">
                <div className="flex items-center gap-3">
                  {evt.createdBy && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-muted-foreground/70" /> By: {evt.createdBy}
                    </span>
                  )}
                  {evt.approvedBy && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved by: {evt.approvedBy}
                    </span>
                  )}
                </div>

                {onSelectEvent && (
                  <button
                    onClick={() => onSelectEvent(evt)}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    View Version Details <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
