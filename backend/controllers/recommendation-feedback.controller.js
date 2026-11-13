import {
  deleteRecommendationFeedback as removeFeedback,
  saveRecommendationFeedback,
} from "../services/recommendation-feedback.service.js";

export const upsertRecommendationFeedback = async (req, res, next) => {
  try {
    const feedback = await saveRecommendationFeedback({
      profileId: req.body.profileId,
      userId: req.user._id,
      movieId: req.params.movieId,
      type: req.body.type,
    });
    return res.status(200).json({ success: true, feedback });
  } catch (error) {
    return next(error);
  }
};

export const deleteRecommendationFeedback = async (req, res, next) => {
  try {
    await removeFeedback({
      profileId: req.query.profileId,
      userId: req.user._id,
      movieId: req.params.movieId,
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};
