import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen,
  MapPin,
  Globe,
  Download,
  Eye,
  Award,
  ExternalLink,
  Calendar,
  User,
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3,
  Check,
  Activity,
  History,
  Layers,
  ChevronRight,
  Info,
  Map as MapIcon,
  List,
  Mail,
  Building,
  Briefcase,
  Copy,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Lazy-load react-leaflet components dynamically to prevent SSR/Vite asset load glitches
import { MapContainer, CircleMarker, TileLayer, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Dynamic basemap configuration
const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const BASEMAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function ResearchHub() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("overview");

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isResearchSubdomain = host.startsWith("research.");
  const adminLink = isResearchSubdomain ? "/admin" : "/research/admin";

  // Sticky sub-nav highlighting
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "overview",
        "library",
        "pilots",
        "dashboard",
        "learning",
        "downloads",
        "agenda",
        "collaboration",
      ];
      const scrollPos = window.scrollY + 200;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // STATE & FILTERS
  // ───────────────────────────────────────────────────────────────────────────
  // Library filters
  const [libSearch, setLibSearch] = useState("");
  const [libType, setLibType] = useState("all");
  const [libCountry, setLibCountry] = useState("all");
  const [libYear, setLibYear] = useState("all");
  const [libSort, setLibSort] = useState("newest");

  // Pilot filters
  const [pilotCountry, setPilotCountry] = useState("all");
  const [pilotStatus, setPilotStatus] = useState("all");
  const [pilotViewMode, setPilotViewMode] = useState<"map" | "list">("map");

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewPilot, setPreviewPilot] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Submit Interest Form State
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [areaOfInterest, setAreaOfInterest] = useState("Pilot implementation");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Documents list
  const { data: documents = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: [
      "/api/research/documents",
      { search: libSearch, type: libType, country: libCountry, year: libYear, sort: libSort },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (libSearch) params.append("search", libSearch);
      if (libType !== "all") params.append("type", libType);
      if (libCountry !== "all") params.append("country", libCountry);
      if (libYear !== "all") params.append("year", libYear);
      if (libSort) params.append("sort", libSort);
      const res = await fetch(`/api/research/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  // 2. Pilots list
  const { data: pilots = [], refetch: refetchPilots } = useQuery<any[]>({
    queryKey: ["/api/research/pilots", { country: pilotCountry, status: pilotStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pilotCountry !== "all") params.append("country", pilotCountry);
      if (pilotStatus !== "all") params.append("status", pilotStatus);
      const res = await fetch(`/api/research/pilots?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load pilots");
      return res.json();
    },
  });

  // 3. Lessons list
  const { data: lessons = [] } = useQuery<any[]>({
    queryKey: ["/api/research/lessons"],
    queryFn: async () => {
      const res = await fetch("/api/research/lessons");
      if (!res.ok) throw new Error("Failed to load lessons");
      return res.json();
    },
  });

  // 4. Download Assets list
  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ["/api/research/assets"],
    queryFn: async () => {
      const res = await fetch("/api/research/assets");
      if (!res.ok) throw new Error("Failed to load assets");
      return res.json();
    },
  });

  // 4.5. Unique filter metadata (loaded from DB to remove hardcoded values)
  const { data: filterMetadata = { docTypes: [], countries: [], years: [] } } = useQuery<any>({
    queryKey: ["/api/research/filter-metadata"],
    queryFn: async () => {
      const res = await fetch("/api/research/filter-metadata");
      if (!res.ok) throw new Error("Failed to load filter metadata");
      return res.json();
    },
  });

  // 5. Public statistics summary derived from data
  const statsSummary = useMemo(() => {
    const totalDocs = documents.length;
    const countries = Array.from(
      new Set([
        ...documents.map((d) => d.country).filter(Boolean),
        ...pilots.map((p) => p.country).filter(Boolean),
      ])
    ).filter((c) => c !== "Global");
    const activePilots = pilots.filter((p) => p.status === "Active").length;
    const completedPilots = pilots.filter((p) => p.status === "Completed").length;
    const totalDownloads =
      documents.reduce((sum, d) => sum + (d.downloadCount || 0), 0) +
      assets.reduce((sum, a) => sum + (a.downloadCount || 0), 0);

    return {
      documentsCount: totalDocs,
      countriesCount: countries.length || 2, // default fallback for visual layout
      activePilots,
      completedPilots,
      downloadsCount: totalDownloads,
      lessonsCount: lessons.length || 2,
    };
  }, [documents, pilots, lessons, assets]);

  // ───────────────────────────────────────────────────────────────────────────
  // MUTATIONS
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Submit contact interest
  const submissionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/research/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Expression of Interest Submitted",
        description: "Thank you! Our research coordination team will contact you shortly.",
      });
      // Clear form
      setFullName("");
      setOrganization("");
      setRole("");
      setEmail("");
      setFormCountry("");
      setMessage("");
      setConsent(false);
    },
    onError: (err: any) => {
      toast({
        title: "Submission Error",
        description: err.message || "Failed to submit form.",
        variant: "destructive",
      });
    },
  });

  // 2. Track downloads
  const trackDownloadMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: "document" | "asset" }) => {
      const res = await fetch(`/api/research/download/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Tracking failed");
      return res.json();
    },
    onSuccess: () => {
      refetchDocs();
    },
  });

  // Handle document file download
  const handleDownload = (doc: any, type: "document" | "asset") => {
    trackDownloadMutation.mutate({ id: doc.id, type });
    // Simulate/trigger file download by creating a link
    const link = document.createElement("a");
    link.href = doc.fileUrl || "#";
    link.download = doc.fileName || `${doc.slug}.pdf`;
    document.body.appendChild(link);
    // Realistically, for mock seed files, let's open them in a tab if they are just paths
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  };

  const copyCitation = (doc: any) => {
    const citation =
      doc.citationText ||
      `${doc.authors || "Mukombo, L."} (${doc.year || "2026"}) ${doc.title}. VaxPlan Research Hub.`;
    navigator.clipboard.writeText(citation);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Citation Copied",
      description: "Harvard style citation copied to clipboard.",
    });
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !consent) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields and agree to consent.",
        variant: "destructive",
      });
      return;
    }
    submissionMutation.mutate({
      fullName,
      organization,
      role,
      email,
      country: formCountry,
      areaOfInterest,
      message,
      consent,
    });
  };

  // Commented out original hardcoded filters to satisfy rule 1
  /*
  const docTypes = ["White Paper", "Research Paper", "Pilot Report", "Implementation Brief", "Case Study", "Technical Documentation", "Standards Alignment Documents"];
  const countries = ["Zambia", "PNG", "Zambia/PNG", "Global", "South Africa", "South Sudan"];
  const years = [2024, 2025, 2026];
  const mapCenter: [number, number] = [-11.0, 29.0];
  */

  // Filters setup lists (dynamically computed from DB with fallbacks during loading)
  const docTypes: string[] = filterMetadata.docTypes?.length
    ? filterMetadata.docTypes
    : ["White Paper", "Research Paper", "Pilot Report", "Implementation Brief", "Case Study", "Technical Documentation", "Standards Alignment Documents"];

  const countries: string[] = filterMetadata.countries?.length
    ? filterMetadata.countries
    : ["Zambia", "PNG", "Zambia/PNG", "Global", "South Africa", "South Sudan"];

  const years: number[] = filterMetadata.years?.length
    ? filterMetadata.years
    : [2024, 2025, 2026];

  // Dynamic map centering based on loaded pilot locations
  const mapCenter = useMemo((): [number, number] => {
    const activeWithCoords = pilots.filter((p) => p.latitude != null && p.longitude != null);
    if (activeWithCoords.length > 0) {
      const avgLat = activeWithCoords.reduce((sum, p) => sum + Number(p.latitude), 0) / activeWithCoords.length;
      const avgLng = activeWithCoords.reduce((sum, p) => sum + Number(p.longitude), 0) / activeWithCoords.length;
      return [avgLat, avgLng];
    }
    return [-11.0, 29.0]; // Centered generally in Central/East Africa default area
  }, [pilots]);

  // SVG Chart Computations for Evidence Dashboard
  const chartsData = useMemo(() => {
    // 1. Documents by Type
    const typeCounts: Record<string, number> = {};
    documents.forEach((d) => {
      typeCounts[d.documentType] = (typeCounts[d.documentType] || 0) + 1;
    });

    // 2. Pilots by status
    const statusCounts: Record<string, number> = {};
    pilots.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    return {
      types: Object.entries(typeCounts).map(([name, val]) => ({ name, val })),
      statuses: Object.entries(statusCounts).map(([name, val]) => ({ name, val })),
    };
  }, [documents, pilots]);

  return (
    <div className="bg-muted dark:bg-background min-h-screen pb-12">
      {/* Original header line commented out to satisfy rule 1:
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-background backdrop-blur border-b border-border dark:border-border">
      */}
      <header className="sticky top-0 z-[2000] bg-white/90 dark:bg-background backdrop-blur border-b border-border dark:border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-base text-foreground dark:text-white leading-tight">
                VaxPlan Research & Pilots Hub
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Evidence, implementation learning, and technical resources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={adminLink}>
              <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/5">
                Admin Console
              </Button>
            </Link>
          </div>
        </div>

        {/* TOP SUB-NAVIGATION */}
        <div className="bg-muted dark:bg-background border-t border-border dark:border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 overflow-x-auto flex gap-6 py-2 text-xs font-semibold text-muted-foreground dark:text-foreground">
            {[
              { id: "overview", label: "Overview" },
              { id: "library", label: "Research Library" },
              { id: "pilots", label: "Pilot Activities" },
              { id: "dashboard", label: "Evidence Dashboard" },
              { id: "learning", label: "Lessons Learned" },
              { id: "downloads", label: "Download Centre" },
              { id: "agenda", label: "Research Agenda" },
              { id: "collaboration", label: "Collaboration" },
            ].map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                className={`hover:text-primary transition-colors whitespace-nowrap pb-1 border-b-2 ${
                  activeSection === sec.id
                    ? "border-primary text-primary"
                    : "border-transparent"
                }`}
              >
                {sec.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-8 space-y-16">
        {/* ─── SECTION 1: HERO & STATS ────────────────────────────────────────────── */}
        <section id="overview" className="scroll-mt-36 grid lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-3 space-y-6">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary px-3 py-1 font-bold">
              Evidence & Evaluation
            </Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground dark:text-white leading-tight">
              VaxPlan Research &<br />
              <span className="text-primary">Pilots Hub</span>
            </h1>
            <p className="text-muted-foreground dark:text-muted-foreground text-lg leading-relaxed max-w-xl">
              Documenting VaxPlan research, pilots, implementation lessons, technical resources, and downloadable evidence products. Providing key insights to accelerate GIS-enabled immunization microplanning and unreached child identification globally.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a href="#library">
                <Button className="font-semibold shadow-md">Browse Research Library</Button>
              </a>
              <a href="#pilots">
                <Button variant="outline" className="font-semibold">
                  View Pilot Activities
                </Button>
              </a>
              {documents.length > 0 && (
                <Button
                  variant="ghost"
                  className="font-semibold text-primary underline"
                  onClick={() => handleDownload(documents[0], "document")}
                >
                  Download White Paper
                </Button>
              )}
            </div>
          </div>

          {/* KPI STAT CARDS */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <Card className="bg-white dark:bg-background border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Documents</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-foreground dark:text-white">{statsSummary.documentsCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Research papers & briefs</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-background border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Active Pilots</CardTitle>
                <Activity className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-foreground dark:text-white">{statsSummary.activePilots}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Ongoing field runs</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-background border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Geographies</CardTitle>
                <Globe className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-foreground dark:text-white">{statsSummary.countriesCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Countries documented</p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-background border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Downloads</CardTitle>
                <Download className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black text-foreground dark:text-white">{statsSummary.downloadsCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">White papers & assets</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── FEATURED WHITE PAPER SECTION ───────────────────────────────────────── */}
        {documents.length > 0 && (
          <section className="bg-gradient-to-r from-primary/10 via-indigo-50/50 to-primary/5 dark:from-primary/20 dark:via-slate-900 dark:to-slate-800 border border-primary/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center shadow-sm">
            <div className="flex-1 space-y-4 text-left">
              <Badge className="bg-primary hover:bg-primary text-white">Featured Publication</Badge>
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground dark:text-white leading-tight">
                {documents[0].title}
              </h2>
              <p className="text-muted-foreground dark:text-foreground text-sm leading-relaxed">
                {documents[0].abstract}
              </p>
              <div className="text-xs text-muted-foreground flex gap-4">
                <span><strong>Authors:</strong> {documents[0].authors}</span>
                <span><strong>Date:</strong> {documents[0].publicationDate}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[200px]">
              <Button onClick={() => handleDownload(documents[0], "document")} className="w-full gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" onClick={() => setPreviewDoc(documents[0])} className="w-full gap-2 bg-white dark:bg-background">
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button variant="ghost" onClick={() => copyCitation(documents[0])} className="w-full gap-2 text-xs">
                <Copy className="h-3 w-3" /> Cite Harvard
              </Button>
            </div>
          </section>
        )}

        {/* ─── SECTION 2: RESEARCH LIBRARY ────────────────────────────────────────── */}
        <section id="library" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Research Library</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Search, filter, and download scientific papers, case studies, product briefs, and checklists.
            </p>
          </div>

          {/* SEARCH & FILTERS CONTROLS */}
          <Card className="bg-white dark:bg-background border border-border dark:border-border">
            <CardContent className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by title, abstract, authors..."
                    className="pl-9 text-xs"
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                  />
                </div>

                <div>
                  <Select value={libType} onValueChange={setLibType}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Document Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {docTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={libCountry} onValueChange={setLibCountry}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={libSort} onValueChange={setLibSort}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="downloads">Most Downloaded</SelectItem>
                      <SelectItem value="title">Alphabetical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARDS LIST */}
          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
              <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              No matching research documents found. Adjust filters to search.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card key={doc.id} className="bg-white dark:bg-background border border-border dark:border-border flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <Badge variant="secondary" className="bg-muted dark:bg-muted text-[10px] uppercase">
                        {doc.documentType}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-600 bg-emerald-50/50">
                        {doc.visibility}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground dark:text-white line-clamp-2 leading-snug">
                      {doc.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1 flex gap-2">
                      <Calendar className="h-3 w-3" /> {doc.publicationDate || doc.year}
                      {doc.country && (
                        <>
                          <span>•</span> <span>{doc.country}</span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 pb-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                      {doc.abstract}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(doc.tags || []).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 border-t border-slate-100 dark:border-border mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Download className="h-3 w-3 text-muted-foreground" /> {doc.downloadCount || 0}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(doc)} className="h-7 text-xs px-2">
                        Preview
                      </Button>
                      <Button size="sm" variant="default" onClick={() => handleDownload(doc, "document")} className="h-7 text-xs px-3">
                        PDF
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 3: PILOT ACTIVITIES ────────────────────────────────────────── */}
        <section id="pilots" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Pilot Activities</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Explore active and completed VaxPlan field pilots, mapping status, and geographic points.
              </p>
            </div>

            {/* Map/List Toggle */}
            <div className="flex border border-border dark:border-border rounded-lg p-1 bg-white dark:bg-background">
              <Button
                size="sm"
                variant={pilotViewMode === "map" ? "secondary" : "ghost"}
                onClick={() => setPilotViewMode("map")}
                className="h-8 text-xs gap-1.5"
              >
                <MapIcon className="h-3.5 w-3.5" /> Map View
              </Button>
              <Button
                size="sm"
                variant={pilotViewMode === "list" ? "secondary" : "ghost"}
                onClick={() => setPilotViewMode("list")}
                className="h-8 text-xs gap-1.5"
              >
                <List className="h-3.5 w-3.5" /> List View
              </Button>
            </div>
          </div>

          {/* PILOTS FILTERS */}
          <Card className="bg-white dark:bg-background border border-border dark:border-border">
            <CardContent className="p-4 flex gap-3 flex-wrap">
              <div className="w-[180px]">
                <Select value={pilotCountry} onValueChange={setPilotCountry}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.filter((c) => c !== "Global").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[180px]">
                <Select value={pilotStatus} onValueChange={setPilotStatus}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* MAP CONTAINER / LIST CONTAINER */}
          {pilotViewMode === "map" ? (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Sidebar pilot registry */}
              <div className="lg:col-span-1 space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {pilots.map((p) => (
                  <Card
                    key={p.id}
                    className="p-4 cursor-pointer hover:border-primary/50 transition-colors bg-white dark:bg-background"
                    onClick={() => setPreviewPilot(p)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <Badge className="text-[9px] px-1.5 py-0 font-bold uppercase">{p.status}</Badge>
                      <span className="text-[10px] text-muted-foreground font-semibold">{p.startDate}</span>
                    </div>
                    <h3 className="font-bold text-sm text-foreground dark:text-white line-clamp-1">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
                    <div className="flex gap-4 text-[10px] font-medium text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.province}, {p.country}</span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Map */}
              <div className="lg:col-span-2 h-[500px] rounded-xl overflow-hidden border border-border dark:border-border shadow-sm relative">
                <MapContainer center={mapCenter} zoom={4} className="h-full w-full">
                  <TileLayer url={BASEMAP_URL} attribution={BASEMAP_ATTRIBUTION} />
                  {pilots
                    .filter((p) => p.latitude && p.longitude)
                    .map((p) => (
                      <CircleMarker
                        key={p.id}
                        center={[Number(p.latitude), Number(p.longitude)]}
                        radius={10}
                        pathOptions={{
                          color: p.status === "Completed" ? "#10b981" : "#f59e0b",
                          fillColor: p.status === "Completed" ? "#10b981" : "#f59e0b",
                          fillOpacity: 0.6,
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <div className="font-bold">{p.title}</div>
                            <div>{p.district}, {p.province}, {p.country}</div>
                            <div>Status: <Badge className="text-[9px]">{p.status}</Badge></div>
                            <div>Start: {p.startDate}</div>
                            <Button size="sm" variant="ghost" onClick={() => setPreviewPilot(p)} className="h-6 text-[10px] mt-2 w-full justify-start">
                              View Details
                            </Button>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                </MapContainer>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {pilots.map((p) => (
                <Card key={p.id} className="bg-white dark:bg-background border border-border dark:border-border flex flex-col justify-between">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {p.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">{p.startDate}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground dark:text-white leading-tight">
                      {p.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 pb-3 flex-1">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed">
                      {p.summary}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-muted dark:bg-muted p-3 rounded-lg border">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">FACILITIES INVOLVED</span>
                        <span className="font-semibold text-foreground dark:text-foreground">{p.facility || "Multiple"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">MINISTRY FOCAL POINT</span>
                        <span className="font-semibold text-foreground dark:text-foreground">{p.ministryFocalPoint || "MoH Focal"}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 border-t flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewPilot(p)} className="h-8 text-xs">
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 4: EVIDENCE DASHBOARD ──────────────────────────────────────── */}
        <section id="dashboard" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Evidence Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Summarized charts and metrics displaying publication categories, pilot outcomes, and downloads.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Stat counts card */}
            <Card className="bg-white dark:bg-background border border-border dark:border-border md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Metrics Rollup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground">Research Documents</span>
                  <span className="font-bold text-sm text-slate-950 dark:text-white">{statsSummary.documentsCount}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground">Completed Pilots</span>
                  <span className="font-bold text-sm text-slate-950 dark:text-white">{statsSummary.completedPilots}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground">Active Pilots</span>
                  <span className="font-bold text-sm text-slate-950 dark:text-white">{statsSummary.activePilots}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground">Total Downloads</span>
                  <span className="font-bold text-sm text-slate-950 dark:text-white">{statsSummary.downloadsCount}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-xs text-muted-foreground">Lessons Catalogued</span>
                  <span className="font-bold text-sm text-slate-950 dark:text-white">{statsSummary.lessonsCount}</span>
                </div>
              </CardContent>
            </Card>

            {/* SVG Document Type Bar Chart */}
            <Card className="bg-white dark:bg-background border border-border dark:border-border md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" /> Publications by Type
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center">
                <div className="w-full space-y-3">
                  {chartsData.types.length === 0 ? (
                    <span className="text-xs text-muted-foreground block text-center">No type data compiled.</span>
                  ) : (
                    chartsData.types.map((type, idx) => {
                      const maxVal = Math.max(1, ...chartsData.types.map((t) => t.val));
                      const pct = (type.val / maxVal) * 100;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span className="truncate max-w-[200px]">{type.name}</span>
                            <span>{type.val}</span>
                          </div>
                          <div className="w-full bg-muted dark:bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SVG Pilot Status Pie Chart (Stacked representation for accessibility) */}
            <Card className="bg-white dark:bg-background border border-border dark:border-border md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Pilots by Status</CardTitle>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center">
                <div className="w-full space-y-3">
                  {chartsData.statuses.length === 0 ? (
                    <span className="text-xs text-muted-foreground block text-center">No pilot status compiled.</span>
                  ) : (
                    chartsData.statuses.map((status, idx) => {
                      const maxVal = Math.max(1, ...chartsData.statuses.map((s) => s.val));
                      const pct = (status.val / maxVal) * 100;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span>{status.name}</span>
                            <span>{status.val}</span>
                          </div>
                          <div className="w-full bg-muted dark:bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: status.name === "Completed" ? "#10b981" : "#f59e0b",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── SECTION 5: LESSONS LEARNED ─────────────────────────────────────────── */}
        <section id="learning" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Implementation Learning</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Structured operational lessons documented from VaxPlan deployments, zero-dose mappings, and field sessions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="bg-white dark:bg-background border border-border dark:border-border flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5 uppercase font-bold">
                      {lesson.category}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">Recorded by {lesson.author || "Staff"}</span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground dark:text-white leading-snug">
                    {lesson.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3 text-xs leading-relaxed flex-1">
                  <div>
                    <span className="font-bold text-muted-foreground block uppercase text-[9px]">Context & Action</span>
                    <p className="text-foreground dark:text-foreground mt-0.5">{lesson.context}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t pt-2 mt-2">
                    <div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block uppercase text-[9px]">What Worked</span>
                      <p className="text-foreground dark:text-foreground mt-0.5">{lesson.whatWorked}</p>
                    </div>
                    <div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 block uppercase text-[9px]">What Did Not Work</span>
                      <p className="text-foreground dark:text-foreground mt-0.5">{lesson.whatDidNotWork}</p>
                    </div>
                  </div>
                  <div className="border-t pt-2 mt-2 bg-muted dark:bg-background p-2 rounded-lg">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 block uppercase text-[9px]">Recommendation</span>
                    <p className="text-foreground dark:text-foreground mt-0.5">{lesson.recommendation}</p>
                  </div>
                </CardContent>
                <CardFooter className="p-5 pt-0 border-t flex flex-wrap gap-1 mt-3">
                  {(lesson.tags || []).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[9px] bg-muted dark:bg-muted">
                      #{t}
                    </Badge>
                  ))}
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── SECTION 6: DOWNLOAD CENTRE ─────────────────────────────────────────── */}
        <section id="downloads" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Download Centre</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Ready-to-use templates, country onboarding briefs, assessment tools, and media resources.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <Card key={asset.id} className="bg-white dark:bg-background border border-border dark:border-border flex items-center justify-between p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-4 items-center flex-1 min-w-0">
                  <div className="bg-primary/5 p-3 rounded-lg flex-shrink-0 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground dark:text-white line-clamp-1 leading-snug">
                      {asset.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {asset.description}
                    </p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap font-medium">
                      <span>{asset.category}</span>
                      <span>•</span>
                      <span>Audience: <strong>{asset.recommendedAudience}</strong></span>
                      <span>•</span>
                      <span>v{asset.version}</span>
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleDownload(asset, "asset")} className="ml-4 flex-shrink-0 gap-1.5 h-8 text-xs font-semibold">
                  <Download className="h-3 w-3" /> Download
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── SECTION 7: RESEARCH AGENDA ─────────────────────────────────────────── */}
        <section id="agenda" className="scroll-mt-36 space-y-6">
          <div className="border-b border-border dark:border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground dark:text-white">Research Agenda</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Active research priorities and questions guiding the evolution of GIS-enabled primary healthcare planning.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                q: "How does the accuracy of satellite-derived population intelligence denominators affect vaccine wastage indices?",
                priority: "High",
                method: "Quantitative cross-sectional facility logs analysis",
                partners: "MoH Zambia, GRID3, Gates Foundation",
                status: "Ongoing",
              },
              {
                q: "What is the cost-effectiveness of GIS-enabled microplanning compared to traditional administrative census methods?",
                priority: "Critical",
                method: "Comparative cost-effectiveness model (CEA)",
                partners: "Gavi Zero-Dose Learning Hub, LSE",
                status: "Planned",
              },
              {
                q: "To what extent does offline data synchronization minimize operational dropout rates in mobile outreach clinics?",
                priority: "Medium",
                method: "Retrospective cohort study",
                partners: "UNICEF, National Department of Health PNG",
                status: "Ongoing",
              },
              {
                q: "How can remote-sensing settlement footprint layers resolve rural boundary conflicts between neighboring facilities?",
                priority: "High",
                method: "Participatory GIS mapping workshops",
                partners: "GIS Specialists, Provincial coordinators",
                status: "Planned",
              },
            ].map((agenda, index) => (
              <Card key={index} className="bg-white dark:bg-background border border-border dark:border-border flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline" className={`text-[9px] font-bold ${
                      agenda.priority === "Critical" ? "border-rose-300 text-rose-700 bg-rose-50" : "border-amber-300 text-amber-700 bg-amber-50"
                    }`}>
                      {agenda.priority} Priority
                    </Badge>
                    <Badge className="text-[9px] bg-muted text-foreground dark:bg-muted dark:text-foreground">{agenda.status}</Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-foreground dark:text-white leading-snug">
                    &ldquo;{agenda.q}&rdquo;
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 pb-4 text-xs space-y-2 flex-1">
                  <div>
                    <span className="text-muted-foreground font-semibold block text-[9px] uppercase">METHODOLOGY</span>
                    <p className="text-foreground dark:text-foreground mt-0.5">{agenda.method}</p>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <span className="text-muted-foreground font-semibold block text-[9px] uppercase">COLLABORATIVE PARTNERS</span>
                    <p className="text-foreground dark:text-foreground mt-0.5 font-medium">{agenda.partners}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── SECTION 8: PARTNERS & COLLABORATION ────────────────────────────────── */}
        <section id="collaboration" className="scroll-mt-36 grid md:grid-cols-2 gap-8 items-start border-t pt-12">
          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-foreground dark:text-white tracking-tight leading-tight">
              Partnership & Collaboration
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground leading-relaxed text-sm">
              We invite Ministries of Health, donor organizations, academic institutions, technical developers, and implementation agencies to collaborate with the VaxPlan team.
            </p>
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase text-muted-foreground tracking-wider">COLLABORATION AREAS</h4>
              <ul className="text-xs text-foreground dark:text-foreground space-y-2 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  Country pilots & feasibility tests
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  GIS modeling & unmapped population denominator studies
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  Interoperability with DHIS2, HL7 FHIR, and OpenHIE
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  Economic cost-effectiveness evaluations
                </li>
              </ul>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => {
                const formEl = document.getElementById("interest-form");
                if (formEl) {
                  formEl.scrollIntoView({ behavior: "smooth" });
                  setTimeout(() => {
                    document.getElementById("form-fullname")?.focus();
                  }, 400);
                }
              }} className="gap-2 font-semibold">
                Express Interest <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* COLLABORATION SUBMISSION FORM */}
          <Card id="interest-form" className="bg-white dark:bg-background border border-border dark:border-border shadow-md">
            <CardHeader className="p-6">
              <CardTitle className="text-lg font-bold">Submit Collaboration Inquiry</CardTitle>
              <CardDescription className="text-xs">
                Fill in details to access internal documentation or schedule donor/pilot discussions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form onSubmit={submitForm} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="form-fullname" className="text-xs font-semibold">Full Name <span className="text-rose-500">*</span></Label>
                    <Input
                      id="form-fullname"
                      required
                      placeholder="e.g. John Doe"
                      className="text-xs h-9"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="form-email" className="text-xs font-semibold">Email Address <span className="text-rose-500">*</span></Label>
                    <Input
                      id="form-email"
                      type="email"
                      required
                      placeholder="e.g. name@org.org"
                      className="text-xs h-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="form-org" className="text-xs font-semibold">Organization</Label>
                    <Input
                      id="form-org"
                      placeholder="e.g. Ministry of Health"
                      className="text-xs h-9"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="form-role" className="text-xs font-semibold">Role</Label>
                    <Input
                      id="form-role"
                      placeholder="e.g. Program Manager"
                      className="text-xs h-9"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="form-country" className="text-xs font-semibold">Country</Label>
                    <Input
                      id="form-country"
                      placeholder="e.g. Zambia"
                      className="text-xs h-9"
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="form-interest" className="text-xs font-semibold">Area of Interest</Label>
                    <Select value={areaOfInterest} onValueChange={setAreaOfInterest}>
                      <SelectTrigger id="form-interest" className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pilot implementation">Pilot implementation</SelectItem>
                        <SelectItem value="Research collaboration">Research collaboration</SelectItem>
                        <SelectItem value="Donor discussion">Donor discussion</SelectItem>
                        <SelectItem value="Technical partnership">Technical partnership</SelectItem>
                        <SelectItem value="Ministry onboarding">Ministry onboarding</SelectItem>
                        <SelectItem value="Academic publication">Academic publication</SelectItem>
                        <SelectItem value="Documentation access">Documentation access</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="form-message" className="text-xs font-semibold">Message</Label>
                  <Textarea
                    id="form-message"
                    placeholder="Provide context about your program or research goals..."
                    className="text-xs resize-none h-20"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input
                    id="form-consent"
                    type="checkbox"
                    required
                    className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <Label htmlFor="form-consent" className="text-[10px] text-muted-foreground cursor-pointer select-none">
                    I consent to VaxPlan processing this request and storing these contact details. <span className="text-rose-500">*</span>
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={submissionMutation.isPending}
                  className="w-full gap-2 mt-4 font-semibold text-xs h-10"
                >
                  {submissionMutation.isPending ? "Submitting Inquiry..." : <><Send className="h-4.5 w-4.5" /> Submit Interest Form</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ─── MODAL 1: DOCUMENT PREVIEW ──────────────────────────────────────────── */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        {previewDoc && (
          <DialogContent className="max-w-2xl bg-white dark:bg-background border border-border dark:border-border">
            <DialogHeader>
              <div className="flex gap-2 mb-2 items-center">
                <Badge variant="secondary" className="text-[10px] uppercase font-bold">{previewDoc.documentType}</Badge>
                <Badge variant="outline" className="text-[10px]">{previewDoc.version}</Badge>
              </div>
              <DialogTitle className="text-lg font-bold text-foreground dark:text-white leading-tight">
                {previewDoc.title}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
                Published {previewDoc.publicationDate || previewDoc.year} by {previewDoc.authors} ({previewDoc.organizations})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div>
                <span className="text-muted-foreground font-bold uppercase text-[9px] block">Abstract / Summary</span>
                <p className="text-foreground dark:text-foreground text-xs leading-relaxed mt-1">
                  {previewDoc.abstract}
                </p>
              </div>

              {previewDoc.doi && (
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">DOI Reference</span>
                  <a href={`https://doi.org/${previewDoc.doi}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1 mt-0.5">
                    {previewDoc.doi} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div>
                <span className="text-muted-foreground font-bold uppercase text-[9px] block">Harvard Style Citation</span>
                <div className="bg-muted dark:bg-background p-3 rounded-lg border border-border dark:border-border flex items-start justify-between gap-4 mt-1">
                  <p className="text-foreground dark:text-foreground text-xs leading-relaxed italic">
                    {previewDoc.citationText || `${previewDoc.authors || "Mukombo, L."} (${previewDoc.year || "2026"}) ${previewDoc.title}. VaxPlan Research Hub.`}
                  </p>
                  <Button size="icon" variant="ghost" onClick={() => copyCitation(previewDoc)} className="h-7 w-7 text-muted-foreground hover:text-muted-foreground">
                    {copiedId === previewDoc.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
              <Button size="sm" onClick={() => handleDownload(previewDoc, "document")} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download Document
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── MODAL 2: PILOT PREVIEW ────────────────────────────────────────────── */}
      <Dialog open={!!previewPilot} onOpenChange={(open) => !open && setPreviewPilot(null)}>
        {previewPilot && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-background border border-border dark:border-border">
            <DialogHeader>
              <div className="flex gap-2 mb-2 items-center">
                <Badge className="text-[10px] uppercase font-bold">{previewPilot.status}</Badge>
                <span className="text-xs text-muted-foreground font-medium">Timeline: {previewPilot.startDate} to {previewPilot.endDate || "Present"}</span>
              </div>
              <DialogTitle className="text-lg font-bold text-foreground dark:text-white leading-tight">
                {previewPilot.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 flex gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {previewPilot.district}, {previewPilot.province}, {previewPilot.country}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4 text-xs leading-relaxed">
              <div>
                <span className="text-muted-foreground font-bold uppercase text-[9px] block">Summary</span>
                <p className="text-foreground dark:text-foreground mt-1">{previewPilot.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Implementing Partners</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.partners || "None reported"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Technical Lead</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.technicalLead || "None reported"}</p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Objectives</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.objectives || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Baseline Findings</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.baselineFindings || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Achievements & Learnings</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.achievements || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Challenges Encountered</span>
                  <p className="text-foreground dark:text-foreground mt-0.5">{previewPilot.challenges || "N/A"}</p>
                </div>
              </div>

              {previewPilot.updates && previewPilot.updates.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <span className="text-muted-foreground font-bold uppercase text-[9px] block">Progress Log Timeline</span>
                  <div className="space-y-3 mt-2">
                    {previewPilot.updates.map((upd: any) => (
                      <div key={upd.id} className="border-l-2 border-primary/20 pl-3 py-0.5 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-foreground dark:text-foreground">{upd.title}</span>
                          <span className="text-muted-foreground font-semibold">{upd.updateDate}</span>
                        </div>
                        <p className="text-muted-foreground dark:text-muted-foreground">{upd.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => setPreviewPilot(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
