const express = require("express");
const { ObjectId } = require("mongodb");
const { v4: uuidv4 } = require("uuid");

const { verifyAccessToken } = require("../utils/jwtUtils");

const taskRoutes = (db) => {
  const router = express.Router();
  const tasksCollection = db.collection("tasks");
  const projectTasksCollection = db.collection("projectTasks");

  // Create tasks
  router.post("/createTasks/:taskInitId", verifyAccessToken, async (req, res) => {
    const taskInitId = req.params.taskInitId;
    try {
      const task = req.body;
      const taskCreated = await tasksCollection.insertOne(task);
      if (taskCreated.acknowledged) {
        const updateTaskInit = await projectTasksCollection.updateOne(
          { _id: new ObjectId(taskInitId) },
          { $addToSet: { allTasks: taskCreated.insertedId } }
        );
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

  router.get("/tasks/status-summary", verifyAccessToken, async (req, res) => {
    const projectId = req.query.ids;

    // console.log("projectId", projectId);
    // console.log("projectId", projectId ? "true" : "false");
    try {
      if (!projectId) {
        return res.status(200).send([
          { name: "pending", value: 1 },
          { name: "in progress", value: 1 },
          { name: "completed", value: 1 },
        ]);
      } else {
        const tasksObjIdArr = req.query.ids
          ?.split(",")
          .map((id) => new ObjectId(String(id.trim())));
        
        const tasks = await tasksCollection.find({ _id: { $in: tasksObjIdArr } }).toArray();

        const summary = [
          { name: "pending", value: tasks.filter(t => t.status === "pending").length },
          { name: "in progress", value: tasks.filter(t => t.status === "in-progress").length },
          { name: "completed", value: tasks.filter(t => t.status === "completed").length },
        ]

        return res.status(200).send(summary);
      }
    } catch (error) {
      res
        .status(500)
        .send("Error fetching task status summary: " + error.message);
    }
  });

  // Update task status
  router.patch("/updateTaskStatus/:id", verifyAccessToken, async (req, res) => {
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

  // Get all tasks
  router.get("/tasks", verifyAccessToken, async (req, res) => {
    const result = await tasksCollection.find().toArray();
    res.send(result);
  });

  // Get all Tasks related to a project with multiple Ids
  router.get("/allTasks",verifyAccessToken, async (req, res) => {
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

  // Delete One task
  router.delete("/deleteTasks/:id",verifyAccessToken, async (req, res) => {
    const id = req.params.id;
    try {
      const result = await tasksCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 1) {
        res.status(200).send({ message: "Task has been deleted successfully" });
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

  // Add steps to a task
  router.patch("/createSteps/:id", verifyAccessToken, async (req, res) => {
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
        res.status(500).send({ message: "there was an error adding the step" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "there was an error in the step endpoint" });
    }
  });

  // complete the step within a task
  router.patch("/completeSteps/:id", verifyAccessToken, async (req, res) => {
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
        message: "there was an error in completeSteps endpoint" + error.message,
      });
    }
  });

  // delete specific step
  router.patch("/deleteSteps/:id", verifyAccessToken, async (req, res) => {
    const mainObjId = req.params.id;
    const { stepid } = req.body;
    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(mainObjId) },
      { $pull: { steps: { _id: stepid } } }
    );
    try {
      if (result.modifiedCount === 1) {
        res.status(200).send({ message: "step has been deleted successfully" });
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

  //get task init for project to fetch tasks
  router.get("/getTasksInit/:taskId", verifyAccessToken, async (req, res) => {
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

  return router;
};

module.exports = taskRoutes;
