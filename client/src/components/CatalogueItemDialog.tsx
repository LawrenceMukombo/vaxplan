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

export function CatalogueItemDialog({ open, onOpenChange, activeTabType, item }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!item;

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
          category: "Vaccine",
          presentation: "Liquid",
          dosesPerVial: 10,
          unitOfMeasure: "vials",
          storageTemperature: "+2 to +8 °C",
          approvalStatus: "published",
          active: true,
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
          classification: "routine",
          targetPopulationGroup: "infants",
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
          packSize: 100,
          unitOfMeasure: "pieces",
          stockManaged: true,
          forecastable: true,
          requisitionable: true,
          sessionSupply: true,
          bufferPercentage: "10.00",
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
      toast({ title: "Success", description: "Item saved successfully." });
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error Saving Item", description: err.message });
    },
  });

  const onSubmit = (rawData: any) => {
    const data = { ...rawData };

    // Explicit type coercion & fallbacks
    if (data.dosesPerVial !== undefined) data.dosesPerVial = Number(data.dosesPerVial) || 1;
    if (data.doseNumber !== undefined) data.doseNumber = Number(data.doseNumber) || 1;
    if (data.vaccineId !== undefined && data.vaccineId !== "") data.vaccineId = Number(data.vaccineId);
    if (data.linkedVaccineId !== undefined && data.linkedVaccineId !== "") {
      data.linkedVaccineId = data.linkedVaccineId === "none" ? null : Number(data.linkedVaccineId);
    }
    if (data.packSize !== undefined) data.packSize = Number(data.packSize) || 1;
    if (data.active === undefined) data.active = true;

    // Ensure type matches active tab for commodities
    if (!["vaccine", "schedule", "wastage"].includes(activeTabType)) {
      data.type = activeTabType;
    }

    saveMutation.mutate(data);
  };

  const isCommodity = !["vaccine", "schedule", "wastage"].includes(activeTabType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"} {activeTabType.replace("_", " ").toUpperCase()} Item
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
                      <Input placeholder="e.g. Auto-disable syringes 0.5ml" {...field} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* VACCINE FIELDS */}
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
                          <Input placeholder="vaccine_penta" {...field} required />
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
                          <Input placeholder="DTP-HepB-Hib" {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-3 gap-2 border rounded-md p-3">
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
                        <FormLabel className="text-xs font-normal">Campaign</FormLabel>
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
              </>
            )}

            {/* SCHEDULE DOSE FIELDS */}
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
                          <Input placeholder="penta_1" {...field} required />
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
                      <FormLabel>Linked Vaccine</FormLabel>
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
              </>
            )}

            {/* WASTAGE THRESHOLD FIELDS */}
            {activeTabType === "wastage" && (
              <>
                <FormField
                  control={form.control}
                  name="vaccineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vaccine</FormLabel>
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="wastageRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wastage Rate (%)</FormLabel>
                        <FormControl>
                          <Input placeholder="10.00" {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wastageFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wastage Factor</FormLabel>
                        <FormControl>
                          <Input placeholder="1.11" {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* COMMODITIES FIELDS */}
            {isCommodity && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="commodityCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commodity Code</FormLabel>
                        <FormControl>
                          <Input placeholder={`ppe_gloves`} {...field} required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="packSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pack Size</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} required />
                        </FormControl>
                        <FormMessage />
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

                <FormField
                  control={form.control}
                  name="stockManaged"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Stock Managed</FormLabel>
                        <FormDescription>Track inventory levels in stock ledger</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* ACTIVE SWITCH */}
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
