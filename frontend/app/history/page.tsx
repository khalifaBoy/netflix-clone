import { Suspense } from "react";
import HistoryClient from "./HistoryClient";

function HistoryLoading() {
  return (
    <main className="min-h-screen bg-[#141414] px-4 pb-12 pt-24 md:px-12">
      <div className="mb-7 h-8 w-48 animate-pulse rounded bg-white/10 md:h-9" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-video animate-pulse rounded-md bg-white/10" />
        ))}
      </div>
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <HistoryClient />
    </Suspense>
  );
}
