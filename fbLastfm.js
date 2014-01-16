//http://stackoverflow.com/a/8235011/1612721
var FB = require('fb');
var fs = require('fs');
var request = require('request');
var beautify = require('js-beautify').js_beautify
var redis = require('./redis.js');
var settings = require('./settings.js');
var lastFM = require('./lastfm.js');
var userToken = settings.facebook.userAccessToken;

module.exports.start = function() {
	_getMessage(function (error, messageData) {
		if(error) {
			console.log(error);
			return;
		}
		if(messageData) {
			switch(messageData.type) {
				case 'registration':
					_register(messageData);
				break;
				default:
					_messageUser(messageData.messageID, 'Invalid command, please try another.', messageData.pageAccessToken);
				break;
			}
		}
 	});
};

var _parseRegisterMessage = function (message, callback) {
	var messageArray = message.split(' ');
	var username = messageArray[1];
	if(username === undefined || username.length === 0) {
		return callback('Missing username, please try register <Last.FM username>.');
	}
	return callback(null, username);
};

var _register = function(messageData) {
	_parseRegisterMessage(messageData.message, function (error, username) {
		if(error) {
			_messageUser(messageData.messageID, error, messageData.pageAccessToken);
			return;
		}
		lastFM.getInfo(username, function (error, userInfo) {
			if(error) {
				_messageUser(messageData.messageID, error.message, messageData.pageAccessToken);
				return;		
			}
			// Check if user exists
			redis.read('lastfmUser:' + messageData.fromID, function (error, oldUser) {
				if(error) {
					console.log('Error reading to redis');
					console.log(error);
					_messageUser(messageData.messageID, 'There was an issue registering, please try again later.', messageData.pageAccessToken);
					return;
				}
				if(oldUser) {
					_messageUser(messageData.messageID, 'User already exists.', messageData.pageAccessToken);
					return;
				}
				var lastfmUser = {
					id: 'lastfmUser:' + messageData.fromID,
					messageID: messageData.messageID,
					fromName: messageData.fromName,
					lastfmID: userInfo.user.id
				};
				redis.store(lastfmUser, function (error) {
					if(error) {
						console.log('Error storing to redis');
						console.log(error);
						_messageUser(messageData.messageID, 'There was an issue registering, please try again later.', messageData.pageAccessToken);
						return;
					}
					_messageUser(messageData.messageID, 'Successfully registered Last.FM username: ' + username, messageData.pageAccessToken);
				});
			});
		});
	});
};

var _getMessage = function(callback) {
	_getPageToken(function (error, pageAccessToken) {
		if(error) {
			if(error.error_subcode && error.error_subcode === 463) {
				// Need to refresh token
				_exchangeToken(userToken, function (error) {
					if(error) {
						return callback(error);
					}
				});
			} else {
				return callback(error);
			}
		}
		FB.api('/' + settings.facebook.id + '/conversations?access_token=' + pageAccessToken, function (res) {
			if(!res || res.error) {
				return callback(!res ? 'error occurred' : res.error);
			}
			var messageID, message, fromID, fromName;
			for(var dataCounter = 0; dataCounter < res.data.length; dataCounter++) {
				if(res.data[dataCounter].unread_count > 0) {
					messageID = res.data[dataCounter].id;
					// Get latest message
					message = res.data[dataCounter].messages.data[0].message;
					// Make sure we are not replying to the bot
					if(res.data[dataCounter].messages.data[0].from.id != settings.facebook.id) {// Don't use === because string vs int
						fromID = res.data[dataCounter].messages.data[0].from.id;
						fromName = res.data[dataCounter].messages.data[0].from.name;
					}
				}
			}
			if(fromID === undefined) {
				return callback();
			}
			var callbackMessage = {
				messageID: messageID,
				message: message,
				fromID: fromID,
				pageAccessToken: pageAccessToken,
				type: _getMessageType(message)
			};
			return callback(null, callbackMessage);
		});
	});
};

var _getPageToken = function(callback) {
	FB.api('/me/accounts?access_token=' + userToken, function (res) {
		if(!res || res.error) {
			return callback(!res ? 'error occurred' : res.error);
		}
		for(var dataCounter = 0; dataCounter < res.data.length; dataCounter++) {
			if(res.data[dataCounter].id == settings.facebook.id) {// Don't use === because string vs int
				return callback(null, res.data[dataCounter].access_token);
			}
		}
		return callback('Missing page access token.');
	});
};

var _exchangeToken = function(oldToken, callback) {
	FB.api('/oauth/access_token?grant_type=fb_exchange_token&client_id=' + settings.facebook.clientID + '&client_secret=' + settings.facebook.clientSecret + '&fb_exchange_token=' + oldToken, function (res) {
		if(!res || res.error) {
			return callback(!res ? 'error occurred' : res.error);
		}
		settings.facebook.userAccessToken = res.access_token;
		fs.writeFile('settings.js', beautify('module.exports = ' + JSON.stringify(settings), { indent_size: 4 }), function (error) {
			if(error) {
				return callback(error);
			}
			return callback();
		});
	});
};

// Checks to make sure the message coming in is a specific command we recognize
var _getMessageType = function(message) {
	if(message.toLowerCase().indexOf('register') !== -1) {
		return 'registration';
	}
};

var _messageUser = function (messageID, message, pageAccessToken) {
	FB.api('/' + messageID + '/messages?access_token=' + pageAccessToken, 'post', {message: message}, function (res) {
		if(!res || res.error) {
			console.log(!res ? 'error occurred' : res.error);
			return;
		}
	});
};

var _untrack = function() {

};