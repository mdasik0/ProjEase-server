const express = require("express");
const { ObjectId } = require("mongodb");

const projectRoutes = (db) => {
  const router = express.Router();
  // db collections
  const projectsCollection = db.collection("projects");
  const projectTasksCollection = db.collection("projectTasks");
  const chatGroupCollection = db.collection("chat-group");
  const announcementsCollection = db.collection("announcements");

  //API routes
  router.post("/project", async (req, res) => {
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

      const response = await projectsCollection.insertOne(project);
      if (response.acknowledged) {
        const taskObj = {
          projectId: response.insertedId,
          allTaskIds: [],
        };
        const chatObj = {
          projectId: response.insertedId,
          unseen: [],
          mediaFiles: [],
        };
        const taskObjInserted = await projectTasksCollection.insertOne(taskObj);
        const chatObjInserted = await chatGroupCollection.insertOne(chatObj);

        if (taskObjInserted.acknowledged && chatObjInserted.acknowledged) {
          await projectsCollection.updateOne(
            { _id: new ObjectId(String(response.insertedId)) },
            {
              $set: {
                taskId: taskObjInserted.insertedId,
                ChatId: chatObjInserted.insertedId,
              },
            }
          );
          return res.status(200).send({
            success: true,
            message: "Project was successfully created.",
            projectId: response.insertedId,
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

  router.patch("/project/:projectId", async (req, res) => {
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

  router.post("/announcement", async (req, res) => {
    const announcement = req.body;

    if (!announcement.projectId) {
      return res.status(400).send({ message: "Please Join a Project" });
    }
    if (!announcement.title || !announcement.content) {
      return res
        .status(400)
        .send({ message: "Please provide a announcement info" });
    }

    try {
      const result = await announcementsCollection.insertOne(announcement);
      if (result.acknowledged) {
        return res.status(200).send({
          success: true,
          message: "Announcement was successfully created.",
          announcementId: result.insertedId,
        });
      } else {
        return res.status(500).send({
          success: false,
          message: "There was an error creating the announcement.",
        });
      }
    } catch (error) {
      console.error("Error creating announcement:", error);
      return res.status(500).send({
        success: false,
        message: "An unexpected error occurred: " + error.message,
      });
    }
  });

  router.get("/announcement/:projectId", async (req, res) => {
    const projectId = req.params.projectId;
    try {
      const result = await announcementsCollection
        .find({ projectId })
        .toArray();
      res.status(200).send(result);
    } catch (error) {
      console.error(error.message);
      res.status(500).send({ success: false, error: error.message });
    }
  });

  router.post("/joinedProjectsInfo", async (req, res) => {
    try {
      const body = req.body; // [{ projectId, status }]
      if (!Array.isArray(body)) {
        return res.status(400).json({ error: "Invalid input format" });
      }
  
      // Extract unique project IDs
      const projectIds = [...new Set(body.map((p) => p.projectId))].map(
        (id) => new ObjectId(String(id))
      );
  
      // Fetch only _id and projectName
      const projects = await projectsCollection
        .find(
          { _id: { $in: projectIds } },
          { projection: { projectName: 1 } }
        )
        .toArray();
  
      // Map ID to name
      const idToName = {};
      projects.forEach((p) => {
        idToName[p._id.toString()] = p.projectName;
      });
  
      // Merge names into response
      const response = body.map((item) => ({
        ...item,
        name: idToName[item.projectId] || "Unknown",
      }));
  
      res.json(response);
    } catch (error) {
      console.error("Error in /joinedProjectsInfo:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  

  return router;
};

module.exports = projectRoutes;
