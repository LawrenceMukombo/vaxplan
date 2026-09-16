import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outputDir = path.resolve("output/pdf");
const publicDir = path.resolve("client/public/downloads");
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
const outputPath = path.join(outputDir, "VaxPlan-Partnership-Implementation-Brief-2026-2030.pdf");

const C = {
  navy: "#17395C", blue: "#2F6FA3", cyan: "#48A7C8", mint: "#DDF3EB",
  green: "#2D8A68", ink: "#17212B", grey: "#5D6A76", light: "#F4F7F9",
  line: "#D9E2E8", red: "#C74635", amber: "#D8952A", white: "#FFFFFF",
};
const doc = new PDFDocument({ size: "A4", margin: 46, info: {
  Title: "VaxPlan Partnership & Implementation Brief 2026–2030",
  Author: "VaxPlan",
  Subject: "GIS-enabled immunisation microplanning, operational intelligence and decision support",
  Keywords: "immunisation, microplanning, GIS, zero-dose, digital health, interoperability, partnership",
  Creator: "VaxPlan",
}});
const out = fs.createWriteStream(outputPath);
doc.pipe(out);

const W = 595.28, H = 841.89, M = 46, CW = W - M * 2;
let pageNo = 0;
function newPage(title, kicker = "VAXPLAN PARTNERSHIP BRIEF") {
  if (pageNo) doc.addPage();
  pageNo++;
  doc.rect(0, 0, W, H).fill(C.white);
  doc.fillColor(C.blue).font("Helvetica-Bold").fontSize(8).text(kicker, M, 34, { characterSpacing: 1.3 });
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(25).text(title, M, 55, { width: CW });
  doc.moveTo(M, 94).lineTo(W - M, 94).strokeColor(C.line).lineWidth(1).stroke();
  doc.fillColor(C.grey).font("Helvetica").fontSize(8).text(`VaxPlan  •  2026–2030`, M, H - 58);
  doc.text(`${pageNo}`, W - M - 20, H - 58, { width: 20, align: "right" });
}
function heading(text, y, color = C.navy) {
  doc.fillColor(color).font("Helvetica-Bold").fontSize(15).text(text, M, y, { width: CW });
}
function body(text, x, y, width, options = {}) {
  doc.fillColor(options.color || C.grey).font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.size || 10).text(text, x, y, { width, lineGap: options.lineGap ?? 3, align: options.align || "left" });
}
function card(x, y, w, h, title, text, accent = C.blue) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(C.light, C.line);
  doc.roundedRect(x, y, 5, h, 2).fill(accent);
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(11).text(title, x + 16, y + 14, { width: w - 27 });
  body(text, x + 16, y + 35, w - 27, { size: 8.8, lineGap: 2 });
}
function pill(text, x, y, color = C.blue) {
  const w = doc.widthOfString(text) + 18;
  doc.roundedRect(x, y, w, 22, 11).fill(color);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8).text(text, x + 9, y + 7);
  return w;
}
function flow(items, y, colors = [C.blue, C.green, C.cyan, C.navy]) {
  const gap = 7, w = (CW - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = M + i * (w + gap);
    doc.roundedRect(x, y, w, 46, 7).fill(colors[i % colors.length]);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5).text(item, x + 5, y + 17, { width: w - 10, align: "center" });
    if (i < items.length - 1) doc.fillColor(C.grey).fontSize(12).text("›", x + w, y + 14, { width: gap, align: "center" });
  });
}
function bullets(items, x, y, width, color = C.grey, size = 9.5) {
  let cy = y;
  items.forEach((item) => {
    doc.circle(x + 3, cy + 5, 2.1).fill(C.blue);
    body(item, x + 12, cy, width - 12, { color, size, lineGap: 2 });
    cy += doc.heightOfString(item, { width: width - 12, lineGap: 2 }) + 9;
  });
  return cy;
}
function mapVisual(x, y, w, h) {
  doc.roundedRect(x, y, w, h, 14).fill("#EAF2F2");
  const polys = [
    [[.07,.22],[.30,.08],[.48,.21],[.42,.48],[.17,.55]],
    [[.48,.21],[.75,.10],[.92,.32],[.74,.52],[.42,.48]],
    [[.17,.55],[.42,.48],[.62,.71],[.45,.92],[.13,.82]],
    [[.42,.48],[.74,.52],[.88,.78],[.62,.71]],
  ];
  polys.forEach((p, i) => { doc.polygon(...p.map(([px,py]) => [x+px*w,y+py*h])).fillAndStroke(i%2 ? "#D7ECE3" : "#DCECF5", C.white); });
  doc.moveTo(x+w*.08,y+h*.76).bezierCurveTo(x+w*.30,y+h*.62,x+w*.45,y+h*.34,x+w*.88,y+h*.22).strokeColor(C.amber).lineWidth(3).stroke();
  [[.22,.38],[.57,.31],[.68,.64],[.39,.71],[.81,.44]].forEach(([px,py], i) => {
    doc.circle(x+px*w,y+py*h,i===2?7:5).fill(i===2?C.red:C.blue);
    doc.circle(x+px*w,y+py*h,2).fill(C.white);
  });
  doc.save().opacity(.22).fillColor(C.red).circle(x+w*.68,y+h*.64,25).fill().restore();
}

