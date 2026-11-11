import express from "express";

import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../controllers/watchlist.controller.js";

import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getWatchlist);

router.post("/:movieId", addToWatchlist);

router.delete("/:movieId", removeFromWatchlist);

export default router;
