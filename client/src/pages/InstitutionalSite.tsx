import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BarChart3, Building2, Check, ChevronRight, Database, Download, Globe2, HeartPulse, Layers3, Mail, Map, MapPin, Menu, Network, Play, Route, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BRIEF_URL = "/downloads/VaxPlan-Partnership-Implementation-Brief-2026-2030.pdf";
const interests = ["Free Demo Request", "Demonstration", "Country Pilot", "GIS Microplanning", "Zero-Dose", "Campaign Management", "Interoperability", "Research", "Funding Partnership", "Technical Partnership", "Other"];

function utm() {
  const p = new URLSearchParams(window.location.search);
  return { utmSource: p.get("utm_source") || undefined, utmMedium: p.get("utm_medium") || undefined, utmCampaign: p.get("utm_campaign") || undefined };
}
function track(eventName: string, interest?: string) {
  const campaign = utm();
  void fetch("/api/public/partner-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName, path: window.location.pathname, interest, ...campaign }), keepalive: true });
}
function Seo({ title, description, canonical }: { title: string; description: string; canonical: string }) {
  useEffect(() => {
    document.title = title;
    const meta = (attribute: "name" | "property", key: string, value: string) => {
      let el = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attribute, key); document.head.appendChild(el); }
      el.content = value;
    };
    meta("name", "description", description);
    meta("property", "og:title", title); meta("property", "og:description", description);
    meta("property", "og:type", "website"); meta("property", "og:url", canonical);
    meta("property", "og:image", "https://vaxplan.org/og-card.png");
    meta("name", "twitter:card", "summary_large_image");
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;
    let structured = document.head.querySelector("script[data-vaxplan-institutional-schema]") as HTMLScriptElement | null;
    if (!structured) { structured = document.createElement("script"); structured.type = "application/ld+json"; structured.dataset.vaxplanInstitutionalSchema = "true"; document.head.appendChild(structured); }
    structured.text = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: canonical, isPartOf: { "@type": "WebSite", name: "VaxPlan", url: "https://vaxplan.org" } });
  }, [title, description, canonical]);
  return null;
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Link href="/" className="flex items-center gap-3" aria-label="VaxPlan home"><img src="/vaxplan-logo-light.png" className="h-9 w-9 rounded-lg" alt="VaxPlan"/><div><div className="font-bold text-slate-950">VaxPlan</div><div className="text-[10px] uppercase tracking-[.16em] text-slate-500">Immunisation intelligence</div></div></Link>
      <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"><Link href="/partners" className="hover:text-blue-700">Partnerships</Link><Link href="/demo" className="hover:text-blue-700">Demo</Link><a href="https://docs.vaxplan.org/partnership-concept" className="hover:text-blue-700">Concept note</a><a href={BRIEF_URL} onClick={() => track("pdf_download")} className="hover:text-blue-700">Brief</a><Button asChild size="sm"><a href="/partners#contact">Request a free demo</a></Button></nav>
      <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
    </div>
    {open && <nav className="grid gap-3 border-t px-5 py-4 text-sm md:hidden"><Link href="/partners">Partnerships</Link><Link href="/demo">Demo</Link><a href="https://docs.vaxplan.org/partnership-concept">Concept note</a><a href={BRIEF_URL}>Download brief</a><a href="/partners#contact" className="font-semibold text-blue-700">Request a free demo</a></nav>}
  </header>;
}
function Footer() {
  return (
    <footer className="border-t bg-slate-950 text-slate-300 print:hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-3 lg:px-8">
        <div>
          <div className="text-lg font-semibold text-white">VaxPlan</div>
          <p className="mt-2 max-w-sm text-sm">GIS-enabled immunisation planning, operational intelligence and decision support.</p>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-white">Explore</div>
          <div className="mt-3 grid gap-2">
            <Link href="/demo">Guided demo</Link>
            <Link href="/partners">Partnerships</Link>
            <a href={BRIEF_URL}>Implementation brief</a>
          </div>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-white">Free Demo &amp; Contact</div>
          <p className="mt-1 text-xs text-slate-400">Request a demonstration, technical review, or country pilot:</p>
          <div className="mt-3 grid gap-2">
            <a className="inline-flex items-center gap-2 hover:text-white transition-colors" href="mailto:info@vaxplan.org?subject=Free%20VaxPlan%20Demo%20Request">
              <Mail className="h-4 w-4 text-blue-400"/>info@vaxplan.org
            </a>
            <a className="inline-flex items-center gap-2 hover:text-white transition-colors" href="mailto:vaxplan@gmail.com?subject=Free%20VaxPlan%20Demo%20Request">
              <Mail className="h-4 w-4 text-emerald-400"/>vaxplan@gmail.com
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} VaxPlan. Programme data shown in public demonstrations are synthetic.
      </div>
    </footer>
  );
}
function Shell({ children }: { children: ReactNode }) { return <div className="min-h-screen bg-white font-sans text-slate-900"><SiteHeader/>{children}<Footer/></div> }
const Section = ({ children, className = "" }: { children: ReactNode; className?: string }) => <section className={`px-5 py-16 md:py-24 lg:px-8 ${className}`}><div className="mx-auto max-w-7xl">{children}</div></section>;
const Eyebrow = ({ children }: { children: ReactNode }) => <div className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-blue-700">{children}</div>;
const SectionTitle = ({ children, sub }: { children: ReactNode; sub?: string }) => <div className="max-w-3xl"><h2 className="text-3xl font-bold tracking-tight md:text-4xl">{children}</h2>{sub && <p className="mt-4 text-lg leading-8 text-slate-600">{sub}</p>}</div>;

