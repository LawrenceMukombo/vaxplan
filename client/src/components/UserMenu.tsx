import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, User, Settings, KeyRound, Info, HeartPulse, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { useState } from "react";
import { useLocation } from "wouter";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { performClientLogout } from "@/lib/logout";
import { APP_VERSION, formatBuildTime, BUILD_TIME } from "@/lib/version";

interface UserMenuProps {
  user: UserType;
}

export function UserMenu({ user }: UserMenuProps) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [, setLocation] = useLocation();
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((n) => n?.[0])
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User";

  const roleLabel = {
    facility_clerk: "Facility Clerk",
    facility_in_charge: "Facility In-Charge",
    facility_partner: "Facility Partner",
    district_manager: "District Manager",
    district_partner: "District Partner",
    provincial_coordinator: "Provincial Coordinator",
    provincial_partner: "Provincial Partner",
    national_admin: "National Admin",
    national_manager: "National Manager",
    national_partner: "National Partner",
    gis_specialist: "GIS Specialist",
  }[user.role || "facility_clerk"];


  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-sm font-medium">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span>{displayName}</span>
            <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setLocation("/settings?tab=profile")}
          className="cursor-pointer"
          data-testid="menu-item-profile"
        >
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setLocation("/settings")}
          className="cursor-pointer"
          data-testid="menu-item-settings"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setChangePasswordOpen(true);
          }}
          data-testid="menu-item-change-password"
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setAboutOpen(true);
          }}
          className="cursor-pointer"
          data-testid="menu-item-about-vaxplan"
        >
          <Info className="mr-2 h-4 w-4" />
          About VaxPlan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void performClientLogout({ reason: "manual_logout" });
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="menu-item-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-center select-none bg-muted/30">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            VaxPlan v{APP_VERSION}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    
    {/* About VaxPlan Modal */}
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-primary/10 via-sky-500/5 to-background border-b border-border/50 text-center relative">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-sky-600 to-sky-700 text-white flex items-center justify-center shadow-lg shadow-primary/25 ring-2 ring-white/20 mb-3">
            <HeartPulse className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">VaxPlan</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Digital Microplanning & Geospatial Immunization Platform
          </DialogDescription>
          <div className="mt-3 inline-flex items-center gap-2 font-mono text-xs px-3 py-1 rounded-full bg-background/80 backdrop-blur border border-primary/20 text-primary shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">Version {APP_VERSION}</span>
          </div>
        </div>
        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-2 rounded-xl bg-muted/40 p-3.5 border border-border/60">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Build Date & Time</span>
              <span className="font-mono text-foreground font-semibold">{formatBuildTime()}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Release Status</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Production Stable
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Security & Storage</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Multi-Tenant Isolated
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground font-medium">Geospatial Engine</span>
              <span className="font-mono text-foreground font-semibold">PostgreSQL · PostGIS</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Built for Ministries of Health, Expanded Programmes on Immunization (EPI), and primary health care workers worldwide.
          </p>
        </div>
        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-end">
          <Button onClick={() => setAboutOpen(false)} size="sm" className="rounded-xl px-5">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
