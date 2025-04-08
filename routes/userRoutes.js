const express = require("express");
const { ObjectId } = require("mongodb");

const userRoutes = (db) => {
  const router = express.Router();
  const usersCollection = db.collection("users");

  // Create User Route
  router.post("/createUser", async (req, res) => {
    try {
      const userInfo = req.body;

      const userAlreadyExists = await usersCollection.findOne({
        email: userInfo.email,
      });

      if (userAlreadyExists && userInfo.login_method === "google") {
        return res.status(200).json({
          success: false,
          message: `Welcome back ${userAlreadyExists.name.firstname} ${userAlreadyExists.name.lastname}`,
          userNameExists: userAlreadyExists.name,
          userImageExists: userAlreadyExists.image,
        });
      } else if (userAlreadyExists && userInfo.login_method === "email") {
        return res
          .status(200)
          .json({ success: false, message: "User already exists" });
      }

      const result = await usersCollection.insertOne(userInfo);
      if (result.acknowledged) {
        return res.status(201).json({
          success: true,
          message: "User created successfully",
          userImageExists: null,
          userNameExists: null,
        });
      } else {
        return res
          .status(500)
          .json({ success: false, message: "Failed to create user" });
      }
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while creating the user",
        error: error.message,
      });
    }
  });

  // Get All Users Route
  router.get("/get-all-users", async (req, res) => {
    try {
      const result = await usersCollection.find().toArray();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  });

  router.get("/getUser/:email", async (req, res) => {
    try {
      const email = req.params.email;
      // Query for a single user by email
      const result = await usersCollection.findOne({ email: email });

      if (result) {
        res.status(200).send(result);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    } catch (error) {
      res.status(500).send({ message: "Server error", error: error.message });
    }
  });

  router.get("/getMultUsers", async (req, res) => {
    const userIdsArr = req.query.userIds;

    const allMembers = userIdsArr
      .split(",")
      .map((id) => {
        if (!ObjectId.isValid(id)) {
          console.error(`Invalid ID: ${id}`);
          return null;
        }
        return new ObjectId(String(id));
      })
      .filter((id) => id !== null);

    if (allMembers.length === 0) {
      return res.status(400).send({
        success: false,
        message: "No members available in this project.",
      });
    }

    // console.log(allMembers);

    try {
      // Fetch users matching the provided IDs
      const members = await usersCollection
        .find({ _id: { $in: allMembers } })
        .toArray();

      // Respond with the fetched members

      return res.status(200).send(members);
    } catch (error) {
      console.error("Error fetching members:", error.message);
      return res.status(500).send({
        message: "An error occurred while fetching tasks.",
        error: error.message,
      });
    }
  });

  // Email Login Route
  router.get("/emailLogin/:email", async (req, res) => {
    try {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });

      if (result) {
        res.status(200).send({
          success: true,
          method: "email-login",
          message: result.name
            ? `Welcome Back ${result.name.firstname} ${result.name.lastname}`
            : "Welcome back! Complete your profile to unlock the full experience.",
          userImageExists: result.image,
          userNameExists: result.name,
        });
      } else {
        res.status(404).json({ success: false, message: "User not found" });
      }
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Error fetching user data" });
    }
  });

  router.patch("/updateProfilePicture/:id", async (req, res) => {
    const id = req.params.id;
    const image = req.body;

    // console.log(image);

    try {
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { image: image?.data } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Can not update your image. Try again!",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile picture updated! You're all set!",
      });
    } catch (error) {
      return res.status(500).json({ error: "Error updating user" });
    }
  });

  router.patch("/updateUser/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body; // Exclude _id from the body

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: body }
      );
      if (result.matchedCount === 0) {
        res.status(404).send({
          success: false,
          message: "User not found. Check the user ID and try again.",
        });
      } else if (result.modifiedCount === 0) {
        res.status(400).send({
          success: false,
          message: "User data was found, but nothing was updated.",
        });
      } else {
        res.status(200).send({
          success: true,
          message: "User has been updated.",
        });
      }
    } catch (error) {
      res.send(error);
    }
  });

  // Update User Name Route
  router.patch("/updateName/:id", async (req, res) => {
    const id = req.params.id;
    const name = req.body;

    try {
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { name: name?.data } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Cannot update your name. Try again!",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Name updated! You're all set to upload your profile picture next.",
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, error: "Error updating user" });
    }
  });

  router.patch("/users/:id/joined-projects", async (req, res) => {
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

  router.patch("/switch-project-status", async (req, res) => {
    const projectId = req.query.projectId;
    const userId = req.query.userId;

    if (!projectId || !userId) {
      return res.status(400).json({ error: "Missing projectId or userId" });
    }

    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedProjects = (user.joinedProjects || []).map((project) => {
        if (project.projectId === projectId) {
          return {
            ...project,
            status: project.status === "active" ? "passive" : "active",
          };
        }
        return project;
      });

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { joinedProjects: updatedProjects } }
      );

      res.status(200).json({success: true, message: "Project status updated", result });
    } catch (error) {
      console.error("Error switching project status:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return router;
};

module.exports = userRoutes;