const capabilities = [
  [Map, "GIS intelligence", "Understand where populations, services and accessibility gaps exist."], [Layers3, "Digital microplanning", "Convert planning processes into reusable, structured workflows."], [MapPin, "Zero-dose intelligence", "Identify geographic areas and populations that may be underserved."], [Route, "Service optimisation", "Support fixed, outreach and mobile delivery decisions."], [Database, "Resource forecasting", "Estimate vaccine, logistics, transport and operational requirements."], [Users, "Campaign operations", "Plan and monitor configurable campaign workflows."], [BarChart3, "Monitoring and decisions", "Turn programme data into actionable dashboards and maps."], [Network, "Interoperability", "Connect authorised national systems and data-collection platforms."],
] as const;
const partnershipModels = [
  ["Demonstration", "4-8 weeks", "Stakeholder assessment, sample configuration and technical review."], ["Proof of concept", "3-6 months", "A country-led test across 2-3 districts and selected facilities."], ["Provincial / regional", "6-12 months", "Wider configuration, integration, training, dashboards and evaluation."], ["National implementation", "Jointly designed", "Phased architecture, governance, localisation, support and sustainability."],
];

function Architecture() { return <div className="mt-10 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1.1fr_auto_1fr]">
  <div className="rounded-2xl border bg-white p-6"><div className="font-bold">Authorised data sources</div><p className="mt-3 text-sm leading-7 text-slate-600">DHIS2 · EIR · LMIS/eLMIS · HFR/MFL · ODK/Kobo/CommCare · census · national statistics · approved population grids · GIS layers</p></div><ChevronRight className="m-auto hidden text-blue-600 lg:block"/>
  <div className="rounded-2xl bg-blue-700 p-6 text-white shadow-xl"><div className="text-xl font-bold">VaxPlan intelligence layer</div><p className="mt-3 text-sm leading-7 text-blue-100">Integration · GIS intelligence · microplanning · forecasting · optimisation · monitoring · analytics</p></div><ChevronRight className="m-auto hidden text-blue-600 lg:block"/>
  <div className="rounded-2xl border bg-white p-6"><div className="font-bold">Operational outputs</div><p className="mt-3 text-sm leading-7 text-slate-600">Facility and district plans · maps · outreach schedules · resource estimates · budgets · dashboards · campaign intelligence · management reports</p></div>
 </div> }

