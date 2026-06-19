import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import {
  insertCatalogueVaccineSchema,
  insertCatalogueScheduleDoseSchema,
  insertCatalogueCommoditySchema,
  insertCatalogueWastageThresholdSchema
} from "@shared/schema";

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

  let endpoint = "";
  let queryKey = "";
  let defaultValues = item || {};

  if (activeTabType === "vaccine") {
    endpoint = "/api/catalogue/vaccines";
    queryKey = "/api/catalogue/vaccines";
    if (!isEditing) defaultValues = { approvalStatus: "published", dosesPerVial: 1, active: true, requiresInjectionDevice: true, requiresSafetyBox: true, routineUse: true };
  } else if (activeTabType === "schedule") {
    endpoint = "/api/catalogue/schedules";
    queryKey = "/api/catalogue/schedules";
    if (!isEditing) defaultValues = { approvalStatus: "published", doseNumber: 1, classification: "routine", targetPopulationGroup: "infants" };
  } else if (activeTabType === "wastage") {
    endpoint = "/api/catalogue/wastage-thresholds";
    queryKey = "/api/catalogue/wastage-thresholds";
    if (!isEditing) defaultValues = { wastageRate: "10.00", wastageFactor: "1.11", minAcceptable: "0.00", maxAcceptable: "15.00", active: true };
  } else {
    // Commodity
    endpoint = "/api/catalogue/commodities";
    queryKey = "/api/catalogue/commodities";
    if (!isEditing) defaultValues = { type: activeTabType, stockManaged: true, requisitionable: true, sessionSupply: true, bufferPercentage: "10.00", packSize: 100 };
  }

  const form = useForm({
    defaultValues
  });

  // Update default values when item or activeTabType changes
  useEffect(() => {
    form.reset(defaultValues);
  }, [item, activeTabType, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing ? `${endpoint}/${item.id}` : endpoint;
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item saved successfully." });
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  const onSubmit = (data: any) => {
    // Basic type coercion for numeric fields before submission
    if (data.dosesPerVial) data.dosesPerVial = Number(data.dosesPerVial);
    if (data.doseNumber) data.doseNumber = Number(data.doseNumber);
    if (data.vaccineId) data.vaccineId = Number(data.vaccineId);
    if (data.linkedVaccineId) data.linkedVaccineId = Number(data.linkedVaccineId);
    if (data.packSize) data.packSize = Number(data.packSize);
    
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} {activeTabType.replace('_', ' ')} Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Common Name Field */}
            {activeTabType !== "wastage" && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} required /></FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* VACCINE FIELDS */}
            {activeTabType === "vaccine" && (
              <>
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product ID</FormLabel>
                      <FormControl><Input {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="antigenName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Antigen</FormLabel>
                      <FormControl><Input {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dosesPerVial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doses Per Vial</FormLabel>
                      <FormControl><Input type="number" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* SCHEDULE DOSES */}
            {activeTabType === "schedule" && (
              <>
                <FormField
                  control={form.control}
                  name="doseCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose Code</FormLabel>
                      <FormControl><Input {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="doseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose Number</FormLabel>
                      <FormControl><Input type="number" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vaccineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Vaccine ID</FormLabel>
                      <FormControl><Input type="number" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* WASTAGE THRESHOLDS */}
            {activeTabType === "wastage" && (
              <>
                <FormField
                  control={form.control}
                  name="vaccineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vaccine ID</FormLabel>
                      <FormControl><Input type="number" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wastageRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wastage Rate (%)</FormLabel>
                      <FormControl><Input type="text" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wastageFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wastage Factor</FormLabel>
                      <FormControl><Input type="text" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* COMMODITIES */}
            {["diluent", "syringe", "safety_box", "ppe", "cold_chain", "recording_tools", "it_equipment", "transport", "stationaries", "social_mob", "other"].includes(activeTabType) && (
              <>
                <FormField
                  control={form.control}
                  name="commodityCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commodity Code</FormLabel>
                      <FormControl><Input {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="packSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pack Size</FormLabel>
                      <FormControl><Input type="number" {...field} required /></FormControl>
                    </FormItem>
                  )}
                />
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

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Save</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
