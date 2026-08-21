import { useState } from "react";
import Header from "@/components/Header";
import TextInput from "@/components/TextInput";
import SummaryCards from "@/components/SummaryCards";
import ResultsTable, { ObstacleResult } from "@/components/ResultsTable";
import ObstacleMap, { MapObstacle } from "@/components/ObstacleMap";
import { Button } from "@/components/ui/button";
import { Download, Info, Loader2 } from "lucide-react";
import { analyzeObstacles, ObstacleAnalysisError } from "@/lib/obstacleAnalysis";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ObstacleResult[]>([]);
  const [airportsChecked, setAirportsChecked] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleTextSubmit = async (text: string) => {
    setIsLoading(true);

    try {
      const analyzed = analyzeObstacles(text);

      const uniqueAirports = new Set(analyzed.map((r) => r.nearestAirport));
      setResults(analyzed);
      setAirportsChecked(uniqueAirports.size);
      setShowResults(true);

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${analyzed.length} obstacles (excluded "determined" status)`,
      });
    } catch (error) {
      console.error("Error analyzing obstacles:", error);

      const message =
        error instanceof ObstacleAnalysisError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to analyze obstacles. Please check your input format.";

      toast({
        title: "Analysis Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    console.log("Exporting results");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-md">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                FAA Part 77 Analysis for Washington State
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload an obstacle list to analyze potential penetrations of airport imaginary surfaces.
                This tool evaluates obstacles against all Part 77 surfaces (primary, approach, transitional,
                horizontal, and conical) as defined in 14 CFR Part 77, using FAA NASR runway-end coordinates
                for directionally correct approach and transitional surface corridors.
              </p>
            </div>
          </div>
        </div>

        {/* Text Input Section */}
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
          <TextInput onTextSubmit={handleTextSubmit} />
        </section>

        {/* Results Section */}
        {showResults && (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">Analysis Summary</h2>
                <Button variant="outline" onClick={handleExport} data-testid="button-export-summary">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
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
        )}

        {/* Empty State */}
        {!showResults && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Info className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Ready to Analyze
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Paste your obstacle data in the text area above to begin the Part 77 surface penetration analysis.
              Supports CSV format or tab-delimited text.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
