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
    const { username, name, password ,status, elo, frd_list} = req.body;

    // Reading the users.json file
    const users = JSON.parse(fs.readFileSync("data/users.json"));

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
    users[username] = {name, password: hash, status, elo, frd_list};

    // Saving the players.json file
    fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));

    // Sending a success response to the browser
    res.json({ status: "success" });
});

app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body;

    // Reading the players.json file
    const users = JSON.parse(fs.readFileSync("data/users.json"));

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
    req.session.user = {username, name: user.name, status: user.status, elo: user.elo, frd_list: user.frd_list};

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
    // connecting socket
    if(socket.request.session.user){
        onlineUsers[socket.request.session.user.username] = {name: socket.request.session.user.name};
        socket.emit("your friends", socket.request.session.user.frd_list[1]);
        io.emit("add user", JSON.stringify(socket.request.session.user));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    };
    // disconnected socket
    socket.on("disconnect", () => {
        delete onlineUsers[socket.request.session.user.username];
        io.emit("remove user", JSON.stringify(socket.request.session.user));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    });
    // fetch online users
    socket.on("get users", () => {
        const list = JSON.stringify(onlineUsers);
        socket.emit("users", list);
    });
    // fetch friend request
    socket.on("get frd request", () => {
        const requests = JSON.parse(fs.readFileSync("data/frd_request.json"), "utf-8");
        socket.emit("frd requests", JSON.stringify(requests));
    });
    // Validation on friend request
    socket.on("send request", (content) => {
        // sanity checking
        console.log(content);
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        // check if the username already existed
        if(!(content in users)){
            socket.emit("user not exist", content);
            return;
        }
        // friendzoning urself is illegal
        if((content.localeCompare(socket.request.session.user.username) == 0)){
            socket.emit("Stop adding yourself, you have no friends?");
            console.log("stop it");
            return;
        }
        // you guys are already FRIENDS!!!
        // for(/* let i in users[user].frd_list */){
        //     if(/* i == content */){
        //         socket.emit("Already Friends");
        //         return;
        //     }
        // }
        
        // read request folder
        const requestList = JSON.parse(fs.readFileSync("data/frd_request.json"));
        // say no to repeated friend request
        for(const frd_req of requestList){
            if((frd_req.user.username.localeCompare(socket.request.session.user.username) == 0) && 
               (frd_req.content.localeCompare(content) == 0)){
                socket.emit("repeated request");
                return;
            }
        }
        // request content
        const message = {
            user: socket.request.session.user,
            datetime: new Date(),
            content: content
        };
        // show the darn thing
        requestList.push(message);
        fs.writeFileSync("data/frd_request.json", JSON.stringify(requestList, null, "  "));
        io.emit("request sent", socket.request.session.user, JSON.stringify(message));
        //io.emit("add message", JSON.stringify(message));
    });

    socket.on("add friend", (friend) => {
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        for(let user in users){
            if(user == socket.request.session.user.username){
                console.log(users[user].frd_list);
                users[user].frd_list.push(String(friend));
                users[friend].frd_list.push(String(user));
                break;
            };
        };
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));

        // delete that specific request in frd_request.json
        // ...
    });

    socket.on("remove friend", (friend) => {

        // delete that specific request in frd_request.json
        //const requestList = JSON.parse(fs.readFileSync("data/frd_request.json"));
        // ...
    });

});

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The chat server has started...");
});