// 1 — Cover
pageNo = 1;
doc.rect(0, 0, W, H).fill(C.navy);
doc.rect(0, 0, 13, H).fill(C.cyan);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(14).text("VAXPLAN", M, 56, { characterSpacing: 2 });
doc.fillColor("#BDE4F1").font("Helvetica").fontSize(9).text("PARTNERSHIP & IMPLEMENTATION", M, 78, { characterSpacing: 1.4 });
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(31).text("VaxPlan Partnership &\nImplementation Brief", M, 152, { width: 480, lineGap: 4 });
doc.fillColor("#BDE4F1").fontSize(23).text("2026–2030", M, 246);
body("GIS-Enabled Immunisation Microplanning, Operational Intelligence and Decision Support", M, 312, 360, { color: C.white, size: 14, lineGap: 5 });
mapVisual(286, 410, 260, 230);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(20).text("Reach every child.\nPlan every session.", M, 475, { width: 220, lineGap: 5 });
doc.fillColor("#BDE4F1").font("Helvetica").fontSize(10).text("vaxplan.org", M, H - 65, { link: "https://vaxplan.org", underline: true });

// 2 — Executive summary
newPage("Executive Summary");
body("VaxPlan is a GIS-enabled immunisation planning, operational intelligence and decision-support platform. It helps programmes translate population, settlement, facility, accessibility and performance data into practical microplans, service-delivery choices and monitorable vaccination sessions.", M, 118, CW, { size: 13, color: C.ink, lineGap: 5 });
card(M, 210, 242, 112, "The opportunity", "Planning information is often distributed across maps, spreadsheets and programme systems. VaxPlan provides a structured operational layer without displacing those systems.", C.amber);
card(M+261, 210, 242, 112, "Why GIS", "Location changes the decision: who is underserved, which facility is responsible, where outreach is feasible and which route or delivery strategy fits.", C.green);
card(M, 340, 242, 112, "How it integrates", "API-ready workflows can consume approved data from DHIS2, registries, LMIS, facility registries, census, field tools and geospatial sources.", C.blue);
card(M+261, 340, 242, 112, "The partnership", "Co-design a bounded proof of concept, evaluate operational value and readiness, and scale only after agreed evidence and governance gates.", C.cyan);
heading("Proposed collaboration pathway", 492);
flow(["Demonstrate", "Pilot", "Evaluate", "Scale"], 528);
body("VaxPlan is designed to complement national architecture—not replace DHIS2, electronic immunisation registries, logistics systems or field data-collection tools.", M, 604, CW, { size: 11, color: C.navy, bold: true, align: "center" });

