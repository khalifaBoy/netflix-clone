"use client";

import VideoPlayer from "@/components/VideoPlayer";
import { useAuth } from "@/context/Authcontext";
import axiosInstance from "@/lib/axios";
import { getMovieById } from "@/lib/movie";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
type Movie = {
  _id: string;
  title: string;
  description: string;
  longDescription?: string;
  backdrop: string;
  poster?: string;
  year: number;
  rating: string;
  duration: string;
  genres: string[];
  cast: string[];
  match?: number;
  isNewRelease?: boolean;
  isTop10?: boolean;
  videoUrl: string;
};

const page = () => {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { selectedProfile } = useAuth();
  // const movie = getMovieById(id);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadMovie = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/movies/${id}`);
        const movie = res.data.movie;
        if (!movie) {
          setMovie(null);
          setLoading(false);
        }
        setMovie(movie);
        const profileid = selectedProfile?._id;
        try {
          if (!selectedProfile) return;
          await axiosInstance.post(`/watchlist/${id}`, {
            profileId: profileid,
          });
        } catch (error) {
          console.log(error);
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    loadMovie();
  }, [id, selectedProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />

          <p className="text-white/60">Loading movie...</p>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Movie not found</p>
          <button
            onClick={() => router.push("/browse")}
            className="text-red-500 hover:text-red-400 transition-colors font-medium"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  const API_ORIGIN = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
  ).replace(/\/api\/?$/, "");

  const videoUrl =
    movie.videoUrl?.startsWith("http://") ||
    movie.videoUrl?.startsWith("https://")
      ? movie.videoUrl
      : `${API_ORIGIN}${
          movie.videoUrl?.startsWith("/") ? "" : "/"
        }${movie.videoUrl}`;
  return (
    <VideoPlayer
      src={videoUrl}
      poster={movie.backdrop}
      title={movie.title}
      onExit={() => router.push("/browse")}
    />
  );
};

export default page;
