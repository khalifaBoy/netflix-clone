"use client";

import { Play, Info, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Movie } from "@/lib/movie";

type HeroBannerProps = {
  movie: Movie;
  onMoreInfo: (movie: Movie) => void;
};

export default function HeroBanner({ movie, onMoreInfo }: HeroBannerProps) {
  const [muted, setMuted] = useState(true);
  const router = useRouter();

  return (
    <div className="relative h-[56.25vw] max-h-[85vh] min-h-[400px] w-full">
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={movie.backdrop}
          alt={movie.title}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 hero-gradient" />
      </div>

      <div className="relative z-10 flex flex-col justify-end h-full pb-[20%] md:pb-[10%] px-4 md:px-12 max-w-3xl">
        <div className="flex items-center gap-2 mb-3 animate-fade-in-up">
          <span className="text-red-500 font-bold text-sm tracking-widest uppercase">
            N Series
          </span>
          {movie.isTop10 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
              TOP 10
            </span>
          )}
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white text-shadow-lg mb-4 animate-fade-in-up">
          {movie.title}
        </h1>

        <div className="flex items-center gap-3 mb-4 text-sm animate-fade-in-up">
          <span className="text-green-500 font-bold">{movie.match}% Match</span>
          <span className="text-white/80">{movie.year}</span>
          <span className="border border-white/40 text-white/80 px-1.5 text-xs">
            {movie.rating}
          </span>
          <span className="text-white/80">{movie.duration}</span>
          {movie.isNew && (
            <span className="text-red-500 font-bold text-xs uppercase tracking-wider">
              New
            </span>
          )}
        </div>

        <p className="text-white/90 text-base md:text-lg max-w-xl leading-relaxed mb-6 text-shadow-lg line-clamp-3 animate-fade-in-up">
          {movie.description}
        </p>

        <div className="flex items-center gap-3 animate-fade-in-up">
          <button
            onClick={() => router.push(`/watch/${movie.id}`)}
            className="flex items-center gap-2 bg-white text-black px-6 md:px-8 py-2 md:py-2.5 rounded-md font-bold text-base md:text-lg hover:bg-white/80 transition-colors"
          >
            <Play className="w-5 h-5 md:w-6 md:h-6 fill-black" />
            Play
          </button>
          <button
            onClick={() => onMoreInfo(movie)}
            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-6 md:px-8 py-2 md:py-2.5 rounded-md font-bold text-base md:text-lg hover:bg-white/30 transition-colors"
          >
            <Info className="w-5 h-5 md:w-6 md:h-6" />
            More Info
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-10 flex items-center gap-4 pb-[10%] md:pb-[8%] pr-4 md:pr-12">
        <button
          onClick={() => setMuted(!muted)}
          className="w-9 h-9 md:w-11 md:h-11 border-2 border-white/50 rounded-full flex items-center justify-center text-white hover:border-white transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
          ) : (
            <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
          )}
        </button>
        <div className="border-l-4 border-white/80 bg-black/40 backdrop-blur-sm pl-3 pr-8 py-1">
          <span className="text-white text-sm md:text-base font-medium">
            {movie.rating === "TV-MA" ? "M" : movie.rating}
          </span>
        </div>
      </div>
    </div>
  );
}