// 3 — Challenge
newPage("The Planning Challenge");
body("Immunisation teams already hold valuable data and expertise. The practical challenge is connecting these assets into a repeatable planning cycle that reaches from national priorities to the last settlement.", M, 118, CW, { size: 12, color: C.ink });
flow(["Population", "Maps", "Catchments", "Targets", "Sessions"], 188);
flow(["Vaccines", "Transport", "Budget", "Delivery", "Monitoring"], 251, [C.green,C.cyan,C.blue,C.amber]);
heading("Common friction points", 332);
const challenge = [
  ["Fragmented inputs", "Approved estimates, geographic data and delivery records may live in different systems."],
  ["Repeated preparation", "Plans are frequently reconstructed instead of reused, reviewed and progressively improved."],
  ["Limited spatial translation", "Data describe performance, but do not always reveal which settlement or access barrier needs action."],
  ["Weak feedback loops", "Completed sessions and local learning do not consistently update the next planning cycle."],
];
challenge.forEach((c,i)=>card(M+(i%2)*261,382+Math.floor(i/2)*118,242,100,c[0],c[1],i===2?C.red:C.blue));
body("The opportunity is not another parallel reporting system. It is a coherent planning and decision layer that makes existing data operational.", M, 654, CW, { size: 12, bold: true, color: C.navy, align: "center" });

// 4 — Approach
newPage("The VaxPlan Approach");
flow(["Plan", "Optimise", "Implement", "Monitor", "Learn"], 125);
heading("From population intelligence to accountable delivery", 205);
flow(["Population", "Settlements", "Facilities", "Catchments"], 244);
flow(["Accessibility", "Service gaps", "Strategy", "Microplan"], 305, [C.cyan,C.red,C.green,C.blue]);
flow(["Resources", "Sessions", "Monitoring", "Performance"], 366, [C.amber,C.blue,C.green,C.navy]);
const approach = [
  ["Operational", "Every map layer should support a concrete planning or supervisory decision."],
  ["Reusable", "Structured plans can be revised instead of recreated each cycle."],
  ["Traceable", "Roles, approvals, changes and implementation status remain visible."],
];
approach.forEach((c,i)=>card(M+i*170,470,156,112,c[0],c[1],[C.blue,C.green,C.amber][i]));
body("The result is a shared operational picture for facility, district and national teams—adapted to programme rules and country governance.", M, 625, CW, { size: 12, color: C.navy, bold: true, align: "center" });

// 5 — GIS
newPage("Geospatial Intelligence");
mapVisual(M, 122, 300, 290);
heading("A map is useful when it changes a decision", 122 + 310);
body("VaxPlan connects spatial context to catchment definition, service strategy, resource planning and follow-up. It can combine approved facility and settlement coordinates with population surfaces, boundaries and access constraints.", M, 466, 300, { size: 10.5 });
card(365,122,184,83,"Facilities & communities","See responsibility, proximity and unserved areas.",C.blue);
card(365,218,184,83,"Access & travel","Use distance, routes and context to assess feasibility.",C.amber);
card(365,314,184,83,"Catchments & gaps","Compare expected service extent with planned delivery.",C.red);
card(365,410,184,83,"Population overlays","Prioritise places using approved denominators and spatial estimates.",C.green);
card(365,506,184,83,"Operational action","Open or revise a microplan, session or follow-up action from the geographic insight.",C.cyan);
body("Illustrative visual only. Operational decisions must use country-approved data, thresholds and programme rules.", M, 676, CW, { size: 8.5, color: C.grey, align: "center" });

// 6 — Equity
newPage("Zero-Dose and Equity");
body("VaxPlan can surface geographic patterns associated with missed services: remote settlements, catchment gaps, high population clusters, difficult travel and planned-session absence. These signals help programmes prioritise investigation and action.", M, 120, CW, { size: 12, color: C.ink });
card(M,205,242,127,"Geographic zero-dose risk","A planning inference based on place, population, access and service-delivery evidence. It points teams to areas that may be underserved.",C.red);
card(M+261,205,242,127,"Confirmed individual status","Requires appropriate individual-level registry or verified programme data. VaxPlan should not claim individual zero-dose status without this evidence.",C.green);
heading("Equity-oriented decision cycle", 378);
flow(["Locate", "Understand", "Prioritise", "Plan", "Verify"], 416, [C.red,C.amber,C.blue,C.green,C.navy]);
bullets([
  "Identify settlements and populations outside expected service reach.",
  "Examine accessibility, gender, demand, insecurity and other locally relevant barriers.",
  "Select fixed, outreach or mobile strategies using national policy and field judgement.",
  "Monitor planned versus completed sessions and update the evidence base.",
], M, 500, CW);

