const fs = require('fs');
const path = require('path');

const file = 'c:\\vaxplan\\VaxPlan\\client\\src\\pages\\Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Clock')) {
  content = content.replace('} from "lucide-react";', '  Clock,\n} from "lucide-react";');
}

// Ensure the new handler functions are present
if (!content.includes('handleUpdateGlobalIdleTimeout')) {
  const settingsHandlers = `
  const handleUpdateGlobalIdleTimeout = (minutes: number) => {
    const s = (tenant?.settings || {}) as Record<string, any>;
    const security = s.security || {};
    updateSettings.mutate({
      settings: {
        ...s,
        security: {
          ...security,
          idleTimeoutMinutes: minutes
        }
      }
    });
  };

  const handleUpdateRoleIdleTimeout = (role: string, minutes: number | null) => {
    const s = (tenant?.settings || {}) as Record<string, any>;
    const security = s.security || {};
    const roleTimeouts = { ...(security.roleIdleTimeouts || {}) };
    
    if (minutes === null) {
      delete roleTimeouts[role];
    } else {
      roleTimeouts[role] = minutes;
    }
    
    updateSettings.mutate({
      settings: {
        ...s,
        security: {
          ...security,
          roleIdleTimeouts: roleTimeouts
        }
      }
    });
  };
`;
  
  // Find a good place to insert (before `return (` of the main component)
  const returnIdx = content.lastIndexOf('  return (\n    <div className="p-6 space-y-6">');
  if (returnIdx !== -1) {
    content = content.slice(0, returnIdx) + settingsHandlers + '\n' + content.slice(returnIdx);
  }
}

// Now insert the UI Card
const uiCard = `
          {/* USER IDLE SESSION TIMEOUT SETTINGS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Session Idle Timeout Settings
              </CardTitle>
              <CardDescription>
                Configure automatic logouts for inactive user sessions to secure data access. 
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Global Idle Timeout (Minutes)</Label>
                <p className="text-xs text-muted-foreground">
                  The default maximum duration of inactivity before a user is logged out.
                </p>
                <Select
                  value={String((tenant?.settings as any)?.security?.idleTimeoutMinutes || 15)}
                  onValueChange={(val) => handleUpdateGlobalIdleTimeout(Number(val))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Minutes</SelectItem>
                    <SelectItem value="10">10 Minutes</SelectItem>
                    <SelectItem value="15">15 Minutes (Default)</SelectItem>
                    <SelectItem value="20">20 Minutes</SelectItem>
                    <SelectItem value="30">30 Minutes</SelectItem>
                    <SelectItem value="45">45 Minutes</SelectItem>
                    <SelectItem value="60">60 Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Label className="text-sm font-semibold mb-2 block">Role-Based Overrides</Label>
                <p className="text-xs text-muted-foreground mb-4">
                  Optionally configure stricter or looser timeouts for specific user roles.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { id: "facility_clerk", label: "Facility Clerk" },
                    { id: "facility_in_charge", label: "Facility In-Charge" },
                    { id: "district_manager", label: "District Manager" },
                    { id: "provincial_coordinator", label: "Provincial Coordinator" },
                    { id: "national_admin", label: "National Admin" },
                  ].map((role) => {
                    const val = (tenant?.settings as any)?.security?.roleIdleTimeouts?.[role.id] || "default";
                    return (
                      <div key={role.id} className="space-y-1">
                        <Label className="text-xs">{role.label}</Label>
                        <Select
                          value={String(val)}
                          onValueChange={(v) => handleUpdateRoleIdleTimeout(role.id, v === "default" ? null : Number(v))}
                        >
                          <SelectTrigger className="w-full text-xs h-8">
                            <SelectValue placeholder="Use Global Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Use Global Default</SelectItem>
                            <SelectItem value="5">5 Minutes</SelectItem>
                            <SelectItem value="10">10 Minutes</SelectItem>
                            <SelectItem value="15">15 Minutes</SelectItem>
                            <SelectItem value="30">30 Minutes</SelectItem>
                            <SelectItem value="60">60 Minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
`;

if (!content.includes('Session Idle Timeout Settings')) {
  // Find </TabsContent> right after Granular Role-Based Access Control
  const target = `</TabsContent>\n\n        <TabsContent value="system"`;
  if (content.includes(target)) {
    content = content.replace(target, uiCard + '\n        </TabsContent>\n\n        <TabsContent value="system"');
  }
}

fs.writeFileSync(file, content);
console.log("Settings.tsx patched successfully.");
