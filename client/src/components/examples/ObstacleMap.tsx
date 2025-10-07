import ObstacleMap, { MapObstacle } from '../ObstacleMap';

// todo: remove mock functionality
const mockObstacles: MapObstacle[] = [
  {
    id: "1",
    obstacleId: "OBS-2024-001",
    latitude: 47.4502,
    longitude: -122.3088,
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
    latitude: 47.6199,
    longitude: -117.5339,
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
    latitude: 47.5300,
    longitude: -122.3019,
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
