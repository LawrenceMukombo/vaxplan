import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTabType: string;
  item?: any;
}

const getTabMeta = (type: string) => {
  switch (type) {
    case "vaccine":
      return {
        title: "Vaccine Product",
        namePlaceholder: "e.g. Measles-Rubella (MR) Vaccine",
        codePlaceholder: "e.g. vaccine_mr",
        category: "Vaccines",
      };
    case "schedule":
      return {
        title: "Schedule Dose",
        namePlaceholder: "e.g. MR-1 (9 Months)",
        codePlaceholder: "e.g. mr_1",
        category: "Schedule Doses",
      };
    case "wastage":
      return {
        title: "Wastage Threshold",
        namePlaceholder: "",
        codePlaceholder: "",
        category: "Wastage Thresholds",
      };
    case "diluent":
      return {
        title: "Diluent",
        namePlaceholder: "e.g. MR Vaccine Diluent 10-dose",
        codePlaceholder: "e.g. diluent_mr",
        category: "Diluents",
      };
    case "syringe":
      return {
        title: "Injection Device",
        namePlaceholder: "e.g. Auto-Disable Syringe 0.5ml",
        codePlaceholder: "e.g. syringe_ad_05ml",
        category: "Injection Devices",
      };
    case "safety_box":
      return {
        title: "Safety Box",
        namePlaceholder: "e.g. Safety Box 5 Litre",
        codePlaceholder: "e.g. safety_box_5l",
        category: "Safety Boxes",
      };
    case "ppe":
      return {
        title: "PPE Item",
        namePlaceholder: "e.g. Surgical Gloves (Large)",
        codePlaceholder: "e.g. ppe_gloves_l",
        category: "PPE",
      };
    case "cold_chain":
      return {
        title: "Cold Chain Equipment",
        namePlaceholder: "e.g. Vaccine Carrier 1.6L",
        codePlaceholder: "e.g. cold_carrier_16l",
        category: "Cold Chain",
      };
    case "recording_tools":
      return {
        title: "Recording Tool",
        namePlaceholder: "e.g. Daily Immunization Tallysheet",
        codePlaceholder: "e.g. rec_tallysheet",
        category: "Recording Tools",
      };
    case "it_equipment":
      return {
        title: "IT Equipment",
        namePlaceholder: 'e.g. Tablet 10" for Digital Registry',
        codePlaceholder: "e.g. it_tablet_10",
        category: "IT Equipment",
      };
    case "transport":
      return {
        title: "Transport Asset",
        namePlaceholder: "e.g. Motorcycle for Outreach Visits",
        codePlaceholder: "e.g. trsp_motorcycle",
        category: "Transport",
      };
    case "stationaries":
      return {
        title: "Stationery Item",
        namePlaceholder: "e.g. Permanent Markers (Pack of 10)",
        codePlaceholder: "e.g. stat_markers",
        category: "Stationery",
      };
    case "social_mob":
      return {
        title: "Social Mobilization Material",
        namePlaceholder: "e.g. Immunization Poster (A2)",
        codePlaceholder: "e.g. sm_poster_a2",
        category: "Social Mobilization",
      };
    default:
      return {
        title: "Commodity Item",
        namePlaceholder: "e.g. Cotton Wool (500g Roll)",
        codePlaceholder: "e.g. oth_cotton_wool",
        category: "Other Commodities",
      };
  }
};

