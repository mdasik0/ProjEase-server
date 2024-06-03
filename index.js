const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

// Middleware
app.use(cors());
app.use(express.json());

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

    // Task API endpoints
    app.post("/createTasks", async (req, res) => {
      try {
        const task = req.body;
        const result = await tasksCollection.insertOne(task);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send("Error creating task: " + error.message);
      }
    });

    app.patch("/updateTaskStatus/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const obj = await tasksCollection.findOne({ _id: new ObjectId(id) });

        if (!obj) {
          return res.status(404).send({ message: "Task is not found" });
        }

        let newStatus;
        if (obj.status === "pending") {
          newStatus = "in-progress";
        } else if (obj.status === "in-progress") {
          newStatus = "completed";
        } else if (obj.status === "completed") {
          return res.status(200).send({ message: "Task is already complete" });
        }

        if (newStatus) {
          const result = await tasksCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: newStatus } }
          );
          if (result.modifiedCount === 1) {
            const result = await tasksCollection.find()
            const message =
              newStatus === "in-progress"
                ? "Task is in progress"
                : "Task is complete";
            return res.status(200).send({ message, ... result });
          } else {
            return res
              .status(500)
              .send({ message: "Failed to update task status" });
          }
        }
      } catch (error) {
        return res
          .status(500)
          .send({ message: "An error occurred", error: error.message });
      }
    });

    app.get("/tasks", async (req, res) => {
      try {
        const result = await tasksCollection.find().toArray(); // Convert cursor to array
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send("Error fetching tasks: " + error.message);
      }
    });

    app.patch("/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const body = req.body;
        const query = { _id: ObjectId(id) };
        const result = await tasksCollection.updateOne(query, { $set: body });
        res.status(200).send("Task updated successfully");
      } catch (error) {
        res.status(500).send("Error updating task: " + error.message);
      }
    });

    app.delete("/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await tasksCollection.deleteOne({ _id: ObjectId(id) });
        res.status(200).send("Task deleted successfully");
      } catch (error) {
        res.status(500).send("Error deleting task: " + error.message);
      }
    });

    console.log("Connected to MongoDB!");
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

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
