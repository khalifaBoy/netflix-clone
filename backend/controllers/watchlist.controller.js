import Watchlist from "../models/Watchlist.js";
import Movie from "../models/Movie.js";
import ApiError from "../utils/ApiError.js";
import {
  getAllowedMovieMaturityRatings,
  isMovieAllowedByMaturity,
  requireProfileMaturityPolicy,
} from "../services/maturity-policy.service.js";

/*
|--------------------------------------------------------------------------
| GET WATCHLIST
|--------------------------------------------------------------------------
*/

export const getWatchlist = async (req, res, next) => {
  try {
    const { profileId } = req.query;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    const policy = await requireProfileMaturityPolicy(profileId, req.user._id);
    const allowedRatings = getAllowedMovieMaturityRatings(policy);

    const watchlist = await Watchlist.find({
      profile: profileId,
    })
      .populate({
        path: "movie",
        match: { isPublished: true, maturityRating: { $in: allowedRatings } },
      })
      .sort({
        addedAt: -1,
      });
    const visibleWatchlist = watchlist.filter((item) => item.movie);

    return res.status(200).json({
      success: true,
      watchlist: visibleWatchlist,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| ADD MOVIE TO WATCHLIST
|--------------------------------------------------------------------------
*/

export const addToWatchlist = async (req, res, next) => {
  try {
    const { profileId } = req.body;
    const { movieId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    const policy = await requireProfileMaturityPolicy(profileId, req.user._id);

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

    if (!isMovieAllowedByMaturity(policy, movie.maturityRating)) {
      throw new ApiError(404, "MOVIE_NOT_FOUND", "Movie not found");
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
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| REMOVE MOVIE FROM WATCHLIST
|--------------------------------------------------------------------------
*/

export const removeFromWatchlist = async (req, res, next) => {
  try {
    const { profileId } = req.body;
    const { movieId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    await requireProfileMaturityPolicy(profileId, req.user._id);

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
    return next(error);
  }
};
