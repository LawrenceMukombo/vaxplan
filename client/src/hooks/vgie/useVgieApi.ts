import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Summary APIs
export function useGetDashboardSummary(params?: Record<string, string>) {
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any>({
    queryKey: ["/api/vgie/dashboard/summary", cleanParams],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/dashboard/summary${qs}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard summary");
      return res.json();
    }
  });
}

export function useGetDistrictStats(params?: Record<string, string>) {
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/district-stats", cleanParams],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/dashboard/district-stats${qs}`);
      if (!res.ok) throw new Error("Failed to fetch district stats");
      return res.json();
    }
  });
}

export function useGetOutreachCoverage(params?: Record<string, string>) {
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/outreach-coverage", cleanParams],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/dashboard/outreach-coverage${qs}`);
      if (!res.ok) throw new Error("Failed to fetch outreach coverage");
      return res.json();
    }
  });
}

export function useGetOutreachFeed(params?: Record<string, string>) {
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/dashboard/outreach-feed", cleanParams],
    queryFn: async () => {
      const res = await fetch(`/api/vgie/dashboard/outreach-feed${qs}`);
      if (!res.ok) throw new Error("Failed to fetch outreach feed");
      return res.json();
    }
  });
}

// Settlements
export function useGetSettlements(params?: Record<string, string | number | undefined | null>) {
  const cleanParams = params 
    ? Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      ) 
    : {};
  const qs = Object.keys(cleanParams).length 
    ? "?" + new URLSearchParams(cleanParams as any).toString() 
    : "";
  return useQuery<{
    success: boolean;
    data: {
      items: any[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
      counts: {
        total: number;
        served: number;
        underserved: number;
        unserved: number;
        highRisk: number;
      };
    };
  }>({
    queryKey: ["/api/vgie/settlements", cleanParams],
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
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery({
    queryKey: ["/api/vgie/facilities", cleanParams],
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
    queryKey: ["/api/vgie/recommendations", cleanParams],
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
  const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
  const qs = Object.keys(cleanParams).length ? "?" + new URLSearchParams(cleanParams as any).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/vgie/alerts", cleanParams],
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

// Recommendation Rules Hooks
export function useGetRecommendationRules() {
  return useQuery<any[]>({
    queryKey: ["/api/vgie/recommendation-rules"],
    queryFn: async () => {
      const res = await fetch("/api/vgie/recommendation-rules");
      if (!res.ok) throw new Error("Failed to fetch recommendation rules");
      return res.json();
    }
  });
}

export function useCreateRecommendationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest("POST", "/api/vgie/recommendation-rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendation-rules"] });
      toast({ title: "Recommendation rule created" });
    }
  });
}

export function useUpdateRecommendationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; [key: string]: any }) => {
      return await apiRequest("PATCH", `/api/vgie/recommendation-rules/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendation-rules"] });
      toast({ title: "Recommendation rule updated" });
    }
  });
}

export function useDeleteRecommendationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/vgie/recommendation-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vgie/recommendation-rules"] });
      toast({ title: "Recommendation rule deleted" });
    }
  });
}

