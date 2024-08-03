const express = require("express"); // Importing Express framework
const cors = require("cors"); // Importing CORS middleware
const mongoose = require("mongoose"); // Importing Mongoose for MongoDB interactions
const User = require("./models/User"); // Importing User model
const Post = require("./models/Post"); // Importing Post model
const bcrypt = require("bcrypt"); // Importing bcrypt for password hashing
const jwt = require("jsonwebtoken"); // Importing jsonwebtoken for creating and verifying JWT tokens
const cookieParser = require("cookie-parser"); // Importing cookie-parser for parsing cookies
const multer = require("multer"); // Importing multer for handling file uploads
const uploadMiddleware = multer({ dest: "uploads/" }); // Configuring multer to store uploaded files in "uploads/" directory
const fs = require("fs"); // Importing Node.js file system module
require("dotenv").config(); // Connect dotenv to use environment variables

const app = express(); // Creating an Express application
app.use(cors({ credentials: true, origin: "http://localhost:3000" })); // Configuring CORS to allow requests from the frontend with credentials
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cookieParser()); // Middleware to parse cookies
app.use("/uploads", express.static(__dirname + "/uploads")); // Serving static files from "uploads/" directory

// Connecting to MongoDB using Mongoose
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Handling connection events
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});

const secret = process.env.JWT_SECRET; // Secret key for signing JWT tokens

// Test route to check if the server is running
app.get("/test", async (req, res) => {
  res.json("test ok");
});

// Route to handle user registration
app.post("/register", async (req, res) => {
  const { userName, password } = req.body;
  try {
    // Generating salt and hashing password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userDoc = await User.create({ userName, password: hashedPassword });

    // Signing JWT token
    jwt.sign(
      { userId: userDoc._id, userName: userDoc.userName },
      secret,
      {},
      (err, token) => {
        if (err) {
          console.error("Error generating token:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        // Setting token as HTTP-only cookie
        res
          .cookie("token", token, { httpOnly: true, sameSite: "strict" })
          .json({ id: userDoc._id, userName: userDoc.userName });
      }
    );
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).json({ error: "Error registering user" });
  }
});

// Route to handle user login
app.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  const userDoc = await User.findOne({ userName });
  if (userDoc) {
    const isPasswordValid = await bcrypt.compare(password, userDoc.password);
    if (isPasswordValid) {
      // Signing JWT token
      jwt.sign(
        { userId: userDoc._id, userName: userDoc.userName },
        secret,
        {},
        (err, token) => {
          if (err) {
            console.error("Error generating token:", err);
            return res.status(500).json({ error: "Internal server error" });
          }
          // Setting token as HTTP-only cookie
          res.cookie("token", token).json({ id: userDoc._id, userName });
        }
      );
    } else {
      res.status(400).json({ error: "Invalid password" });
    }
  } else {
    res.status(400).json({ error: "User not found" });
  }
});

// Route to get the user's profile based on the token
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(403).json({ error: "Token is missing" });
  }
  // Verifying JWT token
  jwt.verify(token, secret, (err, info) => {
    if (err) {
      console.error("Error verifying token:", err);
      return res.status(403).json({ error: "Invalid token" });
    }
    res.json(info);
  });
});

// Route to handle user logout
app.post("/logout", (req, res) => {
  // Clearing the token cookie
  res.cookie("token", "").json("ok");
});

// Route to create a new post
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  try {
    const { title, summary, content } = req.body;
    let cover = null;

    if (!req.cookies.token) {
      throw new Error("Token is missing");
    }

    // Verifying JWT token
    jwt.verify(req.cookies.token, secret, async (err, info) => {
      if (err) {
        console.error("Error verifying token:", err);
        return res.status(403).json({ error: "Invalid token" });
      }

      // Handling file upload and renaming
      if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split(".");
        const ext = parts[parts.length - 1];
        const newPath = path + "." + ext;
        fs.renameSync(path, newPath);
        cover = newPath.replace("uploads/", ""); // Ensuring the path is relative
      }

      // Creating the post document
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover,
        author: info.userId,
      });

      res.json(postDoc);
    });
  } catch (err) {
    console.error("Error processing request:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get all posts
app.get("/post", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", "userName")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get a specific post by ID
app.get("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(404).json({ message: "Post not found" });
    }
    const postDoc = await Post.findById(id).populate("author", "userName");
    res.json(postDoc);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to update a post by ID
app.put("/post/:id", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  if (!token) {
    return res.status(403).json({ error: "Token is missing" });
  }

  // Verifying JWT token
  jwt.verify(token, secret, async (err, info) => {
    if (err) {
      console.error("Error verifying token:", err);
      return res.status(403).json({ error: "Invalid token" });
    }

    const { id } = req.params;
    const { title, summary, content } = req.body;

    try {
      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (post.author.toString() !== info.userId) {
        return res
          .status(403)
          .json({ error: "You are not the author of this post" });
      }

      // Updating the post fields
      post.title = title;
      post.summary = summary;
      post.content = content;
      if (newPath) {
        post.cover = newPath.replace("uploads/", ""); // Ensuring the path is relative
      }

      const updatedPost = await post.save();
      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Starting the server and listening on port 4000
app.listen(4000, () => {
  console.log("Server is running on http://localhost:4000");
});
