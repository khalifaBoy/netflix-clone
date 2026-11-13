import mongoose from "mongoose";

import groq from "../config/groq.js";
import { generateDeterministicRecommendations } from "../services/recommendation/recommendation.service.js";

import Movie from "../models/Movie.js";
import Profile from "../models/Profile.js";
import Watchlist from "../models/Watchlist.js";

/*
|--------------------------------------------------------------------------
| GET PROFILE
|--------------------------------------------------------------------------
*/

const getProfile = async (profileId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(profileId)) {
    return null;
  }

  return Profile.findOne({
    _id: profileId,
    user: userId,
    isActive: true,
  }).lean();
};

/*
|--------------------------------------------------------------------------
| GET USER RECOMMENDATION CONTEXT
|--------------------------------------------------------------------------
|
| Currently we only use Watchlist as the user's preference signal.
|
*/

const getRecommendationContext = async (profileId) => {
  const watchlist = await Watchlist.find({
    profile: profileId,
  })
    .populate("movie", "_id")
    .sort({
      addedAt: -1,
    })
    .limit(30)
    .lean();

  return {
    watchlistMovieIds: watchlist
      .filter((item) => item.movie)
      .map((item) => item.movie._id.toString()),
  };
};

const recommendationMovieFields = [
  "_id", "title", "description", "longDescription", "genres", "cast", "year", "rating",
  "duration", "backdrop", "poster", "videoUrl", "trailerUrl", "isNewRelease", "isTop10",
  "language", "maturityRating", "director", "releaseDate",
];

const toRecommendationMovie = (movie) => Object.fromEntries(
  recommendationMovieFields
    .filter((field) => movie[field] !== undefined)
    .map((field) => [field, movie[field]]),
);

/*
|--------------------------------------------------------------------------
| PERSONALIZED RECOMMENDATIONS
|--------------------------------------------------------------------------
|
| GET /api/recommendations?profileId=PROFILE_ID
|
*/

export const getRecommendations = async (req, res, next) => {
  try {
    const { profileId } = req.query;
    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profileId",
      });
    }

    const result = await generateDeterministicRecommendations({
      profileId,
      userId: req.user._id,
      limit: 15,
    });
    const movies = result.movies.map((entry) => toRecommendationMovie(entry.movie));

    return res.status(200).json({
      success: true,
      profile: result.profile,
      count: movies.length,
      movies,
    });
  } catch (error) {
    return next(error);
  }
};
export const searchRecommendations = async (req, res, next) => {
  try {
    const { q, profileId } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "profileId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profileId",
      });
    }

    const searchQuery = q.trim();

    const profile = await getProfile(profileId, req.user._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const context = await getRecommendationContext(profileId);

    const watchlistIds = context.watchlistMovieIds;

    let candidates = await Movie.find({
      $text: {
        $search: searchQuery,
      },

      isPublished: true,

      /*
      | Don't show movies already in Watchlist
      */
      _id: {
        $nin: watchlistIds,
      },

      /*
      | Kids profile restriction
      */
      ...(profile.isKids
        ? {
            maturityRating: {
              $in: ["All", "7+"],
            },
          }
        : {}),
    })
      .select(
        [
          "_id",
          "title",
          "description",
          "longDescription",
          "genres",
          "cast",
          "year",
          "rating",
          "duration",
          "backdrop",
          "poster",
          "videoUrl",
          "trailerUrl",
          "isNewRelease",
          "isTop10",
          "language",
          "maturityRating",
          "director",
          "releaseDate",
        ].join(" "),
      )
      .limit(100)
      .lean();

    /*
    |--------------------------------------------------------------------------
    | Fallback Search
    |--------------------------------------------------------------------------
    |
    | MongoDB text search may return nothing for some queries.
    | In that case use regex search.
    |
    */

    if (!candidates.length) {
      const regex = new RegExp(
        searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );

      candidates = await Movie.find({
        isPublished: true,

        _id: {
          $nin: watchlistIds,
        },

        $or: [
          {
            title: regex,
          },
          {
            description: regex,
          },
          {
            longDescription: regex,
          },
          {
            genres: regex,
          },
          {
            cast: regex,
          },
          {
            director: regex,
          },
          {
            language: regex,
          },
        ],

        ...(profile.isKids
          ? {
              maturityRating: {
                $in: ["All", "7+"],
              },
            }
          : {}),
      })
        .select(
          [
            "_id",
            "title",
            "description",
            "longDescription",
            "genres",
            "cast",
            "year",
            "rating",
            "duration",
            "backdrop",
            "poster",
            "videoUrl",
            "trailerUrl",
            "isNewRelease",
            "isTop10",
            "language",
            "maturityRating",
            "director",
            "releaseDate",
          ].join(" "),
        )
        .limit(100)
        .lean();
    }

    /*
    |--------------------------------------------------------------------------
    | No Search Results
    |--------------------------------------------------------------------------
    */

    if (!candidates.length) {
      return res.status(200).json({
        success: true,

        query: searchQuery,

        profile: {
          id: profile._id,
          name: profile.name,
        },

        count: 0,

        movies: [],
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GROQ SEARCH RECOMMENDATION
    |--------------------------------------------------------------------------
    */

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",

      temperature: 0.2,

      messages: [
        {
          role: "system",

          content: `
You are a Netflix personalized search recommendation engine.

The user searched for a movie, genre, actor, theme, or description.

Your job is to rank the supplied search results based on:

1. The user's search query.
2. Genre and thematic fit.
3. Similar actors/cast.
4. Movie descriptions.
5. Language.

IMPORTANT RULES:

- ONLY use movies from AVAILABLE MOVIES.
- NEVER invent movie IDs.
- NEVER return movies that are not in AVAILABLE MOVIES.
- Rank movies that best satisfy the user's search query.
- Search results have already been filtered for watchlist exclusions and profile safety.
- Return a maximum of 15 movies.
- Strongest matches must come first.
- Return ONLY the requested JSON structure.
`,
        },

        {
          role: "user",

          content: `
SEARCH QUERY:
${searchQuery}

AVAILABLE SEARCH RESULTS:

${JSON.stringify(
  candidates.map((movie) => ({
    id: movie._id.toString(),

    title: movie.title,

    description: movie.description,

    longDescription: movie.longDescription,

    genres: movie.genres || [],

    cast: movie.cast || [],

    year: movie.year,

    rating: movie.rating,

    duration: movie.duration,

    language: movie.language,

    maturityRating: movie.maturityRating,

    director: movie.director,
  })),
  null,
  2,
)}
`,
        },
      ],

      response_format: {
        type: "json_schema",

        json_schema: {
          name: "search_recommendations",

          strict: true,

          schema: {
            type: "object",

            properties: {
              movieIds: {
                type: "array",

                items: {
                  type: "string",
                },

                maxItems: 15,
              },
            },

            required: ["movieIds"],

            additionalProperties: false,
          },
        },
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Parse Groq Response
    |--------------------------------------------------------------------------
    */

    const content = completion?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    const result = JSON.parse(content);

    /*
    |--------------------------------------------------------------------------
    | Map AI IDs → Actual Movies
    |--------------------------------------------------------------------------
    */

    const movieMap = new Map(
      candidates.map((movie) => [movie._id.toString(), movie]),
    );

    const movies = (result.movieIds || [])
      .map((id) => movieMap.get(id))
      .filter(Boolean);

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      query: searchQuery,

      profile: {
        id: profile._id,
        name: profile.name,
      },

      count: movies.length,

      movies,
    });
  } catch (error) {
    return next(error);
  }
};
