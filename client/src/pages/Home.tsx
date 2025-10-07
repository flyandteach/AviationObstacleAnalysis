import { useState } from "react";
import Header from "@/components/Header";
import TextInput from "@/components/TextInput";
import SummaryCards from "@/components/SummaryCards";
import ResultsTable, { ObstacleResult } from "@/components/ResultsTable";
import ObstacleMap, { MapObstacle } from "@/components/ObstacleMap";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";

// todo: remove mock functionality
// Obstacle coordinates offset from airports by realistic distances
const mockResults: ObstacleResult[] = [
  {
    id: "1",
    obstacleId: "OBS-2024-001",
    nearestAirport: "SEA",
    airportName: "Seattle-Tacoma Intl",
    distance: 0.45,
    obstacleHeight: 215,
    surfaceType: "Approach Surface",
    status: "penetration",
    latitude: 47.4434, // Offset from SEA (47.4502, -122.3088)
    longitude: -122.3156
  },
  {
    id: "2",
    obstacleId: "OBS-2024-002",
    nearestAirport: "GEG",
    airportName: "Spokane International",
    distance: 1.32,
    obstacleHeight: 178,
    surfaceType: "Horizontal Surface",
    status: "warning",
    latitude: 47.6385, // Offset from GEG (47.6199, -117.5339)
    longitude: -117.5512
  },
  {
    id: "3",
    obstacleId: "OBS-2024-003",
    nearestAirport: "BFI",
    airportName: "Boeing Field",
    distance: 0.89,
    obstacleHeight: 95,
    surfaceType: "Transitional Surface",
    status: "clear",
    latitude: 47.5389, // Offset from BFI (47.5300, -122.3019)
    longitude: -122.3145
  },
  {
    id: "4",
    obstacleId: "OBS-2024-004",
    nearestAirport: "PSC",
    airportName: "Tri-Cities Airport",
    distance: 0.67,
    obstacleHeight: 142,
    surfaceType: "Transitional Surface",
    status: "warning",
    latitude: 46.2725, // Offset from PSC (46.2647, -119.1190)
    longitude: -119.1278
  },
  {
    id: "5",
    obstacleId: "OBS-2024-005",
    nearestAirport: "OLM",
    airportName: "Olympia Regional",
    distance: 1.56,
    obstacleHeight: 186,
    surfaceType: "Horizontal Surface",
    status: "penetration",
    latitude: 46.9889, // Offset from OLM (46.9694, -122.9026)
    longitude: -122.9234
  },
  {
    id: "6",
    obstacleId: "OBS-2024-006",
    nearestAirport: "ALW",
    airportName: "Walla Walla Regional",
    distance: 0.23,
    obstacleHeight: 68,
    surfaceType: "Primary Surface",
    status: "clear",
    latitude: 46.0978, // Offset from ALW (46.0949, -118.2880)
    longitude: -118.2912
  },
  {
    id: "7",
    obstacleId: "OBS-2024-007",
    nearestAirport: "ELN",
    airportName: "Bowers Field",
    distance: 0.78,
    obstacleHeight: 125,
    surfaceType: "Approach Surface",
    status: "clear",
    latitude: 46.6834, // Offset from ELN (46.6743, -120.5309)
    longitude: -120.5423
  }
];

export default function Home() {
  const [showResults, setShowResults] = useState(false);

  const handleTextSubmit = (text: string) => {
    console.log('Text submitted:', text.substring(0, 100));
    // Simulate processing
    setTimeout(() => {
      setShowResults(true);
    }, 500);
  };

  const handleExport = () => {
    console.log('Exporting results');
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
                This tool evaluates obstacles against approach, primary, transitional, and horizontal surfaces 
                as defined in 14 CFR Part 77.
              </p>
            </div>
          </div>
        </div>

        {/* Text Input Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Paste Obstacle Data</h2>
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
                totalObstacles={mockResults.length}
                airportsChecked={6}
                penetrations={mockResults.filter(r => r.status === "penetration").length}
                warnings={mockResults.filter(r => r.status === "warning").length}
              />
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Map View</h2>
              <ObstacleMap obstacles={mockResults as MapObstacle[]} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Detailed Results</h2>
              <ResultsTable results={mockResults} />
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
