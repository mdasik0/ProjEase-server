const { Server } = require("socket.io");

const users = {};
const groups = {};

module.exports = (server, db) => {
  const messageCollection = db.collection("messages");

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    // Register a user
    socket.on("register", (userData) => {
      const { userId } = userData;
      if (users[userId]) {
        users[userId].socket = socket.id; 
        socket.emit("registerResponse", {
          success: true,
          message: `User ${userId} reconnected successfully.`,
        });
      } else {
        users[userId] = { socket: socket.id, ...userData };
        socket.emit("registerResponse", {
          success: true,
          message: `User ${userId} registered successfully.`,
        });
      }
      console.log(users);
    });

    // Join a group
    socket.on("joinGroup", (groupId) => {
      if (!groupId || typeof groupId !== "string" || groupId.trim() === "") {
        socket.emit("error", { message: "Invalid group ID." });
        return;
      }

      const userId = Object.keys(users).find(
        (key) => users[key].socket === socket.id
      );
      if (!userId) {
        socket.emit("error", { message: "You must register before joining a group." });
        return;
      }

      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      if (!groups[groupId].includes(socket.id)) {
        groups[groupId].push(socket.id);
      }

      console.log(`${socket.id} joined group: ${groupId}`, groups);

      socket.join(groupId);

      socket.emit("groupJoinResponse", {
        success: true,
        groupId,
        message: `You joined group: ${groupId}`,
      });
    });

    // Send a group message
    socket.on("groupMessage", async ({ groupId, message }) => {
      if (!groupId || !message) {
        socket.emit("error", {
          message: "Group name and message are required.",
        });
        return;
      }

      const userId = Object.keys(users).find(
        (key) => users[key].socket === socket.id
      );
      if (!userId) {
        socket.emit("error", { message: "You must register to send messages." });
        return;
      }

      const { socket: _, ...userWithoutSocket } = users[userId];

      const messageObject = {
        sender: userWithoutSocket, // Sender object without the 'socket' property
        msgObj: message,
      };

      try {
        await messageCollection.insertOne(messageObject);
        io.to(groupId).emit("groupMessageReceived", messageObject);
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("error", { message: "Failed to send message." });
      }

      console.log(`Message from ${socket.id} to group ${groupId}: ${message}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      const userId = Object.keys(users).find(
        (key) => users[key].socket === socket.id
      );
      if (userId) delete users[userId];

      for (const groupId in groups) {
        groups[groupId] = groups[groupId].filter((id) => id !== socket.id);
        if (groups[groupId].length === 0) delete groups[groupId];
      }

      console.log("User disconnected", socket.id);
    });

    // Error logging
    socket.on("error", (error) => {
      console.error("Socket Error:", error.message);
    });
  });
};
