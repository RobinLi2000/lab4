const express = require("express");

const bcrypt = require("bcrypt");
const fs = require("fs");
const session = require("express-session");

// Create the Express app
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Use the json middleware to parse JSON data
app.use(express.json());

// Use the session middleware to maintain sessions
const chatSession = session({
    secret: "game",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 300000 }
});
app.use(chatSession);

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text);
}

// Handle the /register endpoint
app.post("/register", (req, res) => {
    // Get the JSON data from the body
    const { username, name, password ,status, high_score} = req.body;

    // Reading the users.json file
    const users = JSON.parse(fs.readFileSync("data/players.json"));

    // Checking for the user data correctness
    if (username === "" || name === "" || password === "") {
        res.json({ status: "error", error: "Please fill in all the fields." });
        return;
    }

    // check invalid input
    if(!containWordCharsOnly(username)){
        res.json({status: "error",
                  error: "Username can only contain underscores, letters or numbers."})
        return;
    }

    // check if the username already existed
    if(username in users){
        res.json({status: "error",
                  error: "Username has already been used."})
        return;
    }

    // Adding the new user account
    const hash = bcrypt.hashSync(password, 10);

    // add new user to users
    users[username] = {name, password: hash, status, high_score};

    // Saving the players.json file
    fs.writeFileSync("data/players.json", JSON.stringify(users, null, "  "));

    // Sending a success response to the browser
    res.json({ status: "success" });
});

app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password ,status, high_score} = req.body;

    // Reading the players.json file
    const users = JSON.parse(fs.readFileSync("data/players.json"));

    // Checking for username/password
    if(!(username in users)){
        res.json({status: "error",
                  error: "Incorrect Username/Password."});
        return;
    }

    const user = users[username];
    if(!bcrypt.compareSync(password, user.password)){
        res.json({status: "error",
                  error: "Incorrect Username/Password."});
        return;
    }

    //generate user session
    req.session.user = {username, name: user.name, status: user.status, high_score: user.high_score};

    // Sending a success response with the user account
    res.json({ status: "success", user: req.session.user});
});

// Handle the /validate endpoint
app.get("/validate", (req, res) => {
    // Getting req.session.user
    if(!req.session.user){
        res.json({status: "error",
                  error: "You have not signed in."});
        return;
    }

    // Sending a success response with the user account
    res.json({ status: "success", user: req.session.user});
});

// Handle the /signout endpoint
app.get("/signout", (req, res) => {
    // Deleting req.session.user
    if(req.session.user){
        delete req.session.user;
    }

    // Sending a success response
    res.json({status: "success"});
});

const{ createServer } = require("http");
const{ Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);

// Use the session in the Socket.IO server
io.use((socket, next) => {
    chatSession(socket.request, {}, next);
});
//socket.request.session.user

// The online user list
const onlineUsers = {};

io.on("connection", (socket) => {

    if(socket.request.session.user){
        onlineUsers[socket.request.session.user.username] = {name: socket.request.session.user.name};
        io.emit("add user", JSON.stringify(socket.request.session.user));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    };

    socket.on("disconnect", () => {
        
        delete onlineUsers[socket.request.session.user.username];
        io.emit("remove user", JSON.stringify(socket.request.session.user));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    });

    socket.on("get users", () => {
        const list = JSON.stringify(onlineUsers);
        socket.emit("users", list);
    });

    socket.on("send Request", (content) => {
        
        console.log(content);
        const users = JSON.parse(fs.readFileSync("data/players.json"));
        // check if the username already existed
        if(!(content in users)){
            socket.emit("user not exist", content);
            return;
        }

        const message = {
            user: socket.request.session.user,
            datetime: new Date(),
            content: content
        };

        const chatroom = JSON.parse(fs.readFileSync("data/frd_request.json"));
        chatroom.push(message);
        fs.writeFileSync("data/frd_request.json", JSON.stringify(chatroom, null, "  "));
        socket.emit("request sent");
        //io.emit("add message", JSON.stringify(message));
    });

});

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The chat server has started...");
});