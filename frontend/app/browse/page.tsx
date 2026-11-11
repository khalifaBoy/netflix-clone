"use client";

import Footer from "@/components/Footer";
import HeroBanner from "@/components/HeroBanner";
import MovieDetailModal from "@/components/MovieDetailModal";
import MovieRow from "@/components/MovieRow";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/Authcontext";
import axiosInstance from "@/lib/axios";
import { allRows, featuredMovie, Movie } from "@/lib/movie";
import { Suspense, useEffect, useState } from "react";

function NavbarWithSuspense() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141414]" />}>
      <Navbar />
    </Suspense>
  );
}
type ApiMovie = {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  longDescription?: string;
  backdrop?: string;
  poster?: string;
  year: number;
  rating: string;
  duration: string;
  genres: string[];
  cast: string[];
  match?: number;
  isNew?: boolean;
  isNewRelease?: boolean;
  isTop10?: boolean;
  videoUrl: string;
  trailerUrl?: string;
  director?: string;
  language?: string;
  maturityRating?: string;
};
const page = () => {
  const { selectedProfile } = useAuth();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apiMovies, setApiMovies] = useState<Movie[]>([]);
  const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const handleSelectMovie = (movie: Movie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const formatMovie = (movie: ApiMovie): Movie => {
    return {
      id: movie._id || movie.id || "",

      title: movie.title,

      description: movie.description,

      longDescription: movie.longDescription || movie.description,

      backdrop: movie.backdrop || "",

      poster: movie.poster || "",

      year: movie.year,

      rating: movie.rating,

      duration: movie.duration,

      genres: movie.genres || [],

      cast: movie.cast || [],

      match: movie.match || 0,

      isNew: movie.isNew ?? movie.isNewRelease ?? false,

      isTop10: movie.isTop10 ?? false,

      videoUrl: movie.videoUrl || "",
    };
  };
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setMoviesLoading(true);
        const response = await axiosInstance.get("/movies");
        const movies = response.data.movies || [];
        const formated = movies?.map(formatMovie);
        setApiMovies(formated);
      } catch (error) {
        console.error(error);
        setApiMovies([]);
      } finally {
        setMoviesLoading(false);
      }
    };
    fetchMovies();
  }, []);
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        if (!selectedProfile) return;
        setRecommendationLoading(true);
        const profileid = selectedProfile?._id;
        const response = await axiosInstance.get("/recommendations", {
          params: {
            profileId: profileid,
          },
        });
        const movies = response.data?.movies || response.data?.data || [];
        const formattedMovies = movies.map(formatMovie);
        setRecommendedMovies(formattedMovies);
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
        setRecommendedMovies([]);
      } finally {
        setRecommendationLoading(false);
      }
    };
    fetchRecommendations();
  }, [selectedProfile]);
  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <NavbarWithSuspense />
      <main className="relative">
        <HeroBanner movie={featuredMovie} onMoreInfo={handleSelectMovie} />
        <div className=" relative z-20 -mt-16 md:-mt-32 pb-12">
          {!recommendationLoading && recommendedMovies.length > 0 && (
            <MovieRow
              title="Recommeneded For You"
              movies={recommendedMovies}
              onSelectMovie={handleSelectMovie}
            />
          )}
          {!moviesLoading && apiMovies.length > 0 && (
            <MovieRow
              title="Movies"
              movies={apiMovies}
              onSelectMovie={handleSelectMovie}
            />
          )}
          <MovieRow
            title="Top 10 in Your Country Today"
            movies={allRows[0].movies.slice(0, 10)}
            onSelectMovie={handleSelectMovie}
            isTop10
          />
          {allRows.map((row) => (
            <MovieRow
              key={row.title}
              title={row.title}
              movies={row.movies}
              onSelectMovie={handleSelectMovie}
            />
          ))}
          <Footer />
        </div>
      </main>
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default page;
