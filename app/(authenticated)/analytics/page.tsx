import { Suspense } from "react";
import AnalyticsClient from "./analytics-client";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Chargement...</div>}>
      <AnalyticsClient />
    </Suspense>
  );
}
