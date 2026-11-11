import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    avatar: {
      type: String,
      default: "",
    },

    isKids: {
      type: Boolean,
      default: false,
    },

    language: {
      type: String,
      default: "English",
    },

    maturityLevel: {
      type: String,
      enum: ["All", "7+", "13+", "16+", "18+"],
      default: "All",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Profile", profileSchema);
