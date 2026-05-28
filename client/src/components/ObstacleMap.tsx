import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle } from 'react-leaflet';
import { DivIcon } from 'leaflet';
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
  obstacleHeightMSL?: number;
  nearestAirport: string;
  airportName: string;
  airportLatitude: number;
  airportLongitude: number;
  distance: number;
  surfaceType: string;
  status: "penetration" | "warning" | "clear";
  penetrationHeight?: number;
  horizontalRadiusFt: number;
  conicalOuterRadiusFt: number;
  approachType: string;
}

interface ObstacleMapProps {
  obstacles: MapObstacle[];
}

const FT_TO_M = 0.3048;

export default function ObstacleMap({ obstacles }: ObstacleMapProps) {
  if (obstacles.length === 0) {
    return null;
  }

  const center: [number, number] = obstacles.length > 0
    ? [obstacles[0].latitude, obstacles[0].longitude]
    : [47.6062, -122.3321];

  const getColor = (status: MapObstacle["status"]) => {
    switch (status) {
      case "penetration": return "#ef4444";
      case "warning":     return "#f59e0b";
      case "clear":       return "#22c55e";
    }
  };

  const getObstacleIcon = (status: MapObstacle["status"]) => {
    const color = getColor(status);
    return new DivIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const getAirportIcon = () => new DivIcon({
    className: 'airport-marker',
    html: `<div style="
      background-color: #1d4ed8;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2
          c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2
          3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // Collapse obstacles by airport: one surface ring set per unique airport,
  // using the largest radii seen for that airport (most conservative).
  interface AirportSurface {
    lat: number;
    lng: number;
    name: string;
    ident: string;
    horizontalRadiusFt: number;
    conicalOuterRadiusFt: number;
    approachType: string;
  }
  const airportSurfaceMap = new Map<string, AirportSurface>();
  obstacles.forEach(obs => {
    const existing = airportSurfaceMap.get(obs.nearestAirport);
    if (!existing || obs.horizontalRadiusFt > existing.horizontalRadiusFt) {
      airportSurfaceMap.set(obs.nearestAirport, {
        lat: obs.airportLatitude,
        lng: obs.airportLongitude,
        name: obs.airportName,
        ident: obs.nearestAirport,
        horizontalRadiusFt: obs.horizontalRadiusFt,
        conicalOuterRadiusFt: obs.conicalOuterRadiusFt,
        approachType: obs.approachType,
      });
    }
  });

  const approachLabel: Record<string, string> = {
    PREC: "Precision (ILS)",
    NONPREC: "Non-Precision",
    VISUAL: "Visual",
    UTILITY: "Utility/Visual",
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

          {/* Part 77 surface rings — one set per airport */}
          {Array.from(airportSurfaceMap.values()).map((ap) => {
            const hRadius = ap.horizontalRadiusFt * FT_TO_M;
            const cRadius = ap.conicalOuterRadiusFt * FT_TO_M;
            const pos: [number, number] = [ap.lat, ap.lng];
            return (
              <div key={`surface-${ap.ident}`}>
                {/* Conical surface — outer ring, drawn first (behind horizontal) */}
                <Circle
                  center={pos}
                  radius={cRadius}
                  pathOptions={{
                    color: "#a855f7",
                    weight: 1,
                    opacity: 0.6,
                    fillColor: "#a855f7",
                    fillOpacity: 0.04,
                    dashArray: "6 4",
                  }}
                />
                {/* Horizontal surface — solid inner ring */}
                <Circle
                  center={pos}
                  radius={hRadius}
                  pathOptions={{
                    color: "#3b82f6",
                    weight: 1.5,
                    opacity: 0.8,
                    fillColor: "#3b82f6",
                    fillOpacity: 0.06,
                  }}
                />
              </div>
            );
          })}

          {/* Airport markers */}
          {Array.from(airportSurfaceMap.values()).map((ap) => (
            <Marker
              key={`airport-${ap.ident}`}
              position={[ap.lat, ap.lng]}
              icon={getAirportIcon()}
              data-testid={`airport-marker-${ap.ident}`}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{ap.ident}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{ap.name}</div>
                  <div className="space-y-1 text-xs border-t pt-2">
                    <div>
                      <span className="text-muted-foreground">Approach type:</span>{' '}
                      <span className="font-medium">{approachLabel[ap.approachType] ?? ap.approachType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-0.5 bg-blue-500 rounded"></span>
                      <span className="text-muted-foreground">
                        Horizontal surface: {(ap.horizontalRadiusFt / 6076.12).toFixed(1)} NM radius
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 border-t border-dashed border-purple-500"></span>
                      <span className="text-muted-foreground">
                        Conical outer edge: {(ap.conicalOuterRadiusFt / 6076.12).toFixed(1)} NM radius
                      </span>
                    </div>
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
              fillOpacity={0.9}
              data-testid={`marker-${obstacle.obstacleId}`}
            >
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold">{obstacle.obstacleId}</span>
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
                      <span className="text-muted-foreground">Height AGL:</span>{' '}
                      <span className="font-medium">{obstacle.obstacleHeight} ft</span>
                    </div>
                    {obstacle.obstacleHeightMSL ? (
                      <div>
                        <span className="text-muted-foreground">Height MSL:</span>{' '}
                        <span className="font-medium">{obstacle.obstacleHeightMSL} ft</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-muted-foreground">Controlling airport:</span>{' '}
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
                    {obstacle.penetrationHeight != null && obstacle.penetrationHeight > 0 && (
                      <div>
                        <span className="text-muted-foreground">Penetration depth:</span>{' '}
                        <span className="font-medium text-red-500">{obstacle.penetrationHeight.toFixed(0)} ft</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="border-t border-border p-4 bg-muted/30">
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-700 border-2 border-white flex items-center justify-center">
              <Plane className="w-3 h-3 text-white" />
            </div>
            <span className="text-foreground">Airport (ARP)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0 border-t-2 border-blue-500 rounded"></div>
            <span className="text-foreground">Horizontal surface</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0 border-t-2 border-dashed border-purple-500 rounded"></div>
            <span className="text-foreground">Conical surface (outer)</span>
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
        <p className="text-center text-xs text-muted-foreground mt-2">
          Surfaces shown are horizontal and conical. Approach surfaces are directional (runway centerline extended) and are evaluated but not drawn.
        </p>
      </div>
    </Card>
  );
}
