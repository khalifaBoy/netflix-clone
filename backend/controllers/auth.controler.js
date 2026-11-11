import User from "../models/User.js";
import Profile from "../models/Profile.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcrypt";
const sanitzeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    role: user.role,
  };
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the details",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 character",
      });
    }
    const normalizeemail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      email: normalizeemail,
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exisits",
      });
    }
    const hasherPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizeemail,
      password: hasherPassword,
    });
    const profiles = await Profile.insertMany([
      {
        user: user._id,
        name: name.trim(),
        avatar: "",
        isKids: false,
        language: "English",
        maturityLevel: "All",
      },
      {
        user: user._id,
        name: "Kids",
        avatar: "",
        isKids: true,
        language: "English",
        maturityLevel: "7+",
      },
    ]);
    const token = generateToken(user._id);
    return res.status(201).json({
      success: true,
      message: "Account created Successfully",
      token,
      user: sanitzeUser(user),
      profiles,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the details",
      });
    }

    const normalizeemail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizeemail,
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const isPasswordvalid = await bcrypt.compare(password, user.password);

    if (!isPasswordvalid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const profiles = await Profile.find({
      user: user._id,
      isActive: true,
    }).sort({ createdAt: 1 });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Login Successfully",
      token,
      user: sanitzeUser(user),
      profiles,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user=await User.findById(req.user._id)

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const profiles = await Profile.find({
      user: user._id,
      isActive: true,
    }).sort({ createdAt: 1 });

    return res.status(201).json({
      success: true,
      message: "Login Successfully",
      user: sanitzeUser(user),
      profiles,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
