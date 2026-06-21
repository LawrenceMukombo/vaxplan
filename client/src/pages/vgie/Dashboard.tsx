import { Link } from "wouter";
import {
  Users, Building2, Hospital, AlertTriangle,
  TrendingUp, MapPin, CheckCircle, XCircle,
  Clock, ChevronRight, Shield, Zap, Activity, Syringe, Radio
} from "lucide-react";
import { useGetDashboardSummary, useGetDistrictStats, useGetAlerts, useGetRecommendations, useGetOutreachFeed, useGetOutreachCoverage } from "@/hooks/vgie/useVgieApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";
import { GeoCascadeFilter } from "@/components/GeoCascadeFilter";

function StatCard({
  title, value, subtitle, icon: Icon, color = "emerald", trend, scope
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: string;
  scope?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10 dark:text-emerald-400",
    red: "text-red-500 bg-red-500/10 dark:text-red-400",
    amber: "text-amber-500 bg-amber-500/10 dark:text-amber-400",
    blue: "text-blue-500 bg-blue-500/10 dark:text-blue-400",
    purple: "text-purple-500 bg-purple-500/10 dark:text-purple-400",
    slate: "text-muted-foreground bg-slate-500/10",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            {scope && <p className="text-[10px] text-primary/80 font-bold uppercase tracking-wider mt-1">{scope}</p>}
            {trend && <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">{trend}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-3 ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const severityColors: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
  low: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/50",
};

export default function Dashboard() {
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [facilityId, setFacilityId] = useState<number | null>(null);

  const filters = {
    provinceId: provinceId?.toString(),
    districtId: districtId?.toString(),
    facilityId: facilityId?.toString(),
  } as any;

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(filters);
  const { data: districtStats, isLoading: loadingDistricts } = useGetDistrictStats(filters);
  const { data: alerts } = useGetAlerts(filters);
  const { data: recs } = useGetRecommendations({ status: "pending", ...filters });
  const { data: outreachFeed, isLoading: loadingFeed } = useGetOutreachFeed(filters);
  const { data: outreachCoverage, isLoading: loadingCoverage } = useGetOutreachCoverage(filters);

  const coverageRate = summary && summary.totalSettlements > 0
    ? Math.round((summary.servedCount / summary.totalSettlements) * 100)
    : 0;

  const chartData = districtStats?.map((d) => ({
    name: d.district,
    served: d.servedCount,
    underserved: d.underservedCount,
    unserved: d.unservedCount,
  }));

  const scopeLabel = facilityId
    ? "Selected facility"
    : districtId
    ? "Selected district"
    : provinceId
    ? "Selected province"
    : "Active country";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <GeoCascadeFilter
          provinceId={provinceId}
          districtId={districtId}
          facilityId={facilityId}
          onProvinceChange={setProvinceId}
          onDistrictChange={setDistrictId}
          onFacilityChange={setFacilityId}
          showFacility={true}
        />
        {(provinceId || districtId || facilityId) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setProvinceId(null); setDistrictId(null); setFacilityId(null); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-16 bg-muted" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Settlements"
              value={summary?.totalSettlements ?? 0}
              subtitle={`${summary?.newSettlementsCount ?? 0} newly detected`}
              icon={Building2}
              color="blue"
              scope={scopeLabel}
            />
            <StatCard
              title="Unserved Population"
              value={(summary?.unservedPopulation ?? 0).toLocaleString()}
              subtitle={`${summary?.unservedCount ?? 0} settlements`}
              icon={Users}
              color="red"
              scope={scopeLabel}
            />
            <StatCard
              title="Coverage Rate"
              value={`${coverageRate}%`}
              subtitle={`${summary?.servedCount ?? 0} served settlements`}
              icon={CheckCircle}
              color="emerald"
              scope={scopeLabel}
            />
            <StatCard
              title="Active Alerts"
              value={summary?.activeAlertsCount ?? 0}
              subtitle={`${summary?.pendingRecommendationsCount ?? 0} recommendations pending`}
              icon={AlertTriangle}
              color="amber"
              scope={scopeLabel}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* District Coverage Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Coverage {districtId ? "by Facility" : provinceId ? "by District" : "by District"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDistricts ? (
              <Skeleton className="h-48 bg-muted rounded" />
            ) : !chartData || chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No coverage data available for the selected filters
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={20} barGap={4}>
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="served" stackId="a" fill="#10b981" name="Served" radius={[0,0,0,0]} />
                  <Bar dataKey="underserved" stackId="a" fill="#f59e0b" name="Underserved" />
                  <Bar dataKey="unserved" stackId="a" fill="#ef4444" name="Unserved" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-3">
              {[["#10b981","Served"],["#f59e0b","Underserved"],["#ef4444","Unserved"]].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service Status</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Served", count: summary?.servedCount ?? 0, color: "bg-emerald-500", icon: CheckCircle },
                  { label: "Underserved", count: summary?.underservedCount ?? 0, color: "bg-amber-500", icon: Clock },
                  { label: "Unserved", count: summary?.unservedCount ?? 0, color: "bg-red-500", icon: XCircle },
                ].map(({ label, count, color, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <span className="text-sm text-muted-foreground flex-1">{label}</span>
                    <span className="text-sm font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <Hospital className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span className="text-sm text-muted-foreground flex-1">Health Facilities</span>
                  <span className="text-sm font-bold text-foreground">{summary?.totalFacilities ?? 0}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  <span className="text-sm text-muted-foreground flex-1">Total Population</span>
                  <span className="text-sm font-bold text-foreground">{(summary?.totalPopulation ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span className="text-sm text-muted-foreground flex-1">New Settlements</span>
                  <span className="text-sm font-bold text-foreground">{summary?.newSettlementsCount ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Recent Alerts
              </CardTitle>
              <Link href="/vgie/alerts">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-6 px-2">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(alerts ?? []).slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted border border-border">
                  <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${severityColors[alert.severity]}`}>
                    {alert.severity}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{alert.message}</p>
                </div>
              ))}
              {(!alerts || alerts.length === 0) && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <Shield className="w-4 h-4 mr-2" /> No active alerts for the selected filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Recommendations */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                Pending Recommendations
              </CardTitle>
              <Link href="/vgie/recommendations">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-6 px-2">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(recs ?? []).slice(0, 4).map((rec) => (
                <div key={rec.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted border border-border">
                  <Badge className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 border ${priorityColors[rec.priority]}`}>
                    {rec.priority}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{rec.settlementName}</p>
                    <p className="text-xs text-muted-foreground truncate">{rec.recommendationType}</p>
                  </div>
                </div>
              ))}
              {(!recs || recs.length === 0) && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> No pending recommendations for the selected filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outreach Coverage by District */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              Outreach Coverage by District
            </CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">sorted by most overdue</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCoverage ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 bg-muted rounded" />
              ))}
            </div>
          ) : !outreachCoverage || outreachCoverage.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Radio className="w-4 h-4 mr-2" /> No district data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">District</th>
                    <th className="text-right py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">Settlements</th>
                    <th className="text-right py-2 pr-6 font-semibold text-muted-foreground uppercase tracking-wider">
                      <span className="text-emerald-500">Recent</span> <span className="text-muted-foreground">&lt;6 mo</span>
                    </th>
                    <th className="text-right py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">
                      <span className="text-red-500">Overdue</span> <span className="text-muted-foreground">&gt;12 mo / never</span>
                    </th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {outreachCoverage.map((row) => (
                    <tr key={row.district} className="hover:bg-muted transition-colors group">
                      <td className="py-2.5 pr-4 font-medium text-foreground">{row.district}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{row.totalSettlements}</td>
                      <td className="py-2.5 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${row.recentPct}%` }}
                            />
                          </div>
                          <span className="text-emerald-400 w-9 text-right font-semibold">{row.recentPct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ width: `${row.overduePct}%` }}
                            />
                          </div>
                          <span className="text-red-400 w-9 text-right font-semibold">{row.overduePct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Link href={`/map?district=${encodeURIComponent(row.district)}&outreach=1`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            title="Open in map"
                          >
                            <MapPin className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Outreach Activity Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Recent Outreach
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFeed ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          ) : !outreachFeed || outreachFeed.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Syringe className="w-4 h-4 mr-2" /> No outreach sessions recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">Settlement</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">District</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground uppercase tracking-wider">Vaccines</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground uppercase tracking-wider">Children</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {outreachFeed.map((item) => (
                    <tr key={item.id} className="hover:bg-muted transition-colors group">
                      <td className="py-2.5 pr-4">
                        <Link href={`/settlements/${item.settlementId}`}>
                          <span className="text-foreground font-medium group-hover:text-emerald-400 transition-colors cursor-pointer">
                            {item.settlementName}
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{item.district}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{item.visitDate}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {item.vaccineTypes.split(",").map((v: any) => (
                            <Badge key={v.trim()} className="text-[10px] px-1.5 py-0 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              {v.trim()}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{item.childrenVaccinated.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
