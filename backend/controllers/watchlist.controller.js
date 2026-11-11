import mongoose from "mongoose";

import Watchlist from "../models/Watchlist.js";
import Movie from "../models/Movie.js";
import Profile from "../models/Profile.js";

/*
|--------------------------------------------------------------------------
| VERIFY PROFILE
|--------------------------------------------------------------------------
*/

const getUserProfile = async (profileId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(profileId)) {
    return null;
  }

  return Profile.findOne({
    _id: profileId,
    user: userId,
    isActive: true,
  });
};

/*
|--------------------------------------------------------------------------
| GET WATCHLIST
|--------------------------------------------------------------------------
*/

export const getWatchlist = async (req, res) => {
  try {
    const { profileId } = req.query;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    const profile = await getUserProfile(profileId, req.user._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const watchlist = await Watchlist.find({
      profile: profileId,
    })
      .populate("movie")
      .sort({
        addedAt: -1,
      });

    return res.status(200).json({
      success: true,
      watchlist,
    });
  } catch (error) {
    console.error("Get watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist",
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADD MOVIE TO WATCHLIST
|--------------------------------------------------------------------------
*/

export const addToWatchlist = async (req, res) => {
  try {
    const { profileId } = req.body;
    const { movieId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid movie ID",
      });
    }

    const profile = await getUserProfile(profileId, req.user._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const movie = await Movie.findOne({
      _id: movieId,
      isPublished: true,
    });

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    const existing = await Watchlist.findOne({
      profile: profileId,
      movie: movieId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Movie already exists in watchlist",
        watchlistItem: existing,
      });
    }

    const watchlistItem = await Watchlist.create({
      profile: profileId,
      movie: movieId,
    });

    await watchlistItem.populate("movie");

    return res.status(201).json({
      success: true,
      message: "Movie added to watchlist",
      watchlistItem,
    });
  } catch (error) {
    console.error("Add watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add movie to watchlist",
    });
  }
};

/*
|--------------------------------------------------------------------------
| REMOVE MOVIE FROM WATCHLIST
|--------------------------------------------------------------------------
*/

export const removeFromWatchlist = async (req, res) => {
  try {
    const { profileId } = req.body;
    const { movieId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    const profile = await getUserProfile(profileId, req.user._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const deleted = await Watchlist.findOneAndDelete({
      profile: profileId,
      movie: movieId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Movie is not in watchlist",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Movie removed from watchlist",
    });
  } catch (error) {
    console.error("Remove watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove movie from watchlist",
    });
  }
};
