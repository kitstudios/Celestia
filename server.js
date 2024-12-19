/**
 * This is the main server script that provides the API endpoints
 *
 * Uses sqlite.js to connect to db
 */

const fastify = require('fastify')({ logger: true });


const crypto = require('crypto')
const bcrypt = require('bcrypt');
const cookie = require('@fastify/cookie')
const session = require('@fastify/session');
const saltRounds = 10;

fastify.register(require("@fastify/formbody"));

// Register CORS plugin
fastify.register(require("@fastify/cors"), {
  origin: "*",
  methods: ["GET", "PUT", "POST", "DELETE"]
});

const db = require("./sqlite.js");
const errorMessage = "Whoops! Error connecting to the database–please try again!";
const verifyUserAndToken = async (request, reply, next) => {
    const token = request.headers['authorization'];
    const userId = request.body.userId;

    if (!token) {
        return reply.status(403).send({ message: 'No token provided.' });
    }

    if (!userId) {
        return reply.status(400).send({ message: 'User ID is required.' });
    }

    try {
        const user = await db.getUserByToken(token);
        if (user && user.id === parseInt(userId)) {
            request.user = user; // Attach user object to the request for further processing
            next();
        } else {
            return reply.status(401).send({ message: 'Failed to authenticate token and user ID.' });
        }
    } catch (error) {
        console.error('Token and user ID verification error:', error);
        return reply.status(500).send({ message: 'Failed to authenticate token and user ID.' });
    }
};






// OnRoute hook to list endpoints
const routes = { endpoints: [] };
fastify.addHook("onRoute", routeOptions => {
  routes.endpoints.push(routeOptions.method + " " + routeOptions.path);
});
fastify.register(cookie);
fastify.register(session, {
  secret: process.env.ADMIN_KEY, // Change this to a secure password',
  cookie: { secure: false } // Set to true if using HTTPS
});

