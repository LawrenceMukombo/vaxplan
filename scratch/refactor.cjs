const fs = require('fs');
const path = require('path');

const srcFile = 'client/src/pages/MicroplanWizard.tsx';
const destFile = 'client/src/pages/MicroplanWizardSteps.tsx';

let content = fs.readFileSync(srcFile, 'utf8');
const lines = content.split('\n');

const stepIndex = lines.findIndex(l => l.startsWith('function NumberField({'));

let topPart = lines.slice(0, stepIndex);
let bottomPart = lines.slice(stepIndex);

// Identify imports
let importLines = [];
let i = 0;
while (i < topPart.length) {
  if (topPart[i].startsWith('import ')) {
    let importStmt = topPart[i];
    while (!importStmt.includes(';') && i < topPart.length) {
      i++;
      importStmt += '\n' + topPart[i];
    }
    importLines.push(importStmt);
  }
  i++;
}

// Add exports to topPart for constants/types needed by bottomPart
topPart = topPart.map(line => {
  if (line.startsWith('type StepDef')) return line.replace('type StepDef', 'export type StepDef');
  if (line.startsWith('const STEPS')) return line.replace('const STEPS', 'export const STEPS');
  if (line.startsWith('const ANTIGENS')) return line.replace('const ANTIGENS', 'export const ANTIGENS');
  if (line.startsWith('const BUDGET_CATEGORIES')) return line.replace('const BUDGET_CATEGORIES', 'export const BUDGET_CATEGORIES');
  if (line.startsWith('const FUNDING_SOURCES')) return line.replace('const FUNDING_SOURCES', 'export const FUNDING_SOURCES');
  if (line.startsWith('function WhatToDo')) return line.replace('function WhatToDo', 'export function WhatToDo');
  return line;
});

// Export all components in bottomPart
bottomPart = bottomPart.map(line => {
  if (line.startsWith('function ')) return line.replace('function ', 'export function ');
  return line;
});

// Create MicroplanWizardSteps.tsx
const destContent = importLines.join('\n') + `
import { 
  StepDef, STEPS, ANTIGENS, BUDGET_CATEGORIES, FUNDING_SOURCES, WhatToDo 
} from './MicroplanWizard';
` + '\n\n' + bottomPart.join('\n');

fs.writeFileSync(destFile, destContent);

// Add imports to MicroplanWizard.tsx
const componentsToImport = [];
bottomPart.forEach(line => {
  const match = line.match(/^export function ([A-Za-z0-9_]+)\(/);
  if (match) {
    componentsToImport.push(match[1]);
  }
});

const topContent = topPart.join('\n') + `\nimport {\n  ${componentsToImport.join(',\n  ')}\n} from './MicroplanWizardSteps';\n`;

fs.writeFileSync(srcFile, topContent);

console.log('Refactoring complete.');
