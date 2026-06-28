import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/DataTable";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { notificationHref } from "@/lib/notificationLinks";
import type { Notification } from "@shared/schema";

function formatDate(value: Date | string | null): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function invalidateNotifications() {
  queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications", "recent"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications", "unread"] });
}

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", unreadOnly ? "unread-page" : "all-page"],
    queryFn: () => apiRequest<Notification[]>("GET", `/api/notifications?limit=100${unreadOnly ? "&unreadOnly=1" : ""}`),
    refetchInterval: 60_000,
  });

  const unreadCount = useMemo(() => data.filter((item) => !item.readAt).length, [data]);

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`, {}),
    onSuccess: invalidateNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all", {}),
    onSuccess: invalidateNotifications,
  });

  const columns = [
    {
      key: "title",
      header: "Notification",
      render: (notification: Notification) => (
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            <Link href={notificationHref(notification)} className="font-medium text-primary hover:underline">
              {notification.title}
            </Link>
          </div>
          {notification.body && <p className="line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (notification: Notification) => <Badge variant="outline" className="uppercase">{notification.type || "system"}</Badge>,
    },
    {
      key: "createdAt",
      header: "Date created",
      render: (notification: Notification) => <span className="whitespace-nowrap text-sm">{formatDate(notification.createdAt)}</span>,
    },
    {
      key: "readAt",
      header: "Status",
      render: (notification: Notification) => notification.readAt ? <Badge variant="secondary">Read</Badge> : <Badge>Unread</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (notification: Notification) => (
        <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          {!notification.readAt && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => markRead.mutate(String(notification.id))}
              disabled={markRead.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              Mark read
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href={notificationHref(notification)}>
              Open
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Notification Center</h1>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Review workflow alerts, approval updates, stock warnings, supervision findings, and sync notices assigned to you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            onClick={() => setUnreadOnly((value) => !value)}
          >
            {unreadOnly ? "Showing unread" : "Show unread"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Inbox className="h-5 w-5 text-primary" />
            Inbox
          </CardTitle>
          <CardDescription>
            {isLoading ? "Loading notifications..." : `${data.length} notification${data.length === 1 ? "" : "s"}${unreadCount ? `, ${unreadCount} unread` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data}
            columns={columns}
            searchKeys={["title", "body", "type"]}
            searchPlaceholder="Search notifications..."
            emptyMessage={unreadOnly ? "No unread notifications." : "No notifications yet."}
            exportFileName="notifications"
            onRowClick={(notification) => {
              window.history.pushState({}, "", notificationHref(notification));
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}