// Just send some info at the home route
fastify.get("/api", (request, reply) => {
  const data = {
    title: "Kit Network API",
    intro: "This is the API that directly communicates with Kit Network",
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
    data.message = 'All fields are required.';
    return reply.status(400).send(data);
  }

  try {
    const existingUserByUsername = await db.getUserByUsername(username);
    const existingUserByEmail = await db.getUserByEmail(email);

    if (existingUserByUsername) {
      data.success = false;
      data.message = 'Username already exists.';
      return reply.status(400).send(data);
    }

    if (existingUserByEmail) {
      data.success = false;
      data.message = 'Email already exists.';
      return reply.status(400).send(data);
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await db.addUser(username, hashedPassword, email);

    if (result.success) {
      const profileSuccess = await db.addProfile(result.userId, '', '');
      if (profileSuccess) {
        data.success = true;
        data.userId = result.userId; // Send back the user ID
        return reply.status(201).send(data);
      } else {
        data.success = false;
        data.message = 'Failed to create profile.';
        return reply.status(500).send(data);
      }
    } else {
      data.success = false;
      return reply.status(400).send(data);
    }
  } catch (error) {
    console.error(error);
    data.success = false;
    data.message = 'Internal Server Error.';
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
} else {
  
}

try {
  const user = await db.getUserByUsername(username);
  if (user && await bcrypt.compare(password, user.password)) {
    const token = crypto.randomBytes(16).toString('hex');
    const encryptedToken = await bcrypt.hash(token, saltRounds);
    await db.storeToken(user.id, encryptedToken);
    data.success = true;
    data.userId = user.id;
    data.nameofuser = user.username;
    data.token = token; // Send the plain token to the client
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
  try {
    data.chat = await db.getMessages();
    const status = data.chat ? 200 : 400;
    reply.status(status).send(data);
  } catch (error) {
    console.error(error);
    data.error = errorMessage;
    reply.status(500).send(data);
  }
});

fastify.post("/api/message", async (request, reply) => {
    let data = {};
    const token = request.headers['authorization'];
    const userId = request.body.userId;
    const { message } = request.body;

    if (!token) {
        console.log('No token provided'); // Debugging
        return reply.status(403).send({ message: 'No token provided.' });
    }

    if (!userId) {
        console.log('User ID is required'); // Debugging
        return reply.status(400).send({ message: 'User ID is required.' });
    }

    try {
        const user = await db.getUserByToken(token);
        if (!user || user.id !== parseInt(userId)) {
            console.log('Failed to authenticate token and user ID'); // Debugging
            return reply.status(401).send({ message: 'Failed to authenticate token and user ID.' });
        }

        const timestamp = new Date().toISOString();
        console.log('Generated timestamp:', timestamp); // Logging the timestamp

        data.success = await db.addMessage(message, userId, timestamp);
        if (data.success) {
            console.log('Add message result:', data.success); // Logging the successful result
            return reply.status(201).send(data);
        } else {
            console.error('Failed to add message'); // Logging the failure
            return reply.status(400).send(data);
        }
    } catch (error) {
        console.error('Error:', error); // Debugging
        data.success = false;
        return reply.status(500).send(data);
    }
});




fastify.put("/api/message", { preHandler: verifyUserAndToken }, async (request, reply) => {
  const { id, message } = request.body;
  const userId = request.user.id; // Use the user ID from the authenticated user
  let data = {};

  if (!id || !message) {
    data.success = false;
    return reply.status(400).send(data);
  }

  try {
    data.success = await db.updateMessage(id, userId, message);
    return reply.status(data.success ? 201 : 400).send(data);
  } catch (error) {
    console.error(error);
    data.success = false;
    return reply.status(500).send(data);
  }
});

fastify.delete("/api/message", { preHandler: verifyUserAndToken }, async (request, reply) => {
    const userId = request.body.userId; // Get userId from the request body
    const messageId = request.body.messageId; // Get messageId from the request body
    let data = {};

    if (!messageId) {
        data.success = false;
        return reply.status(400).send(data);
    }

    try {
        const message = await db.getMessageById(messageId);
        if (message && message.userId === parseInt(userId)) {
            data.success = await db.deleteMessage(messageId);
            return reply.status(data.success ? 201 : 400).send(data);
        } else {
            return reply.status(403).send({ success: false, error: "You do not have permission to delete this message." });
        }
    } catch (error) {
        return reply.status(500).send({ success: false, error: "Internal Server Error" });
    }
});





// Get all users (no auth)
fastify.get("/api/users", async (request, reply) => {
  let data = {};
  try {
    data.users = await db.getUsers();
    const status = data.users ? 200 : 400;
    reply.status(status).send(data);
  } catch (error) {
    console.error(error);
    data.error = errorMessage;
    reply.status(500).send(data);
  }
});

// Update user information (auth)
fastify.put("/api/user", async (request, reply) => {
  const { id, username, password, email } = request.body;
  let data = {};

  if (!id || !username || !password || !email) {
    data.success = false;
    return reply.status(400).send(data);
  }

  try {
    data.success = await db.updateUser(id, username, password, email);
    return reply.status(data.success ? 201 : 400).send(data);
  } catch (error) {
    console.error(error);
    data.success = false;
    return reply.status(500).send(data);
  }
});

// Delete a user (auth)
fastify.delete("/api/user", async (request, reply) => {
  const { id } = request.query;
  let data = {};

  if (!id) {
    data.success = false;
    return reply.status(400).send(data);
  }

  try {
    data.success = await db.deleteUser(id);
    return reply.status(data.success ? 201 : 400).send(data);
  } catch (error) {
    console.error(error);
    data.success = false;
    return reply.status(500).send(data);
  }
});

// Get user by ID
fastify.get("/api/user/:id", async (request, reply) => {
  const { id } = request.params;
  let data = {};

  if (!id) {
    data.success = false;
    data.message = 'User ID is required.';
    return reply.status(400).send(data);
  }

  try {
    const user = await db.getUserById(id);
    if (user) {
      data.success = true;
      data.user = user;
      return reply.status(200).send(data);
    } else {
      data.success = false;
      data.message = 'User not found.';
      return reply.status(404).send(data);
    }
  } catch (error) {
    console.error(error);
    data.success = false;
    data.message = 'Internal Server Error.';
    return reply.status(500).send(data);
  }
});
// Get user by ID
fastify.get("/api/profile/:id", async (request, reply) => {
  const { id } = request.params;
  let data = {};

  if (!id) {
    data.success = false;
    data.message = 'User ID is required.';
    return reply.status(400).send(data);
  }

  try {
    const user = await db.getProfileByUserId(id);
    if (user) {
      data.success = true;
      data.user = user;
      return reply.status(200).send(data);
    } else {
      data.success = false;
      data.message = 'User not found.';
      return reply.status(404).send(data);
    }
  } catch (error) {
    console.error(error);
    data.success = false;
    data.message = 'Internal Server Error.';
    return reply.status(500).send(data);
  }
});

// Update user profile
fastify.post("/api/profile/:id", async (request, reply) => {
const { id } = request.params;
const { bio, profilePic } = request.body;
let data = {};

if (!id) {
  data.success = false;
  data.message = 'User ID is required.';
  return reply.status(400).send(data);
}

try {
  const result = await db.updateProfile(id, bio, profilePic);
  if (result) {
    data.success = true;
    return reply.status(200).send(data);
  } else {
    data.success = false;
    data.message = 'Failed to update profile.';
    return reply.status(500).send(data);
  }
} catch (error) {
  console.error('Error updating profile:', error);
  data.success = false;
  data.message = 'Internal Server Error.';
  return reply.status(500).send(data);
}
});

const authorized = key => {
  return key && key === process.env.ADMIN_KEY;
  const adminPassword = key; // Change this to a secure password

};


// Verify Token Endpoint
fastify.post("/api/verifyToken", async (request, reply) => {
    const { userId, token } = request.body;

    if (!token) {
        return reply.status(403).send({ message: 'No token provided.' });
    }

    if (!userId) {
        return reply.status(400).send({ message: 'User ID is required.' });
    }

    try {
        const user = await db.getUserByToken(token);
        if (user && user.id === parseInt(userId)) {
            return reply.status(200).send({ success: true, message: 'Token and User ID verified successfully.' });
        } else {
            return reply.status(401).send({ success: false, message: 'Failed to authenticate token and user ID.' });
        }
    } catch (error) {
        console.error('Token and user ID verification error:', error);
        return reply.status(500).send({ success: false, message: 'Failed to authenticate token and user ID.' });
    }
});


// Helper function to authenticate the user key


// Run the server and report out to the logs
fastify.listen({ port: process.env.PORT, host: '0.0.0.0' }, function(err, address) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
});