// 7 — Microplanning
newPage("Digital Microplanning");
body("Structured workflows convert programme guidance into a transparent, reviewable operational plan while preserving space for local judgement and comments.", M, 118, CW, { size: 12, color: C.ink });
const mp = [
  ["1", "Area & targets", "Catchments, communities, denominators and delivery strategy"],
  ["2", "Sessions & teams", "Calendar, session type, workload and staffing"],
  ["3", "Supplies & access", "Vaccines, consumables, cold chain, transport and budget"],
  ["4", "Review & learn", "Supervision, approvals, monitoring and revision"],
];
mp.forEach((c,i)=>{
  const y=195+i*112; doc.circle(M+23,y+30,20).fill([C.blue,C.green,C.amber,C.navy][i]);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(14).text(c[0],M+15,y+23,{width:16,align:"center"});
  card(M+55,y,448,88,c[1],c[2],[C.blue,C.green,C.amber,C.navy][i]);
});
body("Role-based workflow gates and an approval audit trail support programme governance. Requirements should be configured to the national process, not hard-coded as universal rules.", M, 672, CW, { size: 10.5, color: C.navy, bold: true });

// 8 — Campaigns
newPage("Campaigns and Monitoring");
body("Campaign operations require a faster cadence than routine planning while still benefiting from shared geographic and resource foundations.", M, 118, CW, { size: 12, color: C.ink });
flow(["Prepare", "Deploy", "Supervise", "Correct", "Review"], 181, [C.blue,C.green,C.amber,C.red,C.navy]);
const camps = [
  ["Readiness", "Operational areas, teams, supplies, training and deployment readiness."],
  ["Implementation", "Daily activity, missed places, emerging constraints and corrective action."],
  ["Supervision", "Structured checks, escalation, geographic oversight and accountability."],
  ["Learning", "Post-campaign review, performance patterns and reusable improvements."],
];
camps.forEach((c,i)=>card(M+(i%2)*261,270+Math.floor(i/2)*132,242,112,c[0],c[1],[C.blue,C.green,C.amber,C.navy][i]));
heading("Separate programme semantics", 561);
body("Routine and supplementary immunisation activities require distinct plan types, schedules, targets, session records and rollups. Shared infrastructure should never blur their totals or accountability.", M, 596, CW, { size: 11, color: C.navy });

// 9 — Interoperability
newPage("Interoperability");
body("VaxPlan is an integration and intelligence layer. It is designed to complement national systems and reuse authoritative data through governed exchanges.", M, 118, CW, { size: 12, color: C.ink });
const sources=["DHIS2","EIR","LMIS","HFR","ODK / Kobo / CommCare","National statistics","GIS & boundaries"];
sources.forEach((s,i)=>pill(s,M+(i%4)*125,185+Math.floor(i/4)*36,[C.blue,C.green,C.cyan,C.amber][i%4]));
doc.moveTo(W/2,264).lineTo(W/2,305).strokeColor(C.grey).lineWidth(2).stroke();
doc.polygon([W/2-5,300],[W/2+5,300],[W/2,310]).fill(C.grey);
doc.roundedRect(130,315,335,90,12).fillAndStroke(C.navy,C.navy);
doc.fillColor(C.white).font("Helvetica-Bold").fontSize(20).text("VaxPlan",130,337,{width:335,align:"center"});
doc.font("Helvetica").fontSize(9).text("Integration • GIS • Planning • Operational intelligence",130,368,{width:335,align:"center"});
doc.moveTo(W/2,405).lineTo(W/2,446).strokeColor(C.grey).lineWidth(2).stroke();
doc.polygon([W/2-5,441],[W/2+5,441],[W/2,451]).fill(C.grey);
flow(["Microplans", "Maps", "Dashboards", "Decisions"], 460);
heading("Integration principles", 548);
bullets(["Country-owned identifiers and master data.","Documented, versioned APIs and standards-based exchange where feasible.","Least-privilege access, auditability and data minimisation.","No parallel reporting requirement unless explicitly agreed for a bounded pilot."],M,584,CW);

