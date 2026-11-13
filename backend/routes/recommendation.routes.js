
import express from "express";

import {
  getRecommendations,
  searchRecommendations,
} from "../controllers/recommendation.controller.js";

import protect from "../middleware/auth.middleware.js";
import { objectIdParam, validateRecommendationFeedbackBody, validateRecommendationFeedbackQuery } from "../middleware/validate.middleware.js";
import {
  validateRecommendationQuery,
  validateRecommendationSearchQuery,
} from "../middleware/validate.middleware.js";
import {
  deleteRecommendationFeedback,
  upsertRecommendationFeedback,
} from "../controllers/recommendation-feedback.controller.js";

const router = express.Router();

router.use(protect);



router.get(
  "/",
  validateRecommendationQuery,
  getRecommendations
);

router.get(
  "/search",
  validateRecommendationSearchQuery,
  searchRecommendations
);

router.put(
  "/:movieId/feedback",
  objectIdParam("movieId"),
  validateRecommendationFeedbackBody,
  upsertRecommendationFeedback,
);

router.delete(
  "/:movieId/feedback",
  objectIdParam("movieId"),
  validateRecommendationFeedbackQuery,
  deleteRecommendationFeedback,
);

export default router;
