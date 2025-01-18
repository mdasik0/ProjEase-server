const express = require("express");
const { ObjectId } = require("mongodb");

const messagesRoutes = (db) => {
  const router = express.Router();

  //collections
  const messageCollection = db.collection("messages");
  const chatGroupCollection = db.collection("chat-group");

  router.get("/unseenMessageCount/:projectId/:userId", async (req, res) => {
    const { projectId, userId } = req.params;
    console.log("🚀 ~ router.get ~ userId:", userId)
    console.log("🚀 ~ router.get ~ projectId:", projectId)

  
    try {
      // Fetch chat group document based on projectId
      const response = await chatGroupCollection.findOne({
        projectId: new ObjectId(String(projectId)),
      });
  
      if (!response) {
        return res.status(404).send({ message: "Chat group not found" });
      }
  
        const userUnseenMessageCount =
    response?.unseenMessageCount && userId in response.unseenMessageCount
      ? response.unseenMessageCount[userId]
      : null;
  
      res.status(200).send({ unseenCount: userUnseenMessageCount });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Server error" });
    }
  });
  

  router.get("/chat-group/:projectId", async (req, res) => {
    const projectId = req.params.projectId;
    try {
      const response = await chatGroupCollection.findOne({
        projectId: new ObjectId(String(projectId)),
      });
      res.status(200).send(response);
    } catch (error) {
      res
        .status(404)
        .send("error occurred in chat-group route: ", error.message);
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
