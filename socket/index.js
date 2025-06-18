const { Server } = require("socket.io");
const { ObjectId } = require("mongodb");

const users = {};
const groups = {};

module.exports = (server, db) => {
  const messageCollection = db.collection("messages");
  const chatGroupCollection = db.collection("chat-group");

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN_URL,
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
  });

  
  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    // Register a user
    socket.on("register", async (userData) => {
      const { userId } = userData;
      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        socket.emit("error", { message: "Invalid user ID." });
        return;
      }

      if (users[userId]) {
        // Update existing user's socket ID
        users[userId].socket = socket.id;

        //resets the user's unseen message count
        await chatGroupCollection.updateOne(
          { [`unseenMessageCount.${userId}`]: { $exists: true } }, 
          { $set: { [`unseenMessageCount.${userId}`]: 0 } } 
        );

        socket.emit("registerResponse", {
          success: true,
          message: `User ${userId} reconnected successfully.`,
        });
      } else {
        // Register new user
        users[userId] = { socket: socket.id, ...userData };
        socket.emit("registerResponse", {
          success: true,
          message: `User ${userId} registered successfully.`,
        });
      }
      // console.log(users);
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
        socket.emit("error", {
          message: "You must register before joining a group.",
        });
        return;
      }

      if (!groups[groupId]) {
        groups[groupId] = [];
      }

      // Add socket to group only if not already present
      if (!groups[groupId].includes(socket.id)) {
        groups[groupId].push(socket.id);
        socket.join(groupId);

        // console.log(`${socket.id} joined group: ${groupId}`, groups);

        socket.emit("groupJoinResponse", {
          success: true,
          groupId,
          message: `You joined group: ${groupId}`,
        });
      } else {
        socket.emit("groupJoinResponse", {
          success: true,
          groupId,
          message: `You are already in group: ${groupId}`,
        });
      }
    });

    // Send a group message
    socket.on("groupMessage", async ({ groupId, message, members }) => {
      const offlineMembers = members.filter((member) => !users[member.userId]);

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
        socket.emit("error", {
          message: "You must register to send messages.",
        });
        return;
      }

      const { socket: _, ...userWithoutSocket } = users[userId];

      const messageObject = {
        sender: userWithoutSocket,
        msgObj: message,
      };

      try {
        const responseFromSendingMessage = await messageCollection.insertOne(messageObject);
        // console.log("🚀 ~ socket.on ~ responseFromSendingMessage:", responseFromSendingMessage)
        if(!responseFromSendingMessage.insertedId) {
          socket.emit("error", { message: "Failed to send message." });
        }
        io.to(groupId).emit("groupMessageReceived", {...messageObject, _id: responseFromSendingMessage.insertedId});
        
        if (offlineMembers.length > 0) {
          for (const member of offlineMembers) {
            const userField = `unseenMessageCount.${member.userId}`;

            await chatGroupCollection.updateOne(
              { _id: new ObjectId(String(groupId)) },
              {
                $inc: { [userField]: 1 },
              }
            );
          }
        }
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    socket.on('deleteMessage', async (_id) => {
      const deleteMessageResponse = await messageCollection.deleteOne({_id: new ObjectId(String(_id))})
      if(deleteMessageResponse.acknowledged){
        socket.emit('deleteMessageResponse', {success: true, message: 'Message has been deleted.'})
      }else {
        socket.emit('deleteMessageResponse',{success:false, message: 'Failed to delete this Message. Refresh and try again.'})
      }
    })

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
