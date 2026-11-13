

import express from "express";

import {
  getProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  selectProfile,
} from "../controllers/profile.controller.js";

import protect from "../middleware/auth.middleware.js";
import {
  objectIdParam,
  validateCreateProfile,
  validateUpdateProfile,
} from "../middleware/validate.middleware.js";

const router = express.Router();

// All profile routes require authentication
router.use(protect);

// Get all profiles
router.get("/", getProfiles);

// Get single profile
router.get("/:profileId", objectIdParam("profileId"), getProfile);

// Create profile
router.post("/", validateCreateProfile, createProfile);

// Update profile
router.patch("/:profileId", objectIdParam("profileId"), validateUpdateProfile, updateProfile);

// Delete profile
router.delete("/:profileId", objectIdParam("profileId"), deleteProfile);

// Select profile
router.post("/:profileId/select", objectIdParam("profileId"), selectProfile);

export default router;
