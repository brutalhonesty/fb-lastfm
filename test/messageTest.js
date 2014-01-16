var FacebookChat = require('node-facebookchat');

var fbchat = new FacebookChat({
        userId: '',
        appId: '',
        accessToken: ''
});

fbchat.addListener('authenticationError', function(e) {
	console.log('Auth error: ' + e);
});

fbchat.addListener('connected', function() {
	console.log("Sending message.");
	fbchat.sendMessage(0, 'register brutalhonesty08');
});