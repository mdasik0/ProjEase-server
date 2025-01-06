const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");

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
      const { projId, password, userId, invited } = req.body;
      try {
        const projObjectId = new ObjectId(String(projId));
        // check does project exists
        const isProjectAvailable = await projectsCollection.findOne(
          { _id: projObjectId },
          {
            projection: {
              projectPassword: 1,
              attemptTracker: 1,
              members: 1,
              isPrivate: 1,
            },
          }
        );
        // if project do not exists
        if (!isProjectAvailable) {
          return res
            .status(404)
            .send({ success: false, message: "Project do not exist." });
        } else {
          // if project exists check password and how many times attampted to join the project.
          const { projectPassword, attemptTracker } = isProjectAvailable;
          // if no attempt tracker create a new one
          if (!attemptTracker || !attemptTracker[userId]) {
            isProjectAvailable.attemptTracker = {
              ...attemptTracker,
              [userId]: { attempts: 0, lastAttempt: null },
            };
          }
          // if attempt tracker exists then check the attempts
          const userAttempts = isProjectAvailable.attemptTracker[userId];
          const currentTime = Date.now();
          // check if they already have an temporary ban or not
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

          isProjectAvailable.attemptTracker[userId] = {
            attempts: 0,
            lastAttempt: 0,
          };

          //? password validation condition start

          if (invited && !isProjectAvailable.isPrivate) {
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
            isProjectAvailable.attemptTracker[userId] = {
              attempts: 0,
              lastAttempt: null,
            };
          } else if ((invited && isProjectAvailable.isPrivate) || !invited) {
            // if entered password and project password do not match increase the attempt tracker
            if (!passMatch) {
              //TODO: changes here
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
            } else {
              // if password matches current project password then reset attempt tracker and add a new member to the project
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

              isProjectAvailable.attemptTracker[userId] = {
                attempts: 0,
                lastAttempt: null,
              };
            }
          }
          //? password validation condition ends

          //? user collection update start
          // find the current user info so you can update the joined projects
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

            // add a new joined project to the user
            await usersCollection.updateOne(
              { _id: new ObjectId(String(userId)) },
              { $set: { joinedProjects: updatedJoinedProjects } }
            );
          }
          //? user collection update ends

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

    app.get("/invitation-info/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const response = await invitationCollection.findOne({
          _id: new ObjectId(id),
        });
        res.status(200).send(response);
      } catch (error) {
        console.error("Error at invitation-info:", error);
        return res.status(500).send({
          success: false,
          message: "An unexpected error occurred: " + error.message,
        });
      }
    });

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
          res.status(400).send({
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
