import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: false,
  maxBuffer: 20 * 1024 * 1024,
});
const report = JSON.parse(result.stdout || "{}");
const allowed = new Set(["image-size", "pptxgenjs"]);
const blocking = Object.entries(report.vulnerabilities ?? {}).filter(
  ([name, finding]) =>
    (finding.severity === "high" || finding.severity === "critical") && !allowed.has(name),
);
if (blocking.length) {
  for (const [name, finding] of blocking) console.error(`${finding.severity}: ${name}`);
  process.exit(1);
}
console.log("No unapproved high or critical production dependency findings.");
if (report.vulnerabilities?.pptxgenjs) {
  console.warn("Accepted temporary exception: pptxgenjs bundles vulnerable image-size; do not process untrusted presentation images.");
}
