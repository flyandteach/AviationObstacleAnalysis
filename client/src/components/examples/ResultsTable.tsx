import ResultsTable, { ObstacleResult } from '../ResultsTable';

// todo: remove mock functionality
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
    latitude: 47.4502,
    longitude: -122.3088
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
    latitude: 47.6199,
    longitude: -117.5339
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
    latitude: 47.5300,
    longitude: -122.3019
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
    latitude: 46.2647,
    longitude: -119.1190
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
