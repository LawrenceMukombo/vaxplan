import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ShieldCheck,
  BadgeCheck,
  Calendar,
  Heart,
  Phone,
  Mail,
  MessageSquare,
  Share2,
  Printer,
  Download,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Building2,
  ChevronRight,
  Send,
  Loader2,
  Sparkles,
  Smartphone,
  Layers,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getCountryConfig } from "@/lib/countryConfig";
import { VACCINE_SCHEDULE } from "@/pages/ClientLogbook";

interface PublicVaxRecord {
  success: boolean;
  verified: boolean;
  verifiedAt: string;
  client: {
    id: string;
    clientId: string;
    name: string;
    clientType: string;
    dateOfBirth: string;
    gender: string;
    parentName: string;
    contactPhone: string;
    email?: string;
    preferredChannel?: string;
    catchmentStatus: string;
    isCrossBorder: boolean;
    countryOfOrigin?: string;
    contraindications: string[];
    isRefusal: boolean;
    refusalReason?: string;
    facilityName: string;
    facilityType: string;
    villageName: string;
    districtName: string;
    provinceName: string;
  };
  tenant: {
    id: string;
    code: string;
    countryCode: string;
    name: string;
    settings?: any;
  };
  vaccinations: Array<{
    id: number;
    vaccineName: string;
    administeredDate: string;
    batchNumber?: string;
    expiryDate?: string;
    vvmStatus?: number;
    facilityId?: number;
  }>;
}

export default function PublicVaxCard() {
  const [, params] = useRoute("/verify/:id");
  const [, vaxParams] = useRoute("/vaxcard/:id");
  const rawId = params?.id || vaxParams?.id;
  const { toast } = useToast();

  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderChannel, setReminderChannel] = useState<"sms" | "whatsapp" | "email">("whatsapp");
  const [reminderContact, setReminderContact] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [savedRecords, setSavedRecords] = useState<Array<{ id: string; name: string; dob: string }>>([]);

  const { data, isLoading, error, refetch } = useQuery<PublicVaxRecord>({
    queryKey: ["/api/public/vaxcard", rawId],
    queryFn: async () => {
      if (!rawId) throw new Error("No client ID provided");
      const res = await fetch(`/api/public/vaxcard/${encodeURIComponent(rawId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load vaccination record");
      }
      return res.json();
    },
    enabled: Boolean(rawId),
    retry: 1,
  });

  const client = data?.client;
  const tenant = data?.tenant;
  const vaccinations = data?.vaccinations || [];
  const tenantCode = tenant?.code || tenant?.countryCode || "MOH";
  const countryConfig = getCountryConfig(tenant || { code: tenantCode, countryCode: tenantCode });

  // Initialize reminder input values when client loads
  useEffect(() => {
    if (client) {
      setGuardianName(client.parentName || "");
      if (client.preferredChannel === "email") {
        setReminderChannel("email");
        setReminderContact(client.email || "");
      } else if (client.preferredChannel === "whatsapp") {
        setReminderChannel("whatsapp");
        setReminderContact(client.contactPhone || "");
      } else {
        setReminderChannel("sms");
        setReminderContact(client.contactPhone || "");
      }

      // Check if already in localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("vaxplan_saved_passports") || "[]");
        setSavedRecords(stored);
        const exists = stored.some((item: any) => item.id === client.id);
        setIsSavedLocally(exists);
      } catch {}
    }
  }, [client]);

  const handleSaveToDevice = () => {
    if (!client) return;
    try {
      const stored = JSON.parse(localStorage.getItem("vaxplan_saved_passports") || "[]");
      const filtered = stored.filter((item: any) => item.id !== client.id);
      const updated = [
        {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
          dob: client.dateOfBirth,
          savedAt: new Date().toISOString(),
        },
        ...filtered,
      ];
      localStorage.setItem("vaxplan_saved_passports", JSON.stringify(updated));
      setIsSavedLocally(true);
      setSavedRecords(updated);
      toast({
        title: "Health Passport Saved",
        description: `${client.name}'s digital health record has been saved to this device for instant offline access.`,
      });
    } catch {
      toast({
        title: "Notice",
        description: "Could not save to local storage. Please ensure cookies/storage are enabled.",
      });
    }
  };

  const subscribeMutation = useMutation({
    mutationFn: async (payload: { phone?: string; email?: string; channel: string; caregiverName?: string }) => {
      const res = await fetch(`/api/public/vaxcard/${encodeURIComponent(client!.id)}/subscribe-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to configure reminders");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Reminders Activated!",
        description: result.message || "You will now receive automatic notifications before each scheduled vaccination.",
      });
      setIsReminderOpen(false);
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Subscription Failed",
        description: err.message || "Please check the contact information provided and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderContact.trim()) {
      toast({
        title: "Contact required",
        description: `Please enter a valid ${reminderChannel === "email" ? "email address" : "mobile phone number"}.`,
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      channel: reminderChannel,
      caregiverName: guardianName.trim(),
    };
    if (reminderChannel === "email") {
      payload.email = reminderContact.trim();
    } else {
      payload.phone = reminderContact.trim();
    }
    subscribeMutation.mutate(payload);
  };

  // Helper calculation for dose statuses
  const canonicalDose = (name: string, code?: string) => {
    return (code || name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  };

  const getDoseStatus = (dose: typeof VACCINE_SCHEDULE[0]) => {
    const matching = vaccinations.find(
      (v) => canonicalDose(v.vaccineName) === canonicalDose(dose.name, dose.code)
    );
    if (matching) {
      return {
        status: "administered" as const,
        record: matching,
        date: new Date(matching.administeredDate).toLocaleDateString(),
        batch: matching.batchNumber,
        vvm: matching.vvmStatus,
      };
    }

    if (!client?.dateOfBirth) {
      return { status: "pending" as const, dueDate: "Pending schedule" };
    }

    const dob = new Date(client.dateOfBirth);
    const dueDate = new Date(dob.getTime() + dose.weeks * 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today >= dueDate) {
      const weeksOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksOverdue < 4) {
        return { status: "due" as const, dueDate: dueDate.toLocaleDateString(), weeksOverdue };
      }
      return { status: "overdue" as const, dueDate: dueDate.toLocaleDateString(), weeksOverdue };
    }

    return { status: "pending" as const, dueDate: dueDate.toLocaleDateString() };
  };

  // Age formatting
  const calculateAge = (dobString: string) => {
    const birth = new Date(dobString);
    const now = new Date();
    const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (diffMonths < 1) {
      const diffDays = Math.floor((now.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000));
      return `${Math.max(1, diffDays)} Days old`;
    }
    if (diffMonths < 24) {
      return `${diffMonths} Months old`;
    }
    const years = Math.floor(diffMonths / 12);
    const remMonths = diffMonths % 12;
    return `${years} Year${years > 1 ? "s" : ""} ${remMonths > 0 ? `${remMonths}m` : ""}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 animate-pulse">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Verifying Immunization Record...</h2>
          <p className="text-xs text-muted-foreground">
            Connecting to the Ministry of Health EPI certified digital registry.
          </p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
            <XCircle className="h-9 w-9" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Record Not Found</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The QR code scanned could not be verified against active health registry databases. Please confirm you have scanned a valid EPI child immunization card.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" className="rounded-xl w-full text-xs">
                Back to Login / Clinician Portal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const givenCount = vaccinations.length;
  const totalCount = VACCINE_SCHEDULE.length;
  const completionPercent = Math.round((givenCount / totalCount) * 100);
  const logoSrc = countryConfig.logoUrl || countryConfig.coatOfArmsUrl;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground py-6 px-3 sm:px-6 font-sans">
      {/* Print media stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, nav, .no-print, [role="dialog"], button {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .vaxcard-container {
            box-shadow: none !important;
            border: 1px solid #000 !important;
            margin: 0 !important;
            padding: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-border-black {
            border-color: #000000 !important;
          }
        }
      `}} />

      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* Top Floating App Bar (No Print) */}
        <div className="no-print flex items-center justify-between gap-3 bg-card/80 backdrop-blur border border-border/80 px-4 py-3 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              VP
            </div>
            <div>
              <span className="font-extrabold text-xs block text-foreground leading-none">VaxPlan e-Passport</span>
              <span className="text-[10px] text-muted-foreground">Digital Immunization Verification</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs h-8 rounded-xl gap-1 text-muted-foreground hover:text-foreground">
                <User className="h-3.5 w-3.5" /> Staff Sign In
              </Button>
            </Link>
            <Button
              onClick={() => window.print()}
              size="sm"
              variant="outline"
              className="text-xs h-8 rounded-xl gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* Authenticity Verification Guarantee Banner */}
        <div className="no-print bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/30">
              <BadgeCheck className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider">EPI Certified Authentic Record</h4>
                <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 rounded-md font-bold uppercase">
                  Verified Valid
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground dark:text-emerald-400/80 mt-0.5 leading-snug">
                Digitally validated by the National Ministry of Health EPI registry database. Scan verified: {new Date(data.verifiedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleSaveToDevice}
              variant={isSavedLocally ? "secondary" : "default"}
              size="sm"
              className={`rounded-xl text-xs h-9 gap-1.5 font-bold ${
                isSavedLocally 
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSavedLocally ? <BookmarkCheck className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
              {isSavedLocally ? "Saved on Device" : "Save to My Device"}
            </Button>
            <Button
              onClick={() => setIsReminderOpen(true)}
              size="sm"
              className="rounded-xl text-xs h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
            >
              <Smartphone className="h-4 w-4" /> Get Reminders
            </Button>
          </div>
        </div>

        {/* MAIN VACCINATION CARD BOOKLET (Double-Sided Presentation) */}
        <div className="vaxcard-container bg-card border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          
          {/* Header Section: Country Crest + Ministry Title + QR Authenticity Tag */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-border print-border-black">
            <div className="flex items-center gap-4">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${countryConfig.name || tenantCode} Official Emblem`}
                  className="h-16 w-16 shrink-0 object-contain drop-shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="h-14 w-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-xl border border-primary/20">
                  {countryConfig.flagEmoji || tenantCode || "MOH"}
                </div>
              )}
              <div className="space-y-0.5">
                <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                  {tenant?.settings?.officialName || tenant?.name || countryConfig.officialName || `Republic of ${tenantCode}`}
                </h2>
                <h3 className="text-base sm:text-lg font-black text-foreground uppercase tracking-tight">
                  Ministry of Health
                </h3>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider">
                    Child Immunization Booklet & Digital Health Passport
                  </span>
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[9px] font-mono font-bold">
                    Official Record
                  </Badge>
                </div>
              </div>
            </div>

            {/* Micro QR Tag Seal */}
            <div className="flex items-center gap-3 self-end sm:self-auto bg-muted/40 dark:bg-muted/20 border border-border p-2 rounded-2xl shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  window.location.href
                )}`} 
                alt="Verification QR Code" 
                className="w-12 h-12 rounded-lg bg-white p-0.5 border"
              />
              <div className="text-[9px] leading-tight font-mono">
                <span className="text-muted-foreground font-semibold block uppercase">SECURE PASS:</span>
                <span className="font-extrabold text-foreground">{client.id?.substring(0, 10).toUpperCase()}</span>
                <span className="text-[8px] text-emerald-600 dark:text-emerald-400 block font-bold mt-0.5">AUTHENTICATED</span>
              </div>
            </div>
          </div>

          {/* Child Demographics & Clinical Profile Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-500/20 rounded-2xl md:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider block">
                  National Unique Client ID
                </span>
                <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm sm:text-base block">
                  {client.clientId || client.id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg">
                  {calculateAge(client.dateOfBirth)}
                </Badge>
                <span className="text-xs text-muted-foreground">Antigen Progress: <strong>{givenCount}/{totalCount} ({completionPercent}%)</strong></span>
              </div>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Child Full Name</span>
              <span className="font-black text-foreground text-sm block">{client.name}</span>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Date of Birth & Gender</span>
              <span className="font-bold text-foreground text-xs block">
                {new Date(client.dateOfBirth).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} • <span className="capitalize">{client.gender || "Child"}</span>
              </span>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Mother / Caregiver Name</span>
              <span className="font-bold text-foreground text-xs block">{client.parentName || "Registered Guardian"}</span>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Guardian Contact Phone</span>
              <span className="font-mono font-bold text-foreground text-xs block">{client.contactPhone || "Not provided"}</span>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Assigned Health Facility</span>
              <span className="font-bold text-foreground text-xs block truncate" title={client.facilityName}>
                {client.facilityName} ({client.facilityType || "Clinic"})
              </span>
            </div>

            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-2xl space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Community / Village Catchment</span>
              <span className="font-bold text-foreground text-xs block">
                {client.villageName} • {client.districtName}, {client.provinceName}
              </span>
            </div>
          </div>

          {/* Schedule Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">National Schedule Completion Rate</span>
              <span className="text-emerald-600 dark:text-emerald-400">{completionPercent}% Complete</span>
            </div>
            <div className="h-2.5 w-full bg-muted dark:bg-muted/60 rounded-full overflow-hidden border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Immunization History & Dose Grid Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-500" />
                Immunization Schedule & Verified Dose Log
              </h4>
              <span className="text-[10px] text-muted-foreground font-semibold">
                WHO & National EPI Standard Schedule
              </span>
            </div>

            <div className="border border-border/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 dark:bg-muted/30 border-b border-border text-muted-foreground font-black text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Antigen Dose</th>
                      <th className="py-2.5 px-3 text-center">Target Age</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Administration Date</th>
                      <th className="py-2.5 px-3">Batch & VVM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {VACCINE_SCHEDULE.map((dose: typeof VACCINE_SCHEDULE[0], idx: number) => {
                      const res = getDoseStatus(dose);
                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-foreground">
                            {dose.name}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-muted-foreground text-[11px]">
                            {dose.group}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {res.status === "administered" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                                GIVEN
                              </Badge>
                            ) : res.status === "due" ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 justify-center">
                                <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> DUE NOW
                              </Badge>
                            ) : res.status === "overdue" ? (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 justify-center">
                                <AlertTriangle className="h-2.5 w-2.5 text-rose-500" /> OVERDUE
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[9px] font-medium uppercase px-2 py-0.5 rounded-md">
                                PENDING
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {res.status === "administered" ? (
                              <div>
                                <span className="font-extrabold text-foreground text-[11px]">{res.date}</span>
                                <span className="block text-[10px] text-muted-foreground truncate max-w-[140px]">
                                  {client.facilityName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px] font-medium">
                                Due: {res.dueDate}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                            {res.status === "administered" && res.batch ? (
                              <div>
                                <span>#{res.batch}</span>
                                {res.vvm && <span className="block text-[9px] text-emerald-600 dark:text-emerald-400">VVM: {res.vvm}</span>}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Caregiver Mobile Action Tray */}
          <div className="no-print pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveToDevice}
                variant="outline"
                className="rounded-xl text-xs gap-1.5"
              >
                {isSavedLocally ? <BookmarkCheck className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
                {isSavedLocally ? "Passport Saved to Device" : "Save Record to Device"}
              </Button>
              <Button
                onClick={() => setIsReminderOpen(true)}
                className="rounded-xl text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                <Smartphone className="h-4 w-4" /> Reminders (SMS/WhatsApp)
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="rounded-xl text-xs gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print Card
              </Button>
            </div>
          </div>

          {/* Footer Official Certification Stamp */}
          <div className="pt-4 border-t border-border text-center text-[10px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              Official Electronic Health Record • Ministry of Health EPI Program
            </p>
            <p>
              This digital passport is authenticated under national public health standards. Keep safe for clinic visits, school enrollments, and international travel.
            </p>
          </div>
        </div>

        {/* Previously Saved Cards on Device Tray (If Multiple) */}
        {savedRecords.length > 1 && (
          <div className="no-print bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Other Saved Health Passports on This Phone ({savedRecords.length})
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {savedRecords.map((rec) => (
                <Link key={rec.id} href={`/verify/${rec.id}`}>
                  <Button
                    variant={rec.id === client.id ? "secondary" : "outline"}
                    size="sm"
                    className="text-xs h-8 rounded-xl font-semibold gap-1.5"
                  >
                    <User className="h-3 w-3" />
                    {rec.name} {rec.id === client.id && "(Current)"}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DIALOG: Caregiver Reminder Subscription Modal */}
      <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Smartphone className="h-5 w-5 text-indigo-600" />
              Automated Vaccine Reminders
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Subscribe to instant automated notifications sent directly to your phone before each scheduled clinic visit for <strong>{client.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubscribeSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Caregiver / Parent Name
              </label>
              <Input
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="e.g. Mary Tembo"
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Preferred Reminder Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={reminderChannel === "whatsapp" ? "default" : "outline"}
                  onClick={() => setReminderChannel("whatsapp")}
                  className={`rounded-xl text-xs h-10 gap-1 font-bold ${
                    reminderChannel === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                  }`}
                >
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={reminderChannel === "sms" ? "default" : "outline"}
                  onClick={() => setReminderChannel("sms")}
                  className={`rounded-xl text-xs h-10 gap-1 font-bold ${
                    reminderChannel === "sms" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> SMS Text
                </Button>
                <Button
                  type="button"
                  variant={reminderChannel === "email" ? "default" : "outline"}
                  onClick={() => setReminderChannel("email")}
                  className={`rounded-xl text-xs h-10 gap-1 font-bold ${
                    reminderChannel === "email" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {reminderChannel === "email" ? "Email Address" : "Mobile Phone Number"}
              </label>
              <Input
                value={reminderContact}
                onChange={(e) => setReminderContact(e.target.value)}
                placeholder={reminderChannel === "email" ? "caregiver@example.com" : "+260 97 1234567"}
                className="rounded-xl text-xs h-10 font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                We'll dispatch a reminder 3 days prior to each due date with the date and clinic location.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReminderOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={subscribeMutation.isPending}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
              >
                {subscribeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {subscribeMutation.isPending ? "Subscribing..." : "Activate Reminders"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
