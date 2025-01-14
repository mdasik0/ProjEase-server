const express = require("express");
const { ObjectId } = require("mongodb");

const messagesRoutes = (db) => {
  const router = express.Router();

  //collections
  const messageCollection = db.collection("messages");
  const chatGroupCollection = db.collection("chat-group");
  
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
