import mongoose from "mongoose";

export const RECOMMENDATION_FEEDBACK_TYPES = Object.freeze([
  "NOT_INTERESTED",
  "MORE_LIKE_THIS",
  "ALREADY_WATCHED",
]);

const recommendationFeedbackSchema = new mongoose.Schema({
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
  type: {
    type: String,
    required: true,
    enum: RECOMMENDATION_FEEDBACK_TYPES,
  },
}, { timestamps: true });

recommendationFeedbackSchema.index({ profile: 1, movie: 1 }, { unique: true });
recommendationFeedbackSchema.index({ profile: 1, type: 1, updatedAt: -1 });

recommendationFeedbackSchema.statics.upsertForProfile = async function upsertForProfile({
  profile,
  movie,
  type,
}) {
  await new this({ profile, movie, type }).validate();

  return this.findOneAndUpdate(
    { profile, movie },
    { $set: { type } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
};

export default mongoose.model("RecommendationFeedback", recommendationFeedbackSchema);
