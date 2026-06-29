import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIdleStore } from "@/lib/idleStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { performClientLogout } from "@/lib/logout";

export function IdleTimeoutController() {
  const { user } = useAuth();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"], staleTime: Infinity });
  const hasUnsavedChanges = useIdleStore().hasUnsavedChanges;
  
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Fetch server configuration
  const { data: sessionConfig } = useQuery<{ idleTimeoutMinutes: number, warningMinutes: number }>({
    queryKey: ["/api/auth/session-config"],
    staleTime: Infinity,
  });

  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const warningId = useRef<NodeJS.Timeout | null>(null);
  const countdownId = useRef<NodeJS.Timeout | null>(null);
  const lastPingTime = useRef<number>(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const getTimeoutMinutes = useCallback(() => {
    const userPref = localStorage.getItem("vaxplan_user_idle_timeout");
    if (userPref && userPref !== "default") {
      const parsed = parseInt(userPref, 10);
      if (!isNaN(parsed)) return parsed;
    }
    if (sessionConfig?.idleTimeoutMinutes) {
      return sessionConfig.idleTimeoutMinutes;
    }
    const security = tenant?.settings?.security || tenant?.settings || {};
    const globalTimeout = security.idleTimeoutMinutes || 15;
    
    if (user?.role && security.roleIdleTimeouts && security.roleIdleTimeouts[user.role]) {
      return security.roleIdleTimeouts[user.role];
    }
    return globalTimeout;
  }, [tenant, user, sessionConfig]);

  const doLogout = useCallback((reason = "idle_timeout", broadcast = true, server = true) => {
    void performClientLogout({
      reason,
      broadcast,
      server,
      message: reason === "idle_timeout" ? "Session expired. Please sign in again." : undefined,
    });
  }, []);

  const resetTimer = useCallback((broadcast = true) => {
    if (timeoutId.current) clearTimeout(timeoutId.current);
    if (warningId.current) clearTimeout(warningId.current);
    if (countdownId.current) clearInterval(countdownId.current);
    
    setShowWarning(false);

    const timeoutMinutes = getTimeoutMinutes();
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    // Warning logic
    const warningPeriodMinutes = sessionConfig?.warningMinutes || (timeoutMinutes > 15 ? 2 : 1);
    const warningPeriodMs = warningPeriodMinutes * 60 * 1000;
    const timeUntilWarning = timeoutMs - warningPeriodMs;

    warningId.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(warningPeriodMinutes * 60);
      
      countdownId.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownId.current!);
            doLogout("idle_timeout");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeUntilWarning);

    timeoutId.current = setTimeout(() => {
      doLogout("idle_timeout");
    }, timeoutMs);

    if (broadcast && channel.current) {
      channel.current.postMessage({ type: "RESET_IDLE" });
    }
    
    // Ping server to keep session alive based on actual elapsed time.
    // This ensures that active users trigger the keep-alive even if the
    // component or dependencies rapidly remount and clear timeouts.
    const now = Date.now();
    if (!lastPingTime.current || now - lastPingTime.current >= 60000) {
      lastPingTime.current = now;
      fetch("/api/auth/ping", { method: "POST" }).catch(() => {});
    }

  }, [getTimeoutMinutes, doLogout, sessionConfig]);

  useEffect(() => {
    if (!user) return; // Only run if logged in
    
    channel.current = new BroadcastChannel("vaxplan_session_sync");
    channel.current.onmessage = (event) => {
      if (event.data?.type === "RESET_IDLE") {
        resetTimer(false);
      } else if (event.data?.type === "LOGOUT_NOW") {
        doLogout("cross_tab_logout", false, false);
      }
    };

    resetTimer();

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    let throttleTimeout: NodeJS.Timeout | null = null;
    
    const handleActivity = () => {
      if (showWarning) return; // Don't reset if modal is up, unless they click "Stay Signed In"
      
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          resetTimer();
        }, 2000);
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      if (warningId.current) clearTimeout(warningId.current);
      if (countdownId.current) clearInterval(countdownId.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      channel.current?.close();
    };
  }, [resetTimer, showWarning, user]);

  const handleStaySignedIn = () => {
    resetTimer();
    fetch("/api/auth/ping", { method: "POST" }).catch(() => {});
  };

  const handleSignOutNow = () => {
    doLogout("manual_logout");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Clock className="h-5 w-5" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            You have been inactive. Your session will expire soon for security reasons.
            <div className="text-3xl font-bold text-center my-6 tabular-nums text-foreground">
              {formatTime(countdown)}
            </div>
            {hasUnsavedChanges && (
              <div className="bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm font-medium border border-amber-200 dark:border-amber-800 mb-4">
                You have unsaved changes. Please stay signed in to continue editing, or save your work before leaving.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={handleSignOutNow} className="w-full sm:w-auto">
            Sign Out Now
          </Button>
          <Button onClick={handleStaySignedIn} className="w-full sm:w-auto">
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