function ContactForm() {
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [interest, setInterest] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setStatus("sending");
    const form = new FormData(e.currentTarget); const campaign = utm();
    const body = Object.fromEntries(form.entries());
    try { const response = await fetch("/api/public/partner-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, interest, referrer: document.referrer || undefined, ...campaign }) }); if (!response.ok) throw new Error(); setStatus("sent"); track("partner_form_submit", interest); e.currentTarget.reset(); setInterest(""); } catch { setStatus("error"); }
  }
  if (status === "sent") return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8"><Check className="h-8 w-8 text-emerald-700"/><h3 className="mt-4 text-xl font-bold">Thank you. Your enquiry has been received.</h3><p className="mt-2 text-slate-600">The VaxPlan team will review the institutional context and respond using the email provided.</p></div>;
  return <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2" aria-label="Partnership enquiry">
    <label className="text-sm font-medium">Name<Input name="name" required minLength={2} className="mt-2"/></label><label className="text-sm font-medium">Organisation<Input name="organisation" required minLength={2} className="mt-2"/></label>
    <label className="text-sm font-medium">Role<Input name="role" className="mt-2"/></label><label className="text-sm font-medium">Country<Input name="country" required className="mt-2"/></label>
    <label className="text-sm font-medium">Email<Input name="email" type="email" required className="mt-2"/></label><label className="text-sm font-medium">Area of interest<Select value={interest} onValueChange={setInterest} required><SelectTrigger className="mt-2"><SelectValue placeholder="Select an area"/></SelectTrigger><SelectContent>{interests.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></label>
    <label className="hidden" aria-hidden="true">Website<Input name="website" tabIndex={-1} autoComplete="off"/></label><label className="text-sm font-medium md:col-span-2">Message<Textarea name="message" required minLength={20} maxLength={4000} rows={5} className="mt-2" placeholder="Tell us about the programme need, geography, systems and proposed collaboration."/></label>
    {status === "error" && <p className="text-sm text-red-700 md:col-span-2">The enquiry could not be submitted. Please retry or email info@vaxplan.org or vaxplan@gmail.com.</p>}<Button disabled={status === "sending" || !interest} className="md:col-span-2">{status === "sending" ? "Submitting…" : "Submit partnership enquiry"}</Button>
  </form>;
}

export function PartnersPage() {
  useEffect(() => track("partners_page_view"), []);
  return <Shell><Seo title="VaxPlan Partnerships | GIS-Enabled Immunisation Microplanning" description="Partner with VaxPlan to strengthen immunisation microplanning, GIS intelligence, zero-dose identification, outreach planning and programme monitoring." canonical="https://vaxplan.org/partners"/>
    <main><section className="relative overflow-hidden bg-slate-950 px-5 py-20 text-white md:py-28 lg:px-8"><div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_70%_30%,#38bdf8_0,transparent_35%),linear-gradient(135deg,transparent_45%,#2563eb22_46%,transparent_47%)]"/><div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div><Eyebrow>Institutional partnerships · 2026-2030</Eyebrow><h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">Transform Immunisation Microplanning into Action</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">VaxPlan combines GIS, population intelligence, operational planning and programme monitoring to help immunisation programmes identify underserved communities, plan services and use available resources more effectively.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" asChild onClick={() => track("request_demo_click")}><a href="#contact">Request a Demonstration</a></Button><Button size="lg" variant="outline" className="border-slate-600 bg-transparent text-white hover:bg-white hover:text-slate-950" asChild><a href={BRIEF_URL} onClick={() => track("pdf_download")}><Download className="mr-2 h-4 w-4"/>Download Partnership Brief</a></Button><Button size="lg" variant="ghost" className="text-white" asChild><Link href="/demo">Explore Interactive Demo <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div></div><div className="relative rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl"><div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900 p-4"><div className="h-full rounded-xl bg-[radial-gradient(circle_at_65%_45%,#60a5fa_0_2%,transparent_3%),radial-gradient(circle_at_30%_65%,#34d399_0_2%,transparent_3%),linear-gradient(145deg,#dbeafe22,#0f172a)]"><svg viewBox="0 0 600 430" className="h-full w-full" aria-label="Conceptual GIS service planning map"><path d="M70 300 C140 180 210 340 290 190 S450 270 540 100" fill="none" stroke="#60a5fa" strokeWidth="7"/><path d="M100 90 L250 70 L330 150 L520 130 L480 340 L220 370 L90 260 Z" fill="#0ea5e922" stroke="#38bdf8" strokeWidth="2" strokeDasharray="8 6"/>{[[150,240],[275,185],[390,240],[470,155],[230,315]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="15" fill={i===2?"#fb7185":"#34d399"}/><circle cx={x} cy={y} r="28" fill="none" stroke={i===2?"#fb7185":"#34d399"} opacity=".35"/></g>)}</svg></div></div><div className="absolute -bottom-5 left-8 right-8 grid grid-cols-3 gap-2 rounded-xl border bg-white p-3 text-center text-xs text-slate-800 shadow-xl"><div><b className="block text-lg text-blue-700">Place</b>Map demand</div><div><b className="block text-lg text-emerald-700">Plan</b>Select strategy</div><div><b className="block text-lg text-amber-700">Act</b>Monitor delivery</div></div></div></div></section>
    <Section><Eyebrow>The opportunity</Eyebrow><SectionTitle sub="Programmes often coordinate maps, demographic estimates, spreadsheets and standalone tools across a single planning cycle. VaxPlan helps turn those existing investments into a reusable operational workflow without displacing national systems.">Move from fragmented inputs to practical service decisions</SectionTitle></Section>
    <Section className="bg-slate-50"><Eyebrow>What VaxPlan adds</Eyebrow><SectionTitle>One operational intelligence layer</SectionTitle><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map(([Icon,title,text])=><div key={title} className="rounded-2xl border bg-white p-5"><Icon className="h-6 w-6 text-blue-700"/><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></Section>
    <Section><Eyebrow>Interoperability</Eyebrow><SectionTitle sub="VaxPlan complements existing national digital health infrastructure rather than requiring countries to replace it.">Connect data to planning and action</SectionTitle><Architecture/></Section>
    <Section className="bg-blue-950 text-white"><Eyebrow>Designed for collaboration with</Eyebrow><SectionTitle sub="Partnership arrangements are country-led and do not imply an existing endorsement or formal relationship.">Institutions that strengthen immunisation systems</SectionTitle><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Ministries of Health","Country ownership, policy alignment and implementation."],["WHO & UNICEF","Technical guidance, programme alignment and implementation support."],["Gavi & Africa CDC","System strengthening, equity priorities and Member State support."],["Implementers & research institutions","Deployment, integration, capacity building and independent evaluation."],["Donors & development partners","Catalytic financing and responsible scale-up support."]].map(([a,b])=><div key={a} className="rounded-2xl border border-white/10 bg-white/5 p-5"><h3 className="font-bold">{a}</h3><p className="mt-2 text-sm text-blue-100">{b}</p></div>)}</div></Section>
    <Section><Eyebrow>Partnership models</Eyebrow><SectionTitle sub="Scope and implementation costs are developed collaboratively based on country systems, integration requirements and sustainability objectives.">Start at the right level</SectionTitle><div className="mt-10 grid gap-4 lg:grid-cols-4">{partnershipModels.map(([a,b,c],i)=><div className="rounded-2xl border p-6" key={a}><div className="text-xs font-bold text-blue-700">MODEL {i+1}</div><h3 className="mt-3 text-xl font-bold">{a}</h3><div className="mt-1 text-sm font-medium text-slate-500">{b}</div><p className="mt-4 text-sm leading-6 text-slate-600">{c}</p></div>)}</div></Section>
    <Section className="bg-slate-50"><Eyebrow>Implementation principles</Eyebrow><SectionTitle>Country-owned, standards-aligned and sustainable</SectionTitle><div className="mt-8 flex flex-wrap gap-3">{["Country ownership","Interoperability","Open standards","Privacy by design","Security by design","Offline-ready where required","Configurability","Scalability","Reuse of national data","Modular adoption","Capacity transfer"].map(x=><span key={x} className="rounded-full border bg-white px-4 py-2 text-sm font-medium"><Check className="mr-2 inline h-4 w-4 text-emerald-600"/>{x}</span>)}</div></Section>
    <Section className="scroll-mt-20" ><div id="contact" className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><Eyebrow>Interested in evaluating VaxPlan?</Eyebrow><h2 className="text-4xl font-bold">Start a partnership discussion</h2><p className="mt-4 leading-7 text-slate-600">Request a free demonstration, propose a pilot, discuss integration, explore implementation research or ask for an indicative implementation framework.</p><div className="mt-6 grid gap-2"><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Free demo requests &amp; inquiries</div><a href="mailto:info@vaxplan.org?subject=Free%20VaxPlan%20Demo%20Request" className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline"><Mail className="h-4 w-4 text-blue-600"/>info@vaxplan.org</a><a href="mailto:vaxplan@gmail.com?subject=Free%20VaxPlan%20Demo%20Request" className="inline-flex items-center gap-2 font-semibold text-emerald-700 hover:underline"><Mail className="h-4 w-4 text-emerald-600"/>vaxplan@gmail.com</a></div></div><ContactForm/></div></Section></main>
  </Shell>;
}

const demoSteps = [
  ["Select an area","Country to facility cascade establishes the operational scope."],["Understand population","Review target cohorts, settlements and demographic layers."],["Analyse accessibility","Combine facilities, roads, catchments and travel constraints."],["Identify service gaps","Highlight population clusters beyond practical service reach."],["Select service strategy","Assign fixed, outreach, mobile or referral strategies."],["Build the microplan","Carry population and place into sessions, schedules and teams."],["Forecast requirements","Calculate vaccines, consumables, staffing, transport and costs."],["Implement","Publish calendars, outreach sites, team assignments and routes."],["Monitor","Compare planned and completed sessions, supervision and missed places."],["Review","Aggregate evidence from facility to national level."],
];
export function DemoPage() {
  const [active,setActive]=useState(0); const [started,setStarted]=useState(false);
  useEffect(()=>track("demo_page_view"),[]);
  const step=demoSteps[active];
  function start(){setStarted(true);setActive(0);track("demo_start")};
  function next(){if(active===demoSteps.length-1){track("demo_complete");setStarted(false)}else setActive(active+1)}
  return <Shell><Seo title="VaxPlan Demo | From GIS Intelligence to Immunisation Microplans" description="See how VaxPlan connects population intelligence, GIS, microplanning, logistics and monitoring to support immunisation programmes." canonical="https://vaxplan.org/demo"/><main><section className="bg-slate-950 px-5 py-20 text-center text-white"><Eyebrow>Demonstration / synthetic programme data</Eyebrow><h1 className="mx-auto max-w-4xl text-4xl font-bold md:text-6xl">See VaxPlan in Action</h1><p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">Follow how a programme can move from population intelligence to an operational immunisation microplan.</p><div className="mt-8 flex justify-center gap-3"><Button size="lg" onClick={start}><Play className="mr-2 h-4 w-4"/>Explore Demo</Button><Button size="lg" variant="outline" className="border-slate-600 bg-transparent text-white" asChild><a href="#video">Watch Demo</a></Button></div></section>
  <Section>{!started?<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">{demoSteps.map(([title,text],i)=><button onClick={()=>{setStarted(true);setActive(i);track("demo_start")}} key={title} className="rounded-2xl border p-5 text-left hover:border-blue-500 hover:shadow-md"><span className="text-xs font-bold text-blue-700">STEP {i+1}</span><h2 className="mt-2 font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{text}</p></button>)}</div>:<div className="grid gap-8 lg:grid-cols-[.65fr_1.35fr]"><div><div className="text-sm font-bold text-blue-700">STEP {active+1} OF 10</div><h2 className="mt-2 text-3xl font-bold">{step[0]}</h2><p className="mt-4 text-lg leading-8 text-slate-600">{step[1]}</p><div className="mt-8 flex gap-3"><Button variant="outline" disabled={active===0} onClick={()=>setActive(active-1)}>Back</Button><Button onClick={next}>{active===9?"Finish demo":"Next step"}<ArrowRight className="ml-2 h-4 w-4"/></Button></div></div><div className="relative min-h-[420px] overflow-hidden rounded-3xl border bg-slate-100 p-6 shadow-inner"><div className="absolute left-6 top-6 rounded-lg bg-white px-3 py-2 text-xs font-semibold shadow">Synthetic district demonstration</div><div className="mt-16 grid h-[320px] place-items-center rounded-2xl bg-[radial-gradient(circle_at_65%_45%,#ef4444_0_1.5%,transparent_2%),radial-gradient(circle_at_40%_60%,#3b82f6_0_1.5%,transparent_2%),linear-gradient(135deg,#dbeafe,#f8fafc)]"><div className="rounded-2xl border bg-white/95 p-6 text-center shadow-xl"><Sparkles className="mx-auto text-blue-700"/><div className="mt-3 text-xl font-bold">{step[0]}</div><div className="mt-1 text-sm text-slate-500">Operational decision, not just a map</div></div></div></div></div>}</Section>
  <Section className="bg-slate-50" ><div id="video" className="grid gap-10 lg:grid-cols-2"><div><Eyebrow>2-3 minute institutional video</Eyebrow><SectionTitle sub="A production-ready narrative structure covering the problem, GIS intelligence, digital microplanning, resources, monitoring and interoperability.">From map to microplan to monitored implementation</SectionTitle><div className="mt-6 flex flex-wrap items-center gap-3"><Button asChild><a href="mailto:info@vaxplan.org?subject=VaxPlan%20Free%20Demonstration%20Request">Request a free demo</a></Button><div className="text-xs text-slate-500">Contact: <a href="mailto:info@vaxplan.org" className="text-blue-600 hover:underline">info@vaxplan.org</a> · <a href="mailto:vaxplan@gmail.com" className="text-emerald-600 hover:underline">vaxplan@gmail.com</a></div></div></div><div className="aspect-video rounded-2xl bg-slate-900 p-8 text-white"><div className="flex h-full flex-col justify-between"><div className="text-sm text-slate-400">VIDEO STRUCTURE</div><div><HeartPulse className="h-10 w-10 text-blue-400"/><div className="mt-4 text-2xl font-bold">Reach every child.<br/>Plan every session.</div></div><div className="text-sm text-slate-400">Video recording to be added following institutional narration approval.</div></div></div></div></Section></main></Shell>
}

export function PartnershipConceptPage() {
  const capabilitiesText=["GIS microplanning","Population intelligence","Accessibility analysis","Geographic zero-dose risk","Outreach planning","Target setting","Logistics forecasting","Budgeting","Campaign planning","Supportive supervision","Dashboards","Interoperability"];
  return <Shell><Seo title="VaxPlan Partnership Concept 2026-2030" description="A concise partnership concept for GIS-enabled immunisation microplanning and decision support." canonical="https://docs.vaxplan.org/partnership-concept"/><main className="bg-slate-100 py-10 print:bg-white print:py-0"><article className="mx-auto max-w-[900px] bg-white shadow-xl print:max-w-none print:shadow-none"><section className="min-h-[1050px] p-10 md:p-16 print:min-h-0 print:break-after-page"><Eyebrow>Partnership concept 2026-2030</Eyebrow><h1 className="text-5xl font-bold tracking-tight">VaxPlan</h1><h2 className="mt-3 text-2xl text-blue-700">GIS-Enabled Immunisation Microplanning and Decision Support</h2><div className="mt-12 grid gap-10 md:grid-cols-2"><div><h3 className="text-xl font-bold">Background</h3><p className="mt-3 leading-7 text-slate-600">Immunisation teams bring together population estimates, service locations, accessibility, workforce, logistics and performance data to create operational microplans. When these inputs remain fragmented, updating plans and translating evidence into outreach decisions can be unnecessarily difficult.</p></div><div><h3 className="text-xl font-bold">Proposed solution</h3><p className="mt-3 leading-7 text-slate-600">VaxPlan is a GIS-enabled planning, operational intelligence and decision-support platform designed to complement authorised national systems. It connects population and place to service strategies, resource forecasts, implementation and review.</p></div></div><h3 className="mt-12 text-xl font-bold">Core capabilities</h3><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">{capabilitiesText.map(x=><div key={x} className="rounded-lg border p-3 text-sm font-medium">{x}</div>)}</div><div className="mt-12 rounded-2xl bg-blue-950 p-7 text-white"><h3 className="font-bold">System philosophy</h3><p className="mt-2 text-blue-100">Integration-first · complementary to DHIS2 and national platforms · country-owned · configurable · modular · scalable · privacy and security by design</p></div></section>
  <section className="min-h-[1050px] p-10 md:p-16 print:min-h-0"><h2 className="text-3xl font-bold">Proposed partnership</h2><p className="mt-4 leading-7 text-slate-600">A country-led collaboration can bring together government programme leadership, technical and implementation partners, VaxPlan configuration support and independent evaluation.</p><div className="mt-8 grid gap-4 md:grid-cols-4">{["Government leadership","Technical partner","Implementation partner","VaxPlan"].map(x=><div className="rounded-xl border p-4 text-center font-semibold" key={x}>{x}</div>)}</div><h3 className="mt-10 text-xl font-bold">Initial proof of concept</h3><p className="mt-3 text-slate-600">A proposed 3-6 month routine-immunisation implementation across 2-3 districts and approximately 10-30 facilities, with an optional geographic zero-dose component.</p><h3 className="mt-9 text-xl font-bold">Evaluation questions</h3><ul className="mt-3 grid list-disc gap-2 pl-5 text-slate-600 md:grid-cols-2">{["Planning time and completeness","Underserved settlement identification","Data quality and operational usefulness","User satisfaction and GIS value","Interoperability feasibility","Sustainability requirements"].map(x=><li key={x}>{x}</li>)}</ul><h3 className="mt-9 text-xl font-bold">Expected outputs</h3><p className="mt-3 leading-7 text-slate-600">A configured environment, digital microplans, GIS analysis, trained users, implementation report, evaluation findings and a documented scale recommendation.</p><h3 className="mt-9 text-xl font-bold">Partnership request</h3><p className="mt-3 leading-7 text-slate-600">VaxPlan invites technical collaboration, pilot implementation, independent evaluation, integration partnerships, financing and implementation research.</p><div className="mt-10 flex flex-wrap gap-3 print:hidden"><Button asChild><a href="https://vaxplan.org/partners#contact">Start a discussion</a></Button><Button variant="outline" asChild><a href={BRIEF_URL}><Download className="mr-2 h-4 w-4"/>Download full brief</a></Button></div><div className="mt-12 border-t pt-6 text-sm text-slate-600"><b>VaxPlan</b><br/>https://vaxplan.org<br/><span className="text-slate-700">Free demo requests &amp; inquiries:</span> <a href="mailto:info@vaxplan.org" className="text-blue-600 hover:underline">info@vaxplan.org</a> · <a href="mailto:vaxplan@gmail.com" className="text-emerald-600 hover:underline">vaxplan@gmail.com</a></div></section></article></main></Shell>
}
