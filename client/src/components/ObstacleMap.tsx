import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export interface MapObstacle {
  id: string;
  obstacleId: string;
  latitude: number;
  longitude: number;
  obstacleHeight: number;
  nearestAirport: string;
  airportName: string;
  distance: number;
  surfaceType: string;
  status: "penetration" | "warning" | "clear";
}

interface ObstacleMapProps {
  obstacles: MapObstacle[];
}

export default function ObstacleMap({ obstacles }: ObstacleMapProps) {
  if (obstacles.length === 0) {
    return null;
  }

  const center: [number, number] = obstacles.length > 0
    ? [obstacles[0].latitude, obstacles[0].longitude]
    : [47.6062, -122.3321];

  const getColor = (status: MapObstacle["status"]) => {
    switch (status) {
      case "penetration":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "clear":
        return "#22c55e";
    }
  };

  const getIcon = (status: MapObstacle["status"]) => {
    const color = getColor(status);
    return new DivIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-[500px] relative">
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          data-testid="map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {obstacles.map((obstacle) => (
            <CircleMarker
              key={obstacle.id}
              center={[obstacle.latitude, obstacle.longitude]}
              radius={8}
              fillColor={getColor(obstacle.status)}
              color="white"
              weight={2}
              fillOpacity={0.8}
              data-testid={`marker-${obstacle.obstacleId}`}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold">
                      {obstacle.obstacleId}
                    </span>
                    {obstacle.status === "penetration" && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Penetration
                      </Badge>
                    )}
                    {obstacle.status === "warning" && (
                      <Badge className="gap-1 text-xs bg-chart-4 text-white">
                        <AlertCircle className="w-3 h-3" />
                        Warning
                      </Badge>
                    )}
                    {obstacle.status === "clear" && (
                      <Badge className="gap-1 text-xs bg-chart-3 text-white">
                        <CheckCircle className="w-3 h-3" />
                        Clear
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Height:</span>{' '}
                      <span className="font-medium">{obstacle.obstacleHeight} ft AGL</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Airport:</span>{' '}
                      <span className="font-medium">{obstacle.nearestAirport}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Distance:</span>{' '}
                      <span className="font-medium">{obstacle.distance.toFixed(2)} NM</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Surface:</span>{' '}
                      <span className="font-medium">{obstacle.surfaceType}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      
      <div className="border-t border-border p-4 bg-muted/30">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#ef4444] border-2 border-white"></div>
            <span className="text-foreground">Penetration</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#f59e0b] border-2 border-white"></div>
            <span className="text-foreground">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#22c55e] border-2 border-white"></div>
            <span className="text-foreground">Clear</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
