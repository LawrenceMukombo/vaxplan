import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "@e965/xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, Trash2, ArrowUp, ArrowDown, Pencil, ArrowLeft,
  MapPin, Image as ImageIcon, ToggleLeft, Hash, Type as TypeIcon, ListChecks,
  CheckSquare, Star, Calendar as CalendarIcon, ShieldAlert, Repeat, GitBranch,
  ChevronDown, ChevronRight, FileUp, Database, Eye, CheckCircle2, AlertTriangle,
  HelpCircle, Sparkles, Layers, Sliders, Play, Copy, RefreshCw, FileText, Download, Upload, Shuffle
} from "lucide-react";
import {
  CHECKLIST_QUESTION_TYPES,
  PREFILL_SOURCE_KEYS,
  SHOW_WHEN_ANY,
  getRiskClassification,
  type ChecklistQuestionType,
  type ChecklistTemplateItem,
  type ChecklistTemplate,
  type ChecklistSection,
  type PrefillSourceKey,
} from "@shared/supervisionChecklist";

const TYPE_ICON: Record<string, any> = {
  yes_no: ToggleLeft,
  yes_no_na: ToggleLeft,
  true_false: ToggleLeft,
  text: TypeIcon,
  long_text: FileText,
  number: Hash,
  decimal: Hash,
  single_select: ListChecks,
  multi_select: CheckSquare,
  rating: Star,
  likert: Star,
  date: CalendarIcon,
  time: CalendarIcon,
  datetime: CalendarIcon,
  gps: MapPin,
  image: ImageIcon,
  file: FileUp,
  signature: Pencil,
  instruction: HelpCircle,
  section_heading: Layers,
  calculated: Sparkles,
  score_only: Hash,
  barcode: Hash,
  temperature: Hash,
  stock_quantity: Hash,
  equipment_status: CheckCircle2,
  person_selector: TypeIcon,
  facility_selector: MapPin,
  community_selector: MapPin,
  auto_prefill: RefreshCw,
};

function typeLabel(t: string): string {
  return CHECKLIST_QUESTION_TYPES.find((q) => q.value === t)?.label ?? t;
}

function newItem(sectionId?: string): ChecklistTemplateItem {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId: sectionId || "sec-default",
    type: "yes_no",
    label: "",
    required: false,
    includeInScore: true,
  };
}

