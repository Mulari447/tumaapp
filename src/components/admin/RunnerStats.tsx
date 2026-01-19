import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CheckCircle, XCircle, FileSearch } from "lucide-react";

interface RunnerStatsProps {
  stats: {
    total: number;
    pending: number;
    underReview: number;
    verified: number;
    rejected: number;
  };
}

export function RunnerStats({ stats }: RunnerStatsProps) {
  const statItems = [
    {
      label: "Total Runners",
      value: stats.total,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Under Review",
      value: stats.underReview,
      icon: FileSearch,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      label: "Verified",
      value: stats.verified,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Rejected",
      value: stats.rejected,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
