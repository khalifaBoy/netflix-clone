

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

const router = express.Router();

// All profile routes require authentication
router.use(protect);

// Get all profiles
router.get("/", getProfiles);

// Get single profile
router.get("/:profileId", getProfile);

// Create profile
router.post("/", createProfile);

// Update profile
router.patch("/:profileId", updateProfile);

// Delete profile
router.delete("/:profileId", deleteProfile);

// Select profile
router.post("/:profileId/select", selectProfile);

export default router;
