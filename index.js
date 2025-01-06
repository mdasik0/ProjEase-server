const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const projectRoutes = require("./routes/projectRoutes");
const joinProjectRoute = require("./routes/joinProjectRoute");
const invitationRoute = require("./routes/invitationRoutes");

// App setup
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

const setupSockets = require("./socket");

setupSockets(server);

app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;

async function run() {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  try {
    await client.connect();

    const db = client.db("Projease")

    app.use(userRoutes(db));
    app.use(taskRoutes(db));
    app.use(projectRoutes(db));
    app.use(joinProjectRoute(db));
    app.use(invitationRoute(db));

    console.log(`Connected to MongoDB! server url=http://localhost:5000`);
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
