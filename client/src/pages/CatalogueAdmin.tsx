import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Download, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CatalogueItemDialog } from "@/components/CatalogueItemDialog";

const TABS = [
  { id: "vaccines", label: "Vaccine Products", type: "vaccine" },
  { id: "schedules", label: "Schedule Doses", type: "schedule" },
  { id: "wastage", label: "Wastage Thresholds", type: "wastage" },
  { id: "diluents", label: "Diluents", type: "diluent" },
  { id: "syringes", label: "Injection Devices", type: "syringe" },
  { id: "safety_boxes", label: "Safety Boxes", type: "safety_box" },
  { id: "ppe", label: "PPE", type: "ppe" },
  { id: "cold_chain", label: "Cold Chain", type: "cold_chain" },
  { id: "recording_tools", label: "Recording Tools", type: "recording_tools" },
  { id: "it_equipment", label: "IT Equipment", type: "it_equipment" },
  { id: "transport", label: "Transport", type: "transport" },
  { id: "stationaries", label: "Stationaries", type: "stationaries" },
  { id: "social_mob", label: "Social Mob. Materials", type: "social_mob" },
  { id: "other", label: "Other Commodities", type: "other" }
];

export default function CatalogueAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("vaccines");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const currentTabType = TABS.find(t => t.id === activeTab)?.type || "vaccine";

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const { data: vaccines = [], isLoading: loadingVaccines } = useQuery<any[]>({
    queryKey: ["/api/catalogue/vaccines"],
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<any[]>({
    queryKey: ["/api/catalogue/schedules"],
  });

  const { data: commodities = [], isLoading: loadingCommodities } = useQuery<any[]>({
    queryKey: ["/api/catalogue/commodities"],
  });

  const { data: wastage = [], isLoading: loadingWastage } = useQuery<any[]>({
    queryKey: ["/api/catalogue/wastage-thresholds"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/catalogue/seed", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catalogue Seeded", description: "Default WHO immunization products and commodities loaded." });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/vaccines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/commodities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/catalogue/wastage-thresholds"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Seeding Failed", description: err.message });
    }
  });

  const handleSeed = () => {
    if (confirm("This will load the default WHO immunization products into your catalogue. Continue?")) {
      seedMutation.mutate();
    }
  };

  const renderVaccines = () => (
    <Card>
      <CardHeader>
        <CardTitle>Physical Vaccine Products</CardTitle>
        <CardDescription>Inventory items managed in the stock ledger.</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingVaccines ? <Skeleton className="h-20 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Antigen</TableHead>
                <TableHead>Doses/Vial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vaccines.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.productId}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.antigenName}</TableCell>
                  <TableCell>{v.dosesPerVial}</TableCell>
                  <TableCell>
                    <Badge variant={v.approvalStatus === 'published' ? 'default' : 'secondary'}>{v.approvalStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}><Edit2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {vaccines.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vaccines found. Click "Seed Default Catalogue" to start.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderSchedules = () => (
    <Card>
      <CardHeader>
        <CardTitle>Immunization Schedule Doses</CardTitle>
        <CardDescription>Individual doses administered to patients (e.g. PENTA-1).</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingSchedules ? <Skeleton className="h-20 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dose Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Dose #</TableHead>
                <TableHead>Target Pop</TableHead>
                <TableHead>Linked Vaccine</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.doseCode}</TableCell>
                  <TableCell>{s.doseNumber}</TableCell>
                  <TableCell className="capitalize">{s.targetPopulationGroup}</TableCell>
                  <TableCell>{vaccines.find((v: any) => v.id === s.vaccineId)?.name || 'Unknown'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schedules found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderWastage = () => (
    <Card>
      <CardHeader>
        <CardTitle>Wastage Thresholds</CardTitle>
        <CardDescription>Target maximum wastage rates per vaccine.</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingWastage ? <Skeleton className="h-20 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vaccine</TableHead>
                <TableHead>Wastage Rate (%)</TableHead>
                <TableHead>Wastage Factor</TableHead>
                <TableHead>Min Acceptable (%)</TableHead>
                <TableHead>Max Acceptable (%)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wastage.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{vaccines.find((v: any) => v.id === w.vaccineId)?.name || 'Unknown'}</TableCell>
                  <TableCell>{w.wastageRate}%</TableCell>
                  <TableCell>{w.wastageFactor}</TableCell>
                  <TableCell>{w.minAcceptable}%</TableCell>
                  <TableCell>{w.maxAcceptable}%</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(w)}><Edit2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {wastage.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No thresholds found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderCommodities = (type: string) => {
    const items = commodities.filter(c => c.type === type);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{type.replace('_', ' ')}</CardTitle>
          <CardDescription>Manage {type.replace('_', ' ')} logistics and inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCommodities ? <Skeleton className="h-20 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Pack Size</TableHead>
                  <TableHead>Stock Managed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.commodityCode}</TableCell>
                    <TableCell>{c.packSize}</TableCell>
                    <TableCell>{c.stockManaged ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No items found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Country Immunization Catalogue</h1>
          <p className="text-muted-foreground mt-1">Single source of truth for vaccines, schedules, and logistics globally.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending}>
            <Download className="h-4 w-4 mr-2" /> Seed Default Catalogue
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ScrollArea className="w-full pb-3 border-b">
          <TabsList className="mb-0 flex w-max min-w-full space-x-1 justify-start">
            {TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="mt-6">
          <TabsContent value="vaccines">{renderVaccines()}</TabsContent>
          <TabsContent value="schedules">{renderSchedules()}</TabsContent>
          <TabsContent value="wastage">{renderWastage()}</TabsContent>
          {TABS.filter(t => !['vaccines', 'schedules', 'wastage'].includes(t.id)).map(tab => (
            <TabsContent key={tab.id} value={tab.id}>{renderCommodities(tab.type)}</TabsContent>
          ))}
        </div>
      </Tabs>

      <CatalogueItemDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        activeTabType={currentTabType}
        item={editingItem}
      />
    </div>
  );
}
