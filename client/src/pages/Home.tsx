import { useState } from "react";
import Header from "@/components/Header";
import TextInput from "@/components/TextInput";
import FileUpload from "@/components/FileUpload";
import SummaryCards from "@/components/SummaryCards";
import ResultsTable, { ObstacleResult } from "@/components/ResultsTable";
import ObstacleMap, { MapObstacle } from "@/components/ObstacleMap";
import { Button } from "@/components/ui/button";
import { Download, Info, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(results: ObstacleResult[]) {
  const headers = [
    "Obstacle ID",
    "Latitude",
    "Longitude",
    "Controlling Airport",
    "Airport Name",
    "Distance NM",
    "Height AGL ft",
    "Height MSL ft",
    "Surface",
    "Status",
    "Penetration ft",
    "Approach Type",
  ];

  const rows = results.map((r: any) => [
    r.obstacleId,
    r.latitude,
    r.longitude,
    r.nearestAirport,
    r.airportName,
    r.distance,
    r.obstacleHeight,
    r.obstacleHeightMSL,
    r.surfaceType,
    r.status,
    r.penetrationHeight,
    r.approachType,
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `part77-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [results, setResults] = useState<ObstacleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const analyzeText = async (text: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/analyze-obstacles", { text });
      const response = await res.json() as {
        success: boolean;
        count: number;
        parsedCount?: number;
        unparsedCount?: number;
        skippedDetermined?: number;
        results: ObstacleResult[];
        error?: string;
      };

      if (!response.success || response.results.length === 0) {
        throw new Error(response.error || "No valid obstacles were found.");
      }

      setResults(response.results);

      const notes: string[] = [];
      if ((response.unparsedCount ?? 0) > 0) {
        notes.push(`${response.unparsedCount} line${response.unparsedCount === 1 ? " was" : "s were"} not recognized`);
      }
      if ((response.skippedDetermined ?? 0) > 0) {
        notes.push(`${response.skippedDetermined} determined line${response.skippedDetermined === 1 ? " was" : "s were"} skipped`);
      }

      toast({
        title: "Analysis complete",
        description: `Analyzed ${response.count} obstacle${response.count === 1 ? "" : "s"}${notes.length ? `. ${notes.join("; ")}.` : "."}`,
      });
    } catch (error) {
      setResults([]);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Unable to analyze obstacle data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "txt") {
      toast({
        title: "Unsupported file",
        description: "Upload a CSV or TXT file, or paste the obstacle data directly.",
        variant: "destructive",
      });
      return;
    }
    await analyzeText(await file.text());
  };

  const airportsChecked = new Set(results.map(r => r.nearestAirport)).size;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-md">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                FAA Part 77 screening analysis for Washington State
              </h3>
              <p className="text-sm text-muted-foreground">
                This tool evaluates obstacle coordinates and elevations against primary, approach,
                transitional, horizontal, and conical surfaces using the bundled FAA/NASR airport and
                runway data. It is a planning and screening tool, not an FAA aeronautical determination.
              </p>
            </div>
          </div>
        </div>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Paste Obstacle Data</h2>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing...</span>
              </div>
            )}
          </div>
          <TextInput onTextSubmit={analyzeText} />
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Or Upload CSV/TXT</h2>
          <FileUpload onFileUpload={handleFileUpload} />
        </section>

        {results.length > 0 ? (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">Analysis Summary</h2>
                <Button variant="outline" onClick={() => downloadCsv(results)}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <SummaryCards
                totalObstacles={results.length}
                airportsChecked={airportsChecked}
                penetrations={results.filter(r => r.status === "penetration").length}
                warnings={results.filter(r => r.status === "warning").length}
              />
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Map View</h2>
              <ObstacleMap obstacles={results as MapObstacle[]} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Detailed Results</h2>
              <ResultsTable results={results} />
            </section>
          </>
        ) : (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Info className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Ready to analyze</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Paste obstacle data or upload a CSV/TXT file. No example or fabricated results are shown if analysis fails.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
