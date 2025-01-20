const fs = require("fs");
const dbFile = "DB_FILE_LOCATION";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
const bcrypt = require('bcrypt');
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

        // Create Posts table with a foreign key to the Users table
        await db.run(
          "CREATE TABLE Posts (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, post TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES Users(id))"
        );

        // Create Profiles table with a foreign key to the Users table
        await db.run(
          "CREATE TABLE Profiles (userId INTEGER PRIMARY KEY, bio TEXT, profilePic TEXT, FOREIGN KEY(userId) REFERENCES Users(userId))"
        );
      }
      console.log(await db.all("SELECT * FROM Posts"));
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

  // Add new post
  addPost: async (post, userId, timestamp) => {
    let success = false;
    try {
      success = await db.run("INSERT INTO Posts (post, userId, timestamp) VALUES (?, ?, ?)", [
        post,
        userId,
        timestamp
      ]);
      console.log("Post added successfully:", success);
    } catch (dbError) {
      console.error("Error adding post to database:", dbError);
    }
    return success.changes > 0 ? true : false;
  },

// Update the function to get posts with profile pictures
getPosts: async () => {
  try {
    return await db.all(`
      SELECT Posts.id, Posts.post, Posts.timestamp, Users.username, Users.id as userId, Profiles.profilePic, Profiles.bio
      FROM Posts
      JOIN Users ON Posts.userId = Users.id
      LEFT JOIN Profiles ON Posts.userId = Profiles.userId
      ORDER BY Posts.timestamp DESC
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
  
    // Get user by ID
  getProfileByUserId: async (id) => {
    try {
      return await db.get("SELECT * FROM Profiles WHERE userId = ?", [id]);
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

  // Update post text
  updatePost: async (id, userId, post) => {
    try {
      const result = await db.run(
        "UPDATE Posts SET post = ? WHERE id = ? AND userId = ?",
        [post, id, userId]
      );
      return result.changes > 0;
    } catch (dbError) {
      console.error(dbError);
      return false;
    }
  },
  
  updateProfile: async (userId, bio, profilePic) => { 
    try { 
      const result = await db.run(
        "UPDATE Profiles SET bio = ?, profilePic = ? WHERE userId = ?", 
        [bio, profilePic, userId] 
      ); 
      return result.changes > 0; 
    } catch (dbError) { 
      console.error("Error updating profile:", dbError); 
      return false; 
    } 
  },

  // Get post by id
  getPostById: async (id) => {
    try {
      return await db.get("SELECT * FROM Posts WHERE id = ?", [id]);
    } catch (dbError) {
      console.error(dbError);
      return null;
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

  // Remove post
  deletePost: async (id) => {
    try {
      const result = await db.run("DELETE FROM Posts WHERE id = ?", [id]);
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
