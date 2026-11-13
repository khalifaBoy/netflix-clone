import express from "express";
import protect from "../middleware/auth.middleware.js";
import { objectIdParam, validateContinueWatchingQuery, validateWatchHistoryCursor, validateWatchHistoryProgress } from "../middleware/validate.middleware.js";
import { getContinueWatching, getViewingHistory, updateProgress } from "../controllers/watch-history.controller.js";

const router = express.Router();

router.use(protect);
router.put("/:movieId/progress", objectIdParam("movieId"), validateWatchHistoryProgress, updateProgress);
router.get("/continue", validateContinueWatchingQuery, getContinueWatching);
router.get("/", validateWatchHistoryCursor, getViewingHistory);

export default router;
