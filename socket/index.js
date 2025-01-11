const { Server } = require("socket.io");

const users = {};
const groups = {};

module.exports = (server, db) => {

  const messageCollection = db.collection('messages');

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    socket.on("register", (userData) => {
      const { userId } = userData;
      if (users[userId]) {
        socket.emit("registerResponse", {
          success: false,
          message: `User ID ${userId} is already registered.`,
        });
        return;
      }
      users[userId] = { socket: socket.id, ...userData };
      socket.emit("registerResponse", {
        success: true,
        message: `User ${userId} registered successfully.`,
      });
      console.log(users);
    });

    socket.on("joinGroup", (groupId) => {
      if (!groupId || typeof groupId !== "string" || groupId.trim() === "") {
        socket.emit("error", { message: "Invalid group ID." });
        return;
      }
      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      groups[groupId].push(socket.id);

      console.log(`${socket.id} joined group: ${groupId}`, groups);

      socket.join(groupId);

      socket.emit("groupJoinResponse", {
        success: true,
        groupId,
        message: `You joined group: ${groupId}`,
      });
    });

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

    socket.on("disconnect", () => {
      const userId = Object.keys(users).find(
        (key) => users[key].socket === socket.id
      );
      if (userId) delete users[userId];
      console.log("User disconnected", socket.id);
    });
  });
};
