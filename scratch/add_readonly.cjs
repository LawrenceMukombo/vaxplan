const fs = require('fs');
const filePath = 'client/src/pages/MicroplanWizard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all `<Step` occurrences with `<Step.. readOnly={isReadOnly}`
content = content.replace(/<Step1\n/g, '<Step1\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step2\n/g, '<Step2\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step3\n/g, '<Step3\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step4\n/g, '<Step4\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step5 staffing=\{staffing\} setStaffing=\{setStaffing\} facilityId=\{facilityId\} \/>/g, '<Step5 staffing={staffing} setStaffing={setStaffing} facilityId={facilityId} readOnly={isReadOnly} />');
content = content.replace(/<Step6\n/g, '<Step6\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step7\n/g, '<Step7\n                  readOnly={isReadOnly}\n');
content = content.replace(/<StepHfcBoard facilityId=\{facilityId\} \/>/g, '<StepHfcBoard facilityId={facilityId} readOnly={isReadOnly} />');
content = content.replace(/<StepChvProfile facilityId=\{facilityId\} villages=\{communities\} planType=\{planType\} \/>/g, '<StepChvProfile facilityId={facilityId} villages={communities} planType={planType} readOnly={isReadOnly} />');
content = content.replace(/<Step8 transport=\{transport\} setTransport=\{setTransport\} \/>/g, '<Step8 transport={transport} setTransport={setTransport} readOnly={isReadOnly} />');
content = content.replace(/<Step9\n/g, '<Step9\n                  readOnly={isReadOnly}\n');
content = content.replace(/<Step10\n/g, '<Step10\n                  readOnly={isReadOnly}\n');
// Step11 and Step12 don't need readOnly because they are view-only or summary usually, 
// but wait, Step11 is SummaryCard. The summary card has 'onEdit' links. If readOnly, should we disable onEdit? 
// No, onEdit just changes the current step. It's safe.

fs.writeFileSync(filePath, content);
console.log("Done");
