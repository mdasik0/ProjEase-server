const express = require("express");
const { ObjectId } = require("mongodb");

const joinProjectRoute = (db) => {
  const router = express.Router();
  // db collections
  const projectsCollection = db.collection("projects");
  const usersCollection = db.collection("users");

  // join project api
  router.post("/join-project", async (req, res) => {
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
            message: "You are temporarily locked out. Try again after 3 hours.",
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
          const updatedJoinedProjects = userObj.joinedProjects.map((project) =>
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
  return router;
};

module.exports = joinProjectRoute;
