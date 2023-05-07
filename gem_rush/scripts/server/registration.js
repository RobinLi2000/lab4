const Registration = (function() {
    // This function sends a register request to the server
    // * `username`  - The username for the sign-in
    // * `avatar`    - The avatar of the user
    // * `name`      - The name of the user
    // * `password`  - The password of the user
    // * `onSuccess` - This is a callback function to be called when the
    //                 request is successful in this form `onSuccess()`
    // * `onError`   - This is a callback function to be called when the
    //                 request fails in this form `onError(error)`
    const register = function(username, name, password, onSuccess, onError) {
        // Preparing the user data
        //

        const status = 0;
        const elo = 0;
        const frd_list = [];

        const json = JSON.stringify({username, name, password, status, elo, frd_list})
        console.log("JSON: ", json);
 
        // Sending the AJAX request to the server
        //
        fetch("/register", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: json
        })
            .then((res) => res.json() )
            .then((json) => {
                if(json.status == "error"){
                    if(onError) onError(json.error);
                }else{
                    if(onSuccess) onSuccess();
                }
            })
            .catch((err) => {
                if(onError) onError(err);
        });

        // Processing any error returned by the server
    
        // Handling the success response from the server
    };

    return { register };
})();