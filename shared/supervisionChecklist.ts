// Shared definitions for configurable supervision checklists.
//
// Kept in shared/ so both the React client and the Express server agree on the
// question types, the template item shape, the captured-answer shape, and the
// scoring rule. (Client must never import from server/.)

export type ChecklistQuestionType =
  | "yes_no"
  | "yes_no_na"
  | "true_false"
  | "text"
  | "long_text"
  | "number"
  | "decimal"
  | "single_select"
  | "multi_select"
  | "rating"
  | "likert"
  | "date"
  | "time"
  | "datetime"
  | "gps"
  | "image"
  | "file"
  | "signature"
  | "instruction"
  | "section_heading"
  | "calculated"
  | "score_only"
  | "barcode"
  | "temperature"
  | "stock_quantity"
  | "equipment_status"
  | "person_selector"
  | "facility_selector"
  | "community_selector"
  | "auto_prefill";

export const CHECKLIST_QUESTION_TYPES: {
  value: ChecklistQuestionType;
  label: string;
  description: string;
}[] = [
  { value: "yes_no", label: "Yes / No", description: "Yes, No, or N/A — counts toward the score" },
  { value: "yes_no_na", label: "Yes / No / N/A", description: "Explicit Yes, No, or N/A choice" },
  { value: "true_false", label: "True / False", description: "True, False, or N/A — counts toward the score" },
  { value: "text", label: "Short text", description: "Free-text answer" },
  { value: "long_text", label: "Long text", description: "Multi-line text comment or explanation" },
  { value: "number", label: "Number", description: "Numeric integer answer" },
  { value: "decimal", label: "Decimal", description: "Precision decimal number" },
  { value: "single_select", label: "Single choice", description: "Pick one option from a list" },
  { value: "multi_select", label: "Multiple choice", description: "Pick one or more options from a list" },
  { value: "rating", label: "Rating (1–5)", description: "A 1 to 5 score rating" },
  { value: "likert", label: "Likert scale", description: "Strongly Disagree to Strongly Agree scale" },
  { value: "date", label: "Date", description: "Pick a date" },
  { value: "time", label: "Time", description: "Pick a time" },
  { value: "datetime", label: "Date and Time", description: "Pick date and timestamp" },
  { value: "gps", label: "GPS location", description: "Capture device's current GPS coordinates" },
  { value: "image", label: "Photo / Image", description: "Attach photo taken on device" },
  { value: "file", label: "File upload", description: "Attach document or evidence file" },
  { value: "signature", label: "Digital signature", description: "Capture supervisor or interviewee signature" },
  { value: "instruction", label: "Instruction text", description: "Read-only guideline or text prompt" },
  { value: "section_heading", label: "Section heading", description: "Visual sub-heading inside checklist" },
  { value: "calculated", label: "Calculated field", description: "Automatically calculated score or formula" },
  { value: "score_only", label: "Score only", description: "Numerical points field" },
  { value: "barcode", label: "Barcode / QR Scan", description: "Scan vaccine vial or equipment barcode" },
  { value: "temperature", label: "Temperature reading", description: "Cold chain temperature measurement" },
  { value: "stock_quantity", label: "Stock quantity", description: "Vaccine or consumable stock count" },
  { value: "equipment_status", label: "Equipment status", description: "Functional / Non-functional status" },
  { value: "person_selector", label: "Staff / Person selector", description: "Select staff member from facility roster" },
  { value: "facility_selector", label: "Facility selector", description: "Select health facility from registry" },
  { value: "community_selector", label: "Community selector", description: "Select settlement or village" },
  { value: "auto_prefill", label: "Auto-prefilled field", description: "Automatically populated from VaxPlan master data" },
];

export const PREFILL_SOURCE_KEYS = [
  { key: "health_facility", label: "Health Facility Name", group: "Facility Summary" },
  { key: "district", label: "District Name", group: "Facility Summary" },
  { key: "province", label: "Province Name", group: "Facility Summary" },
  { key: "visit_date_current", label: "Date of Current Visit", group: "Visit Context" },
  { key: "visit_date_previous", label: "Date of Previous Visit", group: "Visit Context" },
  { key: "contacted_person_1", label: "Contacted Person 1: Name & Responsibility", group: "Staff Roster" },
  { key: "contacted_person_2", label: "Contacted Person 2: Name & Responsibility", group: "Staff Roster" },
  { key: "contacted_person_3", label: "Contacted Person 3: Name & Responsibility", group: "Staff Roster" },
  { key: "total_catchment_population", label: "Total Catchment Area Population", group: "Population Denominators" },
  { key: "surviving_infants", label: "Surviving Infants (0-11m)", group: "Population Denominators" },
  { key: "live_births", label: "Live Births", group: "Population Denominators" },
  { key: "pregnant_women", label: "Pregnant Women", group: "Population Denominators" },
  { key: "static_epi_sites", label: "No. of Static EPI Sites", group: "Service Delivery Sites" },
  { key: "outreach_epi_sites", label: "No. of Outreach EPI Sites", group: "Service Delivery Sites" },
  { key: "mobile_epi_sites", label: "No. of Mobile EPI Sites", group: "Service Delivery Sites" },
] as const;

export type PrefillSourceKey = typeof PREFILL_SOURCE_KEYS[number]["key"];

export interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  displayOrder: number;
  scoreWeight?: number;
  required?: boolean;
  isCollapsedByDefault?: boolean;
}

// Sentinel meaning "show the follow-up as soon as the parent has any answer".
export const SHOW_WHEN_ANY = "__any__";

// A question as authored in a template.
export interface ChecklistTemplateItem {
  id: string;
  sectionId?: string;
  type: ChecklistQuestionType;
  label: string;
  shortLabel?: string;
  helpText?: string;
  required?: boolean;
  options?: string[]; // for single_select / multi_select / likert
  min?: number;
  max?: number;
  scoreWeight?: number;
  placeholder?: string;
  displayOrder?: number;

  // --- Auto-Prefill Configuration ---
  isAutoPrefill?: boolean;
  prefillSourceKey?: PrefillSourceKey;
  readOnly?: boolean;
  allowOverride?: boolean;
  overrideRequiresReason?: boolean;
  showSourceMetadata?: boolean;

  // --- Follow-up (conditional display) ---
  parentId?: string;
  showWhen?: string;
  conditionalOperator?: "equals" | "not_equals" | "contains" | "gt" | "lt" | "between" | "is_empty" | "is_not_empty";
  conditionalOnQuestionId?: string | null;
  conditionalValue?: string | null;

  // --- Repeat ---
  repeatable?: boolean;
  repeatLabel?: string;
  maxRepeats?: number;

  // --- Scoring & Auditing ---
  isScored?: boolean;
  weight?: number;
  includeInScore?: boolean;
  evidenceRequired?: boolean;
  photoRequired?: boolean;
  correctiveActionRequired?: boolean;
  commentsEnabled?: boolean;
  indicatorMapping?: string;
  dataElementMapping?: string;
}

// A template authored by a national admin and used by lower levels.
export interface ChecklistTemplate {
  id: number;
  tenantId: string;
  name: string;
  category: "supervision" | "campaign" | "pce" | "h2h";
  programModule?: string;
  description?: string | null;
  applicableLevel?: "national" | "provincial" | "district" | "facility" | "community" | "campaign";
  version?: number;
  status?: "draft" | "published" | "archived" | "superseded";
  sections?: ChecklistSection[];
  items: ChecklistTemplateItem[];
  isActive: boolean;
  createdByUserId?: string | null;
  publishedByUserId?: string | null;
  publishedAt?: string;
  changeSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function getRiskClassification(score: number): {
  level: "low" | "medium" | "high";
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { level: "low", label: "Low Risk (>= 80%)", color: "emerald" };
  }
  if (score >= 60) {
    return { level: "medium", label: "Medium Risk (60–79%)", color: "amber" };
  }
  return { level: "high", label: "High Risk (< 60%)", color: "red" };
}

// A single captured answer stored on a supervision visit's `checklist` array.
// Backward-compatible with the legacy yes/no/na shape: `key`, `label`, `response`,
// `note` are preserved; `type` and `value` are added for the richer types.
export interface ChecklistAnswer {
  key: string; // unique per answer instance (== item id, or `${id}__r${n}` for repeats)
  baseKey?: string; // the template item id this answer derives from
  repeatIndex?: number; // 0 for the first/only entry, 1+ for added repeat entries
  label: string;
  type?: ChecklistQuestionType;
  response?: "yes" | "no" | "na" | ""; // yes_no / true_false (true->yes, false->no)
  value?: unknown; // text | number | select | multi-select | rating | date | gps {lat,lng,accuracy} | image (data URL)
  note?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];

  // carried template config so the conduct UI is self-contained
  parentId?: string;
  showWhen?: string;
  repeatable?: boolean;
  repeatLabel?: string;
  maxRepeats?: number;
  includeInScore?: boolean;
}

function blankAnswerFor(it: ChecklistTemplateItem, key: string, repeatIndex: number): ChecklistAnswer {
  return {
    key,
    baseKey: it.id,
    repeatIndex,
    label: it.label,
    type: it.type,
    response: it.type === "yes_no" || it.type === "true_false" ? "" : undefined,
    value: it.type === "multi_select" ? [] : undefined,
    note: "",
    helpText: it.helpText,
    required: it.required,
    options: it.options,
    parentId: it.parentId,
    showWhen: it.showWhen,
    repeatable: it.repeatable,
    repeatLabel: it.repeatLabel,
    maxRepeats: it.maxRepeats,
    includeInScore: it.includeInScore,
  };
}

// Turn an authored template into a blank set of answers for a new visit. Each
// item seeds a single (entry-0) answer; repeatable questions get extra entries
// added during the visit.
export function templateToAnswers(items: ChecklistTemplateItem[]): ChecklistAnswer[] {
  return (items || []).map((it) => blankAnswerFor(it, it.id, 0));
}

// Build a fresh, empty repeat entry from an existing answer of the same question.
export function makeRepeatAnswer(base: ChecklistAnswer, repeatIndex: number): ChecklistAnswer {
  const baseKey = base.baseKey || base.key;
  return {
    ...base,
    key: `${baseKey}__r${repeatIndex}`,
    baseKey,
    repeatIndex,
    response: base.type === "yes_no" || base.type === "true_false" ? "" : undefined,
    value: base.type === "multi_select" ? [] : undefined,
    note: "",
  };
}

function answerHasValue(a: ChecklistAnswer): boolean {
  if (a.response !== undefined) {
    if (a.response === "yes" || a.response === "no" || a.response === "na") return true;
  }
  const v = a.value;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v as object).length > 0;
  return v !== undefined && v !== null && v !== "";
}

function parentMatches(parent: ChecklistAnswer, showWhen: string | undefined): boolean {
  if (!showWhen || showWhen === SHOW_WHEN_ANY) return answerHasValue(parent);
  const t = parent.type || "yes_no";
  if (t === "yes_no" || t === "true_false") return parent.response === showWhen;
  if (t === "single_select") return parent.value === showWhen;
  if (t === "multi_select") return Array.isArray(parent.value) && (parent.value as string[]).includes(showWhen);
  return String(parent.value ?? "") === showWhen;
}

// A follow-up answer is visible only when its parent's answer matches the
// configured trigger AND the parent itself is visible. Visibility therefore
// cascades down a chain of follow-ups: if an ancestor is hidden, every
// descendant is hidden too — even if a descendant still holds a stale value.
// For repeated questions, a follow-up tracks the parent entry that shares its
// repeat index when available. `seen` guards against cyclic parent references.
export function isAnswerVisible(
  answer: ChecklistAnswer,
  all: ChecklistAnswer[],
  seen: Set<string> = new Set(),
): boolean {
  if (!answer.parentId) return true;
  if (seen.has(answer.key)) return true; // cycle guard — treat as visible
  seen.add(answer.key);
  const sameIndex = all.find(
    (a) => (a.baseKey || a.key) === answer.parentId && (a.repeatIndex ?? 0) === (answer.repeatIndex ?? 0),
  );
  const parent = sameIndex || all.find((a) => (a.baseKey || a.key) === answer.parentId);
  if (!parent) return true;
  if (!parentMatches(parent, answer.showWhen)) return false;
  return isAnswerVisible(parent, all, seen);
}

// Contribution of a single answer to the score, as a 0..1 value, or null when
// it is not a scorable/answered question.
function scoreContribution(a: ChecklistAnswer): number | null {
  const t = a.type || "yes_no";
  if (t === "yes_no" || t === "true_false") {
    if (a.includeInScore === false) return null;
    if (a.response === "yes") return 1;
    if (a.response === "no") return 0;
    return null; // na / unanswered
  }
  if (t === "rating") {
    if (a.includeInScore !== true) return null;
    const v = Number(a.value);
    if (Number.isNaN(v) || v < 1 || v > 5) return null;
    return v / 5;
  }
  return null;
}

// Score = average of every visible, scorable answer's contribution, as a
// percentage. Yes/No and True/False count by default; ratings count when the
// author opted them in. Repeated entries each contribute, so they aggregate
// naturally. Hidden follow-ups (condition not met) are ignored.
export function computeChecklistScore(answers: ChecklistAnswer[]): number {
  const all = answers || [];
  let total = 0;
  let count = 0;
  for (const a of all) {
    if (!isAnswerVisible(a, all)) continue;
    const c = scoreContribution(a);
    if (c === null) continue;
    total += c;
    count += 1;
  }
  if (!count) return 0;
  return Math.round((total / count) * 100);
}
