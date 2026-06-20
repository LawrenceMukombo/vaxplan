const fs = require('fs');

let wiz = fs.readFileSync('client/src/pages/MicroplanWizard.tsx', 'utf8');
wiz = wiz.replace('type ExcludedVillageDetail = {', 'export type ExcludedVillageDetail = {');
wiz = wiz.replace('function currentQuarter() {', 'export function currentQuarter() {');
wiz = wiz.replace('function formatRemovedAt(iso: string | null): string {', 'export function formatRemovedAt(iso: string | null): string {');
fs.writeFileSync('client/src/pages/MicroplanWizard.tsx', wiz);

let steps = fs.readFileSync('client/src/pages/MicroplanWizardSteps.tsx', 'utf8');
steps = steps.replace(
  "StepDef, STEPS, ANTIGENS, BUDGET_CATEGORIES, FUNDING_SOURCES, WhatToDo \n}",
  "StepDef, STEPS, ANTIGENS, BUDGET_CATEGORIES, FUNDING_SOURCES, WhatToDo,\n  ExcludedVillageDetail, currentQuarter, formatRemovedAt\n}"
);
fs.writeFileSync('client/src/pages/MicroplanWizardSteps.tsx', steps);

console.log('Fixed exports');