export function CatalogueItemDialog({ open, onOpenChange, activeTabType, item }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!item;
  const tabMeta = getTabMeta(activeTabType);

  // Fetch vaccines list for dropdowns (linking schedule doses, wastage thresholds, or diluents)
  const { data: vaccines = [] } = useQuery<any[]>({
    queryKey: ["/api/catalogue/vaccines"],
    enabled: open && ["schedule", "wastage", "diluent"].includes(activeTabType),
  });

  let endpoint = "";
  let queryKey = "";
  let defaultValues: any = {};

  if (activeTabType === "vaccine") {
    endpoint = "/api/catalogue/vaccines";
    queryKey = "/api/catalogue/vaccines";
    defaultValues = item
      ? { ...item }
      : {
          productId: "",
          name: "",
          antigenName: "",
          category: "Vaccines",
          presentation: "Liquid",
          dosesPerVial: 10,
          unitOfMeasure: "vials",
          storageTemperature: "+2 to +8 °C",
          wastageThreshold: "10.00",
          approvalStatus: "published",
          active: true,
          stockManaged: true,
          forecastable: true,
          requisitionable: true,
          requiresInjectionDevice: true,
          requiresSafetyBox: true,
          requiresDiluent: false,
          routineUse: true,
          campaignUse: false,
          outbreakUse: false,
        };
  } else if (activeTabType === "schedule") {
    endpoint = "/api/catalogue/schedules";
    queryKey = "/api/catalogue/schedules";
    defaultValues = item
      ? { ...item }
      : {
          doseCode: "",
          name: "",
          doseNumber: 1,
          vaccineId: vaccines[0]?.id || "",
          targetAge: "infants",
          minimumAge: "0",
          maximumAge: "365",
          minimumInterval: "28",
          targetPopulationGroup: "infants",
          route: "Intramuscular",
          site: "Anterolateral thigh",
          classification: "routine",
          stockDeducting: true,
          approvalStatus: "published",
          active: true,
        };
  } else if (activeTabType === "wastage") {
    endpoint = "/api/catalogue/wastage-thresholds";
    queryKey = "/api/catalogue/wastage-thresholds";
    defaultValues = item
      ? { ...item }
      : {
          vaccineId: vaccines[0]?.id || "",
          wastageRate: "10.00",
          wastageFactor: "1.11",
          minAcceptable: "0.00",
          maxAcceptable: "15.00",
          strategy: "routine",
          notes: "",
          active: true,
        };
  } else {
    // Commodity item
    endpoint = "/api/catalogue/commodities";
    queryKey = "/api/catalogue/commodities";
    defaultValues = item
      ? { ...item }
      : {
          type: activeTabType,
          commodityCode: "",
          name: "",
          category: tabMeta.category,
          unitOfMeasure: "pieces",
          packSize: 100,
          bufferPercentage: "10.00",
          minimumStockThreshold: 0,
          maximumStockThreshold: 0,
          reorderLevel: 0,
          stockManaged: true,
          forecastable: true,
          requisitionable: true,
          sessionSupply: true,
          linkedVaccineId: null,
          active: true,
        };
  }

  const form = useForm({ defaultValues });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, item, activeTabType]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing ? `${endpoint}/${item.id}` : endpoint;
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMessage = "Save failed";
        try {
          const parsedErr = await res.json();
          errMessage = parsedErr.error || parsedErr.message || JSON.stringify(parsedErr);
        } catch {
          errMessage = await res.text();
        }
        throw new Error(errMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Catalogue item saved successfully." });
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error Saving Item", description: err.message });
    },
  });

  const onSubmit = (rawData: any) => {
    const data = { ...rawData };

    // Explicit type coercion & numerical formatting
    if (data.dosesPerVial !== undefined) data.dosesPerVial = Number(data.dosesPerVial) || 1;
    if (data.doseNumber !== undefined) data.doseNumber = Number(data.doseNumber) || 1;
    if (data.vaccineId !== undefined && data.vaccineId !== "") data.vaccineId = Number(data.vaccineId);
    if (!data.linkedVaccineId || data.linkedVaccineId === "none" || data.linkedVaccineId === "0" || data.linkedVaccineId === 0) {
      data.linkedVaccineId = null;
    } else {
      data.linkedVaccineId = Number(data.linkedVaccineId);
    }
    if (data.packSize !== undefined) data.packSize = Number(data.packSize) || 1;
    if (data.minimumStockThreshold !== undefined) data.minimumStockThreshold = Number(data.minimumStockThreshold) || 0;
    if (data.maximumStockThreshold !== undefined) data.maximumStockThreshold = Number(data.maximumStockThreshold) || 0;
    if (data.reorderLevel !== undefined) data.reorderLevel = Number(data.reorderLevel) || 0;

    if (data.active === undefined) data.active = true;

    // Ensure default empty objects for jsonb fields
    if (!data.modules) data.modules = {};
    if (!data.consumptionRule) data.consumptionRule = {};

    // Ensure type matches active tab for commodities
    if (!["vaccine", "schedule", "wastage"].includes(activeTabType)) {
      data.type = activeTabType;
    }

    saveMutation.mutate(data);
  };

  const isCommodity = !["vaccine", "schedule", "wastage"].includes(activeTabType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"} {tabMeta.title}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* COMMON NAME FIELD */}
            {activeTabType !== "wastage" && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder={tabMeta.namePlaceholder} {...field} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ── VACCINE FIELDS ────────────────────────────────── */}
            {activeTabType === "vaccine" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Code / ID</FormLabel>
                        <FormControl>
                          <Input placeholder={tabMeta.codePlaceholder} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="antigenName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Antigen Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Measles-Rubella" {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="presentation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Presentation</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Liquid">Liquid</SelectItem>
                            <SelectItem value="Lyophilized">Lyophilized</SelectItem>
                            <SelectItem value="Pre-filled Syringe">Pre-filled Syringe</SelectItem>
                            <SelectItem value="Oral Drops">Oral Drops</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dosesPerVial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doses Per Vial</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unitOfMeasure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <FormControl>
                          <Input placeholder="vials" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="storageTemperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Storage Temperature</FormLabel>
                        <FormControl>
                          <Input placeholder="+2 to +8 °C" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wastageThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Wastage Threshold (%)</FormLabel>
                        <FormControl>
                          <Input placeholder="10.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-md p-3 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Requirements</span>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="requiresDiluent"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Diluent</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requiresInjectionDevice"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">AD Syringe</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requiresSafetyBox"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Safety Box</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="border rounded-md p-3 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Programme Context</span>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="routineUse"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Routine</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="campaignUse"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Campaign (SIA)</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="outbreakUse"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Outbreak</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── SCHEDULE DOSE FIELDS ──────────────────────────── */}
            {activeTabType === "schedule" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="doseCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dose Code</FormLabel>
                        <FormControl>
                          <Input placeholder={tabMeta.codePlaceholder} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="doseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dose Number</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vaccineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Vaccine Product</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : ""}
                        onValueChange={(val) => field.onChange(Number(val))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vaccine..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vaccines.map((v: any) => (
                            <SelectItem key={v.id} value={v.id.toString()}>
                              {v.name} ({v.productId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="targetAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Age</FormLabel>
                        <FormControl>
                          <Input placeholder="9 months" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Age (Days)</FormLabel>
                        <FormControl>
                          <Input placeholder="270" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Interval (Days)</FormLabel>
                        <FormControl>
                          <Input placeholder="28" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="targetPopulationGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Group</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="infants">Infants (&lt;1 yr)</SelectItem>
                            <SelectItem value="children">Children (1-5 yrs)</SelectItem>
                            <SelectItem value="girls">Adolescent Girls</SelectItem>
                            <SelectItem value="pregnant_women">Pregnant Women</SelectItem>
                            <SelectItem value="adults">Adults</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="route"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Route</FormLabel>
                        <FormControl>
                          <Input placeholder="Subcutaneous" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="classification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classification</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="routine">Routine</SelectItem>
                            <SelectItem value="campaign">Campaign</SelectItem>
                            <SelectItem value="outbreak">Outbreak</SelectItem>
                            <SelectItem value="school_based">School-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* ── WASTAGE THRESHOLD FIELDS ──────────────────────── */}
            {activeTabType === "wastage" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vaccineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vaccine Product</FormLabel>
                        <Select
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(Number(val))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vaccine..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vaccines.map((v: any) => (
                              <SelectItem key={v.id} value={v.id.toString()}>
                                {v.name} ({v.productId})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="strategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Strategy</FormLabel>
                        <Select value={field.value || "routine"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="routine">Routine</SelectItem>
                            <SelectItem value="fixed">Fixed Post</SelectItem>
                            <SelectItem value="outreach">Outreach</SelectItem>
                            <SelectItem value="campaign">Campaign / SIA</SelectItem>
                            <SelectItem value="htr">Hard-to-Reach</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <FormField
                    control={form.control}
                    name="wastageRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wastage %</FormLabel>
                        <FormControl>
                          <Input placeholder="10.00" {...field} required />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wastageFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Factor</FormLabel>
                        <FormControl>
                          <Input placeholder="1.11" {...field} required />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minAcceptable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min %</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxAcceptable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max %</FormLabel>
                        <FormControl>
                          <Input placeholder="15.00" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operational Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Operational guidelines or wastage thresholds rationale..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* ── COMMODITIES FIELDS ────────────────────────────── */}
            {isCommodity && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="commodityCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commodity Code</FormLabel>
                        <FormControl>
                          <Input placeholder={tabMeta.codePlaceholder} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder={tabMeta.category} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unitOfMeasure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select value={field.value || "pieces"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pieces">pieces</SelectItem>
                            <SelectItem value="boxes">boxes</SelectItem>
                            <SelectItem value="vials">vials</SelectItem>
                            <SelectItem value="kits">kits</SelectItem>
                            <SelectItem value="units">units</SelectItem>
                            <SelectItem value="packs">packs</SelectItem>
                            <SelectItem value="pairs">pairs</SelectItem>
                            <SelectItem value="rolls">rolls</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <FormField
                    control={form.control}
                    name="packSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pack Size</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} required />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bufferPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buffer %</FormLabel>
                        <FormControl>
                          <Input placeholder="10.00" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumStockThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Stock</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reorderLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reorder Lvl</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {activeTabType === "diluent" && (
                  <FormField
                    control={form.control}
                    name="linkedVaccineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked Vaccine (Optional)</FormLabel>
                        <Select
                          value={field.value ? field.value.toString() : "none"}
                          onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {vaccines.map((v: any) => (
                              <SelectItem key={v.id} value={v.id.toString()}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                )}

                <div className="border rounded-md p-3 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventory &amp; Operational Controls</span>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="stockManaged"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Track in Stock Ledger</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="forecastable"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Include in Supply Forecasting</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requisitionable"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Allow Stock Orders / Requisitions</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sessionSupply"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs font-normal">Daily Session Supply Lists</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── ACTIVE SWITCH ────────────────────────────────── */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Allowed for Country</FormLabel>
                    <FormDescription>
                      Enable or disable item across Client Logbook, Stock Ledger, and Microplanning
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
