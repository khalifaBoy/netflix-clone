import mongoose from "mongoose";

export const RECOMMENDATION_INTERACTION_TYPES = Object.freeze([
  "IMPRESSION",
  "CLICK",
  "PLAY",
  "DISMISS",
]);

const recommendationInteractionSchema = new mongoose.Schema({
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
    required: true,
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Movie",
    required: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: RECOMMENDATION_INTERACTION_TYPES,
  },
  position: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isInteger,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

recommendationInteractionSchema.index({ profile: 1, createdAt: -1 });
recommendationInteractionSchema.index({ profile: 1, eventType: 1, createdAt: -1 });
recommendationInteractionSchema.index({ profile: 1, movie: 1, createdAt: -1 });

export default mongoose.model("RecommendationInteraction", recommendationInteractionSchema);
