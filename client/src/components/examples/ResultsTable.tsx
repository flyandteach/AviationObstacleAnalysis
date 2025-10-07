import ResultsTable, { ObstacleResult } from '../ResultsTable';

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
  }
];

export default function ResultsTableExample() {
  return (
    <div className="p-6">
      <ResultsTable results={mockResults} />
    </div>
  );
}
