const fs = require('fs');

const file = 'c:\\vaxplan\\VaxPlan\\client\\src\\pages\\Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add State
const stateRegex = /const \[brandColor, setBrandColor\] = useState<string>\("#1e40af"\);/g;
const stateReplacement = `const [brandColor, setBrandColor] = useState<string>("#1e40af");
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<string>("15");
  const [roleIdleTimeouts, setRoleIdleTimeouts] = useState<Record<string, string>>({});`;
content = content.replace(stateRegex, stateReplacement);

// 2. Initialize State
const initRegex = /if \(typeof s.brandColor === "string"\) setBrandColor\(s.brandColor\);/g;
const initReplacement = `if (typeof s.brandColor === "string") setBrandColor(s.brandColor);
      if (s.security?.idleTimeoutMinutes) setIdleTimeoutMinutes(String(s.security.idleTimeoutMinutes));
      if (s.security?.roleIdleTimeouts) {
        const strRecord: Record<string, string> = {};
        for (const k in s.security.roleIdleTimeouts) {
          strRecord[k] = String(s.security.roleIdleTimeouts[k]);
        }
        setRoleIdleTimeouts(strRecord);
      }`;
content = content.replace(initRegex, initReplacement);

// 3. Save Function
const saveRegex = /const updateSettings = useMutation\({/g;
const saveReplacement = `const handleSaveSecuritySettings = () => {
    const s = (tenant?.settings || {}) as Record<string, any>;
    const updatedSecurity = {
      ...(s.security || {}),
      idleTimeoutMinutes: parseInt(idleTimeoutMinutes) || 15,
      roleIdleTimeouts: Object.fromEntries(Object.entries(roleIdleTimeouts).map(([k,v]) => [k, parseInt(v)]))
    };
    updateSettings.mutate({ settings: { ...s, security: updatedSecurity } });
  };

  const updateSettings = useMutation({`;
content = content.replace(saveRegex, saveReplacement);

// 4. UI Component
const uiRegex = /<TabsContent value="access" className="space-y-6 mt-6">/g;
const uiReplacement = `<TabsContent value="access" className="space-y-6 mt-6">
          {/* IDLE TIMEOUT SETTINGS */}
          <Card className="border border-border/80 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/40 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Session Security & Timeout</CardTitle>
                  <CardDescription>
                    Configure automatic idle logout settings.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2">
                <Label>Global Idle Timeout (Minutes)</Label>
                <div className="flex gap-2 max-w-sm">
                  <Input 
                    type="number" 
                    min="5" 
                    max="60" 
                    value={idleTimeoutMinutes} 
                    onChange={e => setIdleTimeoutMinutes(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Applies to all users unless a role override is defined (min: 5, max: 60).</p>
              </div>
              <div className="space-y-2">
                <Label>Role-Based Overrides</Label>
                <div className="grid gap-2 max-w-md">
                  {["national_admin", "provincial_coordinator", "district_manager", "facility_in_charge", "facility_clerk"].map(role => (
                    <div key={role} className="flex items-center gap-4">
                      <Label className="flex-1 capitalize">{role.replace(/_/g, " ")}</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 15"
                        min="5" max="60"
                        className="w-24"
                        value={roleIdleTimeouts[role] || ""}
                        onChange={(e) => setRoleIdleTimeouts(prev => ({ ...prev, [role]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleSaveSecuritySettings}>
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
`;
content = content.replace(uiRegex, uiReplacement);

fs.writeFileSync(file, content);
console.log("Settings.tsx patched successfully!");
