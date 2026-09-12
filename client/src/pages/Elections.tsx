import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Archive, BarChart3, CalendarDays, ChevronRight, FileText, Search, ShieldCheck, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ElectionType = "Presidential" | "Parliamentary" | "Local Government";

interface ElectionRecord {
  year: number;
  type: ElectionType;
  title: string;
  description: string;
  sourceFile: string;
  status: "Results available" | "Source archive";
}

const ELECTIONS: ElectionRecord[] = [
  { year: 2021, type: "Presidential", title: "2021 Presidential Election", description: "Presidential results by constituency.", sourceFile: "2021-PresidentialResultsPerConst.pdf", status: "Results available" },
  { year: 2021, type: "Parliamentary", title: "2021 National Assembly Election", description: "National Assembly election results.", sourceFile: "2021-ParliamentaryResults.pdf", status: "Results available" },
  { year: 2021, type: "Local Government", title: "2021 Local Government Election", description: "Councillor and mayoral results.", sourceFile: "2021-CouncilorResults.pdf", status: "Results available" },
  { year: 2016, type: "Presidential", title: "2016 Presidential Election", description: "Published presidential election results.", sourceFile: "2016-PresidentialResults2016.pdf", status: "Results available" },
  { year: 2016, type: "Parliamentary", title: "2016 National Assembly Election", description: "Parliamentary public notice and results archive.", sourceFile: "2016-ParliamentaryPublicNotice.pdf", status: "Source archive" },
  { year: 2016, type: "Local Government", title: "2016 Local Government Election", description: "Local government and mayoral results.", sourceFile: "2016-LGE-Results.pdf", status: "Results available" },
  { year: 2015, type: "Presidential", title: "2015 Presidential Election", description: "Presidential election public notice.", sourceFile: "2015-Presidential-Election-Results-Public-Notice.pdf", status: "Source archive" },
  { year: 2011, type: "Presidential", title: "2011 Presidential Election", description: "Published presidential election results.", sourceFile: "2011-Presidential-Election-Results.pdf", status: "Results available" },
  { year: 2011, type: "Parliamentary", title: "2011 National Assembly Election", description: "National Assembly election results.", sourceFile: "2011-National-Assembly-Elections-Results.pdf", status: "Results available" },
  { year: 2011, type: "Local Government", title: "2011 Local Government Election", description: "Local government election results.", sourceFile: "2011-LGE-Results.pdf", status: "Results available" },
  { year: 2008, type: "Presidential", title: "2008 Presidential Election", description: "Published presidential election results.", sourceFile: "2008-Presidential-Election-Results.pdf", status: "Results available" },
  { year: 2006, type: "Presidential", title: "2006 Presidential Election", description: "Published presidential election results.", sourceFile: "2006-Presidential-Election-Results.pdf", status: "Results available" },
  { year: 2001, type: "Presidential", title: "2001 Presidential Election", description: "Published presidential election results.", sourceFile: "2001-Presidential-Election-Results.pdf", status: "Results available" },
  { year: 1996, type: "Presidential", title: "1996 Presidential Election", description: "Published presidential election results.", sourceFile: "1996-Presidential-Election-Results.pdf", status: "Results available" },
];

const TYPES: Array<"All" | ElectionType> = ["All", "Presidential", "Parliamentary", "Local Government"];

export default function Elections() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const filtered = useMemo(() => ELECTIONS.filter((election) => {
    const matchesType = type === "All" || election.type === type;
    const searchable = `${election.year} ${election.title} ${election.type} ${election.sourceFile}`.toLowerCase();
    return matchesType && searchable.includes(query.toLowerCase());
  }), [query, type]);
  const years = new Set(ELECTIONS.map((election) => election.year)).size;

  return (
    <div className="min-h-full bg-muted/20">
      <div className="border-b bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                <ShieldCheck className="h-4 w-4" /> Electoral archive
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Zambia election results</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">Explore published presidential, parliamentary and local government results from the archive.</p>
            </div>
            <Link href="/data-sources" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">About the sources <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-4 p-4"><Archive className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">{ELECTIONS.length}</p><p className="text-xs text-muted-foreground">Archived result documents</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 p-4"><CalendarDays className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">{years}</p><p className="text-xs text-muted-foreground">Election years covered</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 p-4"><BarChart3 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-semibold">3</p><p className="text-xs text-muted-foreground">Election categories</p></div></CardContent></Card>
          </div>
        </div>
      </div>
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search years, elections or documents" className="pl-9" /></div>
          <div className="flex flex-wrap gap-2">{TYPES.map((item) => <button key={item} type="button" onClick={() => setType(item)} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${type === item ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{item}</button>)}</div>
        </div>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Results archive</h2><span className="text-sm text-muted-foreground">{filtered.length} documents</span></div>
        {filtered.length === 0 ? <Card><CardContent className="py-16 text-center text-muted-foreground">No archived results match your search.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((election) => <Card key={`${election.year}-${election.type}`} className="group transition-shadow hover:shadow-md"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="h-5 w-5" /></div><Badge variant="secondary">{election.year}</Badge></div><CardTitle className="pt-2 text-lg">{election.title}</CardTitle><CardDescription>{election.description}</CardDescription></CardHeader><CardContent><div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground"><FileText className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">{election.sourceFile}</span></div><div className="mt-4 flex items-center justify-between"><Badge variant="outline">{election.type}</Badge><span className="text-xs text-muted-foreground">{election.status}</span></div></CardContent></Card>)}</div>}
      </main>
    </div>
  );
}
