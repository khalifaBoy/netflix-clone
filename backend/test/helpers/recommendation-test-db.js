import "dotenv/config";
import mongoose from "mongoose";
import User from "../../models/User.js";
import Profile from "../../models/Profile.js";
import Movie from "../../models/Movie.js";
import WatchHistory from "../../models/WatchHistory.js";
import RecommendationFeedback from "../../models/RecommendationFeedback.js";
import RecommendationInteraction from "../../models/RecommendationInteraction.js";
import Watchlist from "../../models/Watchlist.js";

export const recommendationModels = [
  User,
  Profile,
  Movie,
  WatchHistory,
  RecommendationFeedback,
  RecommendationInteraction,
  Watchlist,
];

const parseTarget = (value, variableName, { requireExplicitDatabase = false } = {}) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid MongoDB connection URI`);
  }

  if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use mongodb:// or mongodb+srv://`);
  }

  const pathDatabaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "").split("/")[0] || "");
  const optionDatabaseName = parsed.searchParams.get("dbName")?.trim() || "";
  if (pathDatabaseName && optionDatabaseName && pathDatabaseName !== optionDatabaseName) {
    throw new Error(`${variableName} contains conflicting database names`);
  }
  const explicitDatabaseName = pathDatabaseName || optionDatabaseName;
  if (requireExplicitDatabase && !explicitDatabaseName) {
    throw new Error(`${variableName} must include an explicit database name`);
  }
  // The MongoDB Node driver defaults to the "test" database when the URI has
  // no database path and no dbName option. Production currently calls
  // mongoose.connect(uri) without options, so this is its effective fallback.
  const databaseName = explicitDatabaseName || "test";
  return { host: parsed.host.toLowerCase(), databaseName: databaseName.toLowerCase() };
};

export const validateTestDatabaseUri = (env = process.env) => {
  const uri = env.MONGO_TEST_URI?.trim();
  if (!uri) {
    throw new Error("MONGO_TEST_URI is required; integration tests never fall back to MONGO_URI");
  }

  const testTarget = parseTarget(uri, "MONGO_TEST_URI", { requireExplicitDatabase: true });
  if (!/(^|[-_])test($|[-_])/i.test(testTarget.databaseName)) {
    throw new Error("MONGO_TEST_URI database name must explicitly contain 'test' (for example netflix_test)");
  }

  const productionUri = env.MONGO_URI?.trim();
  const configuredProductionDatabase = env.MONGO_DATABASE_NAME?.trim();
  let productionDatabaseName;
  if (configuredProductionDatabase) {
    productionDatabaseName = configuredProductionDatabase.toLowerCase();
  } else if (productionUri) {
    productionDatabaseName = parseTarget(productionUri, "MONGO_URI").databaseName;
  } else {
    throw new Error("Cannot verify database isolation: set MONGO_DATABASE_NAME or configure MONGO_URI so its effective database can be determined");
  }

  if (testTarget.databaseName === productionDatabaseName) {
    throw new Error("MONGO_TEST_URI database name matches the effective production database; refusing to run integration tests");
  }

  return { uri, target: testTarget };
};

export const connectRecommendationTestDatabase = async () => {
  const { uri, target } = validateTestDatabaseUri();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  } catch (error) {
    throw new Error(`Unable to connect to the dedicated MONGO_TEST_URI database (${error?.name || "connection error"})`);
  }

  if (mongoose.connection.name.toLowerCase() !== target.databaseName) {
    await mongoose.disconnect();
    throw new Error("Connected database name does not match the validated MONGO_TEST_URI target");
  }
  if (!/(^|[-_])test($|[-_])/i.test(mongoose.connection.name)) {
    await mongoose.disconnect();
    throw new Error("Connected database is not explicitly named as a test database");
  }

  // Build only declared indexes in the explicitly validated isolated database.
  await Promise.all(recommendationModels.map((model) => model.createIndexes()));
  return mongoose.connection;
};

export const inspectRecommendationIndexes = async () => {
  const indexes = new Map();
  for (const model of recommendationModels) {
    indexes.set(model.modelName, await model.collection.indexes());
  }
  return indexes;
};

export const disconnectRecommendationTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
