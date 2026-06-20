const fs = require('fs');
const readline = require('readline');

async function extract() {
  const fileStream = fs.createReadStream('C:\\Users\\Mukombo\\.gemini\\antigravity-ide\\brain\\a23ba46a-e9af-4fef-8ab7-a3b01335f03e\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let bestContent = "";
  for await (const line of rl) {
    if (line.includes('MicroplanWizardSteps.tsx')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for (const call of obj.tool_calls) {
            if (call.name === 'default_api:write_to_file' && call.arguments.TargetFile && call.arguments.TargetFile.includes('MicroplanWizardSteps.tsx')) {
              bestContent = call.arguments.CodeContent;
            }
          }
        }
      } catch (e) {}
    }
  }
  
  if (bestContent) {
    fs.writeFileSync('c:\\vaxplan\\VaxPlan\\client\\src\\pages\\MicroplanWizardSteps.tsx', bestContent);
    console.log("Restored from write_to_file! Length: " + bestContent.length);
  } else {
    console.log("Not found in write_to_file.");
  }
}
extract();
