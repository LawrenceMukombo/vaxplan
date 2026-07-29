const fs = require('fs');

// Fix GlobalSearch.tsx
let contentGS = fs.readFileSync('c:/vaxplan/client/src/components/GlobalSearch.tsx', 'utf-8');
contentGS = contentGS.replace('  user: User;', '  user: User | null;');
fs.writeFileSync('c:/vaxplan/client/src/components/GlobalSearch.tsx', contentGS);

// Fix AppSidebar.tsx
let contentAS = fs.readFileSync('c:/vaxplan/client/src/components/AppSidebar.tsx', 'utf-8');
contentAS = contentAS.replace('  const { isMobile } = useSidebar();\r\n', '');
contentAS = contentAS.replace('  const { isMobile } = useSidebar();\n', '');
fs.writeFileSync('c:/vaxplan/client/src/components/AppSidebar.tsx', contentAS);

console.log('Fixed files');
