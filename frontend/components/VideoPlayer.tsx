"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type VideoPlayerProps = {
  src: string;
  poster: string;
  title: string;
  onExit: () => void;
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  poster,
  title,
  onExit,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + seconds),
    );
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * duration;
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSettings(false);
        setShowSpeedMenu(false);
      }
    }, 3500);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") {
        toggleMute();
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "ArrowLeft") {
        skip(-10);
      } else if (e.key === "ArrowRight") {
        skip(10);
      } else if (e.key === "Escape" && !fullscreen) {
        onExit();
      }
      resetHideTimer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    toggleMute,
    toggleFullscreen,
    resetHideTimer,
    fullscreen,
    onExit,
  ]);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black flex items-center justify-center group"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (playing) {
          setShowControls(false);
          setShowSettings(false);
          setShowSpeedMenu(false);
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === videoRef.current) {
          togglePlay();
          resetHideTimer();
        }
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-red-600 rounded-full animate-spin" />
        </div>
      )}

      <div
        className={cn(
          "absolute top-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="text-white hover:text-white/70 transition-colors flex items-center gap-2"
          >
            <X className="w-6 h-6" />
            <span className="text-sm font-medium hidden md:inline">Exit</span>
          </button>
          <div className="text-white">
            <h1 className="text-lg md:text-2xl font-bold">{title}</h1>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-4 md:pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="group/progress relative h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all mb-3"
          onClick={handleSeek}
        >
          <div
            className="absolute h-full bg-white/30 rounded-full"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute h-full bg-red-600 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 bg-red-600 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => skip(-10)}
              className="text-white hover:text-white/70 transition-colors p-1"
              aria-label="Skip back 10 seconds"
            >
              <Rewind className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button
              onClick={togglePlay}
              className="text-white hover:text-white/70 transition-colors p-1"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="w-7 h-7 md:w-8 md:h-8 fill-white" />
              ) : (
                <Play className="w-7 h-7 md:w-8 md:h-8 fill-white" />
              )}
            </button>
            <button
              onClick={() => skip(10)}
              className="text-white hover:text-white/70 transition-colors p-1"
              aria-label="Skip forward 10 seconds"
            >
              <FastForward className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          <div
            className="flex items-center gap-2 group/volume"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="text-white hover:text-white/70 transition-colors p-1"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              <VolumeIcon className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                showVolumeSlider ? "w-20 md:w-24" : "w-0",
              )}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-red-600"
                style={{
                  background: `linear-gradient(to right, #dc2626 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(muted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>
          </div>

          <div className="text-white/90 text-sm md:text-base font-medium tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span className="text-white/50"> / {formatTime(duration)}</span>
          </div>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowSettings(false);
                }}
                className="text-white hover:text-white/70 transition-colors p-1 flex items-center gap-1"
                aria-label="Playback speed"
              >
                <Settings className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 rounded-lg p-2 min-w-[140px] animate-fade-in">
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-2 px-2">
                    Speed
                  </p>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.playbackRate = rate;
                          setPlaybackRate(rate);
                        }
                        setShowSpeedMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded text-sm transition-colors",
                        playbackRate === rate
                          ? "text-red-500 font-bold"
                          : "text-white/80 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {rate === 1 ? "Normal" : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-white/70 transition-colors p-1"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? (
                <Minimize className="w-5 h-5 md:w-6 md:h-6" />
              ) : (
                <Maximize className="w-5 h-5 md:w-6 md:h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {!playing && !loading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play className="w-8 h-8 md:w-10 md:h-10 text-white fill-white ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
