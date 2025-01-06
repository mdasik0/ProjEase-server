const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const projectRoutes = require("./routes/projectRoutes");

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

    
    //Create project api endpoints
    

    

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
