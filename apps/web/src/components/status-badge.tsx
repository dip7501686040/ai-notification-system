import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<string, "success" | "destructive" | "warning" | "secondary" | "outline"> = {
  published: "success",
  sent: "success",
  active: "success",
  completed: "success",
  received: "secondary",
  pending: "secondary",
  dispatching: "secondary",
  retrying: "warning",
  suspended: "warning",
  failed: "destructive",
  dead_letter: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANTS[status] ?? "outline"} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
