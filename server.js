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

// Handle the / endpoint
app.get("/", function(req, res) {
    const filePath = "gem_rush/index.html";
    res.sendFile(filePath, { root: __dirname });
});

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

// Matchmaking system
let queue = [];
const findingMatch = function(socketID){
    queue.push(socketID);
    if(queue.length >= 2){
        // The match has been found
        const player1 = queue.shift();
        const player2 = queue.shift();
        return[player1, player2];
    }
    else {
        // The match has not yet been found
        return null;
    }
};

let finalScore = [];

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
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        for(let user in users){
            if(user == socket.request.session.user.username){
                users[user].status = 1;
            }
        }
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));
        socket.emit("load friend", JSON.stringify(socket.request.session.user.frd_list));
        io.emit("add user", JSON.stringify(socket.request.session.user));
        console.log("Online Users: ");
        console.log(onlineUsers);
        console.log();
    };
    // disconnected socket
    socket.on("disconnect", () => {
        delete onlineUsers[socket.request.session.user.username];
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        for(let user in users){
            if(user == socket.request.session.user.username){
                users[user].status = 0;
            }
        }
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));
        //socket.emit("unload friend", JSON.stringify(socket.request.session.user.frd_list));
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

    // fetch friends
    socket.on("get friends", () => {
        const list = JSON.stringify(socket.request.session.user.frd_list);
        //console.log("init friend list: "+list);
        socket.emit("friends", list);
    });

    // fetch friend request
    socket.on("get frd request", () => {
        const requests = JSON.parse(fs.readFileSync("data/frd_request.json"), "utf-8");
        socket.emit("frd requests", JSON.stringify(requests));
    });
    // Validation on friend request
    socket.on("send request", (content) => {
        // sanity checking
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        // check if the username already existed
        if(!(content in users)){
            socket.emit("user not exist", content);
            return;
        }
        // friendzoning urself is illegal
        if((content.localeCompare(socket.request.session.user.username) == 0)){
            socket.emit("Stop adding yourself, you have no friends?");
            return;
        }
        // you guys are already FRIENDS!!!
        let i = 0;
        for(let user in users){
            if(users[user].frd_list[i] == content){
                socket.emit("Already Friends");
                return;
            }
            i++;
        }
        
        // read request folder
        const requestList = JSON.parse(fs.readFileSync("data/frd_request.json"));
        // say no to repeated friend request
        for(const frd_req of requestList){
            if((frd_req.name.localeCompare(socket.request.session.user.username) == 0) && 
               (frd_req.content.localeCompare(content) == 0)){
                socket.emit("repeated request");
                return;
            }
        }
        // request content
        const message = {
            name: socket.request.session.user.username,
            datetime: new Date(),
            content: content
        };
        // show the darn thing
        requestList.push(message);
        fs.writeFileSync("data/frd_request.json", JSON.stringify(requestList, null, "  "));
        io.emit("request sent", socket.request.session.user, JSON.stringify(message));
    });

    socket.on("add friend", (friend) => {
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        const requestList = JSON.parse(fs.readFileSync("data/frd_request.json"));
        for(let user in users){
            if(user == socket.request.session.user.username){
                users[user].frd_list.push(String(friend));
                users[friend].frd_list.push(String(user));
                removeByAttr(requestList, String(friend), String(user));
                removeByAttr(requestList, String(user), String(friend));
                break;
            };
        };
        fs.writeFileSync("data/frd_request.json", JSON.stringify(requestList, null, "  "));
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));
    });

    socket.on("reject friend", (friend) => {
        // delete that specific request in frd_request.json
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        const requestList = JSON.parse(fs.readFileSync("data/frd_request.json"));
        for(let user in users){
            if(user == socket.request.session.user.username){
                removeByAttr(requestList, String(friend), String(user));
                break;
            };
        };
        fs.writeFileSync("data/frd_request.json", JSON.stringify(requestList, null, "  "));
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));
    });

    // Remove Friend from friend list
    socket.on("remove friend", (friend) => {
        const users = JSON.parse(fs.readFileSync("data/users.json"));

        // Check if the friend is in the friend list
        if (!users[socket.request.session.user.username].frd_list.includes(friend)) {
            socket.emit("That user is not your friend or the user does not exist.");
            return;
        }

        // Remove the friend from caller's friend list
        const resultArray = users[socket.request.session.user.username].frd_list.filter((item) => {
            return item !== friend;
        }
        );
        users[socket.request.session.user.username].frd_list = resultArray;

        // Remove the caller from friend's friend list
        const resultArray2 = users[friend].frd_list.filter((item) => {
            return item !== socket.request.session.user.username;
        }
        );
        users[friend].frd_list = resultArray2;
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, "  "));
    }
    );

    // Matchmaking
    socket.on("finding match", () => {
        matchMakingResult = findingMatch(socket.id);
        console.log(matchMakingResult);
        if (matchMakingResult) {
            socket.to(matchMakingResult[0]).emit("join this room", socket.id);
            socket.to(matchMakingResult[1]).emit("join this room", socket.id);
            io.to(matchMakingResult[0]).emit("navigate to", "/gem_rush.html");
            io.to(matchMakingResult[1]).emit("navigate to", "/gem_rush.html");
        }
    });
    
    socket.on("game-over", (collectedGems) => {
        finalScore.push(socket.id, collectedGems);
        console.log(finalScore);
        io.to(socket.id).emit("navigate to", "/index.html");
    });

    // Matchmaking client side code
    // Please add this to the client side
    // Debug might be needed
// =============================================================
    // Client-side code
    // const socket = io();
    // socket.on("navigate to", (url) => {
    // window.location.href = url;
    // });
// =============================================================
});

var removeByAttr = function(arr,  sdr_value,  rec_value){
    var i = 0;
    for(const frd_req of arr){        
        if((frd_req.name.localeCompare(sdr_value) == 0) && 
           (frd_req.content.localeCompare(rec_value) == 0)){
            arr.splice(i, 1);
        }
        i++;
    }
    return arr;
}

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The chat server has started...");
});