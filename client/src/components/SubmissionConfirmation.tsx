import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Eye, X, Calendar, MapPin, ClipboardCheck, ArrowRight, ShieldCheck, User, ArrowRightCircle } from "lucide-react";

interface SubmissionConfirmationProps {
  microplan: any;
  submittedByName?: string;
  nextApprovalStep?: string;
  responsibleRole?: string;
  facilityLabel?: string;
  onViewDetails: () => void;
  onClose: () => void;
}

export function SubmissionConfirmation({
  microplan,
  submittedByName = "Facility Officer",
  nextApprovalStep = "District Review",
  responsibleRole = "District Health Officer / Team",
  facilityLabel = "Target Facility",
  onViewDetails,
  onClose,
}: SubmissionConfirmationProps) {
  if (!microplan) return null;

  const submittedDate = microplan.submittedAt 
    ? new Date(microplan.submittedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

  const status = microplan.status || "pending";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "auto_approved":
        return (
          <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Approved
          </Badge>
        );
      case "locked":
        return (
          <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ClipboardCheck className="h-3.5 w-3.5" /> Locked
          </Badge>
        );
      case "pending":
      case "submitted":
      default:
        return (
          <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <ClipboardCheck className="h-3.5 w-3.5" /> Pending Approval
          </Badge>
        );
    }
  };

  // Determine current timeline active steps
  const timelineSteps = [
    { label: "Draft Saved", desc: "Plan prepared by facility staff", completed: true },
    { label: "Submitted", desc: `Awaiting review since ${submittedDate}`, completed: true, active: status === "pending" || status === "submitted" },
    { label: "Provincial Check", desc: "Verification of resource requests", completed: status === "approved" || status === "locked", active: false },
    { label: "Approved & Locked", desc: "Plan locked for implementation", completed: status === "locked", active: status === "approved" }
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 animate-fade-in w-full">
      <Card className="w-full max-w-2xl border border-muted/40 shadow-xl overflow-hidden bg-gradient-to-b from-card to-background">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 ring-8 ring-emerald-50/50 dark:ring-emerald-950/10 animate-bounce">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Microplan Submitted Successfully!
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Your microplanning data has been logged in the system registry and queued for administrative review.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 px-6 md:px-8">
          {/* Metadata Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-muted/50 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Facility</span>
                <span className="font-semibold text-foreground">{facilityLabel}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Submission Date & Time</span>
                <span className="font-semibold text-foreground">{submittedDate}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted By</span>
                <span className="font-semibold text-foreground">{submittedByName}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {getStatusBadge(status)}
              </div>
              <div className="ml-1">
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Status</span>
                <span className="font-semibold text-foreground">
                  {status === "approved" || status === "auto_approved" ? "Approved" : status === "locked" ? "Locked" : "Pending Review"}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ArrowRightCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Approval Step</span>
                <span className="font-semibold text-foreground">{nextApprovalStep}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsible Approver / Role</span>
                <span className="font-semibold text-foreground">{responsibleRole}</span>
              </div>
            </div>
          </div>

          {/* Workflow Timeline Tracker */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Approval Workflow Timeline</h4>
            <div className="relative border-l border-muted-foreground/20 ml-3.5 pl-6 space-y-6 py-2">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="relative">
                  {/* Indicator Dot */}
                  <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    step.completed 
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : step.active
                      ? "bg-background border-amber-500 text-amber-500 animate-pulse"
                      : "bg-background border-muted"
                  }`}>
                    {step.completed && (
                      <svg className="h-2 w-2 fill-current" viewBox="0 0 20 20">
                        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                      </svg>
                    )}
                  </span>
                  
                  {/* Step Info */}
                  <div>
                    <h5 className={`text-sm font-semibold ${
                      step.completed ? "text-foreground" : step.active ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </h5>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-muted/50">
            <Button 
              className="w-full sm:w-auto flex items-center justify-center gap-2"
              onClick={onViewDetails}
              data-testid="button-view-submitted-plan"
            >
              <Eye className="h-4 w-4" /> View Submitted Plan
            </Button>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 ml-auto"
              onClick={onClose}
              data-testid="button-close-confirmation"
            >
              <X className="h-4 w-4" /> Return to List
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
