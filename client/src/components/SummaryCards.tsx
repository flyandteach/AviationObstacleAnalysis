import { Database, MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SummaryCardsProps {
  totalObstacles: number;
  airportsChecked: number;
  penetrations: number;
  warnings: number;
}

export default function SummaryCards({
  totalObstacles,
  airportsChecked,
  penetrations,
  warnings
}: SummaryCardsProps) {
  const stats = [
    {
      icon: Database,
      label: "Obstacles Analyzed",
      value: totalObstacles,
      color: "text-chart-2"
    },
    {
      icon: MapPin,
      label: "Airports Checked",
      value: airportsChecked,
      color: "text-chart-1"
    },
    {
      icon: AlertTriangle,
      label: "Penetrations Found",
      value: penetrations,
      color: "text-destructive"
    },
    {
      icon: CheckCircle,
      label: "Warnings",
      value: warnings,
      color: "text-chart-4"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground" data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-2 rounded-md bg-muted ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
