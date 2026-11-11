import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    longDescription: {
      type: String,
      default: "",
      trim: true,
    },

    backdrop: {
      type: String,
      required: true,
    },

    poster: {
      type: String,
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    rating: {
      type: String,
      required: true,
    },

    duration: {
      type: String,
      required: true,
    },

    genres: [
      {
        type: String,
        trim: true,
      },
    ],

    cast: [
      {
        type: String,
        trim: true,
      },
    ],

    match: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    isNewRelease: {
      type: Boolean,
      default: false,
    },

    isTop10: {
      type: Boolean,
      default: false,
    },

    videoUrl: {
      type: String,
      required: true,
    },

    trailerUrl: {
      type: String,
      default: "",
    },

    director: {
      type: String,
      default: "",
    },

    language: {
      type: String,
      default: "English",
    },

    maturityRating: {
      type: String,
      default: "13+",
    },

    views: {
      type: Number,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },

    releaseDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

movieSchema.index({
  title: "text",
  description: "text",
});

movieSchema.index({
  genres: 1,
});

movieSchema.index({
  isTop10: 1,
});

movieSchema.index({
  isNewRelease: 1,
});

export default mongoose.model("Movie", movieSchema);