const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { v4: uuidv4 } = require("uuid");
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
    const usersCollection = client.db("Projease").collection("users");
    const projectsCollection = client.db("Projease").collection("projects");

    // Projects user collection
    app.post("/createProject", async (req, res) => {
      const body = req.body;

      try {
        const result = await projectsCollection.insertOne(body);
        if (result.acknowledged && result.insertedId) {
          res
            .status(200)
            .send({ message: "Project has been created successfully" });
        } else {
          res.status(400).send({ message: "Failed to create this project" });
        }
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/getallProjects", async (req, res) => {
      const result = await projectsCollection.find().toArray();
      res.send(result);
    });

    app.get("/joinProjects", async (req, res) => {
      const body = req.body;
      const { uid, password } = body;
      const storedProjects = await projectsCollection
        .findOne({ uid: uid })
        .toArray();
      if (storedProjects) {
        console.log("project found");
        if (storedProjects.password === password) {
          console.log("welcome to project" + storedProjects.name);
        } else {
          console.log(
            "The password you entered is incorrect. Please try again."
          );
        }
      } else {
        console.log("project not found");
      }
    });
    // User Api endpoints
    app.post("/createUser", async (req, res) => {
      try {
        const userInfo = req.body;

        const userAlreadyExists = await usersCollection.findOne({
          email: userInfo.email,
        });

        if (userAlreadyExists && userInfo.login_method === "google") {
          return res.status(200).json({
            success: false,
            message: "Welcome back " + userAlreadyExists.name,
            userNameExists: userAlreadyExists.name,
            userImageExists: userAlreadyExists.image,
          });
        } else if (
          userAlreadyExists &&
          userInfo.login_method === "email-password"
        ) {
          return res
            .status(200)
            .json({ success: false, message: "User already exists" });
        }

        const result = await usersCollection.insertOne(userInfo);
        if (result.acknowledged) {
          return res.status(201).json({
            success: true,
            message: "User created successfully",
            userImageExists: null,
            userNameExists: null,
          });
        } else {
          return res
            .status(500)
            .json({ success: false, message: "Failed to create user" });
        }
      } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while creating the user",
          error: error.message,
        });
      }
    });

    // login user
    app.get("/emailLogin/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });
      if (result) {
        res
          .status(200)
          .send({
            success: true,
            method: 'email-login',
            message: "Welcome back " + result.name,
            userImageExists: result.image,
            userNameExists: result.name,
          });
      }
    });

    //get single user data after login
    app.get("/getUser/:email", async (req, res) => {
      try {
        const email = req.params.email;
        // Query for a single user by email
        const result = await usersCollection.findOne({ email: email });

        if (result) {
          res.status(200).send(result);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.patch("/updateUser/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { _id, ...body } = req.body; // Exclude _id from the body

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: body }
        );
        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "User has been updated." });
        } else {
          res.status(404).send({
            message: "There was an problem updating the user try again.",
          });
        }
      } catch (error) {
        res.send(error);
      }
    });

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
            const result = await tasksCollection.find();
            const message =
              newStatus === "in-progress"
                ? "Task is in progress"
                : "Task is complete";
            return res.status(200).send({ message, ...result });
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

    app.delete("/deleteTasks/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          res
            .status(200)
            .send({ message: "Task has been deleted successfully" });
        } else
          res
            .status(500)
            .send({ message: "There was an error deleting the task" });
      } catch (error) {
        res
          .status(500)
          .send(
            "An error occurred at the delete task api endpoint" + error.message
          );
      }
    });

    app.patch("/createSteps/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const stepWithId = { ...body, _id: uuidv4() };
      try {
        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { steps: stepWithId } }
        );
        if (result.modifiedCount === 1) {
          res.status(200).send({ message: "steps have been added" });
        } else
          res
            .status(500)
            .send({ message: "there was an error adding the step" });
      } catch (error) {
        res
          .status(500)
          .send({ message: "there was an error in the step endpoint" });
      }
    });

    app.patch("/completeSteps/:id", async (req, res) => {
      const id = req.params.id;
      const { stepid } = req.body;
      const idQuery = { _id: new ObjectId(id) };
      const result = await tasksCollection.updateOne(
        { ...idQuery, "steps._id": stepid },
        { $set: { "steps.$.isCompleted": true } }
      );
      try {
        if (result.modifiedCount === 1) {
          res
            .status(200)
            .send({ message: `step has been completed successfully` });
        } else {
          res
            .status(500)
            .send({ message: "there was an error completing the step" });
        }
      } catch (error) {
        res.status(500).send({
          message:
            "there was an error in completeSteps endpoint" + error.message,
        });
      }
    });

    app.patch("/deleteSteps/:id", async (req, res) => {
      const mainObjId = req.params.id;
      const { stepid } = req.body;
      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(mainObjId) },
        { $pull: { steps: { _id: stepid } } }
      );
      try {
        if (result.modifiedCount === 1) {
          res
            .status(200)
            .send({ message: "step has been deleted successfully" });
        } else {
          res
            .status(500)
            .send({ message: "there was an error deleting the stpes" });
        }
      } catch (error) {
        res.status(500).send({
          message: "there was an error at deleteSteps endpoint" + error.message,
        });
      }
    });

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

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
