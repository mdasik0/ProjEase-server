const express = require("express");
const { ObjectId } = require("mongodb");

const { verifyAccessToken } = require("../utils/jwtUtils");

const invitationRoute = (db) => {
  const router = express.Router();
  // db collection
  const invitationCollection = db.collection("invitations");
  // API routes
  router.get("/invitation-info/:id", async (req, res) => {
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

  router.post("/invite-members", verifyAccessToken, async (req, res) => {
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
  return router;
};

module.exports = invitationRoute;
