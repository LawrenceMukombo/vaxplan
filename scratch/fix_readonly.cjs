const fs = require('fs');
const filePath = 'client/src/pages/MicroplanWizardSteps.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add readOnly to Step1
content = content.replace(
  /export function Step1\(\{\n/g,
  'export function Step1({\n  readOnly,\n'
);
content = content.replace(
  /setCampaignScopeDetails: \(v: \{ provinceIds: number\[\]; districtIds: number\[\]; facilityIds: number\[\] \}\) => void;\n\}\) \{/g,
  'setCampaignScopeDetails: (v: { provinceIds: number[]; districtIds: number[]; facilityIds: number[] }) => void;\n  readOnly?: boolean;\n}) {'
);
// Disable clicks in Step1
content = content.replace(/onClick=\{\(\) => clearScope\("provinceIds"\)\}/g, 'onClick={() => !readOnly && clearScope("provinceIds")}');
content = content.replace(/onClick=\{\(\) => toggleId\("provinceIds", pid\)\}/g, 'onClick={() => !readOnly && toggleId("provinceIds", pid)}');
content = content.replace(/onClick=\{\(\) => clearScope\("districtIds"\)\}/g, 'onClick={() => !readOnly && clearScope("districtIds")}');
content = content.replace(/onClick=\{\(\) => toggleId\("districtIds", did\)\}/g, 'onClick={() => !readOnly && toggleId("districtIds", did)}');

// 2. Add readOnly to AddStaffDialog
content = content.replace(
  /export function AddStaffDialog\(\{ facilityId \}: \{ facilityId: number \| null \}\) \{/g,
  'export function AddStaffDialog({ facilityId, readOnly }: { facilityId: number | null; readOnly?: boolean }) {'
);
content = content.replace(
  /<Button size="sm" variant="outline" onClick=\{\(\) => setOpen\(true\)\} type="button">/g,
  '<Button size="sm" variant="outline" onClick={() => setOpen(true)} type="button" disabled={readOnly}>'
);

// 3. Add readOnly to Step5
content = content.replace(
  /export function Step5\(\{ staffing, setStaffing, facilityId \}: \{ staffing: any\[\]; setStaffing: \(v: any\[\]\) => void; facilityId: number \| null \}\) \{/g,
  'export function Step5({ staffing, setStaffing, facilityId, readOnly }: { staffing: any[]; setStaffing: (v: any[]) => void; facilityId: number | null; readOnly?: boolean }) {'
);
// Add readOnly to AddStaffDialog inside Step5
content = content.replace(/<AddStaffDialog facilityId=\{facilityId\} \/>/g, '<AddStaffDialog facilityId={facilityId} readOnly={readOnly} />');
content = content.replace(/<Button size="icon" variant="ghost" onClick=\{\(\) => remove\(i\)\}>/g, '<Button size="icon" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>');

// 4. Add readOnly to AddColdChainDialog
content = content.replace(
  /export function AddColdChainDialog\(\{ facilityId, onAdded \}: \{ facilityId: number \| null; onAdded\?: \(\) => void \}\) \{/g,
  'export function AddColdChainDialog({ facilityId, onAdded, readOnly }: { facilityId: number | null; onAdded?: () => void; readOnly?: boolean }) {'
);

// 5. Add readOnly to Step6
content = content.replace(
  /export function Step6\(\{/g,
  'export function Step6({\n  readOnly,'
);
content = content.replace(
  /facilityId: number \| null;\n\}\) \{/g,
  'facilityId: number | null;\n  readOnly?: boolean;\n}) {'
);
content = content.replace(/<AddColdChainDialog facilityId=\{facilityId\} onAdded=\{\(\) => refetch\(\)\} \/>/g, '<AddColdChainDialog facilityId={facilityId} onAdded={() => refetch()} readOnly={readOnly} />');

// 6. StepHfcBoard
content = content.replace(
  /export function StepHfcBoard\(\{ facilityId \}: \{ facilityId: number \| null \}\) \{/g,
  'export function StepHfcBoard({ facilityId, readOnly }: { facilityId: number | null; readOnly?: boolean }) {'
);

// 7. StepChvProfile
content = content.replace(
  /export function StepChvProfile\(\{ facilityId, villages, planType = "routine" \}: \{ facilityId: number \| null; villages: any\[\]; planType\?: string \}\) \{/g,
  'export function StepChvProfile({ facilityId, villages, planType = "routine", readOnly }: { facilityId: number | null; villages: any[]; planType?: string; readOnly?: boolean }) {'
);

// 8. Step7
content = content.replace(
  /export function Step7\(\{/g,
  'export function Step7({\n  readOnly,'
);
content = content.replace(
  /villages: any\[\];\n\}\) \{/g,
  'villages: any[];\n  readOnly?: boolean;\n}) {'
);
content = content.replace(/<StepHfcBoard facilityId=\{facilityId\} \/>/g, '<StepHfcBoard facilityId={facilityId} readOnly={readOnly} />');
content = content.replace(/<StepChvProfile facilityId=\{facilityId\} villages=\{villages\} planType=\{planType\} \/>/g, '<StepChvProfile facilityId={facilityId} villages={villages} planType={planType} readOnly={readOnly} />');


// 9. Step8
content = content.replace(
  /export function Step8\(\{ transport, setTransport \}: \{ transport: any\[\]; setTransport: \(v: any\[\]\) => void \}\) \{/g,
  'export function Step8({ transport, setTransport, readOnly }: { transport: any[]; setTransport: (v: any[]) => void; readOnly?: boolean }) {'
);
content = content.replace(/<Button size="sm" variant="outline" onClick=\{add\} data-testid="button-add-budget">/g, '<Button size="sm" variant="outline" onClick={add} data-testid="button-add-budget" disabled={readOnly}>');

// 10. Step9
content = content.replace(
  /export function Step9\(\{/g,
  'export function Step9({\n  readOnly,'
);
content = content.replace(
  /setBudget: \(v: any\[\]\) => void;\n\}\) \{/g,
  'setBudget: (v: any[]) => void;\n  readOnly?: boolean;\n}) {'
);

// 11. Step10
content = content.replace(
  /export function Step10\(\{/g,
  'export function Step10({\n  readOnly,'
);
content = content.replace(
  /facilityId: number \| null;\n\}\) \{/g,
  'facilityId: number | null;\n  readOnly?: boolean;\n}) {'
);
content = content.replace(/<Button size="sm" variant="outline" onClick=\{add\} data-testid="button-add-supervision">/g, '<Button size="sm" variant="outline" onClick={add} data-testid="button-add-supervision" disabled={readOnly}>');


fs.writeFileSync(filePath, content);
console.log("Done");
