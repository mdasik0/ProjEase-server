const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const { connectToDB } = require("./db/dbConnect");

const app = express();
const server = http.createServer(app);

// CORS first
app.use(cors({
  origin: [process.env.CORS_ORIGIN_URL, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// Handle preflight
app.options('*', cors());

app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

async function run() {
  try {
    const db = await connectToDB();
    
    // Import routes here
    const userRoutes = require("./routes/userRoutes");
    const taskRoutes = require("./routes/taskRoutes");
    const projectRoutes = require("./routes/projectRoutes");
    const joinProjectRoute = require("./routes/joinProjectRoute");
    const invitationRoute = require("./routes/invitationRoutes");
    const messagesRoutes = require("./routes/messagesRoutes");
    const setupSockets = require("./socket");
    
    app.use(userRoutes(db));
    app.use(taskRoutes(db));
    app.use(projectRoutes(db));
    app.use(joinProjectRoute(db));
    app.use(invitationRoute(db));
    app.use(messagesRoutes(db));
    
    setupSockets(server, db);
    
    console.log(`server url=http://localhost:5000`);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.error);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
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