import { useState } from "react";
import Header from "@/components/Header";
import FileUpload from "@/components/FileUpload";
import SummaryCards from "@/components/SummaryCards";
import ResultsTable, { ObstacleResult } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";

// todo: remove mock functionality
const mockResults: ObstacleResult[] = [
  {
    id: "1",
    obstacleId: "OBS-2024-001",
    nearestAirport: "SEA",
    airportName: "Seattle-Tacoma Intl",
    distance: 2.45,
    obstacleHeight: 485,
    surfaceType: "Approach Surface",
    status: "penetration",
    latitude: 47.4502,
    longitude: -122.3088
  },
  {
    id: "2",
    obstacleId: "OBS-2024-002",
    nearestAirport: "GEG",
    airportName: "Spokane International",
    distance: 4.12,
    obstacleHeight: 328,
    surfaceType: "Horizontal Surface",
    status: "warning",
    latitude: 47.6199,
    longitude: -117.5339
  },
  {
    id: "3",
    obstacleId: "OBS-2024-003",
    nearestAirport: "BFI",
    airportName: "Boeing Field",
    distance: 1.89,
    obstacleHeight: 215,
    surfaceType: "Primary Surface",
    status: "clear",
    latitude: 47.5300,
    longitude: -122.3019
  },
  {
    id: "4",
    obstacleId: "OBS-2024-004",
    nearestAirport: "PSC",
    airportName: "Tri-Cities Airport",
    distance: 3.67,
    obstacleHeight: 412,
    surfaceType: "Transitional Surface",
    status: "warning",
    latitude: 46.2647,
    longitude: -119.1190
  },
  {
    id: "5",
    obstacleId: "OBS-2024-005",
    nearestAirport: "OLM",
    airportName: "Olympia Regional",
    distance: 5.23,
    obstacleHeight: 156,
    surfaceType: "Approach Surface",
    status: "clear",
    latitude: 46.9694,
    longitude: -122.9026
  },
  {
    id: "6",
    obstacleId: "OBS-2024-006",
    nearestAirport: "ALW",
    airportName: "Walla Walla Regional",
    distance: 6.15,
    obstacleHeight: 298,
    surfaceType: "Horizontal Surface",
    status: "penetration",
    latitude: 46.0949,
    longitude: -118.2880
  },
  {
    id: "7",
    obstacleId: "OBS-2024-007",
    nearestAirport: "ELN",
    airportName: "Bowers Field",
    distance: 1.34,
    obstacleHeight: 178,
    surfaceType: "Primary Surface",
    status: "clear",
    latitude: 46.6743,
    longitude: -120.5309
  }
];

export default function Home() {
  const [hasFile, setHasFile] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleFileUpload = (file: File) => {
    console.log('File uploaded:', file.name);
    setHasFile(true);
    // Simulate processing
    setTimeout(() => {
      setShowResults(true);
    }, 1000);
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

        {/* File Upload Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Upload Obstacle Data</h2>
          <FileUpload onFileUpload={handleFileUpload} />
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
              Upload your obstacle data file to begin the Part 77 surface penetration analysis. 
              Supported formats include CSV, XLS, and XLSX.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
