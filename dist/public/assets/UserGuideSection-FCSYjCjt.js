import{r as i,u as B,j as n,C as N,c as j,a as L,b as W,n as ie,B as U,t as Y,o as b,bi as oe,W as se,at as le,a4 as ce,aV as de,aq as ue}from"./index-DSonOqZm.js";import{P as he}from"./progress-C_vmrIJO.js";import{A as pe,a as me,b as ge,c as ye}from"./accordion-CY38TFd2.js";import{A as fe}from"./award-SyD-dqmO.js";import{L as ve}from"./lock-V1KVt8xD.js";import{T as H}from"./trophy-Cr1670wx.js";import{M as Q,r as $}from"./index-D4qQx7Du.js";const we=`# VaxPlan — End-User Guide\r
\r
> A practical, role-by-role manual for the VaxPlan GIS microplanning\r
> platform. Use the table of contents to jump to your role.\r
\r
**Audience:** Ministry of Health staff at every level — facility\r
clerks, facility in-charges, district managers, provincial coordinators,\r
national administrators, and tenant onboarding leads.\r
\r
**Version:** This document is kept in lockstep with the running\r
application. If a screen looks different in your environment, your\r
tenant administrator may have customised the labels (for example\r
"Province" → "Region") — the workflows below are unchanged.\r
\r
---\r
\r
## Table of Contents\r
\r
1. [What VaxPlan does](#1-what-vaxplan-does)\r
2. [Roles at a glance](#2-roles-at-a-glance)\r
3. [Signing in](#3-signing-in)\r
4. [The home screen and switching country](#4-the-home-screen-and-switching-country)\r
5. [Facility staff — your daily workflow](#5-facility-staff--your-daily-workflow)\r
   - 5.1 [Build a routine microplan](#51-build-a-routine-microplan)\r
   - 5.2 [Plan a session](#52-plan-a-session)\r
   - 5.3 [Run a session in the field](#53-run-a-session-in-the-field)\r
   - 5.4 [Mark a session done](#54-mark-a-session-done)\r
   - 5.5 [Coverage and the under-immunised list](#55-coverage-and-the-under-immunised-list)\r
   - 5.6 [Stock, wastage, and supply](#56-stock-wastage-and-supply)\r
   - 5.7 [Offline mode and sync](#57-offline-mode-and-sync)\r
   - 5.8 [Manage your communities](#58-manage-your-communities)\r
6. [District managers — review and oversight](#6-district-managers--review-and-oversight)\r
7. [Provincial coordinators — approvals and visibility](#7-provincial-coordinators--approvals-and-visibility)\r
8. [National administrators](#8-national-administrators)\r
9. [Tenant onboarding (new Ministry of Health)](#9-tenant-onboarding-new-ministry-of-health)\r
10. [Map and boundary management](#10-map-and-boundary-management)\r
11. [Settlement intelligence and zero-dose targeting](#11-settlement-intelligence-and-zero-dose-targeting)\r
13. [Supervision visits & scorecards](#13-supervision-visits)\r
14. [Supportive Supervision, Executive Scorecards & Smart Cascading Filters](#14-supportive-supervision-executive-scorecards--smart-cascading-filters)\r
15. [Reports and exports](#14-reports-and-exports)\r
16. [Indicator reference manual](#14b-indicator-reference-manual)\r
17. [Troubleshooting](#15-troubleshooting)\r
18. [Data sources and acknowledgements](#16-data-sources-and-acknowledgements)\r
19. [Glossary](#17-glossary)\r
\r
---\r
\r
## 1. What VaxPlan does\r
\r
VaxPlan is a multi-country microplanning system used by Ministries of\r
Health to plan, run, and track routine immunisation and supplementary\r
immunisation activities (SIAs).\r
\r
**Core workflows it covers:**\r
\r
- **Microplanning:** facility-level quarterly plans that combine\r
  catchment population, vaccine schedules, and outreach intent into a\r
  list of executable sessions.\r
- **Session execution:** scheduling, running, and closing out\r
  vaccination sessions (fixed-site, outreach, mobile).\r
- **Coverage analytics:** by antigen, by dose, by month, by location,\r
  with under-immunised and zero-dose surfacing.\r
- **Stock and supply:** vaccine requirements, wastage thresholds,\r
  cold-chain stock balances, and reconciliation.\r
- **Supervision:** scheduled supervisory visits with rolled-up\r
  reporting to district and province.\r
- **Mapping:** every facility, village, settlement, and session plotted\r
  on Leaflet maps with admin boundary overlays (GeoBoundaries +\r
  custom GeoJSON uploads).\r
- **Multitenant SaaS:** each Ministry of Health is a separate tenant\r
  with its own data, users, and SSO. Every account belongs to exactly\r
  one country and can only ever access that country. The single\r
  exception is a **Super Admin**, who can access and switch between all\r
  countries from the header.\r
\r
**See the full feature list.** For a complete, plain-language catalogue\r
of everything VaxPlan can do today, open **Standards Alignment** from the\r
sidebar and select the **Features** tab. It groups every feature by area\r
(dashboards, microplanning, vaccines & stock, maps & GIS, supervision,\r
users & access, offline & sync, security, and more), and the filter box\r
lets you jump straight to anything.\r
\r
**Where the data lives.** Everything is stored in PostgreSQL on a\r
tenant-isolated schema. Facility and village reference data is loaded\r
once during onboarding and then maintained by national administrators.\r
Day-to-day operational data (sessions, coverage, stock) is written by\r
facility staff.\r
\r
---\r
\r
## 2. Roles at a glance\r
\r
| Role | What they can do | Where they work |\r
| --- | --- | --- |\r
| **Facility clerk** | Authors microplans and sessions, captures session results, manages stock balances. | Their own facility only. |\r
| **Facility in-charge** | Same as clerk, plus signs off (submits) the microplan and session results. | Their own facility only. |\r
| **District manager** | Reviews and approves microplans from facilities in the district, runs supervision visits, reads coverage. | Their district. |\r
| **Provincial coordinator** | Approves district-level plans, sees rolled-up coverage, escalates issues. | Their province. |\r
| **National admin** | Manages users, facilities, vaccine schedule, labels, boundaries, and the country dashboard. | Their own country only. |\r
| **Super Admin** | Onboards new countries, configures SSO, provisions national admins, and is the only role that can access and switch between all countries (and promote other Super Admins). | All countries. |\r
\r
Microplan authoring (creating new microplans and session plans) is\r
**reserved for facility staff** (clerk and in-charge), so accountability\r
stays with the people who actually run the sessions. National admins can\r
also author when setting up or correcting a country's data. District\r
managers and provincial coordinators are reviewers and approvers only —\r
they cannot author plans on a facility's behalf.\r
\r
---\r
\r
## 3. Signing in\r
\r
VaxPlan supports two sign-in modes:\r
\r
1. **Email and password** (used during onboarding and colleague\r
   testing).\r
2. **Tenant SSO** — once your Ministry of Health is fully onboarded,\r
   you sign in with your own organisational identity (OIDC or SAML —\r
   for example Microsoft Entra, Google Workspace, Okta).\r
\r
**To sign in:**\r
\r
1. Open the VaxPlan URL provided by your administrator (each tenant\r
   has either a subdomain or a path-based URL).\r
2. Click **Sign in**.\r
3. You will be redirected to your identity provider; complete the\r
   login there.\r
4. On first login, your home tenant is set automatically from your\r
   email domain (if your administrator has configured a domain\r
   mapping) or from the signup invite you accepted. You'll land on\r
   your home tenant's dashboard.\r
\r
If you signed up but no role has been granted yet, you'll see a\r
"pending approval" message. Your district or national administrator\r
needs to confirm your role before you can use the system. They will\r
receive an inbox notification automatically.\r
\r
**Passwords (email sign-in):**\r
\r
- **Change your own password.** Click your name in the top-right\r
  corner and choose **Change password**. Enter your current password\r
  (leave it blank if you've never set one), then your new password\r
  twice. Passwords must be at least 8 characters.\r
- **Forgot your password?** On the sign-in screen click **Forgot\r
  password?** and enter your email. Your administrator is notified so\r
  they can set a new one for you, which they'll share with you\r
  securely.\r
- **Administrators** can set or reset passwords for users — see\r
  section 8.\r
\r
---\r
\r
## 4. The home screen and switching country\r
\r
The header has three constant elements:\r
\r
- **Country switcher (top-left)** — this appears **only for a Super\r
  Admin**. It shows the current country and a dropdown to switch\r
  between all countries. Switching changes which country's data you're\r
  working in. Every other account is permanently locked to its own\r
  country and never sees this switcher.\r
- **Navigation sidebar (collapsible)** — your modules. Items that\r
  your role can't access are hidden, so the menu adapts to who you\r
  are.\r
- **Profile menu (top-right)** — language, theme (light/dark), and\r
  sign-out.\r
\r
**Country isolation rule:** every account — including a national admin\r
— can only ever access its own country. There is no way to view or\r
edit another country's data. Only a Super Admin can move between\r
countries; when a Super Admin switches, they act fully within whichever\r
country they have selected. A Super Admin can also grant Super Admin to\r
another user from that user's edit screen (Users → open a user → Super\r
Admin access).\r
\r
**What you can see within your country.** VaxPlan also scopes data by\r
your place in the hierarchy. A facility clerk or in-charge sees only\r
their **own facility's** facilities, villages, population, microplans,\r
sessions, and reports. A district manager sees their district; a\r
provincial coordinator sees their province; a national admin sees the\r
whole country. You won't see — or be able to open — a record that\r
belongs to a facility outside your area, even with a direct link. This\r
keeps each facility's data private to the people responsible for it.\r
\r
---\r
\r
## 5. Facility staff — your daily workflow\r
\r
This is the most important section for clerks and in-charges. Read it\r
end-to-end the first time, then return to specific subsections as\r
needed. There is also a separate one-page card,\r
\`QUICKSTART_FACILITY.md\`, you can print and pin next to your\r
workstation.\r
\r
### 5.1 Build a routine microplan\r
\r
A **microplan** is your facility's quarterly plan. It declares:\r
\r
- which villages your facility serves this quarter,\r
- the target population (under-1s and pregnant women by default —\r
  configurable per tenant),\r
- the antigens you will offer,\r
- the outreach sessions you intend to run (fixed-site sessions are\r
  automatic).\r
\r
**Steps:**\r
\r
1. From the sidebar, open **Microplans → Routine**. You will see a list of your facility's saved microplans in a sortable and searchable table showing the plan name, period, status, and planned vs. completed session counts. You can sort by columns, filter by plan name, and use the page size selectors and pagination controls.\r
2. Click **New microplan** (or click **Open** on an existing plan in the table to resume editing). The wizard opens.\r
3. **Step 1 — Scope.** Pick the quarter and year. Your facility is\r
   pre-filled from your profile and cannot be changed.\r
4. **Step 2 — Catchment.** Tick the villages the facility will serve\r
   this quarter. The list is your facility's assigned villages from\r
   the registry. If a community is missing you can add it yourself —\r
   see **5.8 Manage your communities** below — then return to the\r
   wizard.\r
5. **Step 3 — Population.** Confirm the target denominators. Three\r
   data sources feed this:\r
   - **Registered population** (your registry, the default),\r
   - **WorldPop raster** (an open population grid — useful for\r
     remote villages without a recent census), and\r
   - **Manual override** (with a justification note).\r
   Pick the source per village; the wizard sums everything and shows\r
   you the totals.\r
6. **Step 4 — Vaccine schedule.** The default schedule is your\r
   tenant's. Untick antigens that don't apply (for example, if your\r
   facility doesn't carry HPV).\r
7. **Step 5 — Outreach intent.** Declare how many outreach sessions\r
   per village you expect to run. The system creates one session\r
   plan per (village × month × declared count). You can edit\r
   individual sessions later.\r
8. **Step 6 — Review and submit.** Check the totals, then **Save as\r
   draft** (you can keep editing) or **Submit for approval** (your\r
   district manager sees it in their queue).\r
\r
> **Tip.** You can save a draft at any step. Drafts are private to you\r
> until you submit.\r
\r
### 5.2 Plan a session\r
\r
Once a microplan is approved, its sessions appear on the **Sessions**\r
page. Each session is created automatically from the microplan's\r
outreach intent. You can also add ad-hoc sessions for defaulter\r
follow-up.\r
\r
**To edit a session:**\r
\r
1. Open **Sessions** from the sidebar.\r
2. Use the **Province → District → Facility** cascade filter at the\r
   top to find your sessions. The row count below changes as you\r
   filter.\r
3. Click a session name. The edit dialog opens.\r
4. Fill in:\r
   - **Scheduled date** — the day you'll run it.\r
   - **Site type** — fixed, outreach, or mobile.\r
   - **Villages served** (for outreach) — pick from the facility's\r
     catchment.\r
   - **Cold-chain plan** — vaccine carrier, ice packs, expected\r
     vaccines.\r
5. Click **Save**.\r
\r
If GPS coordinates are missing for the village, the system warns you\r
when you save and offers a "Capture GPS now" link to record them from\r
your phone in the field.\r
\r
**Tip — plan from the calendar.** On **All sessions**, pick a day and\r
click **Plan a session on this day**. This opens the New Session form\r
(not the microplan wizard) with the date already filled in; pick the\r
parent microplan and the form inherits its facility, quarter, year, and\r
target population.\r
\r
**Add itinerary days.** Inside a session, use **Add Vaccination Session\r
Itinerary Day** to plan each outreach day. Each day needs a **lead\r
vaccinator**, a **date at least 7 days ahead**, a **target population**,\r
and at least one **community** (tick from the list or quick-add from the\r
map). The **Calculated Vaccine Supplies** panel estimates realistic doses\r
per antigen — target × doses-per-child × wastage — so ~50 children yields\r
tens of doses, not thousands. If a day won't save, the error names the\r
field that needs fixing.\r
\r
### 5.3 Run a session in the field\r
\r
The session execution screen is designed for use **offline**, on a\r
phone or tablet, while you're at the village.\r
\r
1. From **Sessions**, tap your session for today.\r
2. Tap **Start session**. The screen switches to capture mode.\r
3. For each child or pregnant woman vaccinated:\r
   - Tap **Add client** (or scan their card if you've enabled barcode\r
     scanning).\r
   - Pick the antigens administered. The system auto-picks the next\r
     due dose based on the schedule.\r
   - Confirm.\r
4. The session totals update live. Stock balances on the device\r
   decrement automatically.\r
\r
You can capture an entire day's session with no connectivity. The\r
device queues every entry into an **offline outbox** (see 5.7).\r
\r
### 5.4 Mark a session done\r
\r
After you've finished vaccinating:\r
\r
1. Tap **Mark session done**.\r
2. Confirm the per-antigen counts. The system pre-fills these from\r
   your capture; you can adjust if your physical tally differs.\r
3. Add session notes (issues, no-shows, supply problems).\r
4. Tap **Submit**.\r
\r
**What happens behind the scenes:**\r
\r
- Per-antigen counts are validated against your tenant's vaccine\r
  schedule. Known codes are stored under their canonical name (so\r
  \`opv-1\` and \`OPV-1\` are treated the same).\r
- Unknown codes — usually from older offline entries — are stored in a\r
  separate bucket so they still count toward totals but don't pollute\r
  per-antigen rollups. You'll see a warning if any were found, and\r
  your national admin can review them in the audit log.\r
- Stock movements are recorded.\r
- The session is locked. Reopening requires district approval.\r
\r
### 5.5 Coverage and the under-immunised list\r
\r
**Coverage** is shown on the **Coverage** page. You'll see:\r
\r
- Coverage by antigen, this quarter and year-to-date.\r
- A heatmap of villages by coverage percentage.\r
- An **under-immunised list** of children who have started but not\r
  completed a vaccine series (for example, OPV-1 done but OPV-2\r
  missing past the due date).\r
\r
**Acting on the under-immunised list:**\r
\r
- Click a child to see their full vaccination history.\r
- Click **Create defaulter follow-up session** to spin up a new\r
  outreach session targeting that child's village. The session is\r
  tagged so it shows up under the **Defaulter follow-up only** filter\r
  on the Sessions page.\r
\r
### 5.6 Stock, wastage, and supply\r
\r
The **Stock** page tracks vaccine balances at your facility:\r
\r
- **On hand** by antigen and lot, with expiry dates.\r
- **Receipts** — when supply arrives from the district, enter the\r
  delivery note.\r
- **Issues** — automatic when you mark a session done, manual if\r
  you give vaccines to another facility.\r
- **Wastage** — auto-computed from session counts vs. opened vials,\r
  with a per-antigen wastage threshold. Vials wasted above threshold\r
  trigger an alert visible to your in-charge and district manager.\r
\r
The **monthly stock summary** is your end-of-month return: review,\r
adjust if you find a discrepancy on physical count, and submit.\r
\r
### 5.6b Cold Chain Equipment Inventory\r
\r
Every health facility tracks its vaccine storage equipment (refrigerators, freezers, solar direct drive units, vaccine carriers, and generators). \r
* **Viewing and Adding Equipment:** Open **Facilities** from the sidebar, click on your health facility, and switch to the **Cold Chain** tab. You can add new equipment, specify the condition (Functional, Needs Repair, Non-Functional, Condemned, Decommissioned), brand/model, serial number, storage capacity in litres, temperature ranges, and installation details.\r
* **Bulk Actions:** You can perform operations concurrently on multiple selected equipment items. Select multiple items in the list to reveal the floating actions toolbar at the bottom of the table to bulk delete, update condition, or make items active/inactive.\r
* **Interoperability (CSV & IGA):** To support Inventory and Gap Analysis (IGA), you can export the facility cold-chain assets to a standard CSV file or a specialized IGA-compatible JSON file. You can also import equipment lists from a CSV file directly.\r
\r
### 5.7 Offline mode and sync\r
\r
VaxPlan works without an internet connection. Here's what you need\r
to know:\r
\r
- The first time you sign in, the app **caches your reference data**\r
  (facilities, villages, vaccine schedule, microplans) into an\r
  on-device IndexedDB.\r
- When you create or update something offline (a session result, a\r
  stock movement, a new defaulter session), it goes into an\r
  **outbox**. The header shows a small cloud/sync badge with the number\r
  of pending items.\r
- **"Sync now" is built into the header.** The sync badge is always\r
  visible. Whenever you're online, tap it to push your outbox and pull\r
  the latest server data immediately — whether you have items queued or\r
  just want a refresh. While you're offline it shows your status and\r
  pending count, and syncs as soon as you're back online.\r
- When connectivity returns, the outbox **syncs automatically in the\r
  background** — even if you've closed the tab or locked the phone, on\r
  devices that support background sync (most Android browsers). On\r
  devices that don't (for example iPhones), it syncs the next time you\r
  open the app.\r
- **Live updates across devices.** While you're online, VaxPlan keeps a\r
  lightweight live connection open. If a colleague — or you on another\r
  device — changes something for your facility, your screen refreshes\r
  within a few seconds, with no manual reload. If that live connection\r
  drops, the app quietly falls back to periodic checks.\r
- If a sync entry is rejected (for example, a session was already\r
  closed on the server), the system shows the rejection inline and\r
  asks you to resolve it.\r
\r
> **Best practice.** Sync at the end of each session day, when you're\r
> back in cellular range. Don't let the outbox grow longer than a\r
> week's worth of entries.\r
\r
### 5.8 Manage your communities\r
\r
You can add and edit the communities (villages) your facility serves —\r
you don't need to wait for your national admin.\r
\r
**To add a community:**\r
\r
1. Open **Facilities** from the sidebar and switch to the\r
   **Communities** tab.\r
2. Click **Add Community**.\r
3. **Facility.** If you're facility staff, the facility is pinned to\r
   your own facility and can't be changed. District staff can pick any\r
   facility in their district; coordinators and admins get a searchable\r
   **Province → District → Facility** picker.\r
4. Fill in the community **name** and any other details.\r
5. **Set the location.** Either drop a **single pin** for the centre of\r
   the community, or switch to **Draw Polygon Mode** and click points on\r
   the map to trace the community's **catchment boundary**. When you save a custom polygon boundary, VaxPlan uses Location Intelligence and PostGIS to intersect the polygon with WorldPop spatial data and calculates the precise estimated population living inside that boundary automatically. Boundaries are saved in the \`gis_polygons\` table and shown on the map everywhere in the app, and can be reused later.\r
6. Click **Save**.\r
\r
> **Note.** Facility and district staff can add and edit **communities**,\r
> but only provincial coordinators and national admins can add a new\r
> **health facility**. The **Add Facility** button is hidden for staff\r
> who aren't allowed to use it.\r
\r
**Communities Registry & Bulk Actions:** Under the Communities tab, you can manage all assigned villages:\r
* **Customize Columns:** Click the **Columns** dropdown next to "Add Community" to show/hide dynamic administrative level columns or metadata like HTR status and coordinates.\r
* **Floating Bulk Actions:** Tick checkboxes on individual community rows (or select all) to activate the floating actions bar. You can bulk delete, bulk update Hard-to-Reach status, bulk update transit modes, or reassign communities in batch to another facility. All bulk updates are processed concurrently in batches of 10 requests.\r
\r
**Catchment overlap and harmonization.** If the boundary you draw\r
overlaps another community's catchment, VaxPlan shows a **Catchment\r
overlap detected** panel after you save. It lists each overlapping\r
community, the other facility, and how much they overlap. To resolve a\r
clash, click **Request harmonization** next to a community: VaxPlan\r
records the conflict and emails that community's facility in-charge so\r
the two facilities can agree on who covers the shared area.\r
\r
---\r
\r
## 6. District managers — review and oversight\r
\r
You sit between facilities and the province. Your day-to-day:\r
\r
- **Approval queue.** Open **Approvals**. You'll see microplans\r
  submitted by facilities in your district. For each, you can:\r
  - **Approve** — the plan locks and its sessions go live.\r
  - **Request changes** — the plan returns to the facility with your\r
    note.\r
  - **Reject** — for plans that should be rebuilt from scratch.\r
- **Coverage rollup.** The **Coverage** page shows you the whole\r
  district at a glance. Drill down by facility or village.\r
- **Supervision visits.** Schedule visits to facilities; see §13.\r
- **Stock alerts.** You'll receive a weekly digest of facilities with\r
  stockouts, wastage above threshold, or upcoming expiries.\r
- **Cross-facility intelligence.** The **Map** view shows every\r
  session in your district pinned by status (planned, conducted,\r
  overdue, cancelled). Use it to spot uneven coverage by location.\r
\r
You **cannot** author microplans for a facility — that responsibility\r
stays with facility staff. You can, however, edit catchment\r
assignments (which villages belong to which facility) if you spot a\r
boundary issue.\r
\r
---\r
\r
## 7. Provincial coordinators — approvals and visibility\r
\r
Your role mirrors the district manager's, scoped to the province:\r
\r
- District-level **plan approvals**: when a district manager signs off\r
  on aggregated district-level outreach plans (for SIAs, mostly),\r
  they come to you next.\r
- **Province-wide coverage** dashboards.\r
- **Cross-district comparison** — see which districts are on track\r
  and which are slipping.\r
- **Resource allocation** — request stock reallocations between\r
  districts using the **Supply request** workflow.\r
\r
You also have access to the **National admin** read-only views (you\r
cannot edit users or facilities, but you can see them).\r
\r
---\r
\r
## 8. National administrators\r
\r
National admins are the power users for your country. Your modules:\r
\r
- **Users & Staff.** Invite users, assign roles, suspend or reactivate accounts.\r
  * **Password Controls:** When creating a user you can set an **initial password** so they can sign in right away, and you can **reset any user's password** later from the user's edit screen (open a user → **Reset Password**). Passwords must be at least 8 characters — share them with the user securely. (Only national admins and Super Admins see these password controls. A national admin can only manage users in **their own country**; a Super Admin can manage users in whichever country they're working in.)\r
  * **Staff Management Bulk Actions:** Open the **Staff** management table. You can perform batch updates concurrently on multiple selected staff members by ticking checkboxes on the left side of the rows (or selecting the header box to select all) to reveal the floating actions bar. You can bulk delete, toggle active/inactive status, update routine roles, or update training status in batches of 10.\r
- **Facilities.** The registry of all facilities. Import from CSV (a\r
  template is downloadable), edit GPS coordinates, merge duplicates,\r
  or retire facilities.\r
- **Villages and catchments.** The same for villages. The **catchment\r
  matrix** lets you assign villages to facilities.\r
- **Vaccine schedule.** Your tenant's authoritative schedule.\r
  Adding an antigen here makes it available in microplans nationwide.\r
- **Labels.** Customise the administrative level labels (e.g.\r
  "Province" → "Region" for South Sudan).\r
- **Boundaries.** See §10.\r
- **Country dashboard.** Top-line KPIs for the country, including\r
  coverage by antigen, dropout rates, stock health, and supervision\r
  compliance.\r
- **Approvals (escalations).** Anything a district or province\r
  rejected escalates to you.\r
- **Audit log.** Every change to sensitive data is logged with who,\r
  when, and what.\r
- **Safe Deployments.** All updates to the VaxPlan database use the \`safe-migration\` protocol, ensuring additive, non-destructive schema changes so your operational data is never wiped during new releases.\r
- **Site activity.** A panel on your country dashboard shows who is\r
  online right now and where they are signed in from, a live map\r
  pinning those users, visits today and over the last two weeks, your\r
  busiest pages, and a breakdown of login locations. Users stay counted\r
  as online while their tab is open — the app sends a quiet heartbeat —\r
  so someone reading a single page without clicking around still shows\r
  up. When a user allows location access in their browser, the map uses\r
  their device's real GPS position; otherwise it falls back to a\r
  best-effort estimate from the network address, which often resolves\r
  only to the nearest large city. Platform super admins can tap any\r
  online person for full detail — email, IP address, device, and exact\r
  coordinates. It is visible only to national and platform\r
  administrators.\r
\r
National admins can also configure **scheduled jobs** — population\r
refresh from WorldPop, stock-alert digests, and supervision digests\r
all run on schedules you can tune in **Settings → Schedules**.\r
\r
---\r
\r
## 9. Tenant onboarding (new Ministry of Health)\r
\r
This section is for the VaxPlan **Super Admin** onboarding a new country.\r
Onboarding a new country is **restricted to Super Admins** — country\r
administrators (national admins) manage only their own country and cannot\r
add new countries. The **Country Onboarding** screen (sidebar →\r
Administration → Country Onboarding) is hidden from everyone except Super\r
Admins, and it carries a built-in step-by-step guide that mirrors the\r
steps below.\r
\r
1. **Create the tenant.** Use **Settings → Tenants → New** and pick:\r
   - Country name and ISO-3 code.\r
   - Default time zone.\r
   - Default admin level labels (e.g. Province/District/Facility,\r
     or Region/State/Health Area).\r
   - Default vaccine schedule (clone from a sibling country if you\r
     have one, then edit).\r
2. **Configure SSO.** Add the OIDC or SAML configuration for the\r
   ministry's identity provider. Test the connection before going\r
   live.\r
3. **Map email domains.** Adding \`@health.gov.xx\` makes anyone who\r
   signs in from that domain land on this tenant by default.\r
4. **Provision the first national admin.** They will receive an\r
   invite email and be able to onboard everyone else.\r
5. **Load reference data.**\r
   - Admin boundaries — use the **Boundary Manager** (§10).\r
   - Facilities — import via CSV.\r
   - Villages and catchments — import via CSV.\r
   - Population — either ingest a WorldPop raster (national admin\r
     can do this on demand) or rely on registered population.\r
   - Where you only have an open facility list with province (but not\r
     district) labels, VaxPlan can fill in districts automatically by\r
     matching each facility's GPS coordinates against GeoBoundaries\r
     ADM2 polygons. See \`docs/COUNTRY_ONBOARDING.md\` for the repeatable\r
     prep-and-seed scripts (used to onboard South Africa).\r
6. **Set the approval workflow.** Decide whether plans need 1, 2, or\r
   3 levels of approval (facility → district → province → national).\r
7. **Go live.** The national admin sends out user invites and\r
   training links.\r
\r
---\r
\r
## 9b. Local Development Database & Restore\r
\r
VaxPlan includes a compressed database dump \`local_dump.sql.zip\` in the root of the project. This dump contains all available development data, including pre-seeded mock health facilities, routine/campaign microplans, volunteer/CHV profiles, spatial boundary definitions, performance indexes, indicators, and multi-tenant profiles (e.g., Zambia and South Africa).\r
\r
To set up your local development database with this data:\r
\r
1. **Unzip the Database Dump**:\r
   Unzip the compressed archive to extract the raw SQL dump file:\r
   \`\`\`bash\r
   unzip local_dump.sql.zip\r
   \`\`\`\r
\r
2. **Restore to PostgreSQL**:\r
   Make sure you have a local PostgreSQL database named \`vaxplan\` running, then restore the dump using \`psql\`:\r
   \`\`\`bash\r
   psql -U postgres -d vaxplan -f local_dump.sql\r
   \`\`\`\r
   *Note: If your local database has different credentials, adjust the username (\`-U\`) and database name (\`-d\`) accordingly.*\r
\r
3. **Verify Restored Schema**:\r
   Run the dev server (\`npm run dev\`) and test the landing page to verify that all country tenants (Zambia, South Africa, etc.) are listed and accessible with pre-configured demo credentials.\r
\r
---\r
\r
## 10. Map and boundary management\r
\r
Every map in VaxPlan (Sessions, Coverage, Settlement intelligence,\r
Microplans) draws boundaries on top of OpenStreetMap tiles.\r
\r
> **Boundary disclaimer.** The credit at the bottom-right of every map\r
> carries a short notice that boundaries are approximate, for planning\r
> and reference only, and do not imply endorsement — and that disputed\r
> areas are not authoritatively depicted. The full statement, including\r
> how disputed regions are handled, is in the **Acknowledgements** on the\r
> Data Sources page (§16).\r
\r
Boundaries come from two sources:\r
\r
- **GeoBoundaries API** — public, covers 200+ countries, available\r
  for admin levels 0 to 2 or 3 depending on the country.\r
- **Custom GeoJSON upload** — your own files, for levels GeoBoundaries\r
  doesn't cover (e.g. South Sudan Payam) or for your authoritative\r
  national geometry.\r
\r
**To fetch from GeoBoundaries:**\r
\r
1. Open **Settings → Boundary Manager**.\r
2. Click **Fetch from GeoBoundaries API**.\r
3. Pick country and admin level. Level names are pre-filled (you can\r
   edit them).\r
4. Click **Fetch Boundaries**. Large countries (Nigeria, DRC,\r
   Ethiopia) take 30 to 60 seconds.\r
\r
**To upload custom GeoJSON:**\r
\r
1. In Boundary Manager, click **Upload Custom GeoJSON**.\r
2. **ISO-3 country code** (3 letters, e.g. \`SSD\`, \`ZMB\`, \`PNG\`).\r
3. Pick the admin level and edit the level label if needed.\r
4. Choose the file (\`.geojson\` or \`.json\`). Files up to 50 MB are\r
   accepted.\r
5. Click **Upload & Store**.\r
\r
> **GADM users.** GADM ships shapefiles, not GeoJSON. Convert with\r
> the free [mapshaper.org](https://mapshaper.org) website (drag in\r
> the \`.shp\`, \`.shx\`, \`.dbf\` files, export as GeoJSON).\r
\r
---\r
\r
## 11. Settlement intelligence and zero-dose targeting\r
\r
For countries where village-level registration is patchy (parts of\r
South Sudan, PNG highlands, Sahel), VaxPlan offers a **settlement\r
intelligence** layer. It overlays:\r
\r
- WorldPop-derived populated cells (250m or 1km).\r
- Building footprints (GRID3) and detected zero-dose clusters.\r
- 5 km service-coverage gaps and suggested outreach sites.\r
\r
The population heatmap is read in **real people**, not an abstract\r
density figure. Each coloured cell shows the estimated number of people\r
living in that small grid cell (about 100 m × 100 m, roughly one\r
hectare), and the legend is labelled in people. When you **click any\r
point on the map**, the popup gives you a real headcount — the estimated\r
number of people living within 1 km of that point, worked out by adding\r
up the people in every nearby grid cell — so you can plan an outreach\r
session straight from the number without converting density yourself.\r
\r
The **Zero-dose map** uses this data to highlight settlements with no\r
recorded vaccinations. Click a hotspot to:\r
\r
- See the settlement's estimated population.\r
- See the nearest facility and travel time.\r
- Create an outreach session targeting the hotspot.\r
\r
**Geospatial Insights (real travel time and nearby assets).** On any\r
zero-dose cluster card or settlement record, click the **Insights**\r
(compass) button to open the Geospatial Insights panel. It shows:\r
\r
- **Travel time to the nearest facility and the nearest outreach\r
  site**, calculated on the real road network (OpenStreetMap routing) —\r
  each with both a **driving** and a **walking** estimate, the road\r
  distance, and a badge noting whether it's a true road route or a\r
  straight-line estimate (used automatically if routing is briefly\r
  unavailable, so the panel always answers). Existing outreach sites are\r
  often closer to a remote cluster than a fixed facility, so the panel\r
  shows whichever is relevant — or both, clearly labelled.\r
- **The route drawn on the map.** While the Insights panel is open, the\r
  map highlights the inspected point and draws a line to each\r
  destination — the actual road geometry when a route is available\r
  (or a dashed straight line when it falls back to an estimate) — and\r
  marks the nearest facility and outreach site, so you can judge terrain\r
  and direction at a glance. The map fits the view around the route\r
  automatically.\r
- **Community assets within 3 km** — schools, places of worship,\r
  markets, water points, transport nodes, pharmacies / drug stores,\r
  universities and colleges, government offices, transport &\r
  logistics features (airstrips, helipads, ferry terminals, river\r
  crossings, bridges, fuel stations, taxi ranks), and\r
  vulnerable-population sites (refugee/IDP camps and mining sites)\r
  pulled live from OpenStreetMap, each with\r
  its distance and a clearly coloured icon. These show what services\r
  already exist near a cluster, which helps you pick an outreach venue.\r
  If a remote cluster has nothing mapped nearby, the panel says so.\r
\r
**Outreach Site Suitability Score (0–100).** Every unserved cluster gets\r
a single, easy-to-read score that answers one question: *how good a\r
candidate is this place for a new outreach session?* A higher score means\r
a stronger case. The score combines six things, each shown as its own\r
bar so you can see exactly why a cluster scored the way it did:\r
\r
- **Population size** — more unserved people means more impact.\r
- **Likely zero-dose children** — the core equity target; clusters with\r
  more estimated never-vaccinated children score higher.\r
- **Distance from the nearest facility** — the farther, the bigger the\r
  access gap a new site would fill.\r
- **Existing-outreach gap** — how far the cluster is from any outreach\r
  site you already run (so you don't double up).\r
- **Road access / travel time** — a site a team can actually reach scores\r
  higher.\r
- **Nearby landmark / venue** — a school, place of worship or market\r
  makes a natural place to hold the session.\r
\r
The list view scores every cluster quickly using the data already on\r
hand (so anything still being measured is clearly marked **est.**). When\r
you open **Insights** on a cluster, the score is **refined live** using\r
the real road-network travel time and the landmarks actually found\r
nearby, and the panel also shows the estimated number of under-5 children\r
and likely zero-dose children there.\r
\r
**Ranked "Unserved Population Clusters" list.** The left panel lists\r
every pending unserved cluster, ranked by suitability score by default.\r
Use the **Sort** dropdown to re-order by suitability, population,\r
zero-dose children, distance to facility, outreach gap or travel time —\r
whatever matters most for your plan. Each row shows the score, the factor\r
breakdown and the key numbers, with three actions: **Locate** (centre the\r
map on it), **Insights** (open the refined breakdown and routes) and —\r
for facility staff who can author plans — **Plan session** (jump straight\r
to Session Planning, pre-filled for that cluster). This is a planning view\r
only: it never changes any data and only shows clusters for your country.\r
\r
**Ranked clusters on the map.** Turn on the **Ranked Clusters** layer in\r
the Map Layers Control panel to plot the same scored clusters from the\r
left panel directly on the map. Each pin is colour-graded by suitability\r
band — **green** for high, **amber** for medium, **grey** for low — so you\r
can judge geography and clustering at a glance alongside the facility and\r
zero-dose layers. Click a pin to see its score, population, likely\r
zero-dose children, distance to the nearest facility and outreach gap,\r
with the same **Locate**, **Insights** and (for facility staff)\r
**Plan session** actions as the list. Like the list, it's a planning view\r
only and shows clusters for your country.\r
\r
**More map layers** (toggle them in the **Map Layers Control**\r
panel, top-right of the map):\r
\r
- **Travel-time zones** — travel-time zones around every health\r
  facility **and every active outreach site** (outreach posts are often\r
  closer to a remote cluster than a fixed facility, so they give a fuller\r
  picture of real-world access), with a **Walking / Driving / Cycling**\r
  toggle in the Map Layers Control panel. Walking shows about 1, 2, and 3\r
  hours on foot; Driving shows about 30, 60, and 90 minutes by vehicle\r
  (useful for planning vehicle-based outreach and supply runs); Cycling\r
  shows about 30, 60, and 90 minutes by bicycle or motorbike (useful for\r
  outreach teams that travel by two-wheeler). When road routing is available\r
  these follow the real road and path network (so a settlement across a\r
  river or behind a ridge correctly shows as far), giving a far more\r
  trustworthy picture than plain circles. If routing is briefly\r
  unavailable, the layer falls back to simple dashed rings so you always\r
  see something — see at a glance which clusters fall outside a\r
  reasonable walking, driving, or cycling distance. On a busy map the\r
  zones can overlap a lot, so a second toggle lets you show only\r
  **Facilities**, only **Outreach** sites, or **Both** — focus on one\r
  access question at a time. (Both the road-network zones and the\r
  fallback rings respect the choice.)\r
- **Community assets** — plots schools, water points, pharmacies,\r
  universities and colleges, government offices, transport & logistics\r
  features, vulnerable-population sites, and other assets found within 5 km of\r
  the current map centre, each with its own coloured icon. Pan or click\r
  **Locate** on a cluster, then turn this layer on to scan what's\r
  around it.\r
\r
> Travel times and community assets come from open data and are a\r
> planning aid, not a survey. Always confirm on the ground.\r
\r
### 11.1 Settlements: Definitions, Classifications, and Caching\r
In VaxPlan, a **Settlement** (or village community) represents a discrete populated area tracked under the gridded population databases. Settlements are classified into three core service statuses:\r
- **Served**: The settlement is assigned to an active health facility, and the distance to that facility is 5 km or less.\r
- **Underserved**: The settlement is assigned to a health facility, but the distance to that facility is greater than 5 km, representing an access bottleneck.\r
- **Unserved**: The settlement has no assigned health facility. Unserved settlements represent critical coverage gaps that are prioritized for outreach planning.\r
\r
**Outreach Post Configuration**: For any settlement catchment, facility staff and managers can configure a persistent outreach site on the Map View. Tap the village pin, select "Configure" under the Outreach Post section, and set the location. You can autofill coordinates from the centroid, manually enter them, capture live GPS from your device, or select a point directly on the map. This creates a high-contrast violet pin connected to the centroid by a dashed line, saved to PostgreSQL with offline IndexedDB fallback.\r
\r
**Offline Basemap Cache**: Base maps (ArcGIS Satellite Imagery and WorldPop Overlays) are cached automatically up to 2,500 tiles via the browser Service Worker. This ensures that managers and field workers can explore and coordinate settlements interactively even in remote, cross-border regions with zero internet connectivity.\r
\r
### 11.2 Recommendations: Rule-Based Analysis and Generative AI\r
Recommendations are actionable strategies to resolve coverage gaps, generated by the VaxPlan Geospatial Intelligence Engine (VGIE). They reside in the \`vgieRecommendations\` registry with status values (\`pending\`, \`actioned\`, \`dismissed\`) and priority ranks (\`high\`, \`medium\`, \`low\`).\r
\r
VaxPlan offers two generation channels:\r
1. **Rule-Based Catchment Analysis**: Triggered manually on demand or via background schedules. The engine scans the database for unassigned or unserved settlements:\r
   - High-risk settlements trigger **High-priority** recommendations to "Establish emergency outreach session".\r
   - Hard-to-reach settlements trigger **Medium-priority** recommendations to "Plan quarterly outreach visit".\r
   - Standard unserved settlements trigger **Low-priority** recommendations to "Add regular outreach visit".\r
2. **Generative AI Recommendation Engine**: By clicking "AI Generate" in the Recommendations module, the system leverages an LLM backend to analyze country-wide stats, gridded population metrics, and facility distribution patterns. The AI produces contextual, multi-dimensional suggestions to optimize outreach schedules, reallocate staff, or propose new structural health posts.\r
\r
*Workflow*: Planners can view details, adjust priority levels, add custom operational notes, and update the status to **Actioned** (once incorporated into a microplan) or **Dismissed**.\r
\r
### 11.3 Alerts: Coverage Gaps, Severity Bands, and Resolution\r
Alerts in VaxPlan are automated, real-time warning indicators flagged by background geospatial analysis to highlight structural failures or high-risk gaps in the immunization network.\r
\r
Key attributes of VaxPlan Alerts:\r
- **Unassigned Hard-to-Reach (HTR) Alerts**: Raised automatically whenever a settlement marked as "isHardToReach" is detected without any assigned health facility.\r
- **Unserved Population Alerts**: Triggered during catchment scans when multiple high-risk settlements are found completely unserved by the health network.\r
- **Severity Levels**:\r
  - **High**: Urgent gaps (e.g. large unassigned high-risk populations) requiring immediate outreach deployment.\r
  - **Warning**: Moderate concerns (e.g. high vaccine wastage or missing coordinates on planned outreach routes).\r
  - **Info**: Operational notes (e.g. newly detected gridded settlement clusters).\r
- **Dismissal and Resolution**: Active alerts appear on the dashboard and supervisor queues. District and national managers can review the alert, coordinate corrective actions (such as assigning the settlement to a facility or planning a session), and click **Dismiss** to change the status to "resolved".\r
\r
This module is most useful for the **district manager**,\r
**provincial coordinator**, and **national admin** roles when planning\r
quarterly microplanning calendars.\r
\r
---\r
\r
## 12. Settings, customisation, and labels\r
\r
National admins can adjust the look and feel of the app for their\r
country:\r
\r
- **Admin level labels.** Each tenant can rename the four hierarchy\r
  levels. The default is Country / Province / District / Facility.\r
  Common alternatives:\r
  - South Sudan: Country / State / County / Payam.\r
  - PNG: Country / Province / District / Local-Level Government.\r
  - Zambia: Country / Province / District / Constituency.\r
- **Branding.** Upload your ministry logo; it appears on the header\r
  and on all PDF exports.\r
- **Languages.** Choose the default language for users in your\r
  tenant. English, French, and Portuguese are bundled; ask the\r
  VaxPlan team for additions.\r
- **Vaccine schedule.** Add antigens and doses; mark which are\r
  routine vs. campaign.\r
- **Wastage thresholds.** Per antigen, what percentage of doses\r
  wasted triggers an alert.\r
\r
---\r
\r
## 13. Supervision visits\r
\r
Supervision is a first-class workflow:\r
\r
1. **Schedule visits.** Open **Supervision → Schedule Visit**, pick a\r
   facility, a date, and a supervisor. You can also choose which\r
   **checklist** to use — the built-in WHO checklist, or any custom\r
   checklist your national admin has built (see below).\r
2. **Visit checklist.** When the supervisor arrives, they open the\r
   visit on their phone. A **progress bar** at the top shows how many\r
   questions are answered and the **live score** updates as they go. A\r
   **Visit location** card confirms where the visit happened using a\r
   smart **Province → District → Health Facility** picker plus an\r
   **interactive map** — tap the map to drop a pin, drag it to\r
   fine-tune, or tap **Use my location** to place it from the device's\r
   GPS. They then answer the checklist questions. Questions\r
   can be Yes/No, True/False, short text, a number, single- or\r
   multiple-choice, a 1–5 rating, a date, a **GPS location** (picked\r
   the same way, on a map), or a **photo** taken on the device.\r
   Some questions are **follow-ups** that only appear after a\r
   particular answer (for example, an "If No, why?" box that shows up\r
   only when the previous question is answered "No"). Other questions\r
   are **repeatable** — tap **Add another** to record one entry per\r
   vaccinator, session, or child, and remove an entry you don't need.\r
3. **Findings and actions.** Record findings and follow-up actions,\r
   and set the next visit date.\r
4. **Score.** The visit score is the average of the scored questions —\r
   Yes/No and True/False answers, plus any ratings the checklist author\r
   chose to count. Every repeated entry counts, so the entries are\r
   averaged together automatically. N/A and hidden follow-ups are\r
   ignored.\r
\r
The **Supervision digest** (a weekly summary) rolls up overdue\r
visits to the district and provincial dashboards.\r
\r
### Custom supervision checklists (national admins)\r
\r
National admins can build their own checklists so every facility in\r
the country uses the same questions:\r
\r
1. Open **Supervision → Manage Checklists**.\r
2. Click **New checklist**, give it a name, and add questions. For\r
   each question pick a type (Yes/No, True/False, short text, number,\r
   single choice, multiple choice, rating, date, GPS location, or\r
   photo), and add options for choice questions.\r
3. Make any question highly configurable:\r
   - **Follow-up:** under any question, click **Add a follow-up\r
     question**. The new question appears indented beneath it, and you\r
     choose which answer reveals it (e.g. show it only when the question\r
     is answered "No", or whenever it has any answer). Any question can\r
     have follow-ups — including the first one — and you can **Detach** a\r
     follow-up to make it a normal question again.\r
   - **Repeat:** turn on "Allow multiple entries" so supervisors can\r
     add as many entries as needed during a visit. You can name each\r
     entry (e.g. "Vaccinator") and cap how many are allowed.\r
   - **Scoring:** choose whether each Yes/No or True/False question\r
     counts toward the score, and opt a rating in so it counts too.\r
4. Mark a checklist **Active** to make it available when scheduling\r
   visits. Anyone in the country can then pick it; only national\r
   admins can create, edit, or delete the checklists themselves.\r
\r
---\r
\r
## 14. Reports and exports\r
\r
Most tables in VaxPlan have an **Export** button that produces an\r
Excel workbook with the currently filtered rows.\r
\r
For more formal outputs, use **Reports → Generate**:\r
\r
- **Quarterly microplan return** (PDF, per facility).\r
- **District coverage report** (PDF, per district per month).\r
- **Stock and wastage report** (Excel, per facility per month).\r
- **Supervision report** (PDF, per visit).\r
\r
All reports honour the geo filters you've selected on the page.\r
\r
---\r
\r
## 14b. Indicator reference manual & Knowledge Mastery\r
\r
To support health planners and managers in interpreting vaccination progress correctly, VaxPlan includes an interactive, tenant-specific **Indicator Reference Manual** accessible from the Analytics sidebar group.\r
\r
### Structure of the Manual\r
The manual organizes standard indicators (including WHO, Gavi, and UNICEF reporting metrics) by category and subcategory:\r
- **Core Metrics**: Numerators, Denominators, and detailed formulas (e.g. \`Coverage Rate (%) = (Vaccinated Count / Target Population) * 100\`).\r
- **Granular Data Sources**: Data sources are explicitly split into separate fields for the Numerator (e.g., client logbooks) and Denominator (e.g., WorldPop or census estimates).\r
- **Calculation Examples**: Every metric includes a concrete, plain-language example showing how values are calculated (e.g., Penta1-Penta3 dropout calculations).\r
- **Clickable Guidelines**: Reference guidelines are clickable pills that open the official WHO or Gavi documentation directly in a new tab.\r
\r
### Knowledge Mastery Gamification\r
Planners can build their expertise using the built-in **Mastery Tracker**:\r
- Toggling **Mark as Mastered 🎯** on any indicator adds it to your personal learning register (saved locally on your device).\r
- Progresses through four mastery ranks in the dashboard header:\r
  - **EPI Novice 🌱** (0-3 metrics mastered)\r
  - **EPI Practitioner 📘** (4-7 metrics mastered)\r
  - **EPI Specialist 🎯** (8-10 metrics mastered)\r
  - **EPI Mastery Legend 🏆** (All 11 metrics mastered)\r
\r
---\r
\r
## 15. Troubleshooting\r
\r
**I can't see my facility's sessions on the Sessions page.**\r
Check the Province / District / Facility filter at the top of the\r
page — if any are set, only matching sessions are shown. Clear them\r
to see everything you're allowed to see.\r
\r
**The map is blank.**\r
Either you don't have boundaries loaded for the level you're viewing\r
(ask a national admin), or your browser blocked location/tile\r
fetches. Try a different browser or hard-refresh.\r
\r
**"413 Request Entity Too Large" when uploading a boundary.**\r
That used to happen for files over 100 KB. Files up to 50 MB are now\r
accepted. If you see this on a smaller file, the file may not be\r
valid GeoJSON; try opening it in [geojson.io](https://geojson.io) to\r
validate.\r
\r
**"GeoBoundaries has no ADM3 boundary" error.**\r
GeoBoundaries doesn't publish every admin level for every country.\r
For South Sudan, only ADM0-ADM2 are upstream — for Payam you need to\r
upload a custom GeoJSON (OCHA HDX is a good source).\r
\r
**My country code is rejected with "must contain exactly 3\r
characters".** Use the ISO 3166-1 alpha-3 code (e.g. \`SSD\` for South\r
Sudan, \`ZMB\` for Zambia, \`PNG\` for Papua New Guinea, \`KEN\` for\r
Kenya). The 2-letter alpha-2 codes (\`SS\`, \`ZM\`) are not accepted.\r
\r
**I marked a session done but it shows zero coverage.**\r
The per-antigen counts may use unknown codes (older offline outbox\r
entries). Open the session, check the "unmapped antigens" warning,\r
and ask your national admin to standardise the codes via the audit\r
log workflow.\r
\r
**Sync failed for some outbox entries.**\r
Tap the cloud icon to see which ones. Most failures are because the\r
underlying session was closed or deleted on the server. Reopen the\r
entry, resolve the conflict, and retry.\r
\r
**I'm logged in but I see "pending approval".**\r
A national or district admin needs to confirm your role. Contact\r
your administrator; they will see the request in their inbox.\r
\r
---\r
\r
## 16. Data sources and acknowledgements\r
\r
VaxPlan has a built-in **Data Sources** page that lists where the\r
platform's maps, administrative boundaries, population figures, and\r
facility data come from, along with the open-source projects it is built\r
on.\r
\r
- Open it from the sidebar (**Data Sources**, near Settings and Help),\r
  from the **External Resources** card on the Help page, or by tapping the\r
  small **Data sources** link in the credit at the bottom-right corner of\r
  any map.\r
- The page is also **public**: anyone can view it at \`/data-sources\`\r
  without signing in, and there is a link to it in the footer of the\r
  public landing page. The per-country population sources block is only\r
  shown to signed-in users; signed-out visitors see the general source\r
  list and acknowledgements.\r
- Sources are grouped by category: Maps & Basemaps, Administrative\r
  Boundaries, Population & Demographics, Health Facilities & Health\r
  Information Systems, Immunization Guidance & Standards, and Software /\r
  Fonts / Icons. Each entry shows a short description, its licence where\r
  relevant, and a link to the original source.\r
- If your country has population sources configured, they appear at the\r
  top of the page so you can see exactly which datasets feed your\r
  catchment and vaccine-needs calculations.\r
- The **Acknowledgements** section credits the data providers and open\r
  projects, and is a reminder that each dataset remains the property of\r
  its original owner and should be cited accordingly.\r
- The Acknowledgements also carry the **map boundary disclaimer** and a\r
  note on **disputed regions**: boundaries shown are for reference only\r
  and do not imply endorsement, and disputed or contested areas are not\r
  authoritatively depicted. The same short notice appears in the credit\r
  on every map.\r
\r
---\r
\r
## 17. Glossary\r
\r
- **Antigen** — A vaccine type (BCG, OPV, Penta, MCV1, etc.).\r
- **Catchment** — The set of villages a facility serves.\r
- **Coverage** — Percentage of the target population that received\r
  a given dose, in a given period.\r
- **Defaulter** — A child who started but did not complete a vaccine\r
  series on time.\r
- **Denominator** — The target population used to calculate coverage.\r
- **Dropout** — The percentage of children who received an earlier\r
  dose but did not receive a later one (e.g. Penta1 → Penta3).\r
- **Fixed-site session** — A vaccination session held at the\r
  facility.\r
- **Microplan** — A facility's quarterly plan combining catchment,\r
  denominator, schedule, and intended outreach.\r
- **Outreach session** — A session held away from the facility,\r
  usually in a village.\r
- **SIA** — Supplementary Immunisation Activity (a campaign — for\r
  example a measles SIA).\r
- **Tenant** — A Ministry of Health (one country) on the VaxPlan\r
  platform. Each tenant has isolated data.\r
- **WorldPop** — An open population dataset providing population\r
  estimates on a 100m or 1km grid.\r
- **Zero-dose child** — A child of vaccination age who has received\r
  no doses of any vaccine.\r
\r
---\r
\r
## 14. Supportive Supervision, Executive Scorecards & Smart Cascading Filters\r
\r
### 14.1 Overview\r
The Supportive Supervision module enables supervisors, district managers, and national teams to conduct facility visits, evaluate operational readiness across 7 core domain sections, generate executive facility scorecards, and compare performance quality across geographic boundaries.\r
\r
### 14.2 Standardized Checklists\r
- **Short Supervision Template**: 35 core questions (5 questions across 7 sections) optimized for rapid field assessments.\r
- **National Supervision Template**: Comprehensive 70-question full assessment checklist.\r
\r
### 14.3 Traffic Light Scoring System\r
Supportive supervision scores follow global health program standards:\r
- 🔴 **High Risk (0% – 49.9%)**: High operational risk; requires immediate supervisor intervention and corrective action plan.\r
- 🟠 **Medium Risk (50.0% – 79.9%)**: Moderate performance; targeted coaching recommended.\r
- 🟢 **Low Risk (80.0% – 100.0%)**: High operational quality and compliance.\r
\r
### 14.4 Executive Facility Scorecards\r
Clicking **Scorecard** on any completed visit opens an executive printable report featuring:\r
1. **Facility Metadata Tile**: Name, code, district, province, supervisor name, and visit date.\r
2. **Overall Risk Score Badge**: Color-coded percentage and classification.\r
3. **KPI Summary Tiles**: Questions Scored, Compliant, Non-compliant, and Action Items.\r
4. **Domain Breakdown**: Section-by-section percentage bar charts.\r
5. **Supervisor Findings**: Qualitative observations and key recommendations.\r
6. **Corrective Action Plan Table**: Specific action items, responsible person, and target completion dates.\r
7. **Print / Export PDF**: Built-in print button (\`window.print()\`) formatted for clean PDF downloads.\r
\r
### 14.5 Comparative Scorecard Matrix & Smart Location Cascade Filter\r
The Comparative Scorecard Matrix allows multi-level comparison across Provinces, Districts, and Facilities:\r
- **Strict Smart Location Cascade (\`GeoCascadeFilter\`)**:\r
  - Selecting a **Province** filters down the available Districts and Health Facilities.\r
  - **District** selector is locked until a Province is selected.\r
  - **Health Facility** selector is locked until a District is selected.\r
  - Downstream dropdown options strictly show **only** the direct children belonging to the active parent selection.\r
  - One-click clear (\`X\`) resets location filters back to full national scope.\r
- **Enterprise Features**: Pagination (10, 25, 50, 100 per page), sortable wrapped header columns, column visibility picker popover, risk level dropdown filter, search, and CSV export.\r
\r
---\r
\r
*If you spot an error in this guide or want a topic added, ask your national admin to file an issue with the VaxPlan team. The guide is versioned alongside the application code.*\r
`,be=`# VaxPlan — Facility Staff Quick-Start

> Pin this card next to your workstation. It covers the things
> you'll do most days as a facility clerk or in-charge.

## 1. Sign in
- Open the VaxPlan link your administrator gave you.
- Click **Sign in** and complete your organisation's login.
- The first time, you'll land on your facility's dashboard
  automatically.
- **Change your password** anytime: click your name (top-right) →
  **Change password**. Forgot it? Use **Forgot password?** on the
  sign-in screen and your admin will help.

## 2. Add a community (village)
1. Sidebar → **Facilities** → **Communities** tab → **Add Community**.
2. Your facility is **pinned automatically** — you can't pick another.
3. Enter the **name**, then set the location: drop a **single pin**, or
   use **Draw Polygon Mode** to trace the **catchment boundary** on the map.
4. **Save.** If your boundary overlaps another community, a
   **Catchment overlap** panel appears — click **Request harmonization**
   to flag it and email the other facility's in-charge.

> You can add **communities**, but only coordinators/admins can add a new
> **health facility** — that button won't show for you.

## 3. Build a quarterly microplan
1. Sidebar → **Microplans → Routine**
2. **New microplan** → pick the quarter and year.
3. Tick the **villages** your facility will serve.
4. Confirm the **target population** (Registered / WorldPop / Manual).
5. Confirm the **antigens** to offer.
6. Declare **outreach sessions per village per month**.
7. **Save as draft** or **Submit for approval**.

## 4. Plan the session days (itinerary)
1. Open a session → **Add Vaccination Session Itinerary Day**.
2. Enter the **lead vaccinator's** name, a **date at least 7 days ahead**,
   the **target population**, and tick at least one **community**.
3. The **Calculated Vaccine Supplies** panel estimates realistic doses per
   antigen (target × doses-per-child × wastage) — ~50 children gives tens of
   doses, not thousands.
4. If a day won't save, the message names the field to fix.

> Tip: From **All sessions → calendar**, "Plan a session on this day" opens
> the New Session form (not the microplan wizard) with the date filled in.

## 5. Run a session in the field
1. Sidebar → **Sessions** → find today's session.
2. **Start session** (works offline).
3. **Add client** for each child or pregnant woman vaccinated.
   - Pick antigens administered; the next-due dose is preselected.
4. When done, **Mark session done** → confirm counts → **Submit**.
5. Sync when you're back in range (cloud icon, top-right).

## 6. Follow up defaulters
1. Sidebar → **Coverage** → **Under-immunised list**.
2. Click a child to see their history.
3. Click **Create defaulter follow-up session** to schedule outreach.

## 7. Track stock
1. Sidebar → **Stock**.
2. Enter **Receipts** when supply arrives.
3. **Issues** are auto-recorded when you close a session.
4. At month-end, review and submit the **Monthly stock summary**.

<!-- Original section ended here. Added section 8 for Cold Chain Equipment below: -->

## 8. Manage Cold Chain Equipment
1. Sidebar → **Facilities** → select your facility → **Cold Chain** tab.
2. View, add, or edit your facility's refrigerators, freezers, solar direct drive units, vaccine carriers, or generators.
3. Select multiple items in the list to trigger the bottom **floating bulk actions** toolbar (e.g. bulk update condition, make active/inactive).
4. Use **Import CSV** to import equipment lists or **Export** (CSV/IGA JSON) to share with Inventory and Gap Analysis (IGA) systems.

---

## Daily checklist

- [ ] Open today's sessions before leaving for outreach.
- [ ] Capture clients during the session (offline is fine).
- [ ] Mark session done before packing up.
- [ ] Tap the **sync badge** (top-right) to sync when back in cellular range.
- [ ] Skim the **Under-immunised list** weekly for defaulters.
- [ ] Submit the **Monthly stock summary** on the last working day.

> **Good to know.** When you're online, the app updates on its own
> within seconds if anything changes for your facility — no need to
> refresh. You only ever see your own facility's data. If a newer
> version of the app is published, a banner appears at the top: tap
> **Reload** in the browser, or **Download update** in the Windows /
> Android app, to get the latest features (your data keeps syncing
> either way).

## Who to call

| Problem | Contact |
| --- | --- |
| My role hasn't been approved | Your district manager |
| Missing villages on my list | Add them yourself (Facilities → Communities → Add Community) |
| Need a new health facility added | Your provincial coordinator or national admin |
| Stock alert / wastage threshold | Your in-charge or district manager |
| Cannot sign in | Your IT focal point |
| App keeps crashing | Open Help → Send feedback (a national admin will see it) |
| Where does the map / population / facility data come from? | Sidebar → **Data Sources** lists every source and its licence |
`,ke=[{id:"quickstart",name:"Quick-Start Pro",description:"Read the Facility Quick-Start guide.",icon:"⚡",color:"from-amber-400 to-orange-500"},{id:"gis_intel",name:"GIS Navigator",description:"Complete the Settlement Intelligence section and pass the quiz.",icon:"🛰️",color:"from-sky-400 to-indigo-500"},{id:"routine_plan",name:"Field Commander",description:"Complete the Routine Microplanning section and pass the quiz.",icon:"🗺️",color:"from-emerald-400 to-teal-500"},{id:"scholar",name:"Wiki Scholar",description:"Mark all available wiki user guide sections as read.",icon:"🎓",color:"from-violet-400 to-purple-500"}],I={"11-settlement-intelligence-and-zero-dose-targeting":{id:"gis_intel",title:"Settlement Intelligence & Zero-Dose Quiz",questions:[{question:"What does the Outreach Site Suitability Score represent?",options:["The percentage of completed supervision visits.","An abstract population density indicator.","A 0-100 score prioritizing unserved building clusters based on size, zero-dose risk, distance, and road travel time."],correctAnswer:2,explanation:"The Outreach Site Suitability Score aggregates multiple factors (unserved size, zero-dose children, distance, accessibility) to help planners choose the optimal location for new outreach sessions."},{question:"What is the spatial resolution of the WorldPop gridded population data in VaxPlan?",options:["100 meters × 100 meters (approx. 1 hectare)","1 kilometer × 1 kilometer","5 kilometers × 5 kilometers"],correctAnswer:0,explanation:"VaxPlan fuses high-resolution WorldPop raster data, which maps population density at 100m grid cells, letting planners click the map and get a precise headcount of people."}]},"5-facility-staff--your-daily-workflow":{id:"routine_plan",title:"Routine Microplanning Quiz",questions:[{question:"How far in advance must a vaccination session date be scheduled?",options:["At least 24 hours in advance","At least 7 days in advance","No advance scheduling is required"],correctAnswer:1,explanation:"To allow for logistics and cold chain planning, all itinerary days must be scheduled at least 7 days in the future."},{question:"Which role is responsible for reviewing and approving microplans?",options:["Facility Clerks","WHO external monitors only","District Managers and Provincial Coordinators"],correctAnswer:2,explanation:"Authoring is done at the facility level, while review and approvals are routed hierarchically to District Managers and Provincial Coordinators."}]}};function J(c){return c?c.charAt(0).toUpperCase()+c.slice(1).toLowerCase():""}function xe(c){return c.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-")}function Se(c){const y=c.split(`
`),p=[];let u=null;for(const h of y){const f=h.match(/^##\s+(.+?)\s*$/);if(f){u&&p.push(u),u={id:xe(f[1]),title:f[1],level:2,body:""};continue}u&&(u.body+=h+`
`)}return u&&p.push(u),p.filter(h=>!/table of contents/i.test(h.title))}function Me({isFacilityRole:c}){const y=i.useMemo(()=>Se(we),[]),[p,u]=i.useState(""),[h,f]=i.useState("All"),[s,_]=i.useState(void 0),[r,M]=i.useState([]),[v,q]=i.useState([]),[z,K]=i.useState({}),[Z,D]=i.useState({}),[O,k]=i.useState(null);i.useEffect(()=>{try{const e=localStorage.getItem("vaxplan.docs.readSections");e&&M(JSON.parse(e));const t=localStorage.getItem("vaxplan.quizzes.completed");t&&q(JSON.parse(t))}catch{}},[]);const C=e=>{M(e);try{localStorage.setItem("vaxplan.docs.readSections",JSON.stringify(e))}catch{}},{data:w=[],isLoading:X}=B({queryKey:["/api/wiki/pages"],queryFn:async()=>{const e=await fetch("/api/wiki/pages");if(!e.ok)throw new Error("Failed to fetch wiki list");return(await e.json()).data},retry:1}),{data:g}=B({queryKey:["/api/wiki/pages",s],queryFn:async()=>{if(!s||s==="quickstart")return null;const e=await fetch(`/api/wiki/pages/${encodeURIComponent(s)}`);if(!e.ok)throw new Error("Failed to fetch page body");return(await e.json()).data},enabled:!!s&&s!=="quickstart"&&w.some(e=>e.slug===s)}),o=i.useMemo(()=>w.length===0?y.map(e=>({...e,category:"General",title:J(e.title),gamification:{quizzes:I[e.id]?[I[e.id]]:[]}})):w.map(e=>{const t=y.find(l=>l.id===e.slug);let a={};try{a=typeof e.gamification=="string"?JSON.parse(e.gamification):e.gamification||{}}catch{}return{id:e.slug,title:J(e.title),category:e.category||"Uncategorized",gamification:a,level:2,body:e.slug===s&&(g!=null&&g.body)?g.body:(t==null?void 0:t.body)??""}}),[w,y,s,g]),x=i.useMemo(()=>{var t;const e=[...ke];for(const a of o)(t=a.gamification)!=null&&t.badges&&Array.isArray(a.gamification.badges)&&e.push(...a.gamification.badges);return Array.from(new Map(e.map(a=>[a.id,a])).values())},[o]),ee=i.useMemo(()=>{var t;const e={...I};for(const a of o)(t=a.gamification)!=null&&t.quizzes&&Array.isArray(a.gamification.quizzes)&&a.gamification.quizzes.length>0&&(e[a.id]=a.gamification.quizzes[0]);return e},[o]),R=i.useMemo(()=>{const e=new Set;return o.forEach(t=>e.add(t.category)),["All",...Array.from(e)].sort()},[o]),A=i.useMemo(()=>{let e=o;h!=="All"&&(e=e.filter(a=>a.category===h));const t=p.trim().toLowerCase();return t?e.filter(a=>a.title.toLowerCase().includes(t)||a.body.toLowerCase().includes(t)):e},[o,p,h]),F=i.useMemo(()=>{const e=o.length+(c?1:0);if(e===0)return 0;let t=r.filter(a=>a==="quickstart"||o.some(l=>l.id===a)).length;return Math.round(t/e*100)},[o,r,c]),V=i.useMemo(()=>{const e=[];r.includes("quickstart")&&e.push("quickstart");for(const a of x)v.includes(a.id)&&e.push(a.id);return o.length>0&&o.every(a=>r.includes(a.id))&&e.push("scholar"),Array.from(new Set(e))},[r,v,o,x]),ne=e=>{let t;r.includes(e)?t=r.filter(a=>a!==e):t=[...r,e],C(t)},te=(e,t)=>{K(a=>({...a,[`${s}-${e}`]:t})),D(a=>({...a,[`${s}-${e}`]:!1}))},ae=(e,t)=>{let a=!0;if(t.questions.forEach((l,d)=>{z[`${e}-${d}`]!==l.correctAnswer&&(a=!1),D(S=>({...S,[`${e}-${d}`]:!0}))}),a){if(!v.includes(t.id)){const l=[...v,t.id];q(l);try{localStorage.setItem("vaxplan.quizzes.completed",JSON.stringify(l))}catch{}}r.includes(e)||C([...r,e])}};return n.jsxs("div",{className:"space-y-6",children:[n.jsx(N,{className:"border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20",children:n.jsx(j,{className:"pt-6",children:n.jsxs("div",{className:"flex flex-col md:flex-row md:items-center justify-between gap-6",children:[n.jsxs("div",{className:"space-y-2 flex-1",children:[n.jsxs("div",{className:"flex items-center gap-2",children:[n.jsx(H,{className:"h-5 w-5 text-indigo-500"}),n.jsx("h2",{className:"font-bold text-base",children:"Your Learning Academy Progress"})]}),n.jsxs("div",{className:"flex items-center justify-between text-xs text-muted-foreground",children:[n.jsxs("span",{children:["Modules Read: ",r.length," of ",o.length+(c?1:0)]}),n.jsxs("span",{children:[F,"% Complete"]})]}),n.jsx(he,{value:F,className:"h-2 bg-muted-foreground/15"})]}),n.jsxs("div",{className:"border-t md:border-t-0 md:border-l border-indigo-500/10 pt-4 md:pt-0 md:pl-6",children:[n.jsxs("div",{className:"text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1.5",children:[n.jsx(fe,{className:"h-4 w-4"})," Unlocked Badges (",V.length," / ",x.length,")"]}),n.jsx("div",{className:"flex gap-2 flex-wrap",children:x.map(e=>{const t=V.includes(e.id);return n.jsxs("div",{title:`${e.name}: ${e.description} (${t?"Unlocked":"Locked"})`,className:`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium select-none transition-all duration-300 ${t?`bg-gradient-to-r ${e.color||"from-indigo-400 to-blue-500"} text-white border-transparent shadow-sm scale-100 hover:scale-105`:"bg-muted text-muted-foreground/60 border-muted-foreground/15 opacity-60"}`,children:[n.jsx("span",{children:e.icon||"🏆"}),n.jsx("span",{children:e.name}),!t&&n.jsx(ve,{className:"h-3 w-3 ml-0.5 opacity-60"})]},e.id)})})]})]})})}),c&&n.jsxs(N,{className:"border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-sky-500/5",children:[n.jsx(L,{className:"pb-3",children:n.jsxs("div",{className:"flex items-center justify-between gap-4 flex-wrap",children:[n.jsxs(W,{className:"flex items-center gap-2 text-base",children:[n.jsx(ie,{className:"h-5 w-5 text-indigo-500"}),"Facility Quick-Start",r.includes("quickstart")&&n.jsxs(U,{variant:"secondary",className:"ml-1 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 flex items-center gap-0.5",children:[n.jsx(Y,{className:"h-3 w-3"})," Completed"]})]}),n.jsxs("div",{className:"flex gap-2",children:[n.jsx(b,{size:"sm",variant:r.includes("quickstart")?"ghost":"default",className:r.includes("quickstart")?"text-muted-foreground text-xs":"text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700",onClick:()=>{const e=r.includes("quickstart");C(e?r.filter(t=>t!=="quickstart"):[...r,"quickstart"])},children:r.includes("quickstart")?"Mark Unread":"Mark as Read"}),n.jsx(b,{size:"sm",variant:"outline",onClick:()=>window.print(),"data-testid":"btn-print-quickstart",children:"Print"})]})]})}),n.jsx(j,{children:n.jsx("article",{className:"prose prose-sm max-w-none dark:prose-invert",children:n.jsx(Q,{remarkPlugins:[$],components:{img:({src:e,alt:t})=>n.jsx("img",{src:e,alt:t,className:"rounded-lg shadow-md max-h-96 object-cover cursor-zoom-in transition-transform hover:scale-[1.01]",onClick:()=>k(e||null)})},children:be})})})]}),n.jsxs(N,{children:[n.jsx(L,{className:"pb-3 border-b",children:n.jsxs("div",{className:"flex items-center justify-between gap-4 flex-wrap",children:[n.jsxs("div",{className:"space-y-1",children:[n.jsxs(W,{className:"flex items-center gap-2 text-base",children:[n.jsx(oe,{className:"h-5 w-5 text-indigo-500"}),"VaxPlan End-User Wiki Guide"]}),n.jsx("p",{className:"text-xs text-muted-foreground",children:"Live role-by-role training handbook. Read modules, submit quizzes, and earn badges."})]}),n.jsxs(b,{size:"sm",variant:"outline",className:"gap-1.5","data-testid":"btn-download-guide-pdf",onClick:async()=>{try{if((await fetch("/VaxPlan-User-Guide.pdf",{method:"HEAD"})).ok){const t=document.createElement("a");t.href="/VaxPlan-User-Guide.pdf",t.download="VaxPlan-User-Guide.pdf",t.click()}else window.print()}catch{window.print()}},children:[n.jsx(se,{className:"h-3.5 w-3.5"}),"Download PDF"]})]})}),n.jsxs(j,{className:"space-y-3 pt-4",children:[n.jsxs("div",{className:"flex flex-col sm:flex-row gap-3",children:[n.jsxs("div",{className:"relative flex-1",children:[n.jsx(le,{"aria-hidden":"true",className:"absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"}),n.jsx(ce,{id:"guide-search",placeholder:"Search guide pages...",value:p,onChange:e=>u(e.target.value),className:"pl-8 h-9 text-sm","data-testid":"input-guide-search"})]}),R.length>1&&n.jsx("select",{value:h,onChange:e=>f(e.target.value),className:"h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",children:R.map(e=>n.jsx("option",{value:e,children:e},e))})]}),X&&A.length===0?n.jsx("div",{className:"py-8 text-center text-sm text-muted-foreground",children:"Loading wiki pages from database..."}):A.length===0?n.jsx("p",{className:"text-sm text-muted-foreground py-6 text-center",children:"No matching pages found."}):n.jsx(pe,{type:"single",collapsible:!0,value:s,onValueChange:_,children:A.map(e=>{const t=r.includes(e.id),a=ee[e.id],l=a&&v.includes(a.id);return n.jsxs(me,{value:e.id,children:[n.jsxs(ge,{className:"text-sm hover:no-underline text-left flex items-center justify-between",children:[n.jsxs("div",{className:"flex items-center gap-2",children:[t?n.jsx(Y,{className:"h-4 w-4 text-emerald-500 shrink-0"}):n.jsx("div",{className:"h-4 w-4 border rounded-full shrink-0 border-muted-foreground/30"}),n.jsx("span",{children:e.title})]}),a&&n.jsx(U,{variant:"outline",className:`ml-2 text-[10px] uppercase font-semibold ${l?"bg-emerald-500/10 text-emerald-600 border-0":"bg-indigo-500/10 text-indigo-600 border-indigo-200"}`,children:l?"Quiz Passed ✅":"Quiz Available 📝"})]}),n.jsx(ye,{className:"pt-2",children:s===e.id&&w.length>0&&g===void 0?n.jsx("div",{className:"py-4 text-center text-xs text-muted-foreground",children:"Loading page body..."}):n.jsxs("div",{className:"space-y-6",children:[n.jsx("article",{className:"prose prose-sm max-w-none dark:prose-invert overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_table]:max-w-full",children:n.jsx(Q,{remarkPlugins:[$],components:{img:({src:d,alt:m})=>n.jsx("img",{src:d,alt:m,className:"rounded-lg shadow-md max-h-96 object-cover cursor-zoom-in transition-transform hover:scale-[1.01]",onClick:()=>k(d||null)})},children:e.body})}),a&&n.jsxs("div",{className:"border border-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-lg p-4 mt-6 space-y-4",children:[n.jsxs("div",{className:"flex items-center gap-2",children:[n.jsx(de,{className:"h-5 w-5 text-indigo-500"}),n.jsx("h4",{className:"font-bold text-sm text-foreground m-0",children:a.title})]}),n.jsx("div",{className:"space-y-4 divide-y divide-indigo-500/5",children:a.questions.map((d,m)=>{const S=`${e.id}-${m}`,G=z[S],E=Z[S],P=G===d.correctAnswer;return n.jsxs("div",{className:"pt-4 first:pt-0 space-y-2",children:[n.jsxs("p",{className:"text-xs font-semibold text-foreground",children:[m+1,". ",d.question]}),n.jsx("div",{className:"grid gap-2",children:d.options.map((re,T)=>n.jsx("button",{type:"button",disabled:l,onClick:()=>te(m,T),className:`text-left text-xs px-3 py-2 border rounded-md transition-all ${G===T?E?P?"bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-medium":"bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-medium":"bg-indigo-500/15 border-indigo-500 font-medium":"bg-background border-muted hover:bg-muted/40"}`,children:re},T))}),E&&n.jsxs("div",{className:`text-xs p-2 rounded ${P?"bg-emerald-500/5 text-emerald-600":"bg-rose-500/5 text-rose-600"}`,children:[n.jsx("strong",{children:P?"Correct!":"Incorrect."})," ",d.explanation]})]},m)})}),l?n.jsxs("div",{className:"flex items-center justify-center gap-1.5 py-1 text-emerald-500 text-xs font-semibold",children:[n.jsx(H,{className:"h-4 w-4"})," Quiz Completed successfully!"]}):n.jsx(b,{size:"sm",onClick:()=>ae(e.id,a),className:"w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white",children:"Submit Quiz Answers"})]}),n.jsxs("div",{className:"flex justify-between items-center border-t pt-4 mt-6",children:[n.jsx("span",{className:"text-xs text-muted-foreground",children:t?"You read this page ✅":"Finished reading?"}),n.jsx(b,{size:"sm",variant:t?"outline":"default",onClick:()=>ne(e.id),className:"text-xs",children:t?"Mark Unread":"Mark as Read"})]})]})})]},e.id)})})]})]}),O&&n.jsxs("div",{onClick:()=>k(null),className:"fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm",children:[n.jsx("button",{type:"button",className:"absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2",onClick:()=>k(null),children:n.jsx(ue,{className:"h-5 w-5"})}),n.jsx("img",{src:O,alt:"Expanded view",className:"max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"})]})]})}export{Me as U};
