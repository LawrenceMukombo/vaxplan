const fs = require('fs');
let content = fs.readFileSync('c:/vaxplan/client/src/components/GlobalSearch.tsx', 'utf-8');

content = content.replace(
  'interface GlobalSearchProps {\n  user: User;\n}',
  'interface GlobalSearchProps {\n  user: User | null;\n}'
);

content = content.replace(
  'const canAccessApprovals = ["district_manager", "provincial_coordinator", "national_admin"].includes(user.role || "");',
  'const canAccessApprovals = user ? ["district_manager", "provincial_coordinator", "national_admin"].includes(user.role || "") : false;'
);

content = content.replace(
  'const isNationalAdmin = user.role === "national_admin";',
  'const isNationalAdmin = user ? user.role === "national_admin" : false;'
);

content = content.replace(
  'const isPlatformAdmin = (user as any).isPlatformAdmin === true;',
  'const isPlatformAdmin = user ? (user as any).isPlatformAdmin === true : false;'
);

content = content.replace(
  'const canReconcile = user.role === "national_admin" || user.role === "district_manager";',
  'const canReconcile = user ? (user.role === "national_admin" || user.role === "district_manager") : false;'
);

content = content.replace(
  'const canAccessFieldTeams = ["district_manager", "provincial_coordinator", "national_admin", "gis_specialist"].includes(user.role || "") || isPlatformAdmin;',
  'const canAccessFieldTeams = user ? (["district_manager", "provincial_coordinator", "national_admin", "gis_specialist"].includes(user.role || "") || isPlatformAdmin) : false;'
);

fs.writeFileSync('c:/vaxplan/client/src/components/GlobalSearch.tsx', content);
console.log('Updated GlobalSearch.tsx successfully');
