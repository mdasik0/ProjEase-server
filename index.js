const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const projectRoutes = require("./routes/projectRoutes");
const joinProjectRoute = require("./routes/joinProjectRoute");
const invitationRoute = require("./routes/invitationRoutes");
const { connectToDB } = require("./db/dbConnect");
const cookieParser = require("cookie-parser");
// App setup
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const setupSockets = require("./socket");
const messagesRoutes = require("./routes/messagesRoutes");


app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

async function run() {
  try {
    const db = await connectToDB();
    app.use(userRoutes(db));
    app.use(taskRoutes(db));
    app.use(projectRoutes(db));
    app.use(joinProjectRoute(db));
    app.use(invitationRoute(db));
    app.use(messagesRoutes(db))
    setupSockets(server,db);

    console.log(`server url=http://localhost:5000`);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.error);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message) {
    res.status(500).send(err.message);
  } else {
    res.status(500).send("There was an error!");
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
