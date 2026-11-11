"use client";

import { Movie } from "@/lib/movie";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import MovieCard from "./MovieCard";

type MovieRowProps = {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  isTop10?: boolean;
};
const MovieRow = ({ title, movies, onSelectMovie, isTop10 }: MovieRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { clientWidth, scrollWidth, scrollLeft } = scrollRef.current;
    const scrollAmount = clientWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(() => {
      if (!scrollRef.current) return;
      setShowLeft(scrollRef.current.scrollLeft > 10);
      setShowRight(
        scrollRef.current.scrollLeft < scrollWidth - clientWidth - 10,
      );
    }, 500);
  };

  return (
    <div className="group/row relative mb-8 md:mb-12">
      <h2 className="text-white text-lg md:text-xl lg:text-2xl font-bold mb-2 md:mb-3 px-4 md:px-12">
        {title}
      </h2>

      <div className="relative">
        {showLeft && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover/row:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
            <div className="absolute left-12 md:left-16 top-0 bottom-0 w-16 row-fade-left pointer-events-none z-10" />
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 scroll-smooth"
        >
          {movies.map((movie, index) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={onSelectMovie}
              rank={isTop10 ? index + 1 : undefined}
            />
          ))}
        </div>

        {showRight && (
          <>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover/row:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
            <div className="absolute right-12 md:right-16 top-0 bottom-0 w-16 row-fade-right pointer-events-none z-10" />
          </>
        )}
      </div>
    </div>
  );
};

export default MovieRow;
