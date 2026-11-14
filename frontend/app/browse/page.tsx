"use client";

import Footer from "@/components/Footer";
import HeroBanner from "@/components/HeroBanner";
import MovieDetailModal from "@/components/MovieDetailModal";
import MovieRow from "@/components/MovieRow";
import RecommendationSection from "@/components/RecommendationSection";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/Authcontext";
import { useRecommendationFeedback } from "@/context/RecommendationFeedbackContext";
import { api } from "@/lib/api";
import { Movie } from "@/lib/movie";
import { RecommendationFeedCoordinator, filterRecommendationMovies, normalizeRecommendationMovie } from "@/lib/recommendation-feed.mjs";
import { ProfileMovieFeedCoordinator } from "@/lib/profile-movie-feed.mjs";
import { canShowStaticCatalog, filterMoviesForProfile } from "@/lib/profile-maturity.mjs";
import { buildBrowseMovieSections } from "@/lib/browse-movie-sections.mjs";
import { getMovieWatchPath } from "@/lib/movie-navigation.mjs";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function NavbarWithSuspense() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141414]" />}>
      <Navbar />
    </Suspense>
  );
}
type RecommendationFeedState = {
  profileId: string | null;
  status: "idle" | "loading" | "success" | "empty" | "error";
  movies: Movie[];
  error: string | null;
};
type ProfileMovieFeedSnapshot = { profileId: string | null; status: string; movies: unknown[] };
const page = () => {
  const { selectedProfile, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { excluded, refreshVersion } = useRecommendationFeedback();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apiMovies, setApiMovies] = useState<Movie[]>([]);
  const [apiMoviesState, setApiMoviesState] = useState({ profileId: null as string | null, status: "idle" as string });
  const [recommendationState, setRecommendationState] = useState<RecommendationFeedState>({ profileId: null, status: "idle", movies: [], error: null });
  const recommendationCoordinator = useRef<RecommendationFeedCoordinator | null>(null);
  const movieCoordinator = useRef<ProfileMovieFeedCoordinator | null>(null);
  if (!recommendationCoordinator.current) {
    recommendationCoordinator.current = new RecommendationFeedCoordinator((profileId: string) => api.recommendations.list(profileId));
  }
  if (!movieCoordinator.current) {
    movieCoordinator.current = new ProfileMovieFeedCoordinator((profileId: string) => api.movies.list(profileId, { limit: 100 }), normalizeRecommendationMovie);
  }
  const [moviesLoading, setMoviesLoading] = useState(true);
  const profileId = user ? selectedProfile?._id || null : null;
  const currentProfileId = useRef<string | null>(profileId);
  currentProfileId.current = profileId;
  const [playError, setPlayError] = useState(false);
  const handleSelectMovie = (movie: Movie) => {
    if (!profileId || !getMovieWatchPath(movie.id)) return;
    setSelectedMovie(movie);
    setModalOpen(true);
  };
  const handlePlayMovie = (movie: Movie) => {
    const requestProfileId = profileId;
    const watchPath = getMovieWatchPath(movie.id);
    if (!requestProfileId || !watchPath || currentProfileId.current !== requestProfileId) return;
    setPlayError(false);
    router.push(watchPath);
  };

  useEffect(() => {
    movieCoordinator.current?.setListener((state: ProfileMovieFeedSnapshot) => {
      setApiMoviesState({ profileId: state.profileId, status: state.status });
      setApiMovies(state.movies as Movie[]);
      setMoviesLoading(state.status === "loading");
    });
  }, []);
  useEffect(() => {
    setSelectedMovie(null);
    setModalOpen(false);
    const requestKey = selectedProfile ? `${selectedProfile.isKids}:${selectedProfile.maturityLevel}` : "";
    void movieCoordinator.current?.load(selectedProfile, requestKey);
  }, [profileId, selectedProfile?.isKids, selectedProfile?.maturityLevel]);
  useEffect(() => {
    recommendationCoordinator.current?.setListener(setRecommendationState);
    void recommendationCoordinator.current?.load(profileId, refreshVersion);
  }, [profileId, refreshVersion]);
  const activeRecommendationState = recommendationState.profileId === profileId
    ? recommendationState
    : { profileId, status: profileId ? "loading" as const : "idle" as const, movies: [], error: null };
  const visibleRecommendedMovies = profileId && selectedProfile
    ? filterMoviesForProfile(filterRecommendationMovies(activeRecommendationState.movies, excluded), selectedProfile)
    : [];
  const visibleApiMovies = apiMoviesState.profileId === profileId && profileId && selectedProfile
    ? filterMoviesForProfile(apiMovies, selectedProfile)
    : [];
  const browseSections = buildBrowseMovieSections(visibleApiMovies);
  const mayShowStaticCatalog = canShowStaticCatalog(selectedProfile);
  const heroMovie = mayShowStaticCatalog ? visibleApiMovies[0] : undefined;
  const visibleRecommendationStatus = activeRecommendationState.status === "success" && visibleRecommendedMovies.length === 0
    ? "empty"
    : activeRecommendationState.status;
  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <NavbarWithSuspense />
      <main className="relative">
        {profileId && mayShowStaticCatalog && heroMovie && <HeroBanner movie={heroMovie} onMoreInfo={handleSelectMovie} onPlay={handlePlayMovie} />}
        {playError && <p role="alert" className="relative z-30 bg-black px-4 py-3 text-center text-sm text-red-300">This title could not be opened for the selected profile.</p>}
        <div className=" relative z-20 -mt-16 md:-mt-32 pb-12">
          <ContinueWatchingRow />
          <RecommendationSection
            status={visibleRecommendationStatus}
            movies={visibleRecommendedMovies}
            onSelectMovie={handleSelectMovie}
            onRetry={() => { void recommendationCoordinator.current?.retry(); }}
            hasProfile={Boolean(profileId)}
            authLoading={authLoading}
          />
          {profileId && !moviesLoading && visibleApiMovies.length > 0 && (
            <MovieRow
              title="Movies"
              movies={visibleApiMovies}
              onSelectMovie={handleSelectMovie}
              onPlayMovie={handlePlayMovie}
            />
          )}
          {profileId && mayShowStaticCatalog && <>
            {!moviesLoading && browseSections.topTen.length > 0 && (
              <MovieRow title="Top 10 in Your Country Today" movies={browseSections.topTen} onSelectMovie={handleSelectMovie} onPlayMovie={handlePlayMovie} isTop10 />
            )}
            {!moviesLoading && browseSections.rows.map((row) => (
              <MovieRow key={row.title} title={row.title} movies={row.movies} onSelectMovie={handleSelectMovie} onPlayMovie={handlePlayMovie} />
            ))}
          </>}
          <Footer />
        </div>
      </main>
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSelectMovie={handleSelectMovie}
      />
    </div>
  );
};

export default page;
