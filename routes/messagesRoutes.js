const { ObjectId } = require("bson");
const express = require("express");
// const { ObjectId } = require("mongodb");

const messagesRoutes = (db) => {
  const router = express.Router();

  //collections
  const messageCollection = db.collection("messages");
  const chatGroupCollection = db.collection("chat-group");
  const projectsCollection = db.collection("projects");

  router.post("/chat-group", async (req, res) => {
    const chatGroupInfo = req.body;
    const projectId = chatGroupInfo.projectId;
  
    try {
      if (!chatGroupInfo || Object.keys(chatGroupInfo).length === 0) {
        return res
          .status(400)
          .send({ success: false, message: "Request body cannot be empty." });
      }
      if (!projectId || !ObjectId.isValid(projectId)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid or missing projectId." });
      }
      const response = await chatGroupCollection.insertOne(chatGroupInfo);
  
      if (!response.acknowledged || !response.insertedId) {
        return res.status(500).send({
          success: false,
          message: "Failed to create chat group. Please try again.",
        });
      }
      const updateProject = await projectsCollection.updateOne(
        { _id: ObjectId(projectId) },
        { $set: { ChatId: response.insertedId } }
      );
  
      if (!updateProject.modifiedCount) {
        return res.status(500).send({
          success: false,
          message:
            "There was an error creating a chat group for this project. Try again later.",
        });
      }
      res.status(201).send({
        success: true,
        message: "Chat group created successfully.",
      });
    } catch (error) {
      console.error("Error in chat-group route:", error);
      res.status(500).send({ success: false, message: error.message });
    }
  });
  
  

  router.get("/messages/:groupId", async (req, res) => {
    const groupId = req.params.groupId;

    try {
      const messageData = await messageCollection.find().toArray();

      const filteredMessages = messageData.filter(
        (m) => m.msgObj.groupChatId === groupId
      );
      res.status(200).json(filteredMessages);
    } catch (error) {
      res.status(404).send("error occured in messages route : ", error.message);
    }
  });

  return router;
};

module.exports = messagesRoutes;
