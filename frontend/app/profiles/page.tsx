"use client";

import { useAuth } from "@/context/Authcontext";
import axiosInstance from "@/lib/axios";
import { profiles as initialProfiles, type Profile } from "@/lib/profiles";
import { cn } from "@/lib/utils";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
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

type LocalProfile = Profile & { color?: string };

const MAX_PROFILES = 5;
const page = () => {
  const { user, profiles, setProfiles, selectProfile } = useAuth();
  const router = useRouter();
  const [profileList, setProfileList] = useState<any[]>([]);
  // const [profileList, setProfileList] =
  //   useState<LocalProfile[]>(initialProfiles);
  const [managing, setManaging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIsKids, setNewIsKids] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/profiles`);
      const data = response.data;
      setProfiles(data.profiles);
      setProfileList(data.profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setError("Failed to fetch profiles. Please try again later.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (profiles && profiles.length > 0) {
      setProfileList(profiles);
    }
    fetchProfiles();
  }, [user]);
  const handleSelect = async (profile: any) => {
    if (managing) return;
    const params = new URLSearchParams({ p: profile._id });
    await selectProfile(profile);
    router.push(`/browse?${params.toString()}`);
  };
  const handleAddProfile = async () => {
    if (!newName.trim()) return;
    const newProfile: any = {
      id: `Local=${Date.now()}`,
      name: newName.trim(),
      avatar: "",
      isKids: newIsKids,
      color: selectedColor,
    };
    try {
      setActionLoading(true);
      const response = await axiosInstance.post("/profiles", {
        name: newProfile.name,
        isKids: newProfile.isKids,
        avatar: newProfile.avatar,
        maturityLevel: newProfile.isKids ? "7+" : "All",
        language: "English",
      });
      const createdProfile = response.data;
      const updatedProfile = [...profileList, createdProfile.profile];
      setProfileList(updatedProfile);
      setProfiles(updatedProfile);
    } catch (error) {
      console.error("Error adding profile:", error);
      setError("Failed to add profile. Please try again later.");
    } finally {
      setActionLoading(false);
      setNewName("");
      setNewIsKids(false);
      setSelectedColor(AVATAR_COLORS[0]);
      setAdding(false);
    }
  };
  const handleRemoveProfile = async (profileId: string) => {
    try {
      setActionLoading(true);
      setError("");
      await axiosInstance.delete(`/profiles/${profileId}`);
      const updatedProfiles = profileList.filter(
        (profile) => profile._id !== profileId,
      );
      setProfileList(updatedProfiles);
      setProfiles(updatedProfiles);
    } catch (error: any) {
      console.error("Delete profile failed:", error);

      setError(error.response?.data?.message || "Failed to delete profile");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "radial-gradient(ellipse at top, #3d0a0a 0%, #1a0505 45%, #000000 100%)",
        }}
      >
        <div className="text-white text-lg">Loading profiles...</div>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative"
      style={{
        background:
          "radial-gradient(ellipse at top, #3d0a0a 0%, #1a0505 45%, #000000 100%)",
      }}
    >
      {/* Netflix Logo */}

      <header className="absolute top-0 left-0 px-6 md:px-12 py-6">
        <span className="text-red-600 font-bold text-2xl md:text-3xl tracking-tighter select-none">
          NETFLIX
        </span>
      </header>

      <div className="w-full max-w-5xl">
        {/* Heading */}

        <h1 className="text-white text-3xl md:text-5xl font-medium text-center mb-10 md:mb-14">
          {managing ? "Manage Profiles:" : "Who's watching?"}
        </h1>

        {/* Error */}

        {error && (
          <div className="max-w-xl mx-auto mb-6">
            <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm text-center">
              {error}
            </div>
          </div>
        )}

        {/* Profiles */}

        <div className="flex flex-wrap items-start justify-center gap-6 md:gap-10">
          {profileList.map((profile, index) => {
            const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

            return (
              <div
                key={profile._id}
                className="relative flex flex-col items-center gap-3"
              >
                {/* Profile */}

                <button
                  onClick={() => handleSelect(profile)}
                  onMouseEnter={() => setHovered(profile._id)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={actionLoading}
                  className="group flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    {/* Avatar */}

                    <div
                      className={cn(
                        "w-24 h-24 md:w-36 md:h-36 rounded-md overflow-hidden transition-all duration-200",

                        hovered === profile._id && !managing
                          ? "ring-4 ring-white scale-105"
                          : "ring-0",

                        managing && "opacity-70",
                      )}
                    >
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={cn(
                            "w-full h-full flex items-center justify-center text-white text-3xl md:text-5xl font-bold",
                            color,
                          )}
                        >
                          {profile.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Manage Overlay */}

                    {managing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                        <Pencil className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                    )}

                    {/* Kids */}

                    {profile.isKids && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        KIDS
                      </div>
                    )}
                  </div>
                </button>

                {/* Profile Name */}

                <span
                  className={cn(
                    "text-sm md:text-lg transition-colors",

                    hovered === profile._id && !managing
                      ? "text-white"
                      : "text-white/60",
                  )}
                >
                  {profile.name}
                </span>

                {/* Delete */}

                {managing && (
                  <button
                    onClick={() => handleRemoveProfile(profile._id)}
                    disabled={actionLoading}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/80 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${profile.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Profile */}

          {!adding && profileList.length < MAX_PROFILES && (
            <button
              onClick={() => setAdding(true)}
              className="group flex flex-col items-center gap-3"
            >
              <div className="w-24 h-24 md:w-36 md:h-36 rounded-md bg-white/5 border-2 border-white/10 flex items-center justify-center group-hover:border-white group-hover:bg-white/10 transition-all">
                <Plus className="w-8 h-8 md:w-12 md:h-12 text-white/40 group-hover:text-white/70 transition-colors" />
              </div>

              <span className="text-sm md:text-lg text-white/40 group-hover:text-white/70 transition-colors">
                Add Profile
              </span>
            </button>
          )}

          {/* Add Profile Form */}

          {adding && (
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "w-24 h-24 md:w-36 md:h-36 rounded-md flex items-center justify-center text-white text-3xl md:text-5xl font-bold",
                  selectedColor,
                )}
              >
                {newName.trim() ? newName.trim().charAt(0).toUpperCase() : "?"}
              </div>

              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                maxLength={20}
                className="w-24 md:w-36 bg-transparent border-b border-white/40 text-white text-center text-sm focus:outline-none focus:border-white"
              />
            </div>
          )}
        </div>

        {/* Add Form */}

        {adding && (
          <div className="max-w-sm mx-auto mt-8 space-y-4 border-t border-white/10 pt-6">
            {/* Avatar Colors */}

            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-2">
                Choose an avatar color
              </p>

              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      color,
                      selectedColor === color &&
                        "ring-2 ring-white ring-offset-2 ring-offset-black scale-110",
                    )}
                    aria-label="Choose avatar color"
                  />
                ))}
              </div>
            </div>

            {/* Kids */}

            <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newIsKids}
                onChange={(e) => setNewIsKids(e.target.checked)}
                className="accent-blue-600"
              />
              Kids profile
            </label>

            {/* Buttons */}

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={handleAddProfile}
                disabled={!newName.trim() || actionLoading}
                className="px-6 py-2 bg-white text-black font-medium rounded hover:bg-white/90 disabled:opacity-40 transition-colors"
              >
                {actionLoading ? "Saving..." : "Save"}
              </button>

              <button
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewIsKids(false);
                }}
                className="px-6 py-2 border border-white/40 text-white/70 rounded hover:border-white hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Manage Profiles */}

        <div className="flex justify-center mt-10 md:mt-14">
          <button
            onClick={() => setManaging(!managing)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium tracking-wide transition-colors",

              managing
                ? "bg-white text-black"
                : "bg-black/40 border border-white/30 text-white hover:bg-black/60 hover:border-white",
            )}
          >
            {managing ? (
              <>
                <Check className="w-4 h-4" />
                Done
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4" />
                Manage Profiles
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default page;
