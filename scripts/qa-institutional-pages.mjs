import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:5101";
const outputDir = path.resolve("tmp/institutional-qa");
fs.mkdirSync(outputDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const cases = [
  { path: "/partners", marker: "Transform Immunisation Microplanning into Action" },
  { path: "/demo", marker: "See VaxPlan in Action" },
  { path: "/partnership-concept", marker: "GIS-Enabled Immunisation Microplanning and Decision Support" },
];
const results = [];
for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  for (const testCase of cases) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("status of 401 (Unauthorized)")) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport(viewport);
    const response = await page.goto(`${baseUrl}${testCase.path}`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => Boolean(document.querySelector("h1")), { timeout: 20000 });
    const state = await page.evaluate((marker) => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim(),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
      markerFound: document.body.innerText.includes(marker),
    }), testCase.marker);
    const slug = testCase.path.slice(1);
    await page.screenshot({ path: path.join(outputDir, `${slug}-${viewport.name}.png`), fullPage: true });
    results.push({ path: testCase.path, viewport: viewport.name, status: response?.status(), errors, ...state });
    await page.close();
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.status !== 200 || result.errors.length || result.horizontalOverflow || !result.h1 || !result.description || !result.canonical || !result.markerFound)) process.exitCode = 1;
