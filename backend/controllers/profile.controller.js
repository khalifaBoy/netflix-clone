import Profile from "../models/Profile.js";

export const getProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({
      user: req.user._id,
      isActive: true,
    }).sort({
      createdAt: 1,
    });

    return res.status(200).json({
      success: true,
      profiles,
    });
  } catch (error) {
    console.error("Get profiles error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profiles",
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await Profile.findOne({
      _id: profileId,
      user: req.user._id,
      isActive: true,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

export const createProfile = async (req, res) => {
  try {
    const {
      name,
      avatar = "",
      isKids = false,
      language = "English",
      maturityLevel = "All",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Profile name is required",
      });
    }

    // Maximum 5 profiles per account
    const profileCount = await Profile.countDocuments({
      user: req.user._id,
      isActive: true,
    });

    if (profileCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "You can have a maximum of 5 profiles",
      });
    }

    // Prevent duplicate profile names
    const existingProfile = await Profile.findOne({
      user: req.user._id,
      name: name.trim(),
      isActive: true,
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "A profile with this name already exists",
      });
    }

    const profile = await Profile.create({
      user: req.user._id,
      name: name.trim(),
      avatar,
      isKids,
      language,
      maturityLevel,
    });

    return res.status(201).json({
      success: true,
      message: "Profile created successfully",
      profile,
    });
  } catch (error) {
    console.error("Create profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create profile",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profileId } = req.params;

    const { name, avatar, isKids, language, maturityLevel } = req.body;

    const profile = await Profile.findOne({
      _id: profileId,
      user: req.user._id,
      isActive: true,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Profile name cannot be empty",
        });
      }

      const duplicateProfile = await Profile.findOne({
        user: req.user._id,
        name: name.trim(),
        isActive: true,
        _id: {
          $ne: profileId,
        },
      });

      if (duplicateProfile) {
        return res.status(409).json({
          success: false,
          message: "A profile with this name already exists",
        });
      }

      profile.name = name.trim();
    }

    if (avatar !== undefined) {
      profile.avatar = avatar;
    }

    if (isKids !== undefined) {
      profile.isKids = isKids;
    }

    if (language !== undefined) {
      profile.language = language;
    }

    if (maturityLevel !== undefined) {
      profile.maturityLevel = maturityLevel;
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

export const deleteProfile = async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await Profile.findOne({
      _id: profileId,
      user: req.user._id,
      isActive: true,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Don't allow deleting the only profile
    const profileCount = await Profile.countDocuments({
      user: req.user._id,
      isActive: true,
    });

    if (profileCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your only profile",
      });
    }

    // Soft delete
    profile.isActive = false;

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete profile",
    });
  }
};

export const selectProfile = async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await Profile.findOne({
      _id: profileId,
      user: req.user._id,
      isActive: true,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile selected successfully",
      profile,
    });
  } catch (error) {
    console.error("Select profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to select profile",
    });
  }
};
