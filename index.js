const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

// MongoDB connection
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

mongoose.connect(
  process.env["MONGO_URI"],
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(
      `MongoDB connected to database: ${mongoose.connection.db.databaseName}`
    );
  }
);

// Users model
const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    exercises: {
      type: [Object],
    },
  },
  {
    versionKey: false,
  }
);

const User = mongoose.model("User", userSchema);

app.use(cors());
app.use(express.static("public"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Main /api endpoint
app.get("/api", (_, res) => {
  res.json({ msg: "GET API route endpoint!" });
});

// Reset users collection
app.delete("/api/users/reset", async (_, res) => {
  await User.deleteMany();
  res.json({ msg: "users collection reset success" });
});

// User checker
const userCheck = async (req, res, next) => {
  const ObjectId = mongoose.Types.ObjectId;
  const { _id } = req.params;
  if (!ObjectId.isValid(_id)) {
    return res.status(400).json({ error: "Invalid user" });
  }
  const user = await User.findOne({ _id });
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }
  req.user = {
    _id,
    username: user.username,
  };
  next();
};

// Get all users
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// create user
app.post("/api/users", async (req, res) => {
  const { username } = req.body;
  const checkDuplicate = await User.findOne({ username });
  if (checkDuplicate) {
    return res.status(400).json({ error: "Username not available" });
  }
  const newUser = await User.create({ username });
  const response = { _id: newUser._id, username };
  res.json(response);
});

// create exercise
app.post("/api/users/:_id/exercises", userCheck, async (req, res) => {
  if (!req.params._id) {
    return res.status(400).json({
      error: "Invalid _id",
    });
  }
  const { _id } = req.user;
  const { description, duration } = req.body;

  if (!description || !duration) {
    return res.status(400).json({
      error: "Please fill in description and duration fields",
    });
  }

  const date = req.body.date
    ? new Date(req.body.date).toDateString()
    : new Date().toDateString();

  const exercise = {
    description,
    duration: Number(duration),
    date,
  };

  const updated = await User.findByIdAndUpdate(_id, {
    $push: { exercises: exercise },
  });
  const response = {
    _id: updated._id,
    username: updated.username,
    ...exercise,
  };
  res.json(response);
});

// get logs from user
app.get("/api/users/:_id/logs", userCheck, async (req, res) => {
  const { _id, username } = req.user;
  const { from, to, limit } = req.query;

  const fromTime = new Date(from).getTime(),
    toTime = new Date(to).getTime();

  const user = await User.findById(_id);

  const logs = !user._doc.exercises.length
    ? []
    : !from || !to
    ? user._doc.exercises
    : user._doc.exercises.filter(
        (l) =>
          new Date(l.date).getTime() > fromTime &&
          new Date(l.date).getTime() < toTime
      );

  const limitedLogs = !limit ? logs : logs.slice(0, limit);
  const response = {
    username,
    count: limitedLogs.length,
    _id,
    log: limitedLogs,
  };
  res.json(response);
});

const listener = app.listen(process.env["PORT"] || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
