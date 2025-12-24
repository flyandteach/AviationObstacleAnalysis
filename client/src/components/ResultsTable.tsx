import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, AlertCircle, ChevronDown, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import React from "react";

export interface ObstacleResult {
  id: string;
  obstacleId: string;
  nearestAirport: string;
  airportName: string;
  distance: number;
  obstacleHeight: number;
  surfaceType: string;
  status: "penetration" | "warning" | "clear";
  latitude: number;
  longitude: number;
  requiresNotification?: boolean;
}

interface ResultsTableProps {
  results: ObstacleResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: ObstacleResult["status"]) => {
    switch (status) {
      case "penetration":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Penetration
          </Badge>
        );
      case "warning":
        return (
          <Badge className="gap-1 bg-chart-4 text-white">
            <AlertCircle className="w-3 h-3" />
            Warning
          </Badge>
        );
      case "clear":
        return (
          <Badge className="gap-1 bg-chart-3 text-white">
            <CheckCircle className="w-3 h-3" />
            Clear
          </Badge>
        );
    }
  };

  if (results.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No results to display. Upload an obstacle file to begin analysis.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border sticky top-0">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 w-12"></th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Obstacle ID</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Nearest Airport</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Distance (NM)</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Height (ft AGL)</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Surface</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">77.9 Notice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((result, index) => (
              <React.Fragment key={result.id}>
                <tr
                  key={result.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => toggleRow(result.id)}
                  data-testid={`row-result-${index}`}
                >
                  <td className="px-6 py-3">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${expandedRows.has(result.id) ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm text-foreground">{result.obstacleId}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{result.nearestAirport}</p>
                      <p className="text-xs text-muted-foreground">{result.airportName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm text-foreground">{result.distance.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm text-foreground">{result.obstacleHeight}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-foreground">{result.surfaceType}</span>
                  </td>
                  <td className="px-6 py-3">
                    {getStatusBadge(result.status)}
                  </td>
                  <td className="px-6 py-3">
                    {result.requiresNotification ? (
                      <Badge variant="outline" className="gap-1 border-chart-4 text-chart-4">
                        <FileWarning className="w-3 h-3" />
                        Required
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
                {expandedRows.has(result.id) && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Coordinates</p>
                          <p className="font-mono text-foreground">
                            {result.latitude.toFixed(6)}°, {result.longitude.toFixed(6)}°
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Analysis Details</p>
                          <p className="text-foreground">
                            {result.status === "penetration" 
                              ? "Obstacle penetrates Part 77 imaginary surface" 
                              : result.status === "warning"
                              ? "Obstacle within warning threshold"
                              : "Obstacle clear of all surfaces"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">FAA Notification (77.9)</p>
                          <p className="text-foreground">
                            {result.requiresNotification 
                              ? "Form 7460-1 notification required (penetrates 100:1 surface)" 
                              : "No notification required"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-6 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {results.length} results
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-export">
              Export Results
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