export default function SupervisionTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const admin = (user as any)?.role === "national_admin" || (user as any)?.role === "platform_admin";

  const { data: templates = [], isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/supervision-checklist-templates"],
  });

  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState<"supervision" | "campaign" | "pce" | "h2h">("supervision");
  const [applicableLevel, setApplicableLevel] = useState<"national" | "provincial" | "district" | "facility" | "community" | "campaign">("facility");

  // Sections & Items state
  const [sections, setSections] = useState<ChecklistSection[]>([
    { id: "sec-default", title: "General Supervision Findings", displayOrder: 1, isCollapsedByDefault: false }
  ]);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [questionBankOpen, setQuestionBankOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll selected question into view
  useEffect(() => {
    if (selectedItemId) {
      const el = document.getElementById(`q-card-${selectedItemId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedItemId]);

  // Auto-Save Effect
  useEffect(() => {
    if (!editing) return;
    setAutoSaveStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const draftPayload = {
          editingId: editing.id || 0,
          name,
          description,
          category,
          applicableLevel,
          sections,
          items,
          savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        localStorage.setItem("vaxplan_supervision_template_draft", JSON.stringify(draftPayload));
        setLastSavedTime(draftPayload.savedAt);
        setAutoSaveStatus("saved");
      } catch (err) {
        console.warn("Auto-save draft error:", err);
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [name, description, category, applicableLevel, sections, items, editing]);

  const clearAutoSaveDraft = () => {
    localStorage.removeItem("vaxplan_supervision_template_draft");
    setAutoSaveStatus("idle");
    setLastSavedTime(null);
  };

  const openEditor = (tpl?: ChecklistTemplate) => {
    if (tpl) {
      setEditing(tpl);
      setIsNew(false);
      setName(tpl.name);
      setDescription(tpl.description || "");
      setActive(tpl.isActive);
      setCategory(tpl.category);
      setApplicableLevel(tpl.applicableLevel || "facility");

      const loadedItems = tpl.items || [];
      let loadedSections = Array.isArray(tpl.sections) && tpl.sections.length > 0 ? [...tpl.sections] : [];

      const referencedSecIds = new Set(
        loadedItems.map((i) => i.sectionId).filter(Boolean) as string[]
      );

      if (loadedSections.length === 0) {
        if (referencedSecIds.size > 0) {
          loadedSections = Array.from(referencedSecIds).map((secId, idx) => ({
            id: secId,
            title: secId === "sec-default" ? "General Supervision Findings" : `Section ${idx + 1}`,
            displayOrder: idx + 1,
          }));
        } else {
          loadedSections = [
            { id: "sec-default", title: "General Supervision Findings", displayOrder: 1 }
          ];
        }
      } else {
        const existingSecIds = new Set(loadedSections.map((s) => s.id));
        referencedSecIds.forEach((secId) => {
          if (!existingSecIds.has(secId)) {
            loadedSections.push({
              id: secId,
              title: secId === "sec-default" ? "General Supervision Findings" : `Additional Section (${secId})`,
              displayOrder: loadedSections.length + 1,
            });
          }
        });
      }

      const firstSecId = loadedSections[0]?.id || "sec-default";
      const normalizedItems = loadedItems.map((item) => ({
        ...item,
        sectionId: item.sectionId || firstSecId,
      }));

      setSections(loadedSections);
      setItems(normalizedItems);
      if (normalizedItems.length > 0) {
        setSelectedItemId(normalizedItems[0].id);
      } else {
        setSelectedItemId(null);
      }
    } else {
      setEditing({ id: 0, tenantId: "", name: "", category: "supervision", items: [], isActive: true });
      setIsNew(true);
      setName("");
      setDescription("");
      setActive(true);
      setCategory("supervision");
      setApplicableLevel("facility");

      // Check if saved draft exists
      const savedDraft = localStorage.getItem("vaxplan_supervision_template_draft");
      let restoredFromDraft = false;
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.name || (draft.items && draft.items.length > 0)) {
            setName(draft.name || "");
            setDescription(draft.description || "");
            if (draft.category) setCategory(draft.category);
            if (draft.applicableLevel) setApplicableLevel(draft.applicableLevel);
            if (Array.isArray(draft.sections) && draft.sections.length > 0) setSections(draft.sections);
            if (Array.isArray(draft.items) && draft.items.length > 0) {
              setItems(draft.items);
              setSelectedItemId(draft.items[0].id);
            }
            restoredFromDraft = true;
            toast({
              title: "Auto-Saved Draft Restored",
              description: `Loaded uncommitted template draft from ${draft.savedAt || "previous session"}.`,
            });
          }
        } catch (e) {
          console.warn("Draft restore parse error:", e);
        }
      }

      if (!restoredFromDraft) {
        const defaultSec = { id: `sec-${Date.now()}`, title: "Facility Readiness & Service Delivery", displayOrder: 1 };
        setSections([defaultSec]);
        const initialItem = newItem(defaultSec.id);
        setItems([initialItem]);
        setSelectedItemId(initialItem.id);
      }
    }
  };

  const normalizeQuestionType = (rawType: any): ChecklistQuestionType => {
    if (!rawType) return "yes_no";
    const t = String(rawType).toLowerCase().trim();
    if (t === "select" || t === "single" || t === "choice" || t === "radio" || t === "single_select") return "single_select";
    if (t === "multiselect" || t === "checkboxes" || t === "multi" || t === "multi_select") return "multi_select";
    if (t === "num" || t === "integer" || t === "count" || t === "number") return "number";
    if (t === "photo" || t === "picture" || t === "camera" || t === "image") return "image";
    if (t === "guidance" || t === "info" || t === "note" || t === "instruction") return "instruction";
    if (t === "bool" || t === "checkbox" || t === "yesno" || t === "yes_no") return "yes_no";
    if (t === "yesnona" || t === "yes_no_na") return "yes_no_na";
    
    const valid = CHECKLIST_QUESTION_TYPES.find((q) => q.value === t);
    if (valid) return valid.value;
    return "text";
  };

  const parseAndAppendQuestions = (rawRows: any[], mode: "append" | "replace") => {
    if (!rawRows || rawRows.length === 0) return;

    const newSectionsMap: Record<string, ChecklistSection> = {};
    const newItems: ChecklistTemplateItem[] = [];

    const baseSecId = sections[0]?.id || `sec-${Date.now()}`;
    if (sections.length === 0) {
      newSectionsMap[baseSecId] = { id: baseSecId, title: "General Findings", displayOrder: 1 };
    } else {
      sections.forEach((s) => { newSectionsMap[s.id] = s; });
    }

    rawRows.forEach((r: any, idx: number) => {
      const secTitle = r.sectionTitle || r.section || r["Section Title"] || r["Section"] || "General Findings";
      let matchedSecId = Object.keys(newSectionsMap).find(
        (id) => newSectionsMap[id].title.toLowerCase() === secTitle.toLowerCase()
      );

      if (!matchedSecId) {
        matchedSecId = `sec-imp-${Date.now()}-${idx}`;
        newSectionsMap[matchedSecId] = {
          id: matchedSecId,
          title: secTitle,
          displayOrder: Object.keys(newSectionsMap).length + 1,
        };
      }

      const qText = r.questionText || r.question || r["Question Text"] || r["Question"] || `Question ${idx + 1}`;
      const rawType = r.answerType || r.type || r["Answer Type"] || r["type"] || "yes_no";
      const qType = normalizeQuestionType(rawType);

      const rawOpts = r.options || r["Options"] || r["Choices"] || [];
      const opts = typeof rawOpts === "string" 
        ? rawOpts.split("|").map((o: string) => o.trim()).filter(Boolean) 
        : (Array.isArray(rawOpts) ? rawOpts.map((o: any) => String(o).trim()) : []);

      const helpText = r.helpText || r.guidance || r["Help Text"] || r["Guidance"] || null;
      const condParent = r.conditionalOnQuestionId || r.conditionalOnQuestion || r["Conditional Parent"] || null;
      const condVal = r.conditionalValue || r["Conditional Value"] || null;
      const prefill = r.prefillSourceKey || r["Prefill Source"] || null;

      newItems.push({
        id: `q-imp-${Date.now()}-${idx}`,
        sectionId: matchedSecId,
        label: qText,
        type: qType,
        options: opts,
        helpText: helpText,
        isScored: r.isScored === true || r.isScored === "true" || r.isScored === 1 || qType === "yes_no" || qType === "yes_no_na",
        weight: parseFloat(r.weight || "1.0") || 1.0,
        prefillSourceKey: prefill,
        conditionalOnQuestionId: condParent,
        conditionalValue: condVal,
      });
    });

    const updatedSectionsList = Object.values(newSectionsMap);
    setSections(updatedSectionsList);

    if (mode === "replace") {
      setItems(newItems);
    } else {
      setItems((prev) => [...prev, ...newItems]);
    }

    toast({
      title: "Questions Imported",
      description: `Successfully loaded ${newItems.length} questions into ${updatedSectionsList.length} sections.`,
    });
    setImportOpen(false);
  };

  const handleSupervisionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith(".json")) {
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const rows = Array.isArray(json) ? json : (json.items || json.questions || [json]);
          parseAndAppendQuestions(rows, "append");
        } catch (err: any) {
          toast({ title: "Invalid JSON", description: err?.message, variant: "destructive" });
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const rawRows = XLSX.utils.sheet_to_json(worksheet);
          parseAndAppendQuestions(rawRows, "append");
        } catch (err: any) {
          toast({ title: "File Error", description: "Failed to parse CSV/Excel file.", variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const addSection = () => {
    const newSec: ChecklistSection = {
      id: `sec-${Date.now()}`,
      title: `New Section ${sections.length + 1}`,
      displayOrder: sections.length + 1,
      isCollapsedByDefault: false,
    };
    setSections([...sections, newSec]);
  };

  const addQuestionToSection = (sectionId: string) => {
    const q = newItem(sectionId);
    setItems((prev) => [...prev, q]);
    setSelectedItemId(q.id);
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= sections.length) return;
    const copy = [...sections];
    const temp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = temp;
    setSections(copy.map((s, i) => ({ ...s, displayOrder: i + 1 })));
  };

  const shuffleSections = () => {
    setSections((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.map((s, idx) => ({ ...s, displayOrder: idx + 1 }));
    });
    toast({ title: "Sections Shuffled", description: "Randomized section positions." });
  };

  const moveQuestionInSec = (secQuestions: ChecklistTemplateItem[], idxInSec: number, dir: -1 | 1) => {
    const nextIdx = idxInSec + dir;
    if (nextIdx < 0 || nextIdx >= secQuestions.length) return;
    const item1 = secQuestions[idxInSec];
    const item2 = secQuestions[nextIdx];
    setItems((prev) => {
      const gIdx1 = prev.findIndex((i) => i.id === item1.id);
      const gIdx2 = prev.findIndex((i) => i.id === item2.id);
      if (gIdx1 === -1 || gIdx2 === -1) return prev;
      const copy = [...prev];
      copy[gIdx1] = item2;
      copy[gIdx2] = item1;
      return copy;
    });
  };

  const shuffleSectionQuestions = (secId: string) => {
    setItems((prev) => {
      const secItems = prev.filter((i) => i.sectionId === secId);
      const otherItems = prev.filter((i) => i.sectionId !== secId);
      const shuffled = [...secItems];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return [...otherItems, ...shuffled];
    });
    toast({ title: "Questions Shuffled", description: "Randomized question order in this section." });
  };

  const duplicateQuestion = (it: ChecklistTemplateItem) => {
    const dup: ChecklistTemplateItem = {
      ...it,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: `${it.label} (Copy)`,
    };
    setItems((prev) => [...prev, dup]);
  };

  const deleteQuestion = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        category,
        applicableLevel,
        isActive: active,
        sections,
        items: items.map((i, idx) => ({ ...i, displayOrder: idx + 1 })),
      };
      if (isNew || !editing?.id) {
        return apiRequest("POST", "/api/supervision-checklist-templates", payload);
      }
      return apiRequest("PATCH", `/api/supervision-checklist-templates/${editing?.id}`, payload);
    },
    onSuccess: (resData: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervision-checklist-templates"] });
      clearAutoSaveDraft();
      toast({ title: "Template Saved", description: "Supervision checklist template saved successfully." });
      if (resData && typeof resData === "object" && resData.id) {
        setEditing(resData);
        setIsNew(false);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const [deletingTemplate, setDeletingTemplate] = useState<ChecklistTemplate | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/supervision-checklist-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervision-checklist-templates"] });
      clearAutoSaveDraft();
      toast({ title: "Checklist Deleted", description: "The checklist template has been deleted permanently." });
      setDeletingTemplate(null);
      setEditing(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedItemId), [items, selectedItemId]);

  // Preview score calculation
  const previewScore = useMemo(() => {
    const scorable = items.filter((i) => i.includeInScore !== false && (i.type === "yes_no" || i.type === "yes_no_na" || i.type === "rating"));
    if (!scorable.length) return 100;
    return 85; // Simulated preview default
  }, [items]);

  const risk = useMemo(() => getRiskClassification(previewScore), [previewScore]);

  const getQuestionsForSection = (secId: string, sIdx: number) => {
    const knownSecIds = new Set(sections.map((s) => s.id));
    return items.filter((i) => {
      const itemSecId = i.sectionId || "sec-default";
      if (itemSecId === secId) return true;
      if (!knownSecIds.has(itemSecId) && sIdx === 0) return true;
      return false;
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/supervision")} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <ClipboardList className="h-6 w-6 text-primary shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Supportive Supervision Template Builder
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 pl-10">
            Design, organize, version, and manage national supervision checklists with collapsible sections and auto-prefill fields.
          </p>
        </div>

        {!editing && (
          <Button onClick={() => openEditor()} className="gap-2 bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="hover:shadow-md transition-all border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-semibold border-primary/30 text-primary">
                    {tpl.category}
                  </Badge>
                  <Badge variant={tpl.isActive ? "default" : "secondary"}>
                    {tpl.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-2">{tpl.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">{tpl.description || "No description provided."}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{tpl.items?.length || 0} Questions</span>
                  <span>v{tpl.version || 1}.0</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEditor(tpl)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Builder
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingTemplate(tpl)}
                    title="Delete entire checklist template"
                    data-testid={`button-delete-checklist-${tpl.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Full Builder Canvas */
        <div className="space-y-4">
          {/* Top Sticky Action Bar with Saved Template Switcher */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border border-border/80 p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 border-r border-border/50 pr-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Saved Checklists:</span>
                <Select
                  value={editing?.id ? String(editing.id) : "new"}
                  onValueChange={(val) => {
                    if (val === "new") {
                      openEditor();
                    } else {
                      const tpl = templates.find((t) => String(t.id) === val);
                      if (tpl) openEditor(tpl);
                    }
                  }}
                >
                  <SelectTrigger className="w-56 md:w-72 h-9 text-xs font-bold border-indigo-500/40 bg-background" data-testid="select-saved-checklist">
                    <SelectValue placeholder="Retrieve saved checklist..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      + Create New Checklist
                    </SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                        {t.name} (v{t.version || 1}.0 — {t.items?.length || 0} Qs) {t.isActive ? "✓ Active" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Checklist Title (e.g. Routine Supportive Supervision)"
                className="w-56 md:w-72 h-9 font-semibold text-sm"
              />
              <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervision">Supervision</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="pce">PCE</SelectItem>
                  <SelectItem value="h2h">House-to-House</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ALWAYS-VISIBLE STICKY ADD QUESTION, SHUFFLE & AUTO-SAVE ACTIONS */}
            <div className="flex items-center gap-2 flex-wrap">
              {autoSaveStatus === "saving" && (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 text-[11px] gap-1 animate-pulse" data-testid="badge-autosave-saving">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Saving draft...
                </Badge>
              )}
              {autoSaveStatus === "saved" && lastSavedTime && (
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 text-[11px] gap-1" data-testid="badge-autosave-saved">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Auto-saved {lastSavedTime}
                </Badge>
              )}

              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm"
                onClick={() => addQuestionToSection(sections[0]?.id || "sec-default")}
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addSection}>
                <Layers className="h-3.5 w-3.5" />
                Add Section
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={shuffleSections}
                title="Shuffle section order"
                data-testid="button-shuffle-sections"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle Sections
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => setImportOpen(true)}
              >
                <FileUp className="h-3.5 w-3.5" />
                Import Questions
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => window.open("/api/supervision/templates/import-template", "_self")}
              >
                <Download className="h-3.5 w-3.5" />
                Sample CSV
              </Button>

              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5" />
                Preview Mode
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name.trim()}
              >
                <CheckCircle2 className="h-4 w-4" />
                Save & Publish
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearAutoSaveDraft();
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              {editing?.id && !isNew && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold"
                  onClick={() => setDeletingTemplate(editing)}
                  data-testid="button-delete-current-checklist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Checklist
                </Button>
              )}
            </div>
          </div>

          {/* Builder Workspace: 3-Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Panel: Sections & Outline */}
            <Card className="lg:col-span-3 border-border/60">
              <CardHeader className="p-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Checklist Outline
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {items.length} Qs
                </Badge>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                {sections.map((sec, sIdx) => {
                  const secQuestions = getQuestionsForSection(sec.id, sIdx);
                  return (
                    <div key={sec.id} className="p-2 rounded border border-border/50 bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => toggleSectionCollapse(sec.id)}
                          className="flex items-center gap-1 font-semibold text-xs text-foreground hover:text-primary truncate flex-1 text-left"
                        >
                          {collapsedSections[sec.id] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <span className="truncate">{sec.title}</span>
                        </button>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{secQuestions.length}</span>
                      </div>
                      {!collapsedSections[sec.id] && (
                        <div className="pl-4 space-y-1 text-[11px]">
                          {secQuestions.map((q) => (
                            <div
                              key={q.id}
                              onClick={() => setSelectedItemId(q.id)}
                              className={`p-1.5 rounded cursor-pointer truncate flex items-center justify-between transition-colors ${
                                selectedItemId === q.id ? "bg-primary/10 font-bold text-primary border border-primary/30" : "hover:bg-muted text-muted-foreground"
                              }`}
                            >
                              <span className="truncate flex-1">{q.label || "Untitled Question"}</span>
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                {q.isAutoPrefill && <RefreshCw className="h-3 w-3 text-emerald-500" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Middle Panel: Sections & Question Cards Canvas */}
            <div className="lg:col-span-6 space-y-4">
              {sections.map((sec, sIdx) => {
                const secQuestions = getQuestionsForSection(sec.id, sIdx);
                const isCollapsed = collapsedSections[sec.id];
                return (
                  <Card key={sec.id} className="border-border/80 shadow-sm">
                    <CardHeader className="p-3 bg-muted/40 border-b border-border/50 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button onClick={() => toggleSectionCollapse(sec.id)} className="text-muted-foreground hover:text-foreground">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <Input
                          value={sec.title}
                          onChange={(e) => {
                            const title = e.target.value;
                            setSections((prev) => prev.map((s) => (s.id === sec.id ? { ...s, title } : s)));
                          }}
                          className="h-8 text-sm font-bold bg-transparent border-transparent hover:border-border focus:border-primary"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); moveSection(sIdx, -1); }}
                          disabled={sIdx === 0}
                          className="h-7 w-7 p-0"
                          title="Move Section Up"
                          data-testid={`move-section-up-${sec.id}`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); moveSection(sIdx, 1); }}
                          disabled={sIdx === sections.length - 1}
                          className="h-7 w-7 p-0"
                          title="Move Section Down"
                          data-testid={`move-section-down-${sec.id}`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); shuffleSectionQuestions(sec.id); }}
                          className="h-7 px-2 text-xs gap-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          title="Shuffle / Randomize question order in this section"
                          data-testid={`shuffle-section-${sec.id}`}
                        >
                          <Shuffle className="h-3.5 w-3.5" />
                          Shuffle Qs
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => addQuestionToSection(sec.id)} className="h-7 text-xs gap-1 text-primary">
                          <Plus className="h-3.5 w-3.5" />
                          Add Question
                        </Button>
                      </div>
                    </CardHeader>
                    {!isCollapsed && (
                      <CardContent className="p-3 space-y-3">
                        {secQuestions.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-border/60 rounded-md">
                            <p className="text-xs text-muted-foreground">No questions in this section yet.</p>
                            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => addQuestionToSection(sec.id)}>
                              + Add First Question
                            </Button>
                          </div>
                        ) : (
                          secQuestions.map((it, idx) => {
                            const IconComp = TYPE_ICON[it.type] || ToggleLeft;
                            return (
                              <div
                                id={`q-card-${it.id}`}
                                key={it.id}
                                onClick={() => setSelectedItemId(it.id)}
                                className={`p-3 rounded-lg border transition-all cursor-pointer space-y-2 ${
                                  selectedItemId === it.id ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm" : "border-border/60 hover:border-border"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <IconComp className="h-4 w-4 text-primary shrink-0" />
                                    <Input
                                      value={it.label}
                                      onChange={(e) => {
                                        const label = e.target.value;
                                        setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, label } : i)));
                                      }}
                                      placeholder="Question prompt or field title..."
                                      className="h-8 text-xs font-medium"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveQuestionInSec(secQuestions, idx, -1);
                                      }}
                                      disabled={idx === 0}
                                      className="h-7 w-7 p-0"
                                      title="Move Question Up"
                                      data-testid={`move-question-up-${it.id}`}
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveQuestionInSec(secQuestions, idx, 1);
                                      }}
                                      disabled={idx === secQuestions.length - 1}
                                      className="h-7 w-7 p-0"
                                      title="Move Question Down"
                                      data-testid={`move-question-down-${it.id}`}
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>

                                    <Select
                                      value={it.type}
                                      onValueChange={(v: any) => setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, type: v } : i)))}
                                    >
                                      <SelectTrigger className="h-7 text-[11px] w-36">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CHECKLIST_QUESTION_TYPES.map((t) => (
                                          <SelectItem key={t.value} value={t.value} className="text-xs">
                                            {t.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant={selectedItemId === it.id ? "default" : "outline"}
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItemId(it.id);
                                      }}
                                      className={`h-7 px-2.5 text-xs gap-1 font-semibold transition-colors ${
                                        selectedItemId === it.id
                                          ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-sm"
                                          : "border-primary/40 text-primary bg-background hover:bg-primary/10 hover:text-primary"
                                      }`}
                                      title="Edit question logic, options, and parameters"
                                      data-testid={`edit-question-${it.id}`}
                                    >
                                      <Pencil className={`h-3.5 w-3.5 ${selectedItemId === it.id ? "text-primary-foreground" : "text-primary"}`} />
                                      <span>Edit</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        duplicateQuestion(it);
                                      }}
                                      className="h-7 w-7 p-0"
                                      title="Duplicate Question"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteQuestion(it.id);
                                      }}
                                      className="h-7 w-7 p-0 text-destructive"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                {it.conditionalOnQuestionId && (
                                   <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded w-fit border border-indigo-500/20">
                                     <GitBranch className="h-3 w-3 shrink-0" />
                                     <span>Follow-up Q (Ask if parent answer = "{it.conditionalValue || 'Yes'}")</span>
                                   </div>
                                 )}

                                 {it.helpText && (
                                   <p className="text-[11px] text-muted-foreground italic pl-6">{it.helpText}</p>
                                 )}

                                 {it.options && it.options.length > 0 && (
                                   <div className="flex flex-wrap gap-1 pl-6 pt-0.5">
                                     {it.options.map((opt, oIdx) => (
                                       <Badge key={oIdx} variant="secondary" className="text-[10px] bg-muted/60 font-normal">
                                         {opt}
                                       </Badge>
                                     ))}
                                   </div>
                                 )}

                                 {it.isAutoPrefill && (
                                   <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded w-fit ml-6">
                                     <RefreshCw className="h-3 w-3" />
                                     <span>Auto-Prefill Key: {it.prefillSourceKey || "health_facility"}</span>
                                   </div>
                                 )}
                               </div>
                             );
                           })
                         )}
                       </CardContent>
                     )}
                   </Card>
                 );
               })}
             </div>

            {/* Right Panel: Selected Question Settings & Logic Drawer */}
            <Card className="lg:col-span-3 border-border/60 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto shadow-sm">
              <CardHeader className="p-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-primary" />
                  Question Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-4">
                {selectedItem ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                        <Layers className="h-3.5 w-3.5" />
                        Section Location
                      </Label>
                      <Select
                        value={selectedItem.sectionId}
                        onValueChange={(targetSecId) => {
                          setItems((prev) =>
                            prev.map((i) => (i.id === selectedItem.id ? { ...i, sectionId: targetSecId } : i))
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1 bg-background" data-testid="select-drawer-section">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Question Prompt Label</Label>
                      <Textarea
                        value={selectedItem.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, label } : i)));
                        }}
                        placeholder="Question prompt or field title..."
                        className="text-xs mt-1 h-14 font-medium"
                        data-testid="input-drawer-question-label"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Question Type</Label>
                      <Select
                        value={normalizeQuestionType(selectedItem.type)}
                        onValueChange={(v: any) =>
                          setItems((prev) =>
                            prev.map((i) => (i.id === selectedItem.id ? { ...i, type: v as ChecklistQuestionType } : i))
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-1 bg-background" data-testid="select-drawer-question-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKLIST_QUESTION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label} ({t.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(normalizeQuestionType(selectedItem.type) === "single_select" ||
                      normalizeQuestionType(selectedItem.type) === "multi_select") && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Choice Options (Pipe | Separated)</Label>
                        <Textarea
                          value={selectedItem.options ? selectedItem.options.join(" | ") : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const options = raw
                              .split("|")
                              .map((o) => o.trim())
                              .filter(Boolean);
                            setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, options } : i)));
                          }}
                          placeholder="Option 1 | Option 2 | Option 3"
                          className="text-xs h-16 font-mono"
                          data-testid="input-drawer-options"
                        />
                        <p className="text-[10px] text-muted-foreground">Separate each choice with a vertical bar (|).</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-semibold">Short Field Label</Label>
                      <Input
                        value={selectedItem.shortLabel || ""}
                        onChange={(e) => {
                          const shortLabel = e.target.value;
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, shortLabel } : i)));
                        }}
                        placeholder="e.g. Fridge Temp"
                        className="h-8 text-xs mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Instructions / Help Text</Label>
                      <Textarea
                        value={selectedItem.helpText || ""}
                        onChange={(e) => {
                          const helpText = e.target.value;
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, helpText } : i)));
                        }}
                        placeholder="Instructions for the supervisor..."
                        className="text-xs mt-1 h-14"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <Label className="text-xs">Required Field</Label>
                      <Switch
                        checked={!!selectedItem.required}
                        onCheckedChange={(checked) =>
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, required: checked } : i)))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <Label className="text-xs">Include in Scoring</Label>
                      <Switch
                        checked={selectedItem.includeInScore !== false}
                        onCheckedChange={(checked) =>
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, includeInScore: checked } : i)))
                        }
                      />
                    </div>

                    {/* Follow-up / Conditional Display Logic */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <Label className="text-xs font-semibold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <GitBranch className="h-3.5 w-3.5" />
                        Follow-Up / Conditional Display
                      </Label>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Parent Question (Condition)</Label>
                        <Select
                          value={selectedItem.conditionalOnQuestionId || "none"}
                          onValueChange={(v) => {
                            const val = v === "none" ? null : v;
                            setItems((prev) =>
                              prev.map((i) => (i.id === selectedItem.id ? { ...i, conditionalOnQuestionId: val } : i))
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-drawer-conditional-parent">
                            <SelectValue placeholder="No parent condition (Always show)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs text-muted-foreground">
                              None (Always Visible)
                            </SelectItem>
                            {items
                              .filter((i) => i.id !== selectedItem.id)
                              .map((i) => (
                                <SelectItem key={i.id} value={i.id} className="text-xs truncate">
                                  {i.label.length > 50 ? i.label.slice(0, 50) + "..." : i.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedItem.conditionalOnQuestionId && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Show when Parent Answer equals</Label>
                          <Input
                            value={selectedItem.conditionalValue || ""}
                            onChange={(e) => {
                              const conditionalValue = e.target.value;
                              setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, conditionalValue } : i)));
                            }}
                            placeholder="e.g. Yes or No"
                            className="h-8 text-xs mt-1"
                            data-testid="input-drawer-conditional-value"
                          />
                        </div>
                      )}
                    </div>

                    {/* Auto-Prefill Config */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 text-emerald-500" />
                          Auto-Prefill Field
                        </Label>
                        <Switch
                          checked={!!selectedItem.isAutoPrefill || selectedItem.type === "auto_prefill"}
                          onCheckedChange={(checked) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.id === selectedItem.id
                                  ? { ...i, isAutoPrefill: checked }
                                  : i
                              )
                            )
                          }
                        />
                      </div>
                      {(selectedItem.isAutoPrefill || selectedItem.type === "auto_prefill") && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Select Prefill Source</Label>
                          <Select
                            value={selectedItem.prefillSourceKey || "health_facility"}
                            onValueChange={(v: any) =>
                              setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, prefillSourceKey: v } : i)))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PREFILL_SOURCE_KEYS.map((k) => (
                                <SelectItem key={k.key} value={k.key} className="text-xs">
                                  {k.label} ({k.group})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Select a question card to edit its type, follow-up logic, choices, and scoring parameters.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Checklist Supervisor Simulation Preview
            </DialogTitle>
            <DialogDescription>Interactive preview of how supervisors will complete this checklist on mobile and desktop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <span className="text-xs text-muted-foreground">Simulated Risk Score</span>
                <div className="font-bold text-lg">{previewScore}%</div>
              </div>
              <Badge className={`bg-${risk.color}-500/10 text-${risk.color}-600 border-${risk.color}-500/30`}>{risk.label}</Badge>
            </div>
            <ScrollArea className="h-64 space-y-3 p-2 border rounded-md">
              {items.map((it) => (
                <div key={it.id} className="p-2 border-b text-xs space-y-1">
                  <div className="font-semibold">{it.label || "Untitled Question"}</div>
                  <Badge variant="outline" className="text-[9px]">
                    {typeLabel(it.type)}
                  </Badge>
                </div>
              ))}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Import Supervision Checklist / Questions Modal ───────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
              <FileUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Import Supervision Checklist & Questions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Upload a CSV, Excel (.xlsx, .xls) or JSON file containing checklist questions and sections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 rounded-2xl p-6 text-center space-y-3 bg-indigo-50/20 dark:bg-indigo-950/10">
              <Upload className="h-8 w-8 mx-auto text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-semibold">Select File to Import Questions</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => {
                  handleSupervisionFile(e);
                  if (e.target) e.target.value = "";
                }}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" /> Browse CSV / Excel / JSON
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-emerald-600 dark:text-emerald-400"
                onClick={() => window.open("/api/supervision/templates/import-template", "_self")}
              >
                <Download className="h-3.5 w-3.5" /> Download Sample CSV Template
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Checklist Confirmation Dialog */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Checklist Template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deletingTemplate?.name}"</strong>? This will permanently remove the entire supervision checklist and all its authored questions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplate?.id && deleteMutation.mutate(deletingTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-checklist"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Checklist"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
