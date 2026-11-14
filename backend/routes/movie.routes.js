
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
import requireProfilePolicy from "../middleware/profile-policy.middleware.js";
import upload from "../middleware/upload.middleware.js";
import validateVideoFile from "../middleware/validate-video-file.middleware.js";
import {
  objectIdParam,
  validateProfileIdQuery,
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

router.get("/", protect, validateProfileIdQuery, requireProfilePolicy, validateMovieListQuery, getMovies);


router.get("/:movieId", protect, objectIdParam("movieId"), validateProfileIdQuery, requireProfilePolicy, getMovie);

router.post("/:movieId/views", protect, objectIdParam("movieId"), validateProfileIdQuery, requireProfilePolicy, incrementMovieViews);

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
  validateVideoFile,
  validateCreateMovie,
  createMovie
);

router.patch(
  "/:movieId",
  protect,
  requireAdmin,
  objectIdParam("movieId"),
  upload.single("video"),
  validateVideoFile,
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
