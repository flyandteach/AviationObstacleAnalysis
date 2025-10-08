import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, AlertCircle, Plane } from 'lucide-react';

export interface MapObstacle {
  id: string;
  obstacleId: string;
  latitude: number;
  longitude: number;
  obstacleHeight: number;
  nearestAirport: string;
  airportName: string;
  airportLatitude: number;
  airportLongitude: number;
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

  const getAirportIcon = () => {
    return new DivIcon({
      className: 'airport-marker',
      html: `
        <div style="
          background-color: #3b82f6;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // Get unique airports to avoid duplicate markers
  const uniqueAirports = new Map<string, { lat: number; lng: number; name: string; ident: string }>();
  obstacles.forEach(obs => {
    if (!uniqueAirports.has(obs.nearestAirport)) {
      uniqueAirports.set(obs.nearestAirport, {
        lat: obs.airportLatitude,
        lng: obs.airportLongitude,
        name: obs.airportName,
        ident: obs.nearestAirport,
      });
    }
  });

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
          
          {/* Airport markers */}
          {Array.from(uniqueAirports.values()).map((airport) => (
            <Marker
              key={airport.ident}
              position={[airport.lat, airport.lng]}
              icon={getAirportIcon()}
              data-testid={`airport-marker-${airport.ident}`}
            >
              <Popup>
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-sm">
                      {airport.ident}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {airport.name}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Obstacle markers */}
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
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#3b82f6] border-2 border-white flex items-center justify-center">
              <Plane className="w-3 h-3 text-white" />
            </div>
            <span className="text-foreground">Airport</span>
          </div>
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
