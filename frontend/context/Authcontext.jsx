"use client";
import { createContext, useState, useEffect, useContext } from "react";
import axiosInstance from "@/lib/axios";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = localStorage.getItem("token");

        const storedUser = localStorage.getItem("user");

        const storedProfiles = localStorage.getItem("profiles");

        const storedSelectedProfile = localStorage.getItem("selectedProfile");

        if (!storedToken) {
          setLoading(false);
          return;
        }

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        if (storedProfiles) {
          setProfiles(JSON.parse(storedProfiles));
        }

        if (storedSelectedProfile) {
          setSelectedProfile(JSON.parse(storedSelectedProfile));
        }

        try {
          const response = await axiosInstance.get("/auth/me");

          if (response.data?.success) {
            const serverUser = response.data.user;

            setUser(serverUser);

            localStorage.setItem("user", JSON.stringify(serverUser));

            if (response.data.profiles) {
              setProfiles(response.data.profiles);

              localStorage.setItem(
                "profiles",
                JSON.stringify(response.data.profiles),
              );
            }
          }
        } catch (error) {
          console.error("Session verification failed:", error);

          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("profiles");
          localStorage.removeItem("selectedProfile");

          setUser(null);
          setProfiles([]);
          setSelectedProfile(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);
  const login = async (email, password) => {
    try {
      setAuthLoading(true);
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });
      const data = response.data;
      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }
      const { token, user: loggedInUser, profiles: userProfiles } = data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      localStorage.setItem("profiles", JSON.stringify(userProfiles));
      setUser(loggedInUser);
      setProfiles(userProfiles);
      if (userProfiles.length > 0) {
        setSelectedProfile(userProfiles[0]);
        localStorage.setItem(
          "selectedProfile",
          JSON.stringify(userProfiles[0]),
        );
      }
      return { success: true, user: loggedInUser, profiles: userProfiles };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: error.message || "Login failed" };
    } finally {
      setAuthLoading(false);
    }
  };
  const signup = async (name, email, password) => {
    try {
      setAuthLoading(true);

      const response = await axiosInstance.post("/auth/register", {
        name,
        email,
        password,
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      const { token, user: registeredUser, profiles: userProfiles = [] } = data;

      /*
      | Save token
      */

      localStorage.setItem("token", token);

      /*
      | Save user
      */

      localStorage.setItem("user", JSON.stringify(registeredUser));

      /*
      | Save profiles
      */

      localStorage.setItem("profiles", JSON.stringify(userProfiles));

      /*
      | Update state
      */

      setUser(registeredUser);
      setProfiles(userProfiles);

      /*
      | Select first profile
      */

      if (userProfiles.length > 0) {
        const firstProfile = userProfiles[0];

        setSelectedProfile(firstProfile);

        localStorage.setItem("selectedProfile", JSON.stringify(firstProfile));
      }

      return {
        success: true,
        user: registeredUser,
        profiles: userProfiles,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || "Registration failed";

      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profiles");
    localStorage.removeItem("selectedProfile");
    setUser(null);
    setProfiles([]);
    setSelectedProfile(null);
  };
  const selectProfile = async (profile) => {
    try {
      await axiosInstance.post(`/profiles/${profile._id}/select`);
      setSelectedProfile(profile);
      localStorage.setItem("selectedProfile", JSON.stringify(profile));
      return profile;
    } catch (error) {
      console.error("Error selecting profile:", error);
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Profile selection failed",
      );
    }
  };
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const updateProfiles = (updatedProfiles) => {
    setProfiles(updatedProfiles);

    localStorage.setItem("profiles", JSON.stringify(updatedProfiles));

    if (selectedProfile) {
      const updatedSelectedProfile = updatedProfiles.find(
        (profile) => profile._id === selectedProfile._id,
      );

      if (updatedSelectedProfile) {
        setSelectedProfile(updatedSelectedProfile);

        localStorage.setItem(
          "selectedProfile",
          JSON.stringify(updatedSelectedProfile),
        );
      }
    }
  };

  const value = {
    user,
    setUser,
    profiles,
    setProfiles,
    setSelectedProfile,
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
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
export default AuthContext;
