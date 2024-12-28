const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to Projease");
});

const users = {};
const groups = {};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // Register User
  socket.on("register", (userId) => {
    if (users[userId]) {
      socket.emit("registerResponse", {
        success: false,
        message: `User ID ${userId} is already registered.`,
      });
      return;
    }

    users[userId] = socket.id;
    console.log(`User registered: ${userId}, Socket: ${socket.id}`, users);

    socket.emit("registerResponse", {
      success: true,
      message: `User ${userId} registered successfully.`,
    });
  });

  // Join Group
  socket.on("joinGroup", (groupId) => {
    if (!groupId || typeof groupId !== "string" || groupId.trim() === "") {
      socket.emit("error", { message: "Invalid group name." });
      return;
    }

    if (!groups[groupId]) {
      groups[groupId] = [];
    }

    // Avoid duplicate entries
    if (!groups[groupId].includes(socket.id)) {
      groups[groupId].push(socket.id);
    }

    socket.join(groupId);
    console.log(`${socket.id} joined group: ${groupId}`, groups);

    socket.emit("groupJoinResponse", {
      success: true,
      groupId,
      message: `You joined group: ${groupId}`,
    });
  });

  socket.on("groupMessage", ({ groupId, message }) => {
    console.log(groupId, message);
    if (!groupId || !message) {
      socket.emit("error", {
        message: "Group name and message are required.",
      });
      return;
    }

    const userId = Object.keys(users).find((key) => users[key] === socket.id);

    io.to(groupId).emit("groupMessageReceived", {
      sender: userId,
      message,
      timestamp: new Date(),
    });

    console.log(`Message from ${userId} to group ${groupId}: ${message}`);
  });

  // Handle Disconnect
  socket.on("disconnect", () => {
    const userId = Object.keys(users).find((key) => users[key] === socket.id);
    if (userId) delete users[userId];
    console.log("User disconnected", socket.id);
  });
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

    app.get("/get-all-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
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
          return res.status(404).json({
            success: false,
            message: "Can not update your name. Try again!",
          });
        }

        return res.status(200).json({
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

      // console.log(image);

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { image: image?.data } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Can not update your image. Try again!",
          });
        }

        return res.status(200).json({
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

    app.get("/getMultUsers", async (req, res) => {
      const userIdsArr = req.query.userIds;

      const allMembers = userIdsArr
        .split(",")
        .map((id) => {
          if (!ObjectId.isValid(id)) {
            console.error(`Invalid ID: ${id}`);
            return null;
          }
          return new ObjectId(String(id));
        })
        .filter((id) => id !== null);

      if (allMembers.length === 0) {
        return res.status(400).send({
          success: false,
          message: "No members available in this project.",
        });
      }

      // console.log(allMembers);

      try {
        // Fetch users matching the provided IDs
        const members = await usersCollection
          .find({ _id: { $in: allMembers } })
          .toArray();

        // Respond with the fetched members

        return res.status(200).send(members);
      } catch (error) {
        console.error("Error fetching members:", error.message);
        return res.status(500).send({
          message: "An error occurred while fetching tasks.",
          error: error.message,
        });
      }
    });

    app.patch("/users/:id/joined-projects", async (req, res) => {
      const id = req.params.id; // User ID
      const newProject = req.body; // New project object to be added (e.g., { projectId, status })

      try {
        // Ensure `newProject` is provided and has the required fields
        if (!newProject.projectId || !newProject.status) {
          return res.status(400).send({
            success: false,
            message:
              "Invalid data. The projectId and status fields are required.",
          });
        }

        // Step 1: Ensure `joinedProjects` exists as an array
        await usersCollection.updateOne(
          { _id: new ObjectId(id), joinedProjects: { $exists: false } },
          { $set: { joinedProjects: [] } }
        );

        // Step 2: Update all existing projects to have status `passive`
        await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              "joinedProjects.$[].status": "passive", // Set all statuses in the array to "passive"
            },
          }
        );

        // Step 3: Push the new project into the array
        const updateResult = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { joinedProjects: newProject } }
        );

        if (updateResult.modifiedCount > 0) {
          return res.status(200).send({
            success: true,
            message: "This project is now marked as active.",
          });
        }

        return res.status(404).send({
          success: false,
          message: "User not found.",
        });
      } catch (error) {
        console.error("Error updating joinedProjects:", error);
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred.",
        });
      }
    });

    //Create project api endpoints
    app.get("/get-all-projects", async (req, res) => {
      const result = await projectsCollection.find().toArray();
      res.send(result);
    });

    app.post("/createProject", async (req, res) => {
      try {
        // body pailam
        const project = req.body;

        //check kormu 2 ta project tar beshi ase ki na
        const userProjects = await projectsCollection
          .find({ CreatedBy: project.CreatedBy })
          .toArray();

        // thakle ar banaite dimu na return
        if (userProjects.length >= 2) {
          return res.status(403).send({
            success: false,
            message: "You can only create up to two projects.",
          });
        }

        // na thakle banaite dimu
        const response = await projectsCollection.insertOne(project);
        if (response.acknowledged) {
          // bananer por response jodi kore taile ekta projTask banamu
          const taskObj = {
            projectId: response.insertedId,
            allTaskIds: [],
          };
          // set projTask insert kormu
          const taskObjInserted = await projectTasksCollection.insertOne(
            taskObj
          );

          if (taskObjInserted.acknowledged) {
            // insert successfull hoile taile taskObjInserted theke insertedId pamu seita projects collection e update marmu
            await projectsCollection.updateOne(
              { _id: new ObjectId(response.insertedId) },
              { $set: { taskId: taskObjInserted.insertedId } }
            );
            return res.status(200).send({
              success: true,
              message: "Project was successfully created.",
              projectId: response.insertedId, // Include the new project's ID here
            });
          }
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

    app.post("/join-project", async (req, res) => {
      console.log(req.body);
      const { projId, password, userId } = req.body;
      try {
        const projObjectId = new ObjectId(String(projId));
        const isProjectAvailable = await projectsCollection.findOne(
          { _id: projObjectId },
          { projection: { projectPassword: 1, attemptTracker: 1, members: 1 } }
        );

        if (!isProjectAvailable) {
          return res
            .status(404)
            .send({ success: false, message: "Project do not exist." });
        } else {
          const { projectPassword, attemptTracker } = isProjectAvailable;

          if (!attemptTracker || !attemptTracker[userId]) {
            isProjectAvailable.attemptTracker = {
              ...attemptTracker,
              [userId]: { attempts: 0, lastAttempt: null },
            };
          }

          const userAttempts = isProjectAvailable.attemptTracker[userId];
          const currentTime = Date.now();
          if (
            userAttempts.attempts >= 3 &&
            userAttempts.lastAttempt &&
            currentTime - userAttempts.lastAttempt < 3 * 60 * 60 * 1000
          ) {
            return res.status(403).send({
              success: false,
              message:
                "You are temporarily locked out. Try again after 3 hours.",
            });
          }

          const passMatch = projectPassword === password;

          if (!passMatch) {
            isProjectAvailable.attemptTracker[userId] = {
              attempts: userAttempts.attempts + 1,
              lastAttempt: currentTime,
            };

            await projectsCollection.updateOne(
              { _id: new ObjectId(String(projId)) },
              { $set: { attemptTracker: isProjectAvailable.attemptTracker } }
            );

            const attemptsRemain = 3 - (userAttempts.attempts + 1);

            return res.status(401).send({
              success: false,
              message: `Invalid password. You have ${attemptsRemain} attempt(s) left.`,
            });
          }

          isProjectAvailable.attemptTracker[userId] = {
            attempts: 0,
            lastAttempt: 0,
          };

          await projectsCollection.updateOne(
            { _id: new ObjectId(String(projId)) },
            {
              $set: {
                [`attemptTracker.${userId}`]: {
                  attempts: 0,
                  lastAttempt: null,
                },
              },
              $push: {
                members: { userId, role: "member" },
              },
            }
          );

          const userObj = await usersCollection.findOne(
            { _id: new ObjectId(String(userId)) },
            { projection: { joinedProjects: 1 } }
          );

          if (!userObj.joinedProjects || userObj.joinedProjects.length === 0) {
            await usersCollection.updateOne(
              { _id: new ObjectId(String(userId)) },
              {
                $set: {
                  joinedProjects: [{ projectId: projId, status: "active" }],
                },
              }
            );
          } else {
            const updatedJoinedProjects = userObj.joinedProjects.map(
              (project) =>
                project.status === "active"
                  ? { ...project, status: "passive" }
                  : project
            );

            updatedJoinedProjects.push({ projectId: projId, status: "active" });

            await usersCollection.updateOne(
              { _id: new ObjectId(String(userId)) },
              { $set: { joinedProjects: updatedJoinedProjects } }
            );
          }

          res.status(200).send({
            success: true,
            message: "Successfully joined the project.",
          });
        }
      } catch (err) {
        res.status(500).send({
          success: false,
          message: `Error occurred in url:/join-project ${err.message}`,
        });
        return console.error(
          `Error occurred in url:/join-project ${err.message}`
        );
      }
    });

    app.get('/invitation-info/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const response = await invitationCollection.findOne({_id: new ObjectId(id)})
        res.status(200).send(response)
      }  catch (error) {
        console.error("Error at invitation-info:", error);
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred: " + error.message,
        });
      }
    })

    app.post("/invite-members", async (req, res) => {
      const invitationInfo = req.body;
      // if (invitationInfo.length ===0) {
      //   res.status(404).send({success: false, message: "Please enter an email address."})
      // }
      try {
        const response = await invitationCollection.insertMany(invitationInfo);
        if (response.insertedCount > 0) {
          res
            .status(200)
            .send({ success: true, insertedIds: response.insertedIds });
        } else {
          res
            .status(400)
            .send({
              success: false,
              message: "There was an error inviting members. Please try again.",
            });
        }
      } catch (error) {
        console.error("Error occurred in route: /invite-members");
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred: " + error.message,
        });
      }
    });

    app.get("/getTasksInit/:taskId", async (req, res) => {
      const taskId = req.params.taskId.trim();

      try {
        // Validate taskId
        if (!taskId || !ObjectId.isValid(taskId)) {
          return console.log("No taskId provided.");
        }

        const result = await projectTasksCollection.findOne({
          _id: new ObjectId(taskId),
        });

        if (result) {
          return res.status(200).send(result);
        } else {
          return res.status(404).send({ error: "Task not found" });
        }
      } catch (error) {
        console.error("Error fetching task:", error);
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred: " + error.message,
        });
      }
    });

    app.patch("/updateProject/:projectId", async (req, res) => {
      const projectId = req.params.projectId;
      const body = req.body;
      try {
        const update = await projectsCollection.updateOne(
          { _id: new ObjectId(projectId) },
          { $set: body }
        );

        if (update.modifiedCount > 0) {
          res
            .status(200)
            .send({ success: true, message: "Project updated successfully" });
        } else {
          res.status(404).send({
            success: false,
            message: "Project not found or no changes made",
          });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    app.get("/getProject/:projectId", async (req, res) => {
      const projectId = req.params.projectId;
      try {
        const result = await projectsCollection.findOne({
          _id: new ObjectId(projectId),
        });
        res.status(200).send(result);
      } catch (error) {
        console.error(error.message);
        res.status(500).send({ success: false, error: error.message });
      }
    });

    app.get("/getProjects", async (req, res) => {
      const result = await projectsCollection.find().toArray();
      res.status(200).send(result);
    });

    // Task API endpoints
    app.post("/createTasks/:taskInitId", async (req, res) => {
      const taskInitId = req.params.taskInitId;
      try {
        const task = req.body;
        const taskCreated = await tasksCollection.insertOne(task);
        if (taskCreated.acknowledged) {
          const updateTaskInit = await projectTasksCollection.updateOne(
            { _id: new ObjectId(taskInitId) },
            { $addToSet: { allTasks: taskCreated.insertedId } }
          );

          // console.log("project id", taskInitId);
          // console.log("task create", taskCreated);
          // console.log("project update", updateTaskInit);
          if (updateTaskInit.modifiedCount > 0) {
            res.status(200).send({
              success: true,
              message: "Task has been Created successfully.",
            });
          }
        }
      } catch (error) {
        res.status(500).send("Error creating task: " + error.message);
      }
    });

    app.patch("/updateTaskStatus/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });

        if (!task) {
          return res.status(404).send({ message: "Task is not found" });
        }

        let newStatus;
        if (task.status === "pending") {
          newStatus = "in-progress";
        } else if (task.status === "in-progress") {
          newStatus = "completed";
        } else if (task.status === "completed") {
          return res.status(200).send({ message: "Task is already complete" });
        }

        const updateFields = {
          status: newStatus,
        };

        if (newStatus === "complete") {
          updateFields.completeDate = new Date();
        }

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
          return res.status(200).send({
            success: true,
            message:
              newStatus === "in-progress"
                ? "Task is now in progress"
                : "Task is now completed",
            taskId: id,
            updatedStatus: newStatus,
          });
        } else {
          return res
            .status(500)
            .send({ message: "Failed to update task status" });
        }
      } catch (error) {
        return res
          .status(500)
          .send({ message: "An error occurred", error: error.message });
      }
    });

    app.get("/tasks", async (req, res) => {
      const result = await tasksCollection.find().toArray();
      res.send(result);
    });

    app.get("/allTasks", async (req, res) => {
      const allTasksIdStr = req.query.ids; // Extract the comma-separated string from the query

      if (!allTasksIdStr) {
        return res.status(400).send([]);
      }

      const allTasksIdArr = allTasksIdStr
        .split(",")
        .map((id) => {
          if (!ObjectId.isValid(id)) {
            console.error(`Invalid ID: ${id}`);
            return null;
          }
          return new ObjectId(String(id));
        })
        .filter((id) => id !== null);

      if (allTasksIdArr.length === 0) {
        return res.status(400).send({
          success: false,
          message: "No valid task IDs provided.",
        });
      }

      try {
        // Fetch tasks matching the provided IDs
        const tasks = await tasksCollection
          .find({ _id: { $in: allTasksIdArr } })
          .toArray();

        // Respond with the fetched tasks
        return res.status(200).send(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error.message);
        return res.status(500).send({
          message: "An error occurred while fetching tasks.",
          error: error.message,
        });
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
