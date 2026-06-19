import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import {
  FileText,
  MapPin,
  BookOpen,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Activity,
  User,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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

const docTypes = [
  "White Papers",
  "Research Papers",
  "Pilot Reports",
  "Implementation Briefs",
  "Case Studies",
  "Technical Documentation",
  "Evaluation Reports",
  "GIS and Population Intelligence Notes",
  "Zero-Dose Identification Notes",
  "Standards Alignment Documents",
  "Training Materials",
  "Policy Briefs",
  "User Guides",
  "Data Dictionaries",
  "System Architecture Notes",
  "Economic Impact Analyses",
  "Partner Presentations",
];

export default function ResearchAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Guard: require authentication and admin/research role
  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const allowedRoles = [
    "national_admin",
    "gis_specialist",
    "national_manager",
    "research_manager",
    "documentation_manager",
    "super_admin",
    "platform_admin",
  ];
  const hasAccess = user && (isPlatformAdmin || allowedRoles.includes(user.role));

  // ───────────────────────────────────────────────────────────────────────────
  // ADMIN PANEL CONTROLS & COMPONENT STATES
  // ───────────────────────────────────────────────────────────────────────────
  // Active Tab
  const [activeTab, setActiveTab] = useState("overview");

  // Create/Edit Dialog states
  const [docDialog, setDocDialog] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);

  const [pilotDialog, setPilotDialog] = useState<boolean>(false);
  const [editingPilot, setEditingPilot] = useState<any | null>(null);

  const [pilotUpdateDialog, setPilotUpdateDialog] = useState<boolean>(false);
  const [targetPilotId, setTargetPilotId] = useState<number | null>(null);

  const [lessonDialog, setLessonDialog] = useState<boolean>(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);

  const [assetDialog, setAssetDialog] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // FIELD STATES (FOR FORMS)
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Document Form
  const [docTitle, setDocTitle] = useState("");
  const [docAbstract, setDocAbstract] = useState("");
  const [docType, setDocType] = useState("White Paper");
  const [docAuthors, setDocAuthors] = useState("");
  const [docOrg, setDocOrg] = useState("");
  const [docPubDate, setDocPubDate] = useState(new Date().toISOString().split("T")[0]);
  const [docYear, setDocYear] = useState(new Date().getFullYear());
  const [docVersion, setDocVersion] = useState("1.0.0");
  const [docCountry, setDocCountry] = useState("Zambia");
  const [docRegion, setDocRegion] = useState("Southern Africa");
  const [docTags, setDocTags] = useState("");
  const [docStatus, setDocStatus] = useState("Draft");
  const [docVisibility, setDocVisibility] = useState("Public");
  const [docDoi, setDocDoi] = useState("");
  const [docLicense, setDocLicense] = useState("CC BY 4.0");
  const [docFeatured, setDocFeatured] = useState(false);

  // 2. Pilot Form
  const [pilotTitle, setPilotTitle] = useState("");
  const [pilotSummary, setPilotSummary] = useState("");
  const [pilotCountry, setPilotCountry] = useState("");
  const [pilotProvince, setPilotProvince] = useState("");
  const [pilotDistrict, setPilotDistrict] = useState("");
  const [pilotFacility, setPilotFacility] = useState("");
  const [pilotCommunities, setPilotCommunities] = useState("");
  const [pilotLat, setPilotLat] = useState("");
  const [pilotLon, setPilotLon] = useState("");
  const [pilotStartDate, setPilotStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [pilotEndDate, setPilotEndDate] = useState("");
  const [pilotStatus, setPilotStatus] = useState("Planned");
  const [pilotType, setPilotType] = useState("Field Implementation");
  const [pilotPartners, setPilotPartners] = useState("");
  const [pilotFocal, setPilotFocal] = useState("");
  const [pilotLead, setPilotLead] = useState("");
  const [pilotObjectives, setPilotObjectives] = useState("");
  const [pilotQuestions, setPilotQuestions] = useState("");
  const [pilotMethod, setPilotMethod] = useState("");
  const [pilotBaseline, setPilotBaseline] = useState("");
  const [pilotAchievements, setPilotAchievements] = useState("");
  const [pilotChallenges, setPilotChallenges] = useState("");
  const [pilotLessons, setPilotLessons] = useState("");
  const [pilotRecommendations, setPilotRecommendations] = useState("");
  const [pilotEthics, setPilotEthics] = useState("");
  const [pilotVisibility, setPilotVisibility] = useState("Public");
  const [pilotFeatured, setPilotFeatured] = useState(false);

  // 3. Pilot Update Form
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split("T")[0]);
  const [updateType, setUpdateType] = useState("Progress");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateAchievements, setUpdateAchievements] = useState("");
  const [updateChallenges, setUpdateChallenges] = useState("");
  const [updateNextSteps, setUpdateNextSteps] = useState("");

  // 4. Lesson Form
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonCategory, setLessonCategory] = useState("GIS microplanning");
  const [lessonContext, setLessonContext] = useState("");
  const [lessonTested, setLessonTested] = useState("");
  const [lessonWorked, setLessonWorked] = useState("");
  const [lessonFailed, setLessonFailed] = useState("");
  const [lessonRec, setLessonRec] = useState("");
  const [lessonPilotId, setLessonPilotId] = useState("none");
  const [lessonDocId, setLessonDocId] = useState("none");
  const [lessonTags, setLessonTags] = useState("");
  const [lessonStatus, setLessonStatus] = useState("Published");
  const [lessonVisibility, setLessonVisibility] = useState("Public");

  // 5. Download Asset Form
  const [assetTitle, setAssetTitle] = useState("");
  const [assetDesc, setAssetDesc] = useState("");
  const [assetCategory, setAssetCategory] = useState("Templates");
  const [assetAudience, setAssetAudience] = useState("Ministry of Health");
  const [assetVersion, setAssetVersion] = useState("1.0.0");
  const [assetStatus, setAssetStatus] = useState("Published");
  const [assetVisibility, setAssetVisibility] = useState("Public");

  // ───────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Admin Analytics
  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/research/analytics"],
    enabled: !!hasAccess,
  });

  // 2. Documents
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/research/documents", { admin: true }],
    enabled: !!hasAccess,
    queryFn: async () => {
      const res = await fetch("/api/research/documents?visibility=all&status=all");
      return res.json();
    },
  });

  // 3. Pilots
  const { data: pilots = [] } = useQuery<any[]>({
    queryKey: ["/api/research/pilots", { admin: true }],
    enabled: !!hasAccess,
    queryFn: async () => {
      const res = await fetch("/api/research/pilots?status=all");
      return res.json();
    },
  });

  // 4. Lessons
  const { data: lessons = [] } = useQuery<any[]>({
    queryKey: ["/api/research/lessons", { admin: true }],
    enabled: !!hasAccess,
    queryFn: async () => {
      const res = await fetch("/api/research/lessons?status=all");
      return res.json();
    },
  });

  // 5. Assets
  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ["/api/research/assets", { admin: true }],
    enabled: !!hasAccess,
    queryFn: async () => {
      const res = await fetch("/api/research/assets?status=all");
      return res.json();
    },
  });

  // 6. Submissions
  const { data: submissions = [] } = useQuery<any[]>({
    queryKey: ["/api/research/submissions"],
    enabled: !!hasAccess,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MUTATIONS (CRUD)
  // ───────────────────────────────────────────────────────────────────────────
  // A. Documents CRUD
  const saveDocMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingDoc;
      const url = isEdit ? `/api/research/documents/${editingDoc.id}` : "/api/research/documents";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document Saved", description: "Document metadata updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/research/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
      setDocDialog(false);
      setEditingDoc(null);
      setUploadedFile(null);
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/research/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  // B. Pilots CRUD
  const savePilotMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingPilot;
      const url = isEdit ? `/api/research/pilots/${editingPilot.id}` : "/api/research/pilots";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pilot Activity Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/pilots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
      setPilotDialog(false);
      setEditingPilot(null);
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const savePilotUpdateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/research/pilots/${targetPilotId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Update failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Progress Update Added" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/pilots"] });
      setPilotUpdateDialog(false);
      setTargetPilotId(null);
      setUpdateTitle("");
      setUpdateDesc("");
      setUpdateAchievements("");
      setUpdateChallenges("");
      setUpdateNextSteps("");
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  // C. Lessons CRUD
  const saveLessonMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingLesson;
      const url = isEdit ? `/api/research/lessons/${editingLesson.id}` : "/api/research/lessons";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Lesson Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/lessons"] });
      setLessonDialog(false);
      setEditingLesson(null);
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  // D. Download Assets CRUD
  const saveAssetMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingAsset;
      const url = isEdit ? `/api/research/assets/${editingAsset.id}` : "/api/research/assets";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Downloadable Asset Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/assets"] });
      setAssetDialog(false);
      setEditingAsset(null);
      setUploadedFile(null);
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  // E. Submissions review status update
  const reviewSubmissionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/research/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Review failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Inquiry Reviewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Review Failed", description: err.message, variant: "destructive" });
    },
  });

  // F. Delete mutations for pilots, lessons, assets
  const deletePilotMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/research/pilots/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pilot Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/pilots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/research/lessons/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Lesson Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/lessons"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/research/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Asset Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/research/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FILE UPLOADER HANDLER
  // ───────────────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/research/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to upload file");
      }

      const uploaded = await res.json();
      setUploadedFile(uploaded);
      toast({
        title: "Upload Successful",
        description: `Attached file: ${uploaded.fileName}`,
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Guard routing
  if (!hasAccess) {
    return <Redirect to="/" />;
  }

  // Edit launchers
  const openDocEdit = (doc: any) => {
    setEditingDoc(doc);
    setDocTitle(doc.title);
    setDocAbstract(doc.abstract || "");
    setDocType(doc.documentType);
    setDocAuthors(doc.authors || "");
    setDocOrg(doc.organizations || "");
    setDocPubDate(doc.publicationDate || "");
    setDocYear(doc.year || new Date().getFullYear());
    setDocVersion(doc.version || "1.0.0");
    setDocCountry(doc.country || "");
    setDocRegion(doc.region || "");
    setDocTags((doc.tags || []).join(", "));
    setDocStatus(doc.status);
    setDocVisibility(doc.visibility);
    setDocDoi(doc.doi || "");
    setDocLicense(doc.license || "CC BY 4.0");
    setDocFeatured(doc.isFeatured);
    setUploadedFile(
      doc.fileUrl
        ? {
            url: doc.fileUrl,
            fileName: doc.fileName || "",
            fileType: doc.fileType || "",
            fileSize: doc.fileSize || 0,
          }
        : null
    );
    setDocDialog(true);
  };

  const openDocCreate = () => {
    setEditingDoc(null);
    setDocTitle("");
    setDocAbstract("");
    setDocType("White Paper");
    setDocAuthors("");
    setDocOrg("");
    setDocPubDate(new Date().toISOString().split("T")[0]);
    setDocYear(new Date().getFullYear());
    setDocVersion("1.0.0");
    setDocCountry("Zambia");
    setDocRegion("Southern Africa");
    setDocTags("");
    setDocStatus("Draft");
    setDocVisibility("Public");
    setDocDoi("");
    setDocLicense("CC BY 4.0");
    setDocFeatured(false);
    setUploadedFile(null);
    setDocDialog(true);
  };

  const submitDocForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: docTitle,
      abstract: docAbstract,
      documentType: docType,
      authors: docAuthors,
      organizations: docOrg,
      publicationDate: docPubDate,
      year: Number(docYear),
      version: docVersion,
      country: docCountry,
      region: docRegion,
      tags: docTags.split(",").map((t) => t.trim()).filter(Boolean),
      status: docStatus,
      visibility: docVisibility,
      doi: docDoi,
      license: docLicense,
      isFeatured: docFeatured,
      fileUrl: uploadedFile?.url || null,
      fileName: uploadedFile?.fileName || null,
      fileType: uploadedFile?.fileType || null,
      fileSize: uploadedFile?.fileSize || null,
    };
    saveDocMutation.mutate(payload);
  };

  // Pilot launcher
  const openPilotCreate = () => {
    setEditingPilot(null);
    setPilotTitle("");
    setPilotSummary("");
    setPilotCountry("");
    setPilotProvince("");
    setPilotDistrict("");
    setPilotFacility("");
    setPilotCommunities("");
    setPilotLat("");
    setPilotLon("");
    setPilotStartDate(new Date().toISOString().split("T")[0]);
    setPilotEndDate("");
    setPilotStatus("Planned");
    setPilotType("Field Implementation");
    setPilotPartners("");
    setPilotFocal("");
    setPilotLead("");
    setPilotObjectives("");
    setPilotQuestions("");
    setPilotMethod("");
    setPilotBaseline("");
    setPilotAchievements("");
    setPilotChallenges("");
    setPilotLessons("");
    setPilotRecommendations("");
    setPilotEthics("");
    setPilotVisibility("Public");
    setPilotFeatured(false);
    setPilotDialog(true);
  };

  const openPilotEdit = (p: any) => {
    setEditingPilot(p);
    setPilotTitle(p.title);
    setPilotSummary(p.summary || "");
    setPilotCountry(p.country);
    setPilotProvince(p.province || "");
    setPilotDistrict(p.district || "");
    setPilotFacility(p.facility || "");
    setPilotCommunities(p.communities || "");
    setPilotLat(p.latitude ? String(p.latitude) : "");
    setPilotLon(p.longitude ? String(p.longitude) : "");
    setPilotStartDate(p.startDate || "");
    setPilotEndDate(p.endDate || "");
    setPilotStatus(p.status);
    setPilotType(p.pilotType || "Field Implementation");
    setPilotPartners(p.partners || "");
    setPilotFocal(p.ministryFocalPoint || "");
    setPilotLead(p.technicalLead || "");
    setPilotObjectives(p.objectives || "");
    setPilotQuestions(p.researchQuestions || "");
    setPilotMethod(p.methodology || "");
    setPilotBaseline(p.baselineFindings || "");
    setPilotAchievements(p.achievements || "");
    setPilotChallenges(p.challenges || "");
    setPilotLessons(p.lessonsLearned || "");
    setPilotRecommendations(p.recommendations || "");
    setPilotEthics(p.ethicsStatus || "");
    setPilotVisibility(p.visibility);
    setPilotFeatured(p.isFeatured);
    setPilotDialog(true);
  };

  const submitPilotForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: pilotTitle,
      summary: pilotSummary,
      country: pilotCountry,
      province: pilotProvince,
      district: pilotDistrict,
      facility: pilotFacility,
      communities: pilotCommunities,
      latitude: pilotLat ? String(Number(pilotLat)) : null,
      longitude: pilotLon ? String(Number(pilotLon)) : null,
      startDate: pilotStartDate,
      endDate: pilotEndDate || null,
      status: pilotStatus,
      pilotType,
      partners: pilotPartners,
      ministryFocalPoint: pilotFocal,
      technicalLead: pilotLead,
      objectives: pilotObjectives,
      researchQuestions: pilotQuestions,
      methodology: pilotMethod,
      baselineFindings: pilotBaseline,
      achievements: pilotAchievements,
      challenges: pilotChallenges,
      lessonsLearned: pilotLessons,
      recommendations: pilotRecommendations,
      ethicsStatus: pilotEthics,
      visibility: pilotVisibility,
      isFeatured: pilotFeatured,
    };
    savePilotMutation.mutate(payload);
  };

  const openPilotUpdate = (pId: number) => {
    setTargetPilotId(pId);
    setPilotUpdateDialog(true);
  };

  const submitPilotUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    savePilotUpdateMutation.mutate({
      title: updateTitle,
      updateDate,
      updateType,
      description: updateDesc,
      achievements: updateAchievements,
      challenges: updateChallenges,
      nextSteps: updateNextSteps,
    });
  };

  // Lesson launcher
  const openLessonCreate = () => {
    setEditingLesson(null);
    setLessonTitle("");
    setLessonCategory("GIS microplanning");
    setLessonContext("");
    setLessonTested("");
    setLessonWorked("");
    setLessonFailed("");
    setLessonRec("");
    setLessonPilotId("none");
    setLessonDocId("none");
    setLessonTags("");
    setLessonStatus("Published");
    setLessonVisibility("Public");
    setLessonDialog(true);
  };

  const openLessonEdit = (l: any) => {
    setEditingLesson(l);
    setLessonTitle(l.title);
    setLessonCategory(l.category);
    setLessonContext(l.context || "");
    setLessonTested(l.whatWasTested || "");
    setLessonWorked(l.whatWorked || "");
    setLessonFailed(l.whatDidNotWork || "");
    setLessonRec(l.recommendation || "");
    setLessonPilotId(l.pilotId ? String(l.pilotId) : "none");
    setLessonDocId(l.documentId ? String(l.documentId) : "none");
    setLessonTags((l.tags || []).join(", "));
    setLessonStatus(l.status);
    setLessonVisibility(l.visibility);
    setLessonDialog(true);
  };

  const submitLessonForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: lessonTitle,
      category: lessonCategory,
      context: lessonContext,
      whatWasTested: lessonTested,
      whatWorked: lessonWorked,
      whatDidNotWork: lessonFailed,
      recommendation: lessonRec,
      pilotId: lessonPilotId !== "none" ? Number(lessonPilotId) : null,
      documentId: lessonDocId !== "none" ? Number(lessonDocId) : null,
      tags: lessonTags.split(",").map((t) => t.trim()).filter(Boolean),
      status: lessonStatus,
      visibility: lessonVisibility,
    };
    saveLessonMutation.mutate(payload);
  };

  // Download Asset launcher
  const openAssetCreate = () => {
    setEditingAsset(null);
    setAssetTitle("");
    setAssetDesc("");
    setAssetCategory("Templates");
    setAssetAudience("Ministry of Health");
    setAssetVersion("1.0.0");
    setAssetStatus("Published");
    setAssetVisibility("Public");
    setUploadedFile(null);
    setAssetDialog(true);
  };

  const openAssetEdit = (a: any) => {
    setEditingAsset(a);
    setAssetTitle(a.title);
    setAssetDesc(a.description || "");
    setAssetCategory(a.category);
    setAssetAudience(a.recommendedAudience || "");
    setAssetVersion(a.version || "1.0.0");
    setAssetStatus(a.status);
    setAssetVisibility(a.visibility);
    setUploadedFile(
      a.fileUrl
        ? {
            url: a.fileUrl,
            fileName: a.fileName || "",
            fileType: a.fileType || "",
            fileSize: a.fileSize || 0,
          }
        : null
    );
    setAssetDialog(true);
  };

  const submitAssetForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: assetTitle,
      description: assetDesc,
      category: assetCategory,
      recommendedAudience: assetAudience,
      version: assetVersion,
      status: assetStatus,
      visibility: assetVisibility,
      fileUrl: uploadedFile?.url || null,
      fileName: uploadedFile?.fileName || null,
      fileType: uploadedFile?.fileType || null,
      fileSize: uploadedFile?.fileSize || null,
    };
    saveAssetMutation.mutate(payload);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> VaxPlan Research Admin Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage white papers, pilots registry, progress logs, field lessons, and collaboration inquiries.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-200 dark:bg-slate-900 p-1 flex gap-2 w-max max-w-full overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs">Analytics Overview</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Research Library ({documents.length})</TabsTrigger>
          <TabsTrigger value="pilots" className="text-xs">Pilots Registry ({pilots.length})</TabsTrigger>
          <TabsTrigger value="lessons" className="text-xs">Field Lessons ({lessons.length})</TabsTrigger>
          <TabsTrigger value="assets" className="text-xs">Download assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="submissions" className="text-xs flex items-center gap-1.5">
            Interest submissions
            {analytics?.pendingSubmissions > 0 && (
              <Badge variant="destructive" className="h-4 w-4 rounded-full flex items-center justify-center p-0 text-[9px]">
                {analytics.pendingSubmissions}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: ANALYTICS OVERVIEW ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Documents</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{analytics?.documents?.total || 0}</div>
                <div className="text-[10px] text-muted-foreground flex gap-2">
                  <span>{analytics?.documents?.published || 0} Published</span>
                  <span>{analytics?.documents?.draft || 0} Drafts</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Pilots</CardTitle>
                <Activity className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{analytics?.pilots?.total || 0}</div>
                <div className="text-[10px] text-muted-foreground flex gap-2">
                  <span>{analytics?.pilots?.active || 0} Active</span>
                  <span>{analytics?.pilots?.completed || 0} Completed</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Total Downloads</CardTitle>
                <Download className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{analytics?.totalDownloads || 0}</div>
                <div className="text-[10px] text-muted-foreground">Across all publications</div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Pending Inquiries</CardTitle>
                <TrendingUp className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{analytics?.pendingSubmissions || 0}</div>
                <div className="text-[10px] text-muted-foreground">Awaiting MoH/Admin review</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top downloaded docs */}
            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-slate-400">Top Publications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics?.topDocuments || []).map((doc: any, i: number) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 text-xs">
                      <span className="truncate max-w-[300px] font-semibold text-slate-800 dark:text-slate-200">{doc.title}</span>
                      <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                        <Download className="h-3 w-3 text-slate-400" /> {doc.downloadCount}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* General help card */}
            <Card className="bg-white dark:bg-slate-900 border">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-slate-400">Hub Actions Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 leading-relaxed text-slate-600 dark:text-slate-400">
                <p>
                  <strong>Role Scoping:</strong> All uploads and edits made in this console automatically apply to the active tenant domain. Document listings default to Draft/Internal visibility until published.
                </p>
                <p>
                  <strong>File Storage:</strong> Supports PDF, DOCX, XLSX, PPTX, and CSV formats up to 15MB. Ensure filenames are sanitized.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB 2: DOCUMENTS LIBRARY ─────────────────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400">Publications Registry</h2>
            <Button size="sm" onClick={openDocCreate} className="gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Upload Document
            </Button>
          </div>

          <Card className="bg-white dark:bg-slate-900 border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                <tr className="text-left font-bold text-slate-600">
                  <th className="p-3">Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Visibility</th>
                  <th className="p-3">Downloads</th>
                  <th className="p-3">Last Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="truncate max-w-[280px]">{doc.title}</div>
                      <span className="text-[10px] text-slate-400 block font-normal">v{doc.version} · {doc.country}</span>
                    </td>
                    <td className="p-3 uppercase text-[10px] font-semibold text-slate-500">{doc.documentType}</td>
                    <td className="p-3">
                      <Badge className={
                        doc.status === "Published" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                      } variant="outline">
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{doc.visibility}</Badge>
                    </td>
                    <td className="p-3 font-mono">{doc.downloadCount}</td>
                    <td className="p-3 text-slate-400">{new Date(doc.updatedAt).toISOString().split("T")[0]}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openDocEdit(doc)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {/* Original delete button commented out to satisfy rule 1
                      <Button size="icon" variant="ghost" onClick={() => deleteDocMutation.mutate(doc.id)} className="h-8 w-8 text-rose-400 hover:text-rose-600">
                      */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete document "${doc.title}"?`)) {
                            deleteDocMutation.mutate(doc.id);
                          }
                        }}
                        className="h-8 w-8 text-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: PILOTS REGISTRY ───────────────────────────────────────────── */}
        <TabsContent value="pilots" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400">VaxPlan Active/Completed Pilots</h2>
            <Button size="sm" onClick={openPilotCreate} className="gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Add Pilot Activity
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {pilots.map((p) => (
              <Card key={p.id} className="bg-white dark:bg-slate-900 border flex flex-col justify-between">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-center mb-1">
                    <Badge className="text-[10px] font-bold uppercase">{p.status}</Badge>
                    <span className="text-xs text-slate-400 font-medium">{p.startDate}</span>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {p.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {p.district}, {p.province}, {p.country}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
                  <p className="line-clamp-3">{p.summary}</p>
                </CardContent>
                <CardFooter className="p-4 border-t flex justify-between items-center">
                  <Button size="sm" variant="outline" onClick={() => openPilotUpdate(p.id)} className="h-8 text-xs gap-1">
                    <Activity className="h-3.5 w-3.5" /> Progress Log
                  </Button>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openPilotEdit(p)} className="h-8 text-xs">
                      Edit Metadata
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete pilot "${p.title}"? This will also remove all progress updates.`)) {
                          deletePilotMutation.mutate(p.id);
                        }
                      }}
                      className="h-8 w-8 text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB 4: FIELD LESSONS ─────────────────────────────────────────────── */}
        <TabsContent value="lessons" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400">Deployment Learnings Log</h2>
            <Button size="sm" onClick={openLessonCreate} className="gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Record New Lesson
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="bg-white dark:bg-slate-900 border flex flex-col justify-between">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-center mb-1">
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5 uppercase font-bold">
                      {lesson.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {lesson.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs text-slate-700 dark:text-slate-300 flex-1 space-y-2">
                  <p className="line-clamp-2"><strong>Context:</strong> {lesson.context}</p>
                  <p className="line-clamp-2"><strong>Recommendation:</strong> {lesson.recommendation}</p>
                </CardContent>
                <CardFooter className="p-4 border-t flex justify-end gap-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openLessonEdit(lesson)} className="h-8 text-xs">
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete lesson "${lesson.title}"?`)) {
                          deleteLessonMutation.mutate(lesson.id);
                        }
                      }}
                      className="h-8 w-8 text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB 5: DOWNLOAD ASSETS ───────────────────────────────────────────── */}
        <TabsContent value="assets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold uppercase text-slate-400">Download Centre Assets</h2>
            <Button size="sm" onClick={openAssetCreate} className="gap-1.5 text-xs font-semibold">
              <Plus className="h-4 w-4" /> Add Asset
            </Button>
          </div>

          <Card className="bg-white dark:bg-slate-900 border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                <tr className="text-left font-bold text-slate-600">
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Audience</th>
                  <th className="p-3">Downloads</th>
                  <th className="p-3">Version</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{asset.title}</td>
                    <td className="p-3">{asset.category}</td>
                    <td className="p-3 font-medium">{asset.recommendedAudience}</td>
                    <td className="p-3 font-mono">{asset.downloadCount}</td>
                    <td className="p-3 font-medium">v{asset.version}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openAssetEdit(asset)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete asset "${asset.title}"?`)) {
                            deleteAssetMutation.mutate(asset.id);
                          }
                        }}
                        className="h-8 w-8 text-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ─── TAB 6: INTEREST SUBMISSIONS ──────────────────────────────────────── */}
        <TabsContent value="submissions" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400">Collaboration & Inquiries Inbox</h2>

          {submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
              No collaboration inquiries recorded yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {submissions.map((sub) => (
                <Card key={sub.id} className="bg-white dark:bg-slate-900 border flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant={sub.status === "reviewed" ? "secondary" : "destructive"}>
                        {sub.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(sub.createdAt).toISOString().split("T")[0]}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {sub.fullName}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 font-medium">
                      {sub.role} at {sub.organization} ({sub.country})
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 text-xs text-slate-700 dark:text-slate-300 flex-1 leading-relaxed border-t pt-2 mt-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400">AREA OF INTEREST</span>
                      <p className="font-semibold text-primary">{sub.areaOfInterest}</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] uppercase font-bold text-slate-400">MESSAGE</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{sub.message || "No message context provided."}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 border-t flex justify-between items-center">
                    <a href={`mailto:${sub.email}`} className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                      <User className="h-3.5 w-3.5" /> Email Contact
                    </a>
                    {sub.status === "pending" && (
                      <Button size="sm" onClick={() => reviewSubmissionMutation.mutate({ id: sub.id, status: "reviewed" })} className="h-8 text-xs font-semibold">
                        Mark Reviewed
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── DIALOG: DOCUMENT FORM ────────────────────────────────────────────── */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Document Metadata" : "Upload & Register Document"}</DialogTitle>
            <DialogDescription className="text-xs">
              Complete the metadata fields. Set visibility and status controls before publishing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitDocForm} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Document Title *</Label>
              <Input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Abstract / Summary</Label>
              <Textarea value={docAbstract} onChange={(e) => setDocAbstract(e.target.value)} className="h-20" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {docTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Version</Label>
                <Input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Authors</Label>
                <Input value={docAuthors} onChange={(e) => setDocAuthors(e.target.value)} placeholder="e.g. L. Mukombo" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Organizations</Label>
                <Input value={docOrg} onChange={(e) => setDocOrg(e.target.value)} placeholder="e.g. Ministry of Health" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Publication Date</Label>
                <Input type="date" value={docPubDate} onChange={(e) => setDocPubDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Publication Year</Label>
                <Input type="number" value={docYear} onChange={(e) => setDocYear(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Country</Label>
                <Input value={docCountry} onChange={(e) => setDocCountry(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Region</Label>
                <Input value={docRegion} onChange={(e) => setDocRegion(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Tags (comma-separated)</Label>
              <Input value={docTags} onChange={(e) => setDocTags(e.target.value)} placeholder="e.g. GIS, Zero-Dose, Checklist" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Status</Label>
                <Select value={docStatus} onValueChange={setDocStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Internal Review">Internal Review</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Visibility</Label>
                <Select value={docVisibility} onValueChange={setDocVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Public">Public</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="Restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">DOI Reference</Label>
                <Input value={docDoi} onChange={(e) => setDocDoi(e.target.value)} placeholder="e.g. 10.1234/wp" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">License</Label>
                <Input value={docLicense} onChange={(e) => setDocLicense(e.target.value)} />
              </div>
            </div>

            {/* File Upload Section */}
            <div className="border p-3 rounded-lg space-y-2 bg-slate-50 dark:bg-slate-900/50">
              <Label className="font-bold block">Document File Attachment</Label>
              {uploadedFile ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-primary truncate max-w-[250px]">{uploadedFile.fileName}</span>
                    <Badge variant="secondary">{(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground">Replace file:</Label>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.7z,.tar,.gz,.apk,.exe,.mp4,.json,.geojson"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="text-xs flex-1"
                    />
                    {uploading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.7z,.tar,.gz,.apk,.exe,.mp4,.json,.geojson"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="text-xs w-full"
                  />
                  {uploading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
              )}
            </div>

            <Button type="submit" disabled={saveDocMutation.isPending || uploading} className="w-full h-10 font-semibold text-xs">
              {saveDocMutation.isPending ? "Saving..." : "Save Document Metadata"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: PILOT FORM ───────────────────────────────────────────────── */}
      <Dialog open={pilotDialog} onOpenChange={setPilotDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>{editingPilot ? "Edit Pilot Activity" : "Create Pilot Activity"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPilotForm} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Pilot Title *</Label>
              <Input required value={pilotTitle} onChange={(e) => setPilotTitle(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Summary / Description</Label>
              <Textarea value={pilotSummary} onChange={(e) => setPilotSummary(e.target.value)} className="h-16" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Country *</Label>
                <Input required value={pilotCountry} onChange={(e) => setPilotCountry(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Province</Label>
                <Input value={pilotProvince} onChange={(e) => setPilotProvince(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">District</Label>
                <Input value={pilotDistrict} onChange={(e) => setPilotDistrict(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Facility</Label>
                <Input value={pilotFacility} onChange={(e) => setPilotFacility(e.target.value)} placeholder="e.g. Liteta Health Centre" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Communities Mapped</Label>
                <Input value={pilotCommunities} onChange={(e) => setPilotCommunities(e.target.value)} placeholder="e.g. villages list" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Latitude</Label>
                <Input type="text" value={pilotLat} onChange={(e) => setPilotLat(e.target.value)} placeholder="-14.6800" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Longitude</Label>
                <Input type="text" value={pilotLon} onChange={(e) => setPilotLon(e.target.value)} placeholder="28.1200" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Start Date</Label>
                <Input type="date" value={pilotStartDate} onChange={(e) => setPilotStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">End Date</Label>
                <Input type="date" value={pilotEndDate} onChange={(e) => setPilotEndDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Pilot Status</Label>
                <Select value={pilotStatus} onValueChange={setPilotStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Preparation">In Preparation</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Pilot Type</Label>
                <Input value={pilotType} onChange={(e) => setPilotType(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Implementing Partners</Label>
                <Input value={pilotPartners} onChange={(e) => setPilotPartners(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Technical Lead</Label>
                <Input value={pilotLead} onChange={(e) => setPilotLead(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Ethics Status / Approval Number</Label>
              <Input value={pilotEthics} onChange={(e) => setPilotEthics(e.target.value)} placeholder="e.g. NHRA-0032/25" />
            </div>

            <Button type="submit" disabled={savePilotMutation.isPending} className="w-full h-10 font-semibold text-xs">
              {savePilotMutation.isPending ? "Saving..." : "Save Pilot Metadata"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: PILOT UPDATE FORM ────────────────────────────────────────── */}
      <Dialog open={pilotUpdateDialog} onOpenChange={setPilotUpdateDialog}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Add Progress Update Log</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPilotUpdate} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Update Title *</Label>
              <Input required value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} placeholder="e.g. Mapped 20 villages" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Update Date</Label>
                <Input type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold">Type</Label>
                <Select value={updateType} onValueChange={setUpdateType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Progress">Progress Update</SelectItem>
                    <SelectItem value="Milestone">Milestone Achieved</SelectItem>
                    <SelectItem value="Alert">Alert / Challenge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Description</Label>
              <Textarea value={updateDesc} onChange={(e) => setUpdateDesc(e.target.value)} className="h-16" />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Achievements (Optional)</Label>
              <Input value={updateAchievements} onChange={(e) => setUpdateAchievements(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Challenges (Optional)</Label>
              <Input value={updateChallenges} onChange={(e) => setUpdateChallenges(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Next Steps (Optional)</Label>
              <Input value={updateNextSteps} onChange={(e) => setUpdateNextSteps(e.target.value)} />
            </div>

            <Button type="submit" disabled={savePilotUpdateMutation.isPending} className="w-full h-10 font-semibold text-xs">
              {savePilotUpdateMutation.isPending ? "Adding update..." : "Log Progress Update"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: LESSON FORM ──────────────────────────────────────────────── */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Record Deployment Lesson</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitLessonForm} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Lesson Title *</Label>
              <Input required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Category</Label>
              <Select value={lessonCategory} onValueChange={setLessonCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GIS microplanning">GIS microplanning</SelectItem>
                  <SelectItem value="Zero-dose identification">Zero-dose identification</SelectItem>
                  <SelectItem value="Population denominator review">Population denominator review</SelectItem>
                  <SelectItem value="Offline-first deployment">Offline-first deployment</SelectItem>
                  <SelectItem value="User training">User training</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Context / Contextual background</Label>
              <Textarea value={lessonContext} onChange={(e) => setLessonContext(e.target.value)} className="h-16" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold text-emerald-600">What worked well</Label>
                <Textarea value={lessonWorked} onChange={(e) => setLessonWorked(e.target.value)} className="h-16" />
              </div>
              <div className="space-y-1">
                <Label className="font-semibold text-rose-600">What did not work</Label>
                <Textarea value={lessonFailed} onChange={(e) => setLessonFailed(e.target.value)} className="h-16" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Recommendation</Label>
              <Textarea value={lessonRec} onChange={(e) => setLessonRec(e.target.value)} className="h-16" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Linked Pilot Activity</Label>
                <Select value={lessonPilotId} onValueChange={setLessonPilotId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {pilots.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Linked Research Document</Label>
                <Select value={lessonDocId} onValueChange={setLessonDocId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {documents.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={saveLessonMutation.isPending} className="w-full h-10 font-semibold text-xs">
              Save Lesson Note
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: ASSET FORM ───────────────────────────────────────────────── */}
      <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>Register Downloadable Resource</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAssetForm} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Asset Title *</Label>
              <Input required value={assetTitle} onChange={(e) => setAssetTitle(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Description</Label>
              <Textarea value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} className="h-16" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-semibold">Category</Label>
                <Select value={assetCategory} onValueChange={setAssetCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="White Paper">White Paper</SelectItem>
                    <SelectItem value="Templates">Templates &amp; Checklists</SelectItem>
                    <SelectItem value="Presentation Decks">Presentation Decks</SelectItem>
                    <SelectItem value="Training Materials">Training Materials</SelectItem>
                    <SelectItem value="Datasets">Datasets &amp; GIS Files</SelectItem>
                    <SelectItem value="Software">Software &amp; App Installer</SelectItem>
                    <SelectItem value="Technical Reference">Technical Reference</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Audience</Label>
                <Input value={assetAudience} onChange={(e) => setAssetAudience(e.target.value)} placeholder="e.g. Ministries of Health" />
              </div>
            </div>

            {/* File Upload Section */}
            <div className="border p-3 rounded-lg space-y-2 bg-slate-50 dark:bg-slate-900/50">
              <Label className="font-bold block">Document File Attachment</Label>
              {uploadedFile ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-primary truncate max-w-[200px]">{uploadedFile.fileName}</span>
                    <Badge variant="secondary">{(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground">Replace file:</Label>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.7z,.tar,.gz,.apk,.exe,.mp4,.json,.geojson"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="text-xs flex-1"
                    />
                    {uploading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.7z,.tar,.gz,.apk,.exe,.mp4,.json,.geojson"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="text-xs w-full"
                  />
                  {uploading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
              )}
            </div>

            <Button type="submit" disabled={saveAssetMutation.isPending || uploading} className="w-full h-10 font-semibold text-xs">
              Save Downloadable Resource
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
