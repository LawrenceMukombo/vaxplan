import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ShieldAlert,
  Activity,
  Plus,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RiskAssessmentItem {
  id: string;
  countryCode: string;
  title: string;
  assessmentYear: number;
  status: "DRAFT" | "IMPORTING" | "VALIDATION_REQUIRED" | "READY_TO_CALCULATE" | "CALCULATING" | "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "SUPERSEDED";
  administrativeLevelName: string;
  approvedAt?: string | null;
  createdAt: string;
}

export default function RiskAssessmentList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("2023 Measles Programmatic Risk Assessment");
  const [assessmentYear, setAssessmentYear] = useState(2023);
  const [countryCode, setCountryCode] = useState("SSD");
  const [adminLevel, setAdminLevel] = useState("County");

  const { data: assessments = [], isLoading } = useQuery<RiskAssessmentItem[]>({
    queryKey: ["/api/risk/assessments"],
  });

  const { data: methodologies = [] } = useQuery<any[]>({
    queryKey: ["/api/risk/methodologies"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/risk/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (newAssessment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/assessments"] });
      setIsCreateOpen(false);
      toast({
        title: "Assessment Created",
        description: `Assessment round "${newAssessment.title}" created successfully.`,
      });
      setLocation(`/risk-assessments/${newAssessment.id}`);
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      assessmentYear: Number(assessmentYear),
      countryCode,
      administrativeLevelName: adminLevel,
      methodologyVersionId: 1,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "CALCULATED":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white"><Activity className="w-3 h-3 mr-1" /> Calculated</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white"><Clock className="w-3 h-3 mr-1" /> Under Review</Badge>;
      case "READY_TO_CALCULATE":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">Ready to Calculate</Badge>;
      case "VALIDATION_REQUIRED":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Issues Detected</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-primary" />
              VPD Programmatic Risk Assessment
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              WHO Aligned
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            District-level programmatic vulnerability scoring, surveillance sensitivity audits, and immunization microplan strengthening.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              New Risk Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Assessment Round</DialogTitle>
                <DialogDescription>
                  Configure a new subnational programmatic risk assessment round.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="methodology">Assessment Methodology</Label>
                  <Select defaultValue="WHO_MEASLES_GLOBAL_RECONCILED_V1">
                    <SelectTrigger>
                      <SelectValue placeholder="Select methodology" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WHO_MEASLES_GLOBAL_RECONCILED_V1">
                        WHO Measles Programmatic Risk Assessment (Reconciled V1.0)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Supported 21 indicators covering Population Immunity, Surveillance Quality, Delivery Performance, and Threats.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Round Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Assessment Year</Label>
                    <Input
                      id="year"
                      type="number"
                      min={2020}
                      max={2030}
                      value={assessmentYear}
                      onChange={(e) => setAssessmentYear(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSD">South Sudan (SSD)</SelectItem>
                        <SelectItem value="ZMB">Zambia (ZMB)</SelectItem>
                        <SelectItem value="PNG">Papua New Guinea (PNG)</SelectItem>
                        <SelectItem value="ZAF">South Africa (ZAF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminLevel">Assessment Unit Label</Label>
                  <Select value={adminLevel} onValueChange={setAdminLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="County">County (Admin Level 2)</SelectItem>
                      <SelectItem value="District">District (Admin Level 2)</SelectItem>
                      <SelectItem value="Municipality">Municipality (Admin Level 2)</SelectItem>
                      <SelectItem value="Woreda">Woreda (Admin Level 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Assessment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Public Health / WHO Disclaimers */}
      <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="font-semibold text-sm">Public Health Decision-Making Guidance</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed mt-1">
          This module is designed exclusively for <strong>immunization programme strengthening</strong> and identifying operational vulnerabilities in routine coverage and disease surveillance.
          In accordance with the <em>WHO Measles Programmatic Risk Assessment Technical Appendix</em>, results <strong>must not be interpreted as predictive forecasts</strong> that an outbreak will occur, nor can risk scores alone be used to automatically recommend, approve, or schedule Supplementary Immunization Activities (SIAs).
        </AlertDescription>
      </Alert>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Active Rounds</CardDescription>
            <CardTitle className="text-2xl font-bold">{assessments.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Multi-year national rounds
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Active Methodology</CardDescription>
            <CardTitle className="text-sm font-bold truncate">WHO Measles Reconciled V1.0</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            21 standardized indicators
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Assessment Units</CardDescription>
            <CardTitle className="text-2xl font-bold">79 Counties</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Second subnational level
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Routine Integration</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Connected</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Linked to microplans & supervision
          </CardContent>
        </Card>
      </div>

      {/* Assessment Rounds Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Assessment Rounds Register
          </CardTitle>
          <CardDescription className="text-xs">
            Official programmatic risk assessments created under your country programme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading risk assessment rounds...
            </div>
          ) : assessments.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground font-medium">No assessment rounds configured yet.</p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create Initial Round
              </Button>
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {assessments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-base hover:underline cursor-pointer" onClick={() => setLocation(`/risk-assessments/${a.id}`)}>
                        {a.title}
                      </h4>
                      {getStatusBadge(a.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Assessment Year: {a.assessmentYear}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Country: {a.countryCode} ({a.administrativeLevelName})
                      </span>
                      <span>Created: {new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setLocation(`/risk-assessments/${a.id}`)}>
                      Open Workspace <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
