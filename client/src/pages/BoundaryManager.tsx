/**
 * Boundary Manager — Admin page for national_admin users
 *
 * Allows loading admin boundary GeoJSON for any country at any admin level:
 * - One-click fetch from GeoBoundaries API (covers 200+ countries, no download needed)
 * - Manual GeoJSON upload for GADM / OCHA HDX / custom shapefiles
 * - Configurable admin levels per country (1-5 levels)
 * - Active boundary list with level, source, feature count, and refresh
 *
 * Route: /admin/boundaries
 */

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, Layers, Download, Upload, RefreshCw, Trash2,
  AlertCircle, CheckCircle, MapPin, Info, ExternalLink, Database,
} from "lucide-react";

interface SupportedCountry {
  code: string;
  name: string;
  region: string;
  maxLevel: number;
  levelNames: Record<number, string>;
}

interface BoundaryMeta {
  id: string;
  adminLevel: number;
  levelName: string;
  source: string;
  countryCode: string;
  featureCount: number | null;
  isActive: boolean;
  fetchedAt: string | null;
  createdAt: string | null;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  geoboundaries: { label: "GeoBoundaries API", color: "bg-blue-500/10 text-blue-600" },
  gadm: { label: "GADM", color: "bg-purple-500/10 text-purple-600" },
  ocha_hdx: { label: "OCHA HDX", color: "bg-orange-500/10 text-orange-600" },
  natural_earth: { label: "Natural Earth", color: "bg-emerald-500/10 text-emerald-600" },
  custom: { label: "Custom Upload", color: "bg-gray-500/10 text-gray-600" },
};

