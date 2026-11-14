import { Suspense } from "react";
import MyListClient from "./MyListClient";

function MyListLoading() {
  return (
    <main className="min-h-screen bg-[#141414] px-4 pb-12 pt-24 md:px-12">
      <div className="mb-7 h-8 w-36 animate-pulse rounded bg-white/10 md:h-9" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-video animate-pulse rounded-md bg-white/10" />
        ))}
      </div>
    </main>
  );
}

export default function MyListPage() {
  return (
    <Suspense fallback={<MyListLoading />}>
      <MyListClient />
    </Suspense>
  );
}
