import dotenv from "dotenv";

dotenv.config();

const startServer = async () => {
  try {
    const [{ default: app }, { default: connectDb }] = await Promise.all([
      import("./app.js"),
      import("../config/db.js"),
    ]);
    const PORT = process.env.PORT;
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
