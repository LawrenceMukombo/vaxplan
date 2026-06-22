import { ThemeProvider } from "@/components/ThemeProvider";
import UserGuideSection from "@/components/UserGuideSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BookOpen, ArrowLeft, Beaker } from "lucide-react";
import { getDomainLinks } from "@/lib/navigation";
import { Button } from "@/components/ui/button";

export default function PublicDocs() {
  const { vaxplanUrl, researchUrl } = getDomainLinks();

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-indigo-600" />
              <span className="font-bold text-lg hidden sm:inline-block">VaxPlan Documentation</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground">
                <a href={researchUrl}>
                  <Beaker className="h-4 w-4" />
                  Research Hub
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href={vaxplanUrl}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to VaxPlan
                </a>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 container max-w-5xl py-8">
          <UserGuideSection isFacilityRole={false} />
        </main>

        <footer className="border-t py-6 bg-muted/40">
          <div className="container flex items-center justify-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} VaxPlan Platform. All rights reserved.
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
