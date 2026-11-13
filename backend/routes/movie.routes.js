
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
import requireAdmin from "../middleware/admin.middleware.js";
import upload from "../middleware/upload.middleware.js";
import {
  objectIdParam,
  validateCreateMovie,
  validateMovieListQuery,
  validateUpdateMovie,
} from "../middleware/validate.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| PUBLIC MOVIE ROUTES
|--------------------------------------------------------------------------
*/

router.get("/", validateMovieListQuery, getMovies);


router.get("/:movieId", objectIdParam("movieId"), getMovie);

router.post("/:movieId/views", objectIdParam("movieId"), incrementMovieViews);

/*
|--------------------------------------------------------------------------
| ADMIN / PROTECTED MOVIE ROUTES
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  requireAdmin,
  upload.single("video"),
  validateCreateMovie,
  createMovie
);

router.patch(
  "/:movieId",
  protect,
  requireAdmin,
  objectIdParam("movieId"),
  upload.single("video"),
  validateUpdateMovie,
  updateMovie
);

router.delete(
  "/:movieId",
  protect,
  requireAdmin,
  objectIdParam("movieId"),
  deleteMovie
);

export default router;
