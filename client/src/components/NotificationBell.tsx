import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { notificationHref } from "@/lib/notificationLinks";
import type { Notification } from "@shared/schema";

function relativeTime(value: Date | string | null): string {
  if (!value) return "Unknown time";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}

function invalidateNotifications() {
  queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications", "recent"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications", "unread"] });
}

export function NotificationBell() {
  const { data: recent = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", "recent"],
    queryFn: () => apiRequest<Notification[]>("GET", "/api/notifications?limit=8"),
    refetchInterval: 45_000,
  });

  const { data: unread = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", "unread"],
    queryFn: () => apiRequest<Notification[]>("GET", "/api/notifications?unreadOnly=1&limit=50"),
    refetchInterval: 45_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`, {}),
    onSuccess: invalidateNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all", {}),
    onSuccess: invalidateNotifications,
  });

  const unreadCount = unread.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={(event) => {
                event.preventDefault();
                markAllRead.mutate();
              }}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[26rem] overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : recent.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            recent.map((notification) => {
              const unreadItem = !notification.readAt;
              return (
                <DropdownMenuItem key={notification.id} asChild className="cursor-pointer p-0">
                  <Link href={notificationHref(notification)}>
                    <div className="flex w-full gap-3 px-3 py-3">
                      <span className={unreadItem ? "mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" : "mt-1 h-2 w-2 shrink-0 rounded-full bg-muted"} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{notification.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(notification.createdAt)}</span>
                        </div>
                        {notification.body && <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Badge variant="outline" className="text-[10px] uppercase">{notification.type || "system"}</Badge>
                          {unreadItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-2 text-xs"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                markRead.mutate(String(notification.id));
                              }}
                            >
                              <Check className="h-3 w-3" />
                              Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer justify-center gap-2 py-2">
          <Link href="/notifications">
            View notification center
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



