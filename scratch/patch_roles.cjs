const fs = require('fs');

const file = 'c:\\vaxplan\\VaxPlan\\client\\src\\pages\\Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

const ALL_ROLES = [
  "facility_clerk",
  "facility_in_charge",
  "district_manager",
  "provincial_coordinator",
  "national_admin",
  "gis_specialist",
  "facility_partner",
  "district_partner",
  "provincial_partner",
  "national_partner",
  "national_manager",
];

// 1. Update DEFAULT_PERMISSIONS
const dpRegex = /const DEFAULT_PERMISSIONS = \{[\s\S]*?\};/;
const newDP = `const DEFAULT_PERMISSIONS = {
    facility_clerk: ["view_demographics", "log_immunizations", "create_session_plans"],
    facility_in_charge: ["view_demographics", "log_immunizations", "create_session_plans", "approve_session_plans"],
    district_manager: ["view_demographics", "approve_session_plans", "manage_facilities"],
    provincial_coordinator: ["view_demographics", "approve_session_plans", "manage_facilities"],
    national_admin: ["view_demographics", "log_immunizations", "create_session_plans", "approve_session_plans", "manage_facilities", "manage_settings"],
    gis_specialist: ["view_demographics"],
    facility_partner: ["view_demographics"],
    district_partner: ["view_demographics"],
    provincial_partner: ["view_demographics"],
    national_partner: ["view_demographics"],
    national_manager: ["view_demographics", "manage_facilities"],
  };`;
content = content.replace(dpRegex, newDP);

// 2. Update RBAC Matrix rows
const rbacRegex = /\{\[\s*\{\s*id:\s*"facility_clerk"[\s\S]*?\}\s*\]\.map\(\(role\)/;
const newRBAC = `{ALL_ROLES.map(roleId => ({ id: roleId, label: roleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') })).map((role)`;
// But wait, we have to inject ALL_ROLES somewhere, or just hardcode the mapping.
const hardcodedRbacRows = `{[
                      { id: "facility_clerk", label: "Facility Clerk" },
                      { id: "facility_in_charge", label: "Facility In-Charge" },
                      { id: "district_manager", label: "District Manager" },
                      { id: "provincial_coordinator", label: "Provincial Coordinator" },
                      { id: "national_admin", label: "National Admin" },
                      { id: "gis_specialist", label: "GIS Specialist" },
                      { id: "facility_partner", label: "Facility Partner" },
                      { id: "district_partner", label: "District Partner" },
                      { id: "provincial_partner", label: "Provincial Partner" },
                      { id: "national_partner", label: "National Partner" },
                      { id: "national_manager", label: "National Manager" },
                    ].map((role)`;
content = content.replace(/\{\[\s*\{\s*id:\s*"facility_clerk"[\s\S]*?\}\s*\]\.map\(\(role\)/, hardcodedRbacRows);

// 3. Update Idle Timeout Settings Overrides mapping
const idleRegex = /\{\["national_admin", "provincial_coordinator", "district_manager", "facility_in_charge", "facility_clerk"\]\.map\(role => \(/;
const newIdle = `{[
                      "facility_clerk", "facility_in_charge", "district_manager", 
                      "provincial_coordinator", "national_admin", "gis_specialist", 
                      "facility_partner", "district_partner", "provincial_partner", 
                      "national_partner", "national_manager"
                    ].map(role => (`;
content = content.replace(idleRegex, newIdle);

fs.writeFileSync(file, content);
console.log("Settings.tsx roles patched successfully!");
