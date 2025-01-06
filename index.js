const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

    const tasksCollection = client.db("Projease").collection("tasks");
    const usersCollection = client.db("Projease").collection("users");
    const projectsCollection = client.db("Projease").collection("projects");
    const invitationCollection = client
      .db("Projease")
      .collection("invitations");
    const projectTasksCollection = client
      .db("Projease")
      .collection("projectTasks");

    // Projects user collection

    app.use("/", userRoutes(client.db("Projease")));
    app.use("/", taskRoutes(client.db("Projease")));
    app.use("/", projectRoutes(client.db("Projease")));
    app.use("/", joinProjectRoute(client.db("Projease")));
    app.use("/", invitationRoute(client.db("Projease")));

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
