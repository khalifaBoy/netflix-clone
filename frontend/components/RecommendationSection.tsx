"use client";

import MovieRow from "@/components/MovieRow";
import type { Movie } from "@/lib/movie";

type RecommendationStatus = "idle" | "loading" | "success" | "empty" | "error";

type RecommendationSectionProps = {
  status: RecommendationStatus;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onRetry: () => void;
  hasProfile: boolean;
  authLoading: boolean;
};

export default function RecommendationSection({ status, movies, onSelectMovie, onRetry, hasProfile, authLoading }: RecommendationSectionProps) {
  if (!hasProfile && !authLoading) {
    return (
      <section aria-labelledby="for-you-heading" className="mb-8 md:mb-12">
        <h2 id="for-you-heading" className="mb-3 px-4 text-lg font-bold text-white md:px-12 md:text-xl lg:text-2xl">For You</h2>
        <p className="px-4 text-sm text-white/65 md:px-12">Select a profile to see personalized recommendations.</p>
      </section>
    );
  }

  if (authLoading || status === "loading" || status === "idle") {
    return (
      <section aria-labelledby="for-you-heading" aria-busy="true" className="group/row relative mb-8 md:mb-12">
        <h2 id="for-you-heading" className="mb-2 px-4 text-lg font-bold text-white md:mb-3 md:px-12 md:text-xl lg:text-2xl">For You</h2>
        <div className="flex gap-2 overflow-hidden px-4 md:gap-3 md:px-12" role="status" aria-label="Loading recommendations">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-video w-[160px] flex-shrink-0 animate-pulse rounded-md bg-white/10 md:w-[240px] lg:w-[280px]" />)}
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section aria-labelledby="for-you-heading" className="mb-8 md:mb-12">
        <h2 id="for-you-heading" className="mb-3 px-4 text-lg font-bold text-white md:px-12 md:text-xl lg:text-2xl">For You</h2>
        <div className="mx-4 rounded-md border border-white/10 bg-[#1d1d1d] px-4 py-5 md:mx-12 md:px-6">
          <p className="text-sm text-white/75">We couldn’t load your recommendations. Please try again.</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/85">Retry</button>
        </div>
      </section>
    );
  }

  if (status === "empty" || movies.length === 0) {
    return (
      <section aria-labelledby="for-you-heading" className="mb-8 md:mb-12">
        <h2 id="for-you-heading" className="mb-3 px-4 text-lg font-bold text-white md:px-12 md:text-xl lg:text-2xl">For You</h2>
        <p className="px-4 text-sm text-white/65 md:px-12">Your personalized picks are still taking shape. Watching more titles and adding favorites can help improve them.</p>
      </section>
    );
  }

  return <MovieRow title="For You" movies={movies} onSelectMovie={onSelectMovie} />;
}
