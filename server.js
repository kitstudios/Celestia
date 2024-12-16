//Celestia API

const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false
});
const bcrypt = require('bcrypt');
const saltRounds = 10;

fastify.register(require("@fastify/formbody"));

// Register CORS plugin
fastify.register(require("@fastify/cors"), {
  origin: "*",
  methods: ["GET", "PUT", "POST", "DELETE"]
});

const db = require("./sqlite.js");
const errorMessage = "Whoops! Error connecting to the database–please try again!";

// OnRoute hook to list endpoints
const routes = { endpoints: [] };
fastify.addHook("onRoute", routeOptions => {
  routes.endpoints.push(routeOptions.method + " " + routeOptions.path);
});

// Just send some info at the home route
fastify.get("/api", (request, reply) => {
  const data = {
    title: "Hello SQLite (blank)",
    intro: "This is a database-backed API with the following endpoints",
    routes: routes.endpoints
  };
  reply.status(200).send(data);
});

// Register new user
fastify.post("/api/register", async (request, reply) => {
  const { username, password, email } = request.body;
  let data = {};

  if (!username || !password || !email) {
    data.success = false;
    return reply.status(400).send(data);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    data.success = await db.addUser(username, hashedPassword, email);
    return reply.status(data.success ? 201 : 400).send(data);
  } catch (error) {
    console.error(error);
    data.success = false;
    return reply.status(500).send(data);
  }
});


// Login user
fastify.post("/api/login", async (request, reply) => {
  const { username, password } = request.body;
  let data = {};

  if (!username || !password) {
    data.success = false;
    return reply.status(400).send(data);
  }

  try {
    const user = await db.getUserByUsername(username);
    if (user && await bcrypt.compare(password, user.password)) {
      data.success = true;
      data.userId = user.id;
      data.nameofuser = user.username;
      return reply.status(200).send(data);
    } else {
      data.success = false;
      return reply.status(401).send(data);
    }
  } catch (error) {
    console.error(error);
    data.success = false;
    return reply.status(500).send(data);
  }
});


// Return the chat messages from the database helper script - no auth
fastify.get("/api/messages", async (request, reply) => {
  let data = {};
  data.chat = await db.getMessages();
  console.log(data.chat);
  if (!data.chat) data.error = errorMessage;
  const status = data.error ? 400 : 200;
  reply.status(status).send(data);
});

// Add new message (auth)
fastify.post("/api/message", async (request, reply) => {
  let data = {};
  const userId = request.body.userId; // Get userId from the request body
  if (!userId || !request.body || !request.body.message) {
    data.success = false;
    reply.status(400).send(data);
  } else {
    data.success = await db.addMessage(request.body.message, userId); // Pass userId to the database function
    const status = data.success ? 201 : 400;
    reply.status(status).send(data);
  }
});

// Update text for a message (auth)
fastify.put("/api/message", async (request, reply) => { 
  let data = {};
  const userId = request.body.userId; // Get userId from the request body
  if (!userId || !request.body || !request.body.id || !request.body.message || !request.body.userId) data.success = false;
  else data.success = await db.updateMessage(request.body.id, request.body.userId, request.body.message);
  const status = data.success ? 201 : userId ? 400 : 401;
  reply.status(status).send(data);
});

// Delete a message (auth)
fastify.delete("/api/message", async (request, reply) => {
  let data = {};
  const userId = request.body.userId; // Get userId from the request body
  const messageId = request.body.id; // Get messageId from the request body

  if (!userId || !messageId) {
    data.success = false;
    reply.status(400).send(data);
  } else {
    try {
      const message = await db.getMessageById(messageId); // Fetch the message to check ownership
      if (message && message.userId === parseInt(userId)) { // Check if the user owns the message
        data.success = await db.deleteMessage(messageId);
        const status = data.success ? 201 : 400;
        reply.status(status).send(data);
      } else {
        reply.status(403).send({ success: false, error: "You do not have permission to delete this message." });
      }
    } catch (err) {
      reply.status(500).send({ success: false, error: "Internal Server Error" });
    }
  }
});





// Get all users (no auth)
fastify.get("/api/users", async (request, reply) => {
  let data = {};
  data.users = await db.getUsers();
  console.log(data.users);
  if (!data.users) data.error = errorMessage;
  const status = data.error ? 400 : 200;
  reply.status(status).send(data);
});

// Update user information (auth)
fastify.put("/api/user", async (request, reply) => { 
  let data = {};
  const auth = authorized(request.headers.admin_key);
  if (!auth || !request.body || !request.body.id || !request.body.username || !request.body.password || !request.body.email) data.success = false;
  else data.success = await db.updateUser(request.body.id, request.body.username, request.body.password, request.body.email); 
  const status = data.success ? 201 : auth ? 400 : 401;
  reply.status(status).send(data);
});

// Delete a user (auth)
fastify.delete("/api/user", async (request, reply) => {
  let data = {};
  const auth = authorized(request.headers.admin_key);
  if (!auth || !request.query || !request.query.id) data.success = false;
  else data.success = await db.deleteUser(request.query.id);
  const status = data.success ? 201 : auth ? 400 : 401;
  reply.status(status).send(data);
});

// Helper function to authenticate the user key
const authorized = key => {
  if (!key || key < 1 || !process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY)
    return false;
  else return true;
};

// Run the server and report out to the logs
fastify.listen({ port: process.env.PORT, host: '0.0.0.0' }, function(err, address) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
});
