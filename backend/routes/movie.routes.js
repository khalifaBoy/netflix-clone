
import express from "express";

import {
  createMovie,
  getMovies,
  getMovie,
  updateMovie,
  deleteMovie,
  incrementMovieViews,
} from "../controllers/movie.controller.js";

import protect from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| PUBLIC MOVIE ROUTES
|--------------------------------------------------------------------------
*/

router.get("/", getMovies);


router.get("/:movieId", getMovie);

router.post("/:movieId/views", incrementMovieViews);

/*
|--------------------------------------------------------------------------
| ADMIN / PROTECTED MOVIE ROUTES
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  upload.single("video"),
  createMovie
);

router.patch(
  "/:movieId",
  protect,
  upload.single("video"),
  updateMovie
);

router.delete(
  "/:movieId",
  protect,
  deleteMovie
);

export default router;