// 10 — Deployment
newPage("Deployment Architecture");
body("Deployment should follow country policy, data classification, connectivity and operational ownership—not a one-size-fits-all hosting assumption.", M, 118, CW, { size: 12, color: C.ink });
flow(["Country cloud", "Government cloud", "Approved cloud", "On-premise", "Hybrid"], 180);
const layers=[
  ["User experience","Responsive web application; installable/offline patterns where configured"],
  ["Application services","APIs, workflow logic, validation, reporting and integrations"],
  ["Data services","PostgreSQL/PostGIS, governed files, backups and retention"],
  ["Security & operations","RBAC, encryption, audit logs, monitoring, recovery and incident response"],
];
layers.forEach((l,i)=>card(M,265+i*92,CW,75,l[0],l[1],[C.blue,C.green,C.amber,C.navy][i]));
body("A production deployment requires a signed security and operations design: identity, environments, backups, recovery objectives, observability, patching, support and data-processing responsibilities.", M, 660, CW, { size: 10.5, color: C.navy, bold: true });

// 11 — Models
newPage("Partnership Models");
const models=[
  ["Demonstrate","1–2 sessions","Validate use cases, workflow fit and stakeholder interest."],
  ["Pilot","3–6 months","Configure, train, deploy and evaluate a bounded implementation."],
  ["Scale","Phased expansion","Extend proven workflows, integrations and support capacity."],
  ["Nationalise","Institutional ownership","Localise, govern, operate and continuously improve nationally."],
];
models.forEach((m,i)=>{
  const x=M+(i%2)*261,y=126+Math.floor(i/2)*220;
  doc.roundedRect(x,y,242,190,10).fillAndStroke(C.light,C.line);
  pill(m[0],x+16,y+16,[C.blue,C.green,C.amber,C.navy][i]);
  body(m[1],x+16,y+55,210,{bold:true,color:C.ink,size:11});
  body(m[2],x+16,y+82,210,{size:10});
  body(["Purpose confirmed","Scope agreed","Outputs documented","Decision gate"][i],x+16,y+143,210,{size:9,color:C.blue,bold:true});
});
heading("Partnership contributions", 594);
body("Country leadership and programme expertise • authoritative data and policy • implementation and integration capacity • independent evaluation • catalytic financing • long-term operational ownership", M, 630, CW, { size: 11, color: C.navy, align: "center" });

// 12 — POC
newPage("Example Proof of Concept");
doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(34).text("3",M,123,{width:80,align:"center"});
body("districts",M,164,80,{bold:true,align:"center",color:C.grey});
doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(34).text("20–30",194,123,{width:120,align:"center"});
body("health facilities",194,164,120,{bold:true,align:"center",color:C.grey});
doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(34).text("3–6",408,123,{width:90,align:"center"});
body("months",408,164,90,{bold:true,align:"center",color:C.grey});
const phases=["Discovery","Configuration","Data preparation","Training","Deployment","Support","Evaluation","Scale decision"];
phases.forEach((p,i)=>{
  const y=232+i*58; doc.circle(M+13,y+13,13).fill(i<5?C.blue:C.green);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8).text(`${i+1}`,M+7,y+9,{width:12,align:"center"});
  body(p,M+40,y+5,180,{bold:true,color:C.ink,size:10.5});
  body(["Confirm priorities, users and governance","Localise workflows and reference data","Validate facility, settlement and denominator sources","Prepare administrators, planners and reviewers","Launch bounded operational use","Resolve issues and coach teams","Measure usability, operations and outcomes","Agree stop, adapt or expand" ][i],235,y+5,314,{size:9});
});
body("Illustrative scope only. Final design and budget are co-developed after discovery and data-readiness review.", M, 714, CW, { size: 9, color: C.grey, align: "center" });

// 13 — M&E
newPage("Monitoring and Evaluation Framework");
body("A pilot should begin with an agreed theory of change, baseline, indicator definitions, data sources and decision gates.", M, 118, CW, { size: 12, color: C.ink });
const indicators=[
  ["Adoption","Facilities with completed microplans; active users; user satisfaction"],
  ["Efficiency","Time to develop or update a microplan; reuse of approved reference data"],
  ["Geographic equity","Previously unmapped settlements; population spatially allocated; service gaps identified"],
  ["Delivery","Planned versus completed outreach sessions; cancelled or rescheduled sessions"],
  ["Data quality","Synchronisation success; validation exceptions; denominator confidence"],
  ["Decision use","Programme decisions informed by GIS outputs; corrective actions closed"],
  ["Reliability","Availability, incident resolution and backup/recovery tests"],
  ["Institutionalisation","Trainers prepared; governance routines; recurrent financing and support ownership"],
];
indicators.forEach((it,i)=>card(M+(i%2)*261,185+Math.floor(i/2)*118,242,100,it[0],it[1],[C.blue,C.green,C.amber,C.navy][i%4]));
body("No impact claim should be made without an appropriate evaluation design and verified programme data.", M, 682, CW, { size: 10, color: C.red, bold: true, align: "center" });

