import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const configuredDatabaseName = process.env.MONGO_DATABASE_NAME?.trim();
    const connectionOptions = configuredDatabaseName
      ? { dbName: configuredDatabaseName }
      : undefined;
    await mongoose.connect(process.env.MONGO_URI, connectionOptions);

    console.log(`MongoDB connected`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
