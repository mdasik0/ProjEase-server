const express = require("express");
const { ObjectId } = require("mongodb");

const projectRoutes = (db) => {
  const router = express.Router();
  // db collections
  const projectsCollection = db.collection("projects");
  const projectTasksCollection = db.collection("projectTasks");

  //API routes
  router.post("/createProject", async (req, res) => {
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
        const taskObjInserted = await projectTasksCollection.insertOne(taskObj);

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

  router.get("/get-all-projects", async (req, res) => {
    const result = await projectsCollection.find().toArray();
    res.send(result);
  });

  router.patch("/updateProject/:projectId", async (req, res) => {
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

  router.get("/getProject/:projectId", async (req, res) => {
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

  return router;
};

module.exports = projectRoutes;
