const express = require("express");
const { ObjectId } = require("mongodb");
const { generateAccessToken, verifyAccessToken, generateRefreshToken,verifyRefreshToken } = require("../utils/jwtUtils");
const userRoutes = (db) => {
  const router = express.Router();
  const usersCollection = db.collection("users");

  // social and email user creation route
  router.post("/createUser", async (req, res) => {
    try {
      const userInfo = req.body;

      const userAlreadyExists = await usersCollection.findOne({
        email: userInfo.email,
      });

      // Generate JWT token
      const token = generateAccessToken({ email: userInfo.email });
      const refreshToken = generateRefreshToken({ email: userInfo.email });

      if (userAlreadyExists && userInfo.login_method === "google") {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true, // only true in HTTPS production
          sameSite: "lax", // must NOT be "none" without secure
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({
          success: false,
          message: `Welcome back ${userAlreadyExists.name.firstname} ${userAlreadyExists.name.lastname}`,
          userNameExists: userAlreadyExists.name,
          userImageExists: userAlreadyExists.image,
          token, // send token even if user already exists
        });
      } else if (userAlreadyExists && userInfo.login_method === "email") {
        return res.status(200).json({
          success: false,
          message: "User already exists",
        });
      }

      const result = await usersCollection.insertOne(userInfo);
      if (result.acknowledged) {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true, // only true in HTTPS production
          sameSite: "lax", // must NOT be "none" without secure
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        
        return res.status(201).json({
          success: true,
          message: "User created successfully",
          userImageExists: null,
          userNameExists: null,
          token, // send token
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to create user",
        });
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
  router.get("/get-all-users", verifyAccessToken, async (req, res) => {
    try {
      const result = await usersCollection.find().toArray();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  });

  router.get("/getUser/:email",verifyAccessToken, async (req, res) => {
    try {
      const email = req.params.email;
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

  router.get("/getMultUsers", verifyAccessToken, async (req, res) => {
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
  router.get("/emailLogin/:email",  async (req, res) => {
    try {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });

      const token = generateAccessToken({email: email})
      const refreshToken = generateRefreshToken({email: email})

      
      if (result) {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: false, // only true in HTTPS production
          sameSite: "lax", // must NOT be "none" without secure
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        
       return res.status(200).send({
          success: true,
          method: "email-login",
          message: result.name
            ? `Welcome Back ${result.name.firstname} ${result.name.lastname}`
            : "Welcome back! Complete your profile to unlock the full experience.",
          userImageExists: result.image,
          userNameExists: result.name,
          token: token
        });
      } else {
        return res.status(404).json({ success: false, message: "User not found" });
      }
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, error: "Error fetching user data" });
    }
  });

  router.patch("/updateProfilePicture/:id",verifyAccessToken, async (req, res) => {
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

  router.patch("/updateUser/:id",verifyAccessToken, async (req, res) => {
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
  router.patch("/updateName/:id",verifyAccessToken, async (req, res) => {
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

  router.patch("/users/:id/joined-projects", verifyAccessToken, async (req, res) => {
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

  router.patch("/switch-project-status", verifyAccessToken, async (req, res) => {
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

      res
        .status(200)
        .json({ success: true, message: "Project status updated", result });
    } catch (error) {
      console.error("Error switching project status:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  router.patch("/change-online-status/:id", verifyAccessToken, async (req, res) => {
    const userId = req.params.id;
    const status = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: "Missing userId or status" });
    }

    try {
      const response = await usersCollection.updateOne({_id: new ObjectId(String(userId)) }, { $set: { onlineStatus: status.status } });
      if (response.modifiedCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(200).json({ success: true, message: "Online status updated" });
    } catch (error) {
      console.error("Error changing online status:", error);
      res.status(500).json({ error: "Internal Server Error" });
      
    }
  })

  router.post("/refresh-token", async (req, res) => {
    const refreshToken = req.cookies.refreshToken; 
  
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }
  
    const decoded = verifyRefreshToken(refreshToken);
  
    if (!decoded) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
  
    const newAccessToken = generateAccessToken({ email: decoded.email })
  
    return res.json({ accessToken: newAccessToken });
  });

  router.delete("/remove-refresh-token", async (req, res) => {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
    return res.status(200).json({ message: "Refresh token removed" });
  })
  return router;
};

module.exports = userRoutes;
