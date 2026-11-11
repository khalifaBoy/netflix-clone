"use client";

import { useAuth } from "@/context/Authcontext";
import { cn } from "@/lib/utils";
import { Bell, ChevronDown, Gift, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const AVATAR_COLORS = [
  "bg-gradient-to-br from-red-500 to-red-700",
  "bg-gradient-to-br from-blue-500 to-blue-700",
  "bg-gradient-to-br from-green-500 to-green-700",
  "bg-gradient-to-br from-purple-500 to-purple-700",
  "bg-gradient-to-br from-yellow-500 to-orange-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
  "bg-gradient-to-br from-teal-500 to-cyan-600",
  "bg-gradient-to-br from-indigo-500 to-violet-600",
];

const Navbar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    user,
    profiles,
    selectedProfile,
    selectProfile,
    logout,
    loading: authLoading,
  } = useAuth();

  const [scrolled, setScrolled] = useState(false);

  const [showProfile, setShowProfile] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [profileSwitching, setProfileSwitching] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
    };

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        searchQuery.trim(),
      )}&p=${selectedProfile?._id || ""}`,
    );

    setSearchOpen(false);
  };

  const handleProfileSwitch = async (profile: any) => {
    if (profileSwitching || profile._id === selectedProfile?._id) {
      setShowProfile(false);
      return;
    }

    try {
      setProfileSwitching(true);

      await selectProfile(profile);

      setShowProfile(false);

      router.push(`/browse?p=${profile._id}`);
    } catch (error) {
      console.error("Profile switch error:", error);
    } finally {
      setProfileSwitching(false);
    }
  };

  const handleLogout = async () => {
    try {
      setShowProfile(false);

      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getAvatarColor = (index: number) => {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  if (authLoading) {
    return null;
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",

        scrolled
          ? "bg-[#141414]"
          : "bg-gradient-to-b from-black/80 via-black/40 to-transparent",
      )}
    >
      <div className="flex items-center justify-between px-4 md:px-12 py-3">
        <div className="flex items-center gap-6 lg:gap-8">
          {/* Netflix */}

          <Link
            href={`/browse?p=${selectedProfile?._id || ""}`}
            className="text-red-600 font-bold text-2xl md:text-3xl tracking-tighter select-none"
          >
            NETFLIX
          </Link>

          <div className="hidden md:flex items-center gap-5 text-sm">
            <Link
              href={`/browse?p=${selectedProfile?._id || ""}`}
              className="text-white hover:text-white/70 transition-colors font-medium"
            >
              Home
            </Link>

            <Link
              href={`/browse?p=${selectedProfile?._id || ""}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              TV Shows
            </Link>

            <Link
              href={`/browse?p=${selectedProfile?._id || ""}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              Movies
            </Link>

            <Link
              href={`/browse?p=${selectedProfile?._id || ""}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              New & Popular
            </Link>

            <Link
              href={`/my-list?p=${selectedProfile?._id || ""}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              My List
            </Link>

            <Link
              href={`/browse?p=${selectedProfile?._id || ""}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              Browse by Languages
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-5">
          {/* Search */}

          {searchOpen ? (
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 bg-black/80 border border-white/30 px-3 py-1.5 rounded"
            >
              <Search className="w-4 h-4 text-white/60" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Titles, people, genres"
                className="bg-transparent text-white text-sm placeholder-white/40 focus:outline-none w-32 md:w-64"
                autoFocus
              />

              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="text-white/90 hover:text-white transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {/* Kids */}

          <button
            onClick={() => {
              const kidsProfile = profiles.find(
                (profile: any) => profile.isKids,
              );

              if (kidsProfile) {
                handleProfileSwitch(kidsProfile);
              }
            }}
            className="hidden md:inline text-white/90 text-sm hover:text-white/70 transition-colors cursor-pointer"
          >
            Kids
          </button>

          {/* Gift */}

          <button
            className="text-white/90 hover:text-white transition-colors hidden md:block"
            aria-label="Gift"
          >
            <Gift className="w-5 h-5" />
          </button>

          {/* Notifications */}

          <button
            className="text-white/90 hover:text-white transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>

          {/* ============================================================ */}
          {/* PROFILE */}
          {/* ============================================================ */}

          <div
            className="relative cursor-pointer"
            onMouseEnter={() => setShowProfile(true)}
            onMouseLeave={() => setShowProfile(false)}
          >
            {/* Active Profile */}

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded overflow-hidden">
                {selectedProfile?.avatar ? (
                  <img
                    src={selectedProfile.avatar}
                    alt={selectedProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "w-full h-full flex items-center justify-center text-white font-bold text-sm",
                      getAvatarColor(
                        profiles.findIndex(
                          (p: any) => p._id === selectedProfile?._id,
                        ),
                      ),
                    )}
                  >
                    {selectedProfile?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>

              <ChevronDown
                className={cn(
                  "w-4 h-4 text-white transition-transform duration-200",

                  showProfile && "rotate-180",
                )}
              />
            </div>

            {/* ======================================================== */}
            {/* PROFILE DROPDOWN */}
            {/* ======================================================== */}

            {showProfile && (
              <div className="absolute right-0 top-full pt-3 w-64 animate-fade-in">
                <div className="bg-black/95 border border-white/10 rounded-md py-2 shadow-2xl">
                  {/* Current User */}

                  {user && (
                    <div className="px-4 py-2 border-b border-white/10 mb-1">
                      <p className="text-white text-sm font-medium">
                        {user.name}
                      </p>

                      <p className="text-white/40 text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  )}

                  <div className="px-4 py-1 text-xs text-white/40 uppercase tracking-wider">
                    Switch Profile
                  </div>

                  {/* Profiles */}

                  {profiles.map((profile: any, index: number) => (
                    <button
                      key={profile._id}
                      onClick={() => handleProfileSwitch(profile)}
                      disabled={profileSwitching}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors text-left disabled:opacity-50",

                        selectedProfile?._id === profile._id && "bg-white/5",
                      )}
                    >
                      {/* Avatar */}

                      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={cn(
                              "w-full h-full flex items-center justify-center text-white text-sm font-bold",
                              getAvatarColor(index),
                            )}
                          >
                            {profile.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name */}

                      <span className="text-white text-sm">{profile.name}</span>

                      {/* Kids */}

                      {profile.isKids && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto">
                          KIDS
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Divider */}

                  <div className="border-t border-white/10 my-2" />
                  {user?.role === "admin" && (
                    <>
                      <button
                        onClick={() => {
                          setShowProfile(false);
                          router.push("/upload");
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                      >
                        Upload Movies
                      </button>

                      <div className="border-t border-white/10 my-2" />
                    </>
                  )}
                  {/* Manage Profiles */}

                  <Link
                    href="/profiles"
                    className="block px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Manage Profiles
                  </Link>

                  {/* Account */}

                  <button
                    onClick={() => router.push("/account")}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Account
                  </button>

                  {/* Help */}

                  <button
                    onClick={() => router.push("/help")}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Help Center
                  </button>

                  {/* Divider */}

                  <div className="border-t border-white/10 my-2" />

                  {/* Logout */}

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Sign out of Netflix
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
