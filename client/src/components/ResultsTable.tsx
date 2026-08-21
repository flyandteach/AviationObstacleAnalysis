import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, Fragment } from "react";

export interface ObstacleResult {
  id: string;
  obstacleId: string;
  nearestAirport: string;
  airportName: string;
  airportLatitude: number;
  airportLongitude: number;
  distance: number;
  obstacleHeight: number;
  obstacleHeightMSL?: number;
  surfaceType: string;
  status: "penetration" | "warning" | "clear";
  penetrationHeight?: number;
  latitude: number;
  longitude: number;
  horizontalRadiusFt: number;
  conicalOuterRadiusFt: number;
  approachType: string;
}

interface ResultsTableProps {
  results: ObstacleResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusBadge = (status: ObstacleResult["status"]) => {
    if (status === "penetration") {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Penetration</Badge>;
    }
    if (status === "warning") {
      return <Badge className="gap-1 bg-chart-4 text-white"><AlertCircle className="w-3 h-3" />Warning</Badge>;
    }
    return <Badge className="gap-1 bg-chart-3 text-white"><CheckCircle className="w-3 h-3" />Clear</Badge>;
  };

  if (results.length === 0) {
    return <Card className="p-12 text-center"><p className="text-muted-foreground">No results to display.</p></Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border sticky top-0">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Obstacle ID</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Controlling Airport</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Distance NM</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">AGL ft</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Surface</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((result, index) => (
              <Fragment key={result.id}>
                <tr className="hover-elevate cursor-pointer" onClick={() => toggleRow(result.id)} data-testid={`row-result-${index}`}>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Toggle details">
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(result.id) ? "rotate-180" : ""}`} />
                    </Button>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{result.obstacleId}</td>
                  <td className="px-4 py-3"><p className="text-sm font-medium">{result.nearestAirport}</p><p className="text-xs text-muted-foreground">{result.airportName}</p></td>
                  <td className="px-4 py-3 font-mono text-sm">{result.distance.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-sm">{result.obstacleHeight}</td>
                  <td className="px-4 py-3 text-sm">{result.surfaceType}</td>
                  <td className="px-4 py-3">{statusBadge(result.status)}</td>
                </tr>
                {expandedRows.has(result.id) && (
                  <tr className="bg-muted/30">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div><p className="text-muted-foreground mb-1">Coordinates</p><p className="font-mono">{result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}</p></div>
                        <div><p className="text-muted-foreground mb-1">Height MSL</p><p>{result.obstacleHeightMSL ?? "—"} ft</p></div>
                        <div><p className="text-muted-foreground mb-1">Approach category</p><p>{result.approachType}</p></div>
                        <div><p className="text-muted-foreground mb-1">Penetration depth</p><p>{result.penetrationHeight != null ? `${result.penetrationHeight.toFixed(1)} ft` : "—"}</p></div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-6 py-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">Showing {results.length} result{results.length === 1 ? "" : "s"}</p>
      </div>
    </Card>
  );
}
