
import Movie from "../models/Movie.js";
import fs from "fs";

/*
|--------------------------------------------------------------------------
| CREATE MOVIE
|--------------------------------------------------------------------------
*/

export const createMovie = async (req, res) => {
  try {
    const {
      title,
      description,
      longDescription,
      backdrop,
      poster,
      year,
      rating,
      duration,
      genres,
      cast,
      match,
      isNewRelease,
      isTop10,
      trailerUrl,
      director,
      language,
      maturityRating,
      releaseDate,
    } = req.body;

    if (!title || !description || !year || !rating || !duration) {
      return res.status(400).json({
        success: false,
        message: "Title, description, year, rating and duration are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Movie video is required",
      });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    let parsedGenres = genres;
    let parsedCast = cast;

    if (typeof genres === "string") {
      try {
        parsedGenres = JSON.parse(genres);
      } catch {
        parsedGenres = genres
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean);
      }
    }

    if (typeof cast === "string") {
      try {
        parsedCast = JSON.parse(cast);
      } catch {
        parsedCast = cast
          .split(",")
          .map((person) => person.trim())
          .filter(Boolean);
      }
    }

    const movie = await Movie.create({
      title: title.trim(),
      description: description.trim(),
      longDescription: longDescription || "",
      backdrop: backdrop || "",
      poster: poster || "",
      year: Number(year),
      rating,
      duration,
      genres: parsedGenres || [],
      cast: parsedCast || [],
      match: Number(match) || 0,
      isNewRelease: isNewRelease === true || isNewRelease === "true",
      isTop10: isTop10 === true || isTop10 === "true",
      videoUrl,
      trailerUrl: trailerUrl || "",
      director: director || "",
      language: language || "English",
      maturityRating: maturityRating || "13+",
      releaseDate: releaseDate || null,
    });

    return res.status(201).json({
      success: true,
      message: "Movie created successfully",
      movie,
    });
  } catch (error) {
    console.error("Create movie error:", error);

    if (req.file) {
      const filePath = req.file.path;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create movie",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL MOVIES
|--------------------------------------------------------------------------
*/

export const getMovies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, genre, isNewRelease, isTop10 } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Number(limit), 100);

    const query = {
      isPublished: true,
    };

    if (search) {
      query.$text = {
        $search: search,
      };
    }

    if (genre) {
      query.genres = genre;
    }

    if (isNewRelease !== undefined) {
      query.isNewRelease = isNewRelease === "true";
    }

    if (isTop10 !== undefined) {
      query.isTop10 = isTop10 === "true";
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [movies, total] = await Promise.all([
      Movie.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      Movie.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      movies,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get movies error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch movies",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET SINGLE MOVIE
|--------------------------------------------------------------------------
*/

export const getMovie = async (req, res) => {
  try {
    const { movieId } = req.params;

    const movie = await Movie.findOne({
      _id: movieId,
      isPublished: true,
    });

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    return res.status(200).json({
      success: true,
      movie,
    });
  } catch (error) {
    console.error("Get movie error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch movie",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE MOVIE
|--------------------------------------------------------------------------
*/

export const updateMovie = async (req, res) => {
  try {
    const { movieId } = req.params;

    const movie = await Movie.findById(movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    const {
      title,
      description,
      longDescription,
      backdrop,
      poster,
      year,
      rating,
      duration,
      genres,
      cast,
      match,
      isNewRelease,
      isTop10,
      trailerUrl,
      director,
      language,
      maturityRating,
      isPublished,
      releaseDate,
    } = req.body;

    if (title !== undefined) {
      movie.title = title.trim();
    }

    if (description !== undefined) {
      movie.description = description.trim();
    }

    if (longDescription !== undefined) {
      movie.longDescription = longDescription;
    }

    if (backdrop !== undefined) {
      movie.backdrop = backdrop;
    }

    if (poster !== undefined) {
      movie.poster = poster;
    }

    if (year !== undefined) {
      movie.year = Number(year);
    }

    if (rating !== undefined) {
      movie.rating = rating;
    }

    if (duration !== undefined) {
      movie.duration = duration;
    }

    if (genres !== undefined) {
      movie.genres =
        typeof genres === "string"
          ? genres.split(",").map((item) => item.trim())
          : genres;
    }

    if (cast !== undefined) {
      movie.cast =
        typeof cast === "string"
          ? cast.split(",").map((item) => item.trim())
          : cast;
    }

    if (match !== undefined) {
      movie.match = Number(match);
    }

    if (isNewRelease !== undefined) {
      movie.isNewRelease = isNewRelease === true || isNewRelease === "true";
    }

    if (isTop10 !== undefined) {
      movie.isTop10 = isTop10 === true || isTop10 === "true";
    }

    if (trailerUrl !== undefined) {
      movie.trailerUrl = trailerUrl;
    }

    if (director !== undefined) {
      movie.director = director;
    }

    if (language !== undefined) {
      movie.language = language;
    }

    if (maturityRating !== undefined) {
      movie.maturityRating = maturityRating;
    }

    if (isPublished !== undefined) {
      movie.isPublished = isPublished === true || isPublished === "true";
    }

    if (releaseDate !== undefined) {
      movie.releaseDate = releaseDate;
    }

    // Replace video if new video uploaded
    if (req.file) {
      if (movie.videoUrl) {
        const oldVideoPath = movie.videoUrl.replace(
          "/uploads/videos/",
          "uploads/videos/",
        );

        if (fs.existsSync(oldVideoPath)) {
          fs.unlinkSync(oldVideoPath);
        }
      }

      movie.videoUrl = `/uploads/videos/${req.file.filename}`;
    }

    await movie.save();

    return res.status(200).json({
      success: true,
      message: "Movie updated successfully",
      movie,
    });
  } catch (error) {
    console.error("Update movie error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update movie",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE MOVIE
|--------------------------------------------------------------------------
*/

export const deleteMovie = async (req, res) => {
  try {
    const { movieId } = req.params;

    const movie = await Movie.findById(movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    // Delete video from filesystem
    if (movie.videoUrl) {
      const videoPath = movie.videoUrl.replace(
        "/uploads/videos/",
        "uploads/videos/",
      );

      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }

    await Movie.findByIdAndDelete(movieId);

    return res.status(200).json({
      success: true,
      message: "Movie deleted successfully",
    });
  } catch (error) {
    console.error("Delete movie error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete movie",
    });
  }
};


export const incrementMovieViews = async (req, res) => {
  try {
    const { movieId } = req.params;

    const movie = await Movie.findOneAndUpdate(
      {
        _id: movieId,
        isPublished: true,
      },
      {
        $inc: {
          views: 1,
        },
      },
      {
        new: true,
      },
    );

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    return res.status(200).json({
      success: true,
      views: movie.views,
    });
  } catch (error) {
    console.error("Increment views error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update movie views",
    });
  }
};
