const Socket = (function() {
    // This stores the current Socket.IO socket
    let socket = null;

    // This function gets the socket from the module
    const getSocket = function() {
        return socket;
    };

    // This function connects the server and initializes the socket
    const connect = function() {
        socket = io();

        // Wait for the socket to connect successfully
        socket.on("connect", () => {
            // Get the online user list
            socket.emit("get users");

            // Get the chatroom messages
            socket.emit("get frd request");
        });

        // Set up the users event
        socket.on("users", (onlineUsers) => {
            onlineUsers = JSON.parse(onlineUsers);

            // Show the online users
            OnlineUsersPanel.update(onlineUsers);
        });

        // Set up the add user event
        socket.on("add user", (user) => {
            user = JSON.parse(user);

            // Add the online user
            OnlineUsersPanel.addUser(user);
        });

        // Set up the remove user event
        socket.on("remove user", (user) => {
            user = JSON.parse(user);

            // Remove the online user
            OnlineUsersPanel.removeUser(user);
        });

        // socket.on("your friends", () => {
        //     currentUser = Authentication.getUser();

        //     FriendListPanel.update(currentUser);
        // });

        // socket.on("add friend", () => {

        // });

        // socket.on("remove friend", () => {

        // });

        // Set up the messages event
        socket.on("frd requests", (requests) => {
            requests = JSON.parse(requests);

            // Show the chatroom messages
            ChatPanel.update(requests);
        });
        
        // Sucessfully sent friend request
        socket.on("request sent", (user, request) => {
            request = JSON.parse(request);
            if(Authentication.getUser().username == user.username){
                $("#chat-input:text").attr('placeholder', 'Friend request was sent.');
            }else if(Authentication.getUser().username == request.content){
                ChatPanel.addRequest(request);
            }            
        });

        // Catch if username does not exist
        socket.on("user not exist", (username) => {
            $("#chat-input:text").attr('placeholder', username + ' does not exist. Try again.');
        });

        socket.on("repeated request", () => {
            $("#chat-input:text").attr('placeholder', 'Same request has been sent...');
        });

        socket.on("Stop adding yourself, you have no friends?", () => {
            $("#chat-input:text").attr('placeholder', 'Try make some friends in quick play, LOL');
        });

        socket.on("Already Friends", () => {
            $("#chat-input:text").attr('placeholder', 'How can you forget who is your friend huh?');
        });

    };

    // This function disconnects the socket from the server
    const disconnect = function() {
        socket.disconnect();
        socket = null;
    };

    // This function sends a post message event to the server
    const sendRequest = function(content) {
        if (socket && socket.connected) {
            socket.emit("send request", content);
        }
    };

    const buttonGroup = document.getElementById("chat-area");

    const buttonGroupPressed = e => { 
        const isButton = e.target.nodeName === 'BUTTON';
  
        if(!isButton) {
            return;
        }
        //console.log(`ID of <em>${e.target.innerHTML}</em> is <strong>${e.target.id}</strong>`);

        friend = e.target.id.split("_", 1);
        if(e.target.innerHTML == "+"){
            //console.log("+++");

            if (socket && socket.connected) {
                socket.emit("add friend", friend);
            }
        }else if(e.target.innerHTML == "-"){
            //console.log("---");

            if (socket && socket.connected) {
                socket.emit("remove friend", friend);
            }
        }

    };

    buttonGroup.addEventListener("click", buttonGroupPressed);

    return { getSocket, connect, disconnect, sendRequest };
})();