const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function extractDocx() {
  const filePath = path.join('c:\\', 'vaxplan', 'docs', 'VaxPlan_White_Paper.docx');
  const result = await mammoth.convertToHtml({path: filePath});
  console.log("HTML length:", result.value.length);
  fs.writeFileSync(path.join('c:\\', 'vaxplan', 'VaxPlan', 'scratch', 'white_paper.html'), result.value);
}
extractDocx().catch(console.error);
