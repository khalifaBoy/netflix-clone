import {
  getContinueWatching as loadContinueWatching,
  getViewingHistory as loadViewingHistory,
  updateMovieProgress,
} from "../services/watch-history.service.js";

export const updateProgress = async (req, res, next) => {
  try {
    const history = await updateMovieProgress({
      profileId: req.body.profileId,
      userId: req.user._id,
      movieId: req.params.movieId,
      progressSeconds: req.body.progressSeconds,
    });
    return res.status(200).json({ success: true, history });
  } catch (error) {
    return next(error);
  }
};

export const getContinueWatching = async (req, res, next) => {
  try {
    const history = await loadContinueWatching({
      profileId: req.query.profileId,
      userId: req.user._id,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, history });
  } catch (error) {
    return next(error);
  }
};

export const getViewingHistory = async (req, res, next) => {
  try {
    const result = await loadViewingHistory({
      profileId: req.query.profileId,
      userId: req.user._id,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};
