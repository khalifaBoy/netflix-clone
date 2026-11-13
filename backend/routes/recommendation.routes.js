
import express from "express";

import {
  getRecommendations,
  searchRecommendations,
} from "../controllers/recommendation.controller.js";

import protect from "../middleware/auth.middleware.js";
import {
  validateRecommendationQuery,
  validateRecommendationSearchQuery,
} from "../middleware/validate.middleware.js";

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

export default router;
