
import express from "express";

import {
  getRecommendations,
  searchRecommendations,
} from "../controllers/recommendation.controller.js";

import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);



router.get(
  "/",
  getRecommendations
);

router.get(
  "/search",
  searchRecommendations
);

export default router;