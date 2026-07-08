import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function KidsLoading() {
  return (
    <div className="generate-page">
      <div className="generate-hero flex flex-col items-center gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-56" />
      </div>

      <div className="generate-steps">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <Card className="generate-card">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <div className="generate-actions">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
