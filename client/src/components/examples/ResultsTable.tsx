import ResultsTable, { ObstacleResult } from '../ResultsTable';

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
    latitude: 47.4434,
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
    latitude: 47.6385,
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
    latitude: 47.5389,
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
    latitude: 46.2725,
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
    latitude: 46.9889,
    longitude: -122.9234
  }
];

export default function ResultsTableExample() {
  return (
    <div className="p-6">
      <ResultsTable results={mockResults} />
    </div>
  );
}
