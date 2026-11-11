"use client";

import { Movie } from "@/lib/movie";
import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent } from "./ui/dialog";
import { Play, Plus, ThumbsDown, ThumbsUp, Volume2, X } from "lucide-react";

type MovieDetailModalProps = {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MovieDetailModal = ({
  movie,
  open,
  onOpenChange,
}: MovieDetailModalProps) => {
  const router = useRouter();
  if (!movie) return null;
  const handlePlay = () => {
    onOpenChange(false);
    router.push(`/watch/${movie.id}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
       className="
        !w-[95vw]
        !max-w-[1100px]
        sm:!max-w-[1100px]
        lg:!max-w-[1100px]

        !p-0
        !overflow-y-auto
        !overflow-x-hidden

        bg-[#181818]
        border-none
        rounded-lg

        !max-h-[90vh]

        scrollbar-hide
        [&>button:last-child]:hidden
    "
      >
        <div className="relative w-full">
          <div className="relative h-[300px] md:h-[500px] w-full">
            <img
              src={movie.backdrop}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />

            <DialogClose className="absolute top-4 right-4 w-9 h-9 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors z-10">
              <X className="w-5 h-5" />
            </DialogClose>

            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-12">
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4 text-shadow-lg">
                {movie.title}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-md font-bold hover:bg-white/80 transition-colors"
                >
                  <Play className="w-5 h-5 fill-black" />
                  Play
                </button>
                <button
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors"
                  aria-label="Add to list"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors"
                  aria-label="Like"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors"
                  aria-label="Dislike"
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
                <button
                  className="w-10 h-10 border-2 border-white/60 rounded-full flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors ml-auto"
                  aria-label="Mute"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 md:px-12 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-green-500 font-bold">
                  {movie.match}% Match
                </span>
                <span className="text-white/70 text-sm">{movie.year}</span>
                <span className="border border-white/40 text-white/70 px-1.5 text-xs">
                  {movie.rating}
                </span>
                <span className="text-white/70 text-sm">{movie.duration}</span>
                <span className="border border-white/40 text-white/70 px-2 text-xs uppercase tracking-wider">
                  HD
                </span>
                {movie.isNew && (
                  <span className="text-red-500 font-bold text-xs uppercase tracking-wider">
                    New
                  </span>
                )}
              </div>
              <p className="text-white/90 text-sm md:text-base leading-relaxed">
                {movie.longDescription}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-white/50">Cast: </span>
                <span className="text-white/90">{movie.cast.join(", ")}</span>
              </div>
              <div>
                <span className="text-white/50">Genres: </span>
                <span className="text-white/90">{movie.genres.join(", ")}</span>
              </div>
              <div>
                <span className="text-white/50">This is: </span>
                <span className="text-white/90">
                  Suspenseful, Gritty, Intense
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 md:px-12 pb-8">
            <h3 className="text-white text-xl font-bold mb-4">
              More Like This
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                "Visceral",
                "Dark",
                "Edge-of-your-seat",
                "Cinematic",
                "Cult Following",
                "Epic",
              ].map((tag) => (
                <div
                  key={tag}
                  className="bg-[#2a2a2a] rounded-md overflow-hidden"
                >
                  <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                    <span className="text-white/40 text-sm">{tag}</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">
                        More titles
                      </span>
                      <span className="text-green-500 text-xs font-bold">
                        98% Match
                      </span>
                    </div>
                    <p className="text-white/50 text-xs">
                      Explore similar content
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MovieDetailModal;
