"use client";

import { Movie } from "@/lib/movie";
import { ChevronDown, Play, Plus, ThumbsUp } from "lucide-react";

type MovieCardProps = {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  rank?: number;
};
const MovieCard = ({ movie, onSelect, rank }: MovieCardProps) => {
  if (rank) {
    return (
      <div
        className="flex-shrink-0 flex items-center group/card cursor-pointer"
        onClick={() => onSelect(movie)}
      >
        <span
          className="text-[120px] md:text-[180px] font-black text-black/70 leading-none -mr-4 md:-mr-8 select-none"
          style={{
            WebkitTextStroke: "3px #6b7280",
          }}
        >
          {rank}
        </span>
        <div className="relative w-[140px] md:w-[200px] aspect-[2/3] rounded-md overflow-hidden transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-2xl">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <p className="text-white text-sm font-bold truncate">
              {movie.title}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="group/card relative flex-shrink-0 w-[160px] md:w-[240px] lg:w-[280px] aspect-video rounded-md overflow-hidden cursor-pointer transition-all duration-300 hover:scale-110 hover:z-30 hover:shadow-2xl"
      onClick={() => onSelect(movie)}
    >
      <img
        src={movie.backdrop}
        alt={movie.title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
        <div className="flex items-center gap-2 mb-2">
          <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-white/80 transition-colors">
            <Play className="w-4 h-4 fill-black text-black" />
          </button>
          <button className="w-8 h-8 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white transition-colors">
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-8 h-8 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white transition-colors ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(movie);
            }}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <p className="text-white text-sm font-bold truncate mb-1">
          {movie.title}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-500 font-bold">{movie.match}% Match</span>
          <span className="border border-white/40 text-white/70 px-1 text-[10px]">
            {movie.rating}
          </span>
          <span className="text-white/70">{movie.duration}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {movie.genres.slice(0, 2).map((g) => (
            <span key={g} className="text-white/60 text-xs">
              {g}
            </span>
          ))}
        </div>
      </div>

      {movie.isNew && (
        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
          NEW
        </div>
      )}
    </div>
  );
};

export default MovieCard;