function BoundaryRow({ boundary, onDelete }: { boundary: BoundaryMeta; onDelete: (id: string) => void }) {
  const src = SOURCE_LABELS[boundary.source] ?? SOURCE_LABELS.custom;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0 group">
      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-primary">L{boundary.adminLevel}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{boundary.levelName}</span>
          <Badge variant="secondary" className="font-mono text-xs">{boundary.countryCode}</Badge>
          <Badge variant="secondary" className={`text-xs ${src.color}`}>{src.label}</Badge>
          {boundary.isActive && (
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">Active</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {boundary.featureCount?.toLocaleString() ?? "?"} features
          </span>
          {boundary.fetchedAt && (
            <span className="text-xs text-muted-foreground">
              Fetched {new Date(boundary.fetchedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
        onClick={() => onDelete(boundary.id)}
        data-testid={`button-delete-boundary-${boundary.id}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function BoundaryManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dialog state
  const [fetchOpen, setFetchOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountry | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [levelName, setLevelName] = useState("");

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCountryCode, setUploadCountryCode] = useState("");
  const [uploadLevel, setUploadLevel] = useState("1");
  const [uploadLevelName, setUploadLevelName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // CSV Upload dialog state
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [csvUploadFile, setCsvUploadFile] = useState<File | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Updated queries with offline fallbacks:
  const { data: countries, isLoading: loadingCountries } = useQuery<SupportedCountry[]>({
    queryKey: ["/api/boundaries/countries"],
    queryFn: async () => {
      if (!navigator.onLine) return [];
      const res = await fetch("/api/boundaries/countries");
      if (!res.ok) throw new Error("Failed to fetch supported countries");
      return res.json();
    }
  });

  const { data: boundaries, isLoading: loadingBoundaries } = useQuery<BoundaryMeta[]>({
    queryKey: ["/api/boundaries"],
    queryFn: async () => {
      if (!navigator.onLine) return [];
      const res = await fetch("/api/boundaries");
      if (!res.ok) throw new Error("Failed to fetch boundaries");
      return res.json();
    }
  });

  const fetchMutation = useMutation({
    mutationFn: async (payload: { countryCode: string; adminLevel: number; levelName: string }) =>
      apiRequest("POST", "/api/boundaries/fetch", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/boundaries"] });
      setFetchOpen(false);
      toast({ title: "Boundary loaded successfully", description: `${selectedCountry?.name} Level ${selectedLevel} admin boundaries are now available on the map.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to load boundary", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: object) => apiRequest("POST", "/api/boundaries/upload", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/boundaries"] });
      setUploadOpen(false);
      setUploadFile(null);
      toast({ title: "GeoJSON uploaded successfully", description: "Admin boundaries are now available on the map." });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const csvUploadMutation = useMutation({
    mutationFn: async (hqs: any[]) => apiRequest("POST", "/api/boundaries/hq-upload", { hqs }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/boundaries"] });
      setCsvUploadOpen(false);
      setCsvUploadFile(null);
      toast({ title: "HQ Coordinates Uploaded", description: `Updated ${data.updatedProvinces || 0} provinces and ${data.updatedDistricts || 0} districts.` });
    },
    onError: (err: Error) => {
      toast({ title: "CSV Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCsvUpload = () => {
    if (!csvUploadFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        
        const parseLine = (line: string) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          return result;
        };

        const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
        const hqs = [];
        
        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]).map(c => c.trim());
          const levelIdx = headers.findIndex(h => h.includes('level'));
          const nameIdx = headers.findIndex(h => h.includes('office name') || h === 'name');
          const latIdx = headers.findIndex(h => h === 'latitude' || h === 'lat');
          const lngIdx = headers.findIndex(h => h === 'longitude' || h === 'lng' || h === 'long');
          
          if (levelIdx !== -1 && nameIdx !== -1 && latIdx !== -1 && lngIdx !== -1) {
             const lat = parseFloat(cols[latIdx]);
             const lng = parseFloat(cols[lngIdx]);
             if (!isNaN(lat) && !isNaN(lng)) {
               hqs.push({
                 level: cols[levelIdx],
                 name: cols[nameIdx].replace("Provincial Health Office", "").replace("District Health Office", "").trim(),
                 lat,
                 lng
               });
             }
          }
        }
        
        if (hqs.length === 0) {
          toast({ title: "No valid rows found", description: "Ensure the CSV has columns: Office Level, Office Name, Latitude, Longitude", variant: "destructive" });
          return;
        }
        
        csvUploadMutation.mutate(hqs);
      } catch (err) {
        toast({ title: "Failed to parse CSV", variant: "destructive" });
      }
    };
    reader.readAsText(csvUploadFile);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/boundaries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/boundaries"] });
      setDeleteId(null);
      toast({ title: "Boundary removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCountrySelect = (code: string) => {
    const country = countries?.find((c) => c.code === code) ?? null;
    setSelectedCountry(country);
    if (country) {
      setSelectedLevel(1);
      setLevelName(country.levelNames[1] ?? "Region");
    }
  };

  const handleLevelSelect = (level: number) => {
    setSelectedLevel(level);
    if (selectedCountry) {
      setLevelName(selectedCountry.levelNames[level] ?? `Level ${level}`);
    }
  };

  const handleFetch = () => {
    if (!selectedCountry || !levelName) return;
    fetchMutation.mutate({
      countryCode: selectedCountry.code,
      adminLevel: selectedLevel,
      levelName: levelName.trim(),
    });
  };

  const handleFileRead = async () => {
    if (!uploadFile) return;
    const code = uploadCountryCode.trim().toUpperCase();
    if (code.length !== 3) {
      toast({
        title: "Country code must be 3 letters",
        description: `"${code || "(empty)"}" is not a valid ISO 3166-1 alpha-3 code.`,
        variant: "destructive",
      });
      return;
    }
    if (!uploadLevelName.trim()) {
      toast({ title: "Level label required", description: "Enter a label such as Country, Province, District.", variant: "destructive" });
      return;
    }
    try {
      const text = await uploadFile.text();
      const geojson = JSON.parse(text);
      uploadMutation.mutate({
        countryCode: code,
        adminLevel: parseInt(uploadLevel),
        levelName: uploadLevelName.trim(),
        geojson,
      });
    } catch {
      toast({ title: "Invalid GeoJSON", description: "The file could not be parsed as GeoJSON.", variant: "destructive" });
    }
  };

  const regions = Array.from(new Set((countries ?? []).map((c) => c.region))).sort();
  const grouped = regions.map((region) => ({
    region,
    countries: (countries ?? []).filter((c) => c.region === region).sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Admin Boundary Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Load GIS administrative boundaries for any country.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvUploadOpen(true)} className="gap-2" data-testid="button-upload-csv">
            <MapPin className="h-4 w-4" /> Upload HQ CSV
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)} className="gap-2" data-testid="button-upload-boundary">
            <Upload className="h-4 w-4" /> Upload GeoJSON
          </Button>
          <Button onClick={() => setFetchOpen(true)} className="gap-2" data-testid="button-fetch-boundary">
            <Globe className="h-4 w-4" /> Fetch from GeoBoundaries
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Loaded Boundary Datasets
                {!loadingBoundaries && (
                  <Badge variant="secondary" className="text-xs">{boundaries?.length ?? 0}</Badge>
                )}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["/api/boundaries"] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBoundaries ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !boundaries || boundaries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No boundaries loaded yet.</p>
            </div>
          ) : (
            <div>
              {boundaries.map((b) => (
                <BoundaryRow key={b.id} boundary={b} onDelete={setDeleteId} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={fetchOpen} onOpenChange={setFetchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Fetch from GeoBoundaries API
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <Select onValueChange={handleCountrySelect}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="Select country…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {grouped.map(({ region, countries: regionCountries }) => (
                    <SelectGroup key={region}>
                      <SelectLabel className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">{region}</SelectLabel>
                      {regionCountries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} <span className="text-muted-foreground ml-1 text-xs font-mono">({c.code})</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCountry && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Admin Level</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: selectedCountry.maxLevel + 1 }, (_, i) => i).map((lvl) => (
                      <Button
                        key={lvl}
                        size="sm"
                        variant={selectedLevel === lvl ? "default" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => handleLevelSelect(lvl)}
                        data-testid={`button-level-${lvl}`}
                      >
                        L{lvl} — {selectedCountry.levelNames[lvl] ?? `Level ${lvl}`}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="level-name" className="text-xs">Level Label</Label>
                  <Input
                    id="level-name"
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFetchOpen(false)}>Cancel</Button>
            <Button
              onClick={handleFetch}
              disabled={!selectedCountry || !levelName || fetchMutation.isPending}
            >
              {fetchMutation.isPending ? "Fetching…" : "Fetch Boundaries"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Boundary GeoJSON
            </DialogTitle>
            <DialogDescription>
              Upload administrative boundaries manually. Files must be .geojson or .json containing a valid FeatureCollection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Country Code (ISO 3166-1 alpha-3)</Label>
              <Input
                placeholder="e.g. ZMB, PNG"
                value={uploadCountryCode}
                onChange={(e) => setUploadCountryCode(e.target.value.toUpperCase())}
                maxLength={3}
                data-testid="input-upload-country"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Admin Level</Label>
              <Select value={uploadLevel} onValueChange={setUploadLevel}>
                <SelectTrigger data-testid="select-upload-level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-level-name" className="text-xs">Level Name</Label>
              <Input
                id="up-level-name"
                value={uploadLevelName}
                onChange={(e) => setUploadLevelName(e.target.value)}
                placeholder="e.g. Province, District, LLG"
                data-testid="input-upload-level-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">GeoJSON File (.geojson or .json)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <span className="text-muted-foreground">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-muted-foreground">Drop a GeoJSON file or click to browse</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                data-testid="input-geojson-file"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleFileRead}
              disabled={!uploadFile || !uploadCountryCode || !uploadLevelName || uploadMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload & Store</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Upload HQ CSV Dialog ──────────────────────────────── */}
      <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Upload HQ Coordinates (CSV)
            </DialogTitle>
            <DialogDescription>
              Upload a CSV containing HQ coordinates for provinces and districts.
              Required columns: Office Level, Office Name, Latitude, Longitude.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">CSV File (.csv)</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvUploadFile(e.target.files?.[0] || null)}
                className="text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCsvUpload}
              disabled={!csvUploadFile || csvUploadMutation.isPending}
            >
              {csvUploadMutation.isPending ? "Processing..." : "Update Coordinates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove boundary dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the stored GeoJSON for this admin level. The boundary will disappear from the map.
              You can re-fetch it at any time from GeoBoundaries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
