import mongoose from "mongoose";

import groq from "../config/groq.js";

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
    .populate(
      "movie",
      "title description genres cast year rating language maturityRating",
    )
    .sort({
      addedAt: -1,
    })
    .limit(30)
    .lean();

  return {
    watchlist: watchlist
      .filter((item) => item.movie)
      .map((item) => ({
        id: item.movie._id.toString(),
        title: item.movie.title,
        description: item.movie.description,
        genres: item.movie.genres || [],
        cast: item.movie.cast || [],
        year: item.movie.year,
        rating: item.movie.rating,
        language: item.movie.language,
        maturityRating: item.movie.maturityRating,
      })),
  };
};

/*
|--------------------------------------------------------------------------
| PERSONALIZED RECOMMENDATIONS
|--------------------------------------------------------------------------
|
| GET /api/recommendations?profileId=PROFILE_ID
|
*/

export const getRecommendations = async (req, res) => {
  try {
    const { profileId } = req.query;

    /*
    |--------------------------------------------------------------------------
    | Validate profileId
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Get profile
    |--------------------------------------------------------------------------
    */

    const profile = await getProfile(profileId, req.user._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Get user's Watchlist
    |--------------------------------------------------------------------------
    */

    const context = await getRecommendationContext(profileId);

    /*
    |--------------------------------------------------------------------------
    | Watchlist movie IDs
    |--------------------------------------------------------------------------
    |
    | We don't recommend movies already present in the user's Watchlist.
    |
    */

    const watchlistIds = context.watchlist.map((movie) => movie.id);

    /*
    |--------------------------------------------------------------------------
    | Candidate movies
    |--------------------------------------------------------------------------
    */

    const movieQuery = {
      isPublished: true,

      /*
      | Don't recommend movies already in My List
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
    };

    const candidates = await Movie.find(movieQuery)
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
      .limit(200)
      .lean();

    /*
    |--------------------------------------------------------------------------
    | No candidate movies
    |--------------------------------------------------------------------------
    */

    if (!candidates.length) {
      return res.status(200).json({
        success: true,
        profile: {
          id: profile._id,
          name: profile.name,
        },
        movies: [],
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GROQ RECOMMENDATION
    |--------------------------------------------------------------------------
    */

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",

      temperature: 0.2,

      messages: [
        {
          role: "system",
          content: `
You are a Netflix recommendation engine.

The user currently has only one personalization signal:

WATCHLIST.

Use the user's Watchlist to understand their preferences.

Analyze:

- Watchlist movies
- Recurring genres
- Cast
- Movie descriptions
- Language
- Rating
- Year
- Profile type
- Maturity level

Rules:

1. Recommend ONLY movies from the supplied AVAILABLE MOVIES catalog.
2. NEVER invent movie IDs.
3. NEVER recommend a movie already present in the Watchlist.
4. Recommend movies that are similar to the user's Watchlist.
5. Identify recurring genres from the Watchlist.
6. Consider actors/cast similarities.
7. Consider movie descriptions and themes.
8. Respect the user's language.
9. Respect the user's maturity level.
10. For Kids profiles, only recommend age-appropriate movies.
11. Return a maximum of 15 movies.
12. Rank the strongest recommendations first.
13. If the Watchlist is empty, recommend generally popular/relevant movies from the available catalog.
14. Return ONLY the JSON structure requested.
`,
        },

        {
          role: "user",
          content: `
PROFILE:

${JSON.stringify(
  {
    name: profile.name,
    isKids: profile.isKids,
    language: profile.language,
    maturityLevel: profile.maturityLevel,
  },
  null,
  2,
)}

WATCHLIST:

${JSON.stringify(context.watchlist, null, 2)}

AVAILABLE MOVIES:

${JSON.stringify(
  candidates.map((movie) => ({
    id: movie._id.toString(),
    title: movie.title,
    description: movie.description,
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
          name: "recommendations",

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
    | Map AI IDs → Actual MongoDB Movies
    |--------------------------------------------------------------------------
    |
    | This prevents Groq from inventing movies.
    |
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

      profile: {
        id: profile._id,
        name: profile.name,
      },

      count: movies.length,

      movies,
    });
  } catch (error) {
    console.error("Recommendation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
export const searchRecommendations = async (req, res) => {
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

    const watchlistIds = context.watchlist.map((movie) => movie.id);

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
2. Movies currently in the user's Watchlist.
3. Recurring genres in the Watchlist.
4. Similar actors/cast.
5. Similar movie themes.
6. Movie descriptions.
7. Language.
8. Profile maturity level.

IMPORTANT RULES:

- ONLY use movies from AVAILABLE MOVIES.
- NEVER invent movie IDs.
- NEVER return movies that are not in AVAILABLE MOVIES.
- NEVER return movies already in the Watchlist.
- Rank movies that best satisfy the user's search query.
- Use the Watchlist only as a personalization signal.
- Do not ignore the search query just because of Watchlist preferences.
- For Kids profiles, only recommend age-appropriate movies.
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


PROFILE:

${JSON.stringify(
  {
    name: profile.name,
    isKids: profile.isKids,
    language: profile.language,
    maturityLevel: profile.maturityLevel,
  },
  null,
  2,
)}


USER WATCHLIST:

${JSON.stringify(context.watchlist, null, 2)}


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
    console.error("Search recommendation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate search recommendations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