// 14 — Sustainability
newPage("Sustainability and Ownership");
body("Sustainability is designed through governance, people, standards and financing—not added at the end of a pilot.", M, 118, CW, { size: 12, color: C.ink });
const sustain=[
  ["Government ownership","Named product owner, steering mechanism and decision rights."],
  ["Local capacity","Master trainers, administrators, support teams and documented procedures."],
  ["Interoperability","Reuse authoritative registries and standards; avoid avoidable duplication."],
  ["Progressive handover","Milestones for configuration, operations, support and roadmap ownership."],
  ["Total cost of ownership","Hosting, connectivity, support, integrations, devices, training and change management."],
  ["Reusable configuration","Country rules and workflows maintained as governed assets."],
];
sustain.forEach((s,i)=>card(M+(i%2)*261,184+Math.floor(i/2)*135,242,116,s[0],s[1],[C.blue,C.green,C.amber,C.navy,C.cyan,C.blue][i]));
heading("A responsible scale decision", 618);
body("Proceed when the programme has evidence of workflow value, data readiness, user adoption, integration feasibility, security acceptability and an affordable operating model.", M, 653, CW, { size: 11, color: C.navy, bold: true });

// 15 — Invitation + references
newPage("Partnership Invitation", "PARTNERSHIP INVITATION");
doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(21).text("Build the Next Generation of Immunisation Microplanning With Us", M, 120, { width: CW });
body("VaxPlan invites Ministries of Health, EPI programmes, WHO, UNICEF, Gavi, Africa CDC, research institutions, implementation partners and donors to explore a country-led demonstration or proof of concept.", M, 177, CW, { size: 12, color: C.ink, lineGap: 4 });
flow(["Technical collaboration", "Pilot implementation", "Independent evaluation"], 257);
flow(["Integration partnership", "Implementation research", "Catalytic financing"], 318, [C.green,C.cyan,C.amber]);
heading("Start the conversation", 397);
body("Request a demonstration", M, 437, 210, { size: 14, bold: true, color: C.blue });
body("https://vaxplan.org/demo", M, 463, 210, { size: 10, color: C.blue });
doc.link(M, 459, 210, 18, "https://vaxplan.org/demo");
body("Explore partnership", 330, 437, 210, { size: 14, bold: true, color: C.blue });
body("https://vaxplan.org/partners", 330, 463, 210, { size: 10, color: C.blue });
doc.link(330, 459, 210, 18, "https://vaxplan.org/partners");
heading("Selected references", 514);
body("World Health Organization. Reaching Every District (RED): a guide to increasing coverage and equity in all communities in the African Region (2017).", M, 548, CW, { size: 8.2 });
body("World Health Organization. Digital Implementation Investment Guide: Integrating Digital Interventions into Health Programmes (2020).", M, 580, CW, { size: 8.2 });
body("World Health Organization. SMART Guidelines: standards-based, machine-readable, adaptive, requirements-based and testable guidance.", M, 612, CW, { size: 8.2 });
body("UNICEF. Digital health and information systems: digitally enabled health systems drive results for children.", M, 644, CW, { size: 8.2 });
body("Gavi, the Vaccine Alliance. Zero-dose children and missed communities; equity goal and operational definitions.", M, 676, CW, { size: 8.2 });
body("Contact: info@vaxplan.org  •  vaxplan.org", M, 735, CW, { size: 11, bold: true, color: C.navy, align: "center" });

doc.end();
await new Promise((resolve, reject) => { out.on("finish", resolve); out.on("error", reject); });
fs.copyFileSync(outputPath, path.join(publicDir, path.basename(outputPath)));
console.log(outputPath);
