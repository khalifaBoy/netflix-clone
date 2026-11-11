import dotenv from "dotenv";

dotenv.config();
import app from "./app.js";
import connectDb from "../config/db.js";

const PORT = process.env.PORT;

const startServer = async () => {
  try {
    await connectDb();
    app.listen(PORT, () => {
      console.log(`Server running on Port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server error:`, error.message);
    process.exit(1);
  }
};
startServer();
