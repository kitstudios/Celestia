//Celestia SQLite Database config and methods
const fs = require("fs");
const dbFile = "DATABASE_FILE_LOCATION";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
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
          "CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, email TEXT)"
        );

        // Create Messages table with a foreign key to the Users table
        await db.run(
          "CREATE TABLE Messages (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, userId INTEGER, FOREIGN KEY(userId) REFERENCES Users(id))"
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
    }
  },


  // Get the messages along with usernames and user IDs
  getMessages: async () => {
    try {
      return await db.all(`
        SELECT Messages.id, Messages.message, Users.username, Users.id as userId
        FROM Messages
        JOIN Users ON Messages.userId = Users.id
      `);
    } catch (dbError) {
      console.error(dbError);
    }
  },


  // Add new message
  addMessage: async (message, userId) => {
    let success = false;
    try {
      success = await db.run("INSERT INTO Messages (message, userId) VALUES (?, ?)", [
        message,
        userId
      ]);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  },




  // Add new user
  addUser: async (username, hashedPassword, email) => {
    let success = false;
    try {
      success = await db.run(
        "INSERT INTO Users (username, password, email) VALUES (?, ?, ?)",
        [username, hashedPassword, email]
      );
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0;
  },

  // Get user by username
  getUserByUsername: async (username) => {
    try {
      return await db.get("SELECT * FROM Users WHERE username = ?", [username]);
    } catch (dbError) {
      console.error(dbError);
    }
  },



  // Update user information
  updateUser: async (id, username, password, email) => {
    let success = false;
    try {
      success = await db.run("UPDATE Users SET username = ?, password = ?, email = ? WHERE id = ?", [
        username,
        password,
        email,
        id
      ]);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  },
  
// Update message text
updateMessage: async (id, userId, message) => {
  let success = false;
  try {
    const result = await db.run(
      "UPDATE Messages SET message = ? WHERE id = ? AND userId = ?",
      message,
      id,
      userId
    );
    success = result.changes > 0;
  } catch (dbError) {
    console.error(dbError);
  }
  return success;
},

// Get message by id
getMessageById: async (id) => {
  try {
    return await db.get("SELECT * FROM Messages WHERE id = ?", id);
  } catch (dbError) {
    console.error(dbError);
  }
},

// Remove message
deleteMessage: async (id) => {
  try {
    const result = await db.run("DELETE FROM Messages WHERE id = ?", id);
    return result.changes > 0;
  } catch (dbError) {
    console.error(dbError);
    return false;
  }
},

  


  // Remove user
  deleteUser: async (id) => {
    let success = false;
    try {
      success = await db.run("DELETE FROM Users WHERE id = ?", id);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  }
};
