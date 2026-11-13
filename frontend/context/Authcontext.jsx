"use client";

import { createContext, useState, useEffect, useContext, useRef } from "react";
import { api } from "@/lib/api";
import { setActiveProfileScope, setUnauthorizedHandler } from "@/lib/axios";

const AuthContext = createContext();

const readStoredJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("profiles");
  localStorage.removeItem("selectedProfile");
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const profileSwitchInProgress = useRef(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      setActiveProfileScope(null);
      setUser(null);
      setProfiles([]);
      setSelectedProfile(null);
    };
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadAuth = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        if (!storedToken) {
          clearStoredAuth();
          setActiveProfileScope(null);
          return;
        }

        const storedUser = readStoredJson("user");
        const storedProfiles = readStoredJson("profiles", []);
        const storedSelectedProfile = readStoredJson("selectedProfile");
        if (storedUser) setUser(storedUser);
        if (Array.isArray(storedProfiles)) setProfiles(storedProfiles);

        const response = await api.auth.me();
        if (!mounted || !response.data?.success) return;

        const serverUser = response.data.user;
        const activeProfiles = Array.isArray(response.data.profiles)
          ? response.data.profiles.filter((profile) => profile?.isActive !== false)
          : [];
        const canonicalSelection = storedSelectedProfile
          ? activeProfiles.find((profile) => profile._id === storedSelectedProfile._id) || null
          : null;

        setUser(serverUser);
        setProfiles(activeProfiles);
        setSelectedProfile(canonicalSelection);
        setActiveProfileScope(canonicalSelection?._id || null);
        localStorage.setItem("user", JSON.stringify(serverUser));
        localStorage.setItem("profiles", JSON.stringify(activeProfiles));
        if (canonicalSelection) {
          localStorage.setItem("selectedProfile", JSON.stringify(canonicalSelection));
        } else {
          localStorage.removeItem("selectedProfile");
        }
      } catch {
        if (!mounted) return;
        clearStoredAuth();
        setActiveProfileScope(null);
        setUser(null);
        setProfiles([]);
        setSelectedProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const persistAuthenticatedSession = (data) => {
    const userProfiles = Array.isArray(data.profiles) ? data.profiles : [];
    const firstProfile = userProfiles.find((profile) => profile?.isActive !== false) || null;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("profiles", JSON.stringify(userProfiles));
    setUser(data.user);
    setProfiles(userProfiles);
    setSelectedProfile(firstProfile);
    setActiveProfileScope(firstProfile?._id || null);
    if (firstProfile) localStorage.setItem("selectedProfile", JSON.stringify(firstProfile));
    else localStorage.removeItem("selectedProfile");
    return userProfiles;
  };

  const login = async (email, password) => {
    try {
      setAuthLoading(true);
      const { data } = await api.auth.login(email, password);
      if (!data.success) return { success: false, message: data.message || "Login failed" };
      const userProfiles = persistAuthenticatedSession(data);
      return { success: true, user: data.user, profiles: userProfiles };
    } catch (error) {
      return { success: false, message: error.message || "Login failed", code: error.code, status: error.status };
    } finally {
      setAuthLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    try {
      setAuthLoading(true);
      const { data } = await api.auth.register(name, email, password);
      if (!data.success) throw new Error(data.message || "Registration failed");
      const userProfiles = persistAuthenticatedSession(data);
      return { success: true, user: data.user, profiles: userProfiles };
    } catch (error) {
      const signupError = new Error(error.message || "Registration failed");
      signupError.code = error.code;
      signupError.status = error.status;
      throw signupError;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setActiveProfileScope(null);
    setUser(null);
    setProfiles([]);
    setSelectedProfile(null);
  };

  const selectProfile = async (profile) => {
    if (profileSwitchInProgress.current) {
      throw Object.assign(new Error("A profile switch is already in progress"), {
        code: "PROFILE_SWITCH_IN_PROGRESS",
      });
    }
    if (profile?._id === selectedProfile?._id) return selectedProfile;

    profileSwitchInProgress.current = true;
    const tokenAtSwitchStart = localStorage.getItem("token");
    const previousProfile = selectedProfile && selectedProfile.isActive !== false
      ? selectedProfile
      : null;
    setActiveProfileScope(null);
    setSelectedProfile(null);
    localStorage.removeItem("selectedProfile");

    try {
      const { data } = await api.profiles.select(profile._id);
      if (localStorage.getItem("token") !== tokenAtSwitchStart) {
        throw Object.assign(new Error("Authentication changed during profile selection"), {
          code: "AUTH_SESSION_CHANGED",
          status: 401,
        });
      }
      const canonicalProfile = data.profile;
      if (!canonicalProfile?._id) {
        throw Object.assign(new Error("Profile selection response was invalid"), {
          code: "INVALID_PROFILE_RESPONSE",
        });
      }
      setActiveProfileScope(canonicalProfile._id);
      setSelectedProfile(canonicalProfile);
      localStorage.setItem("selectedProfile", JSON.stringify(canonicalProfile));
      const nextProfiles = profiles.map((current) =>
        current._id === canonicalProfile._id ? canonicalProfile : current,
      );
      setProfiles(nextProfiles);
      localStorage.setItem("profiles", JSON.stringify(nextProfiles));
      return canonicalProfile;
    } catch (error) {
      if (localStorage.getItem("token") !== tokenAtSwitchStart) {
        throw error;
      }

      let restoredProfile = null;
      if (error.status !== 401) {
        try {
          const { data } = await api.profiles.list();
          const activeProfiles = Array.isArray(data.profiles)
            ? data.profiles.filter((item) => item?.isActive !== false)
            : [];
          setProfiles(activeProfiles);
          localStorage.setItem("profiles", JSON.stringify(activeProfiles));
          restoredProfile = previousProfile
            ? activeProfiles.find((item) => item._id === previousProfile._id) || null
            : null;
        } catch (refreshError) {
          if (refreshError.status === 401) {
            setProfiles([]);
            setSelectedProfile(null);
            setActiveProfileScope(null);
            localStorage.removeItem("profiles");
            localStorage.removeItem("selectedProfile");
          } else if (previousProfile) {
            restoredProfile = previousProfile;
          }
        }
      }

      if (restoredProfile) {
        setSelectedProfile(restoredProfile);
        setActiveProfileScope(restoredProfile._id);
        localStorage.setItem("selectedProfile", JSON.stringify(restoredProfile));
      } else {
        setSelectedProfile(null);
        setActiveProfileScope(null);
        localStorage.removeItem("selectedProfile");
      }

      throw Object.assign(new Error(error.message || "Profile selection failed"), {
        code: error.code,
        status: error.status,
      });
    } finally {
      profileSwitchInProgress.current = false;
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const updateProfiles = (updatedProfiles) => {
    const activeProfiles = updatedProfiles.filter((profile) => profile?.isActive !== false);
    setProfiles(activeProfiles);
    localStorage.setItem("profiles", JSON.stringify(activeProfiles));
    const canonicalSelection = selectedProfile
      ? activeProfiles.find((profile) => profile._id === selectedProfile._id) || null
      : null;
    setSelectedProfile(canonicalSelection);
    setActiveProfileScope(canonicalSelection?._id || null);
    if (canonicalSelection) {
      localStorage.setItem("selectedProfile", JSON.stringify(canonicalSelection));
    } else {
      localStorage.removeItem("selectedProfile");
    }
  };

  const value = {
    user,
    setUser,
    profiles,
    selectedProfile,
    loading,
    authLoading,
    login,
    isAuthenticated: !!user,
    signup,
    logout,
    selectProfile,
    updateUser,
    updateProfiles,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default AuthContext;
