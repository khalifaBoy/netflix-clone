import express from "express";

import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../controllers/watchlist.controller.js";

import protect from "../middleware/auth.middleware.js";
import {
  objectIdParam,
  validateProfileIdBody,
  validateProfileIdQuery,
} from "../middleware/validate.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", validateProfileIdQuery, getWatchlist);

router.post("/:movieId", objectIdParam("movieId"), validateProfileIdBody, addToWatchlist);

router.delete("/:movieId", objectIdParam("movieId"), validateProfileIdBody, removeFromWatchlist);

export default router;
