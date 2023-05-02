const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const session = require("express-session");

// Create the Express app
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("gem_rush"));

// Use the json middleware to parse JSON data
app.use(express.json());

// Use the session middleware to maintain sessions
const gameSession = session({
    secret: "game",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 300000 }
});
app.use(gameSession);

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text);
}

// Handle the /register endpoint
app.post("/register", (req, res) => {
    // Get the JSON data from the body
    const { username, name, password } = req.body;

    // Reading the users.json file
    const users = JSON.parse(fs.readFileSync("data/users.json"));

    // Checking for the user data correctness
    if (username === "" || name === "" || password === "") {
        res.json({ status: "error", error: "Please fill in all the fields." });
        return;
    }
    // check if the username already exists
    if (username in users) {
        res.json({ status: "error", error: "Username already exists." });
        return;
    }

    // Adding the new user account
    const hash = bcrypt.hashSync(password, 10);

    // Saving the users.json file
    users[username] = {name, password: hash};

    // Sending a success response to the browser
    fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));

    res.json({ status: "success" });

    // Delete when appropriate
    // res.json({ status: "error", error: "This endpoint is not yet implemented." });
});

// Handle the /signin endpoint
app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body;

    // Reading the users.json file
    const users = JSON.parse(fs.readFileSync("data/users.json"));

    // check if the username exists
    if (!(username in users)) {
        res.json({ status: "error", error: "Username does not exist." });
        return;
    }
    // check if the password is correct
    if (!bcrypt.compareSync(password, users[username].password)) {
        res.json({ status: "error", error: "Password is incorrect." });
        return;
    }

    // Sending a success response with the user account
    req.session.user = {username, name: users[username].name};
    res.json({ status: "success", user: req.session.user });

    console.log("A user signin successfully: "+ req.session.user.username);
    console.log();
});

// Handle the /validate endpoint
app.get("/validate", (req, res) => {

    // Getting req.session.user
    if (!req.session.user) {
        res.json({ status: "error", error: "User is not logged in." });
        return;
    }

    // Sending a success response with the user account
    res.json({ status: "success", user: req.session.user });
});

// Handle the /signout endpoint
app.get("/signout", (req, res) => {

    console.log("A user called signout: " + req.session.user.username);
    console.log();

    // Deleting req.session.user
    if (req.session.user) {
        delete req.session.user;
    }
    // Sending a success response
    res.json({ status: "success" });
});

// app.get("/addFriend", (req, res) => {
//     // Getting req.session.user
//     if (!req.session.user) {
//         res.json({ status: "error", error: "User is not logged in." });
//         return;
//     }

//     // Get the JSON data from the body
//     const { username } = req.query;

//     // Reading the users.json file
//     const users = JSON.parse(fs.readFileSync("data/users.json"));

//     // check if the username exists
//     if (!(username in users)) {
//         res.json({ status: "error", error: "Username does not exist." });
//         return;
//     }

//     // check if the username is the same as the current user
//     if (username === req.session.user.username) {
//         res.json({ status: "error", error: "You cannot add yourself as a friend." });
//         return;
//     }

//     // check if the username is already a friend
//     if (username in req.session.user.friends) {
//         res.json({ status: "error", error: "This user is already your friend." });
//         return;
//     }

//     // Adding the new friend
//     req.session.user.friends[username] = users[username].name;

//     // Sending a success response to the browser
//     res.json({ status: "success" });
// });

// app.get("/removeFriend", (req, res) => {
//     // Getting req.session.user
//     if (!req.session.user) {
//         res.json({ status: "error", error: "User is not logged in." });
//         return;
//     }

//     // Get the JSON data from the body
//     const { username } = req.query;

//     // Reading the users.json file
//     const users = JSON.parse(fs.readFileSync("data/users.json"));

//     // check if the username exists
//     if (!(username in users)) {
//         res.json({ status: "error", error: "Username does not exist." });
//         return;
//     }

//     // check if the username is the same as the current user
//     if (username === req.session.user.username) {
//         res.json({ status: "error", error: "You cannot remove yourself as a friend." });
//         return;
//     }
// });

// Setting up web sockets with socket.io
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);

const onlineUsers = {};

// Use the created session
io.use((socket, next) => {
    gameSession(socket.request, {}, next);
});

io.on("connection", (socket) => {
    if (socket.request.session.user) {
        const newUser = {
            name: socket.request.session.user.name,
        };
        onlineUsers[socket.request.session.user.username] = newUser;
        io.emit("add user", JSON.stringify(newUser));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    }

    socket.on("disconnect", () => {
        delete onlineUsers[socket.request.session.user.username];
        // io.emit("remove user", socket.request.session.user.username);
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    });

    socket.on("get users", () => {
        user = JSON.stringify(onlineUsers);
        socket.emit("users", user);
    });
});

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The server has started...");
});