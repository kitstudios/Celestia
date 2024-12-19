const fs = require("fs");
const dbFile = "./.data/kitdb4.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
const bcrypt = require('bcrypt');
const casual = require("casual");
let db;

// SQLite wrapper for async / await connections
dbWrapper
  .open({
    filename: dbFile,
    driver: sqlite3.Database
  })
  .then(async dBase => {
    db = dBase;

    try {
      if (!exists) {
        // Create Users table
        await db.run(
          "CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, email TEXT, token TEXT)"
        );

        // Create Messages table with a foreign key to the Users table
        await db.run(
          "CREATE TABLE Messages (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, message TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES Users(id))"
        );

        // Create Profiles table with a foreign key to the Users table
        await db.run(
          "CREATE TABLE Profiles (userId INTEGER PRIMARY KEY, bio TEXT, profilePic TEXT, FOREIGN KEY(userId) REFERENCES Users(userId))"
        );
      }
      console.log(await db.all("SELECT * FROM Messages"));
    } catch (dbError) {
      console.error(dbError);
    }
  });

// Server script calls these methods to connect to the db
module.exports = {
  // Get all users in the database
    getUsers: async () => {
    try {
      return await db.all("SELECT * FROM Users");
    } catch (dbError) {
      console.error(dbError);
      return [];
    }
  },


  // Add new message
  addMessage: async (message, userId, timestamp) => {
    let success = false;
    try {
      success = await db.run("INSERT INTO Messages (message, userId, timestamp) VALUES (?, ?, ?)", [
        message,
        userId,
        timestamp
      ]);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  },









  // Get all messages with timestamps
  getMessages: async () => {
    try {
      return await db.all(`
        SELECT Messages.id, Messages.message, Messages.timestamp, Users.username, Users.id as userId
        FROM Messages
        JOIN Users ON Messages.userId = Users.id
        ORDER BY Messages.timestamp DESC
      `);
    } catch (dbError) {
      console.error(dbError);
      return [];
    }
  },

  // Add new user
  addUser: async (username, hashedPassword, email) => {
    try {
      const result = await db.run(
        "INSERT INTO Users (username, password, email) VALUES (?, ?, ?)",
        [username, hashedPassword, email]
      );
      return { success: result.changes > 0, userId: result.lastID };
    } catch (dbError) {
      console.error(dbError);
      return { success: false, userId: null };
    }
  },

  // Add new profile
  addProfile: async (userId, bio, profilePic) => {
    try {
      const result = await db.run(
        "INSERT INTO Profiles (userId, bio, profilePic) VALUES (?, ?, ?)",
        [userId, bio, profilePic]
      );
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },

  // Get user by username
  getUserByUsername: async (username) => {
    try {
      return await db.get("SELECT * FROM Users WHERE username = ?", [username]);
    } catch (dbError) {
      console.error(dbError);
      return null;
    }
  },

  // Get user by email
  getUserByEmail: async (email) => {
    try {
      return await db.get("SELECT * FROM Users WHERE email = ?", [email]);
    } catch (dbError) {
      console.error(dbError);
      return null;
    }
  },

  // Get user by ID
  getUserById: async (id) => {
    try {
      return await db.get("SELECT * FROM Users WHERE id = ?", [id]);
    } catch (dbError) {
      console.error(dbError);
      return null;
    }
  },
  

  
  getUserByToken: async (token) => { 
    try { 
      const users = await db.all("SELECT * FROM Users"); 
      for (let user of users) { 
        const isMatch = await bcrypt.compare(token, user.token); 
        if (isMatch) { 
          return user; 
        } 
      } 
      return null; // No user found with the given token 
    } catch (error) { 
      console.error('Error fetching user by token:', error); 
      throw new Error('Error fetching user by token'); 
    } 
  },





  // Get profile by user ID
  getProfileByUserId: async (userId) => {
    try {
      console.log('Querying profile for userId:', userId); // Logging for debugging
      return await db.get("SELECT * FROM Profiles WHERE userId = ?", [userId]);
    } catch (dbError) {
      console.error('Database error fetching profile:', dbError);
      return null;
    }
  },

  // Update user information
  updateUser: async (id, username, password, email) => {
    try {
      const result = await db.run(
        "UPDATE Users SET username = ?, password = ?, email = ? WHERE id = ?",
        [username, password, email, id]
      );
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },

  // Update message text
  updateMessage: async (id, userId, message) => {
    try {
      const result = await db.run(
        "UPDATE Messages SET message = ? WHERE id = ? AND userId = ?",
        [message, id, userId]
      );
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },

  // Get message by id
  getMessageById: async (id) => {
    try {
      return await db.get("SELECT * FROM Messages WHERE id = ?", [id]);
    } catch (dbError) {
      console.error(dbError);
      return null;
    }
  },

  // Update user profile
  updateProfile: async (userId, bio, profilePic) => {
    try {
      const result = await db.run(
        "UPDATE Profiles SET bio = ?, profilePic = ? WHERE userId = ?",
        [bio, profilePic, userId]
      );
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },
    // Store token
    storeToken: async (userId, token) => {
        let success = false;
        try {
            const result = await db.run(
                "UPDATE Users SET token = ? WHERE id = ?",
                [token, userId]
            );
            success = result.changes > 0;
        } catch (dbError) {
            console.error(dbError);
        }
        return success;
    },

  // Remove message
  deleteMessage: async (id) => {
    try {
      const result = await db.run("DELETE FROM Messages WHERE id = ?", [id]);
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },

  // Remove user
  deleteUser: async (id) => {
    try {
      const result = await db.run("DELETE FROM Users WHERE id = ?", [id]);
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  }
};