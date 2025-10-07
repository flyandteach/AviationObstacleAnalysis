import ObstacleMap, { MapObstacle } from '../ObstacleMap';

// todo: remove mock functionality
// Obstacle coordinates offset from airports
const mockObstacles: MapObstacle[] = [
  {
    id: "1",
    obstacleId: "OBS-2024-001",
    latitude: 47.4434,
    longitude: -122.3156,
    obstacleHeight: 215,
    nearestAirport: "SEA",
    airportName: "Seattle-Tacoma Intl",
    distance: 0.45,
    surfaceType: "Approach Surface",
    status: "penetration"
  },
  {
    id: "2",
    obstacleId: "OBS-2024-002",
    latitude: 47.6385,
    longitude: -117.5512,
    obstacleHeight: 178,
    nearestAirport: "GEG",
    airportName: "Spokane International",
    distance: 1.32,
    surfaceType: "Horizontal Surface",
    status: "warning"
  },
  {
    id: "3",
    obstacleId: "OBS-2024-003",
    latitude: 47.5389,
    longitude: -122.3145,
    obstacleHeight: 95,
    nearestAirport: "BFI",
    airportName: "Boeing Field",
    distance: 0.89,
    surfaceType: "Transitional Surface",
    status: "clear"
  }
];

export default function ObstacleMapExample() {
  return (
    <div className="p-6">
      <ObstacleMap obstacles={mockObstacles} />
    </div>
  );
}
