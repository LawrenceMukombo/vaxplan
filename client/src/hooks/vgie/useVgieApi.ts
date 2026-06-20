import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Summary APIs
export function useGetDashboardSummary() {
  return useQuery<any>({
    queryKey: ["/api/vgie/dashboard/summary"],
    queryFn: async () => {
      const res = await fetch("/api/vgie/dashboard/summary");
      if (!res.ok) throw new Error("Failed to fetch dashboard summary");
      return res.json();
    }
  });
}

export function useGetDistrictStats() {
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/district-stats"],
    queryFn: async () => {
      const res = await fetch("/api/vgie/dashboard/district-stats");
      if (!res.ok) throw new Error("Failed to fetch district stats");
      return res.json();
    }
  });
}

export function useGetOutreachCoverage() {
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/outreach-coverage"],
    queryFn: async () => {
      const res = await fetch("/api/vgie/dashboard/outreach-coverage");
      if (!res.ok) throw new Error("Failed to fetch outreach coverage");
      return res.json();
    }
  });
}

export function useGetOutreachFeed() {
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/outreach-feed"],
    queryFn: async () => {
      const res = await fetch("/api/vgie/dashboard/outreach-feed");
      if (!res.ok) throw new Error("Failed to fetch outreach feed");
      return res.json();
    }
  });
}

// Settlements
export function useGetSettlements(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery({
    queryKey: ["/api/vgie/settlements", params],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/settlements${qs}`);
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    }
  });
}

export function useGetSettlement(id?: string | number) {
  return useQuery({
    queryKey: ["/api/vgie/settlements", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/vgie/settlements/${id}`);
      if (!res.ok) throw new Error("Failed to fetch settlement");
      return res.json();
    }
  });
}

// Facilities
export function useGetFacilities(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery({
    queryKey: ["/api/vgie/facilities", params],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/facilities${qs}`);
      if (!res.ok) throw new Error("Failed to fetch facilities");
      return res.json();
    }
  });
}

export function useGetFacility(id?: string | number) {
  return useQuery({
    queryKey: ["/api/vgie/facilities", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/vgie/facilities/${id}`);
      if (!res.ok) throw new Error("Failed to fetch facility");
      return res.json();
    }
  });
}

// Recommendations
export function useGetRecommendations(params?: Record<string, string>) {
  // Filter out undefined keys so URLSearchParams doesn't stringify them as "undefined"
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/recommendations", params],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/recommendations${qs}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    }
  });
}

export function useUpdateRecommendation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/vgie/recommendations/${id}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/summary"] });
      toast({ title: "Recommendation updated" });
    }
  });
}

export function useGenerateRecommendations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/vgie/analyze-catchment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/summary"] });
      toast({ title: "Catchment analysis completed" });
    }
  });
}

// Alerts
export function useGetAlerts(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/alerts", params],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/alerts${qs}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    }
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("PATCH", `/api/vgie/alerts/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/summary"] });
      toast({ title: "Alert dismissed" });
    }
  });
}

// Actions
export function useLogOutreach() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest("POST", "/api/vgie/outreach-sessions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/outreach-feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/dashboard/outreach-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/settlements"] });
      toast({ title: "Outreach logged successfully" });
    }
  });
}
