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
        } else if (userAlreadyExists && userInfo.login_method === "email") {
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
        res.status(200).send({
          success: true,
          method: "email-login",
          message: result.name
            ? "Welcome Back" + result.name
            : "Welcome back! Complete your profile to unlock the full experience.",
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

    app.patch("/updateName/:id", async (req, res) => {
      const id = req.params.id;
      const name = req.body;

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { name: name?.data } }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({
              success: false,
              message: "Can not update your name. Try again!",
            });
        }

        return res
          .status(200)
          .json({
            success: true,
            message:
              "Name updated! You're all set to upload your profile picture next.",
          });
      } catch (error) {
        return res.status(500).json({ error: "Error updating user" });
      }
    });
    app.patch("/updateProfilePicture/:id", async (req, res) => {
      const id = req.params.id;
      const image = req.body;

      console.log(image);

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { image: image?.data } }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({
              success: false,
              message: "Can not update your image. Try again!",
            });
        }

        return res
          .status(200)
          .json({
            success: true,
            message: "Profile picture updated! You're all set!",
          });
      } catch (error) {
        return res.status(500).json({ error: "Error updating user" });
      }
    });

    app.patch("/updateUser/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const body = req.body; // Exclude _id from the body

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: body }
        );
        if (result.matchedCount === 0) {
          res.status(404).send({
            success: false,
            message: "User not found. Check the user ID and try again.",
          });
        } else if (result.modifiedCount === 0) {
          res.status(400).send({
            success: false,
            message: "User data was found, but nothing was updated.",
          });
        } else {
          res.status(200).send({
            success: true,
            message: "User has been updated.",
          });
        }
      } catch (error) {
        res.send(error);
      }
    });

    app.patch('/users/:id/joined-projects', async (req, res) => {
      const id = req.params.id; // User ID
      const newProject = req.body; // New project object to be added (e.g., { projectId, status })
    
      try {
        // Ensure `newProject` is provided and has the required fields
        if (!newProject.projectId || !newProject.status) {
          return res.status(400).send({
            success: false,
            message: 'Invalid data. The projectId and status fields are required.',
          });
        }
    
        // Update logic
        const updateResult = await usersCollection.updateOne(
          { _id: new ObjectId(id) }, // Match the user by their ID
          {
            $push: { joinedProjects: newProject }, // Add the new project object to the array
            $setOnInsert: { joinedProjects: [] }, // Ensure the field exists if it doesn't
          }
        );
    
        if (updateResult.modifiedCount > 0) {
          return res.status(200).send({
            success: true,
            message: 'Project added to joinedProjects successfully.',
          });
        }
    
        return res.status(404).send({
          success: false,
          message: 'User not found.',
        });
      } catch (error) {
        console.error('Error updating joinedProjects:', error);
        return res.status(500).send({
          success: false,
          message: 'An unexpected error occurred.',
        });
      }
    });
    

    //Create project api endpoints
    app.post("/createProject", async (req, res) => {
      try {
        const project = req.body;
    
        const userProjects = await projectsCollection
          .find({ CreatedBy: project.CreatedBy })
          .toArray();
    
        if (userProjects.length >= 2) {
          return res.status(403).send({
            success: false,
            message: "You can only create up to two projects.",
          });
        }
    
        const result = await projectsCollection.insertOne(project);
    
        if (result.acknowledged) {
          return res.status(200).send({
            success: true,
            message: "Project was successfully created.",
            projectId: result.insertedId, // Include the new project's ID here
          });
        } else {
          return res.status(500).send({
            success: false,
            message: "There was an error creating the project.",
          });
        }
      } catch (error) {
        console.error("Error creating project:", error);
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred: " + error.message,
        });
      }
    });
    
    

    app.get('/getProjects', async (req, res) => {
      const result = await projectsCollection.find().toArray();
      res.status(200).send(result)
    })

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
