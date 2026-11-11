import mongoose from "mongoose";

const watchlistSchema = new mongoose.Schema(
  {
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
      index: true,
    },

    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
      index: true,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

watchlistSchema.index(
  {
    profile: 1,
    movie: 1,
  },
  {
    unique: true,
  },
);

export default mongoose.model("Watchlist", watchlistSchema);
