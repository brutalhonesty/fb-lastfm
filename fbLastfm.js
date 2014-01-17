// http://stackoverflow.com/a/8235011/1612721
var FB = require('fb');
var fs = require('fs');
var request = require('request');
var beautify = require('js-beautify').js_beautify
var redis = require('./redis.js');
var settings = require('./settings.js');
var lastFM = require('./lastfm.js');
var userToken = settings.facebook.userAccessToken;

// Main function executed to kick off the application
// Currently gets messages and returns responses if possible.
// Also gathers public mentions of the Facebook Page and (if Facebook fixes the bug), replies to the them.
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
    _getMentions(function (error, mentionArray) {
        if(error) {
            console.log(error);
            return;
        }
        for(var mentionCounter = 0; mentionCounter < mentionArray.length; mentionCounter++) {
            (function (mentionArray, mentionCounter) {
                setTimeout(function () {
                    redis.read('lastfmUser:' + mentionArray[mentionCounter].fromID, function (error, oldUser) {
                        if(error) {
                            console.log(error);
                            return;
                        }
                        var statusID = mentionArray[mentionCounter].statusID;
                        if(!oldUser) {
                            _replyStatus(statusID, 'You need to register first.');
                            return;
                        }
                        lastFM.getTracks(oldUser.lastfmName, function (error, latestTrack) {
                            if(error) {
                                _replyStatus(statusID, 'Unable to get latest track.');
                                return;
                            }
                            _replyStatus(statusID, 'Latest track: ' + latestTrack.name + ' by ' + latestTrack.artist['#text']);
                        });
                    });
                }, mentionArray * 1000);
            })(mentionArray, mentionCounter);
        }
    });
};

// Parses out the registration message
var _parseRegisterMessage = function (message, callback) {
    var messageArray = message.split(' ');
    var username = messageArray[1];
    if(username === undefined || username.length === 0) {
        return callback('Missing username, please try register <Last.FM username>.');
    }
    return callback(null, username);
};

// Registers a user with their Last.FM information
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
                    fromID: messageData.fromID,
                    messageID: messageData.messageID,
                    fromName: messageData.fromName,
                    lastfmID: userInfo.user.id,
                    lastfmName: userInfo.user.name
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

// Retrieves new messages that are not from the Facebook Page
var _getMessage = function(callback) {
    _getPageToken(function (error, pageAccessToken) {
        if(error) {
            if(error.error_subcode && error.error_subcode === 463) {
                // Need to refresh token
                // TODO This could be setup better. 
                // It waits for the next time the start() call is make to actually do anything
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
                    // Make sure we are not replying to the page
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

// Gets the page token of the Facebook Page in the settings file
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

// Used to exchange an short term token with a long term
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

// Replies to a message on the Facebook Page's behalf
var _messageUser = function (messageID, message, pageAccessToken) {
    FB.api('/' + messageID + '/messages?access_token=' + pageAccessToken, 'post', {message: message}, function (res) {
        if(!res || res.error) {
            console.log(!res ? 'error occurred' : res.error);
            return;
        }
    });
};

// Get the new mentions of the Facebook Page
// If the Page as already replied, don't add it to the mention array
// TODO, add &since=' + (Date.now() - 120000) + '
var _getMentions = function(callback) {
    FB.api('/search?q=' + settings.facebook.name + '&type=post&access_token=' + userToken, function (res) {
        if(!res || res.error) {
            return callback(!res ? 'error occurred' : res.error);
        }
        var mentionArray = [];
        for(var dataCounter = 0; dataCounter < res.data.length; dataCounter++) {
            if(res.data[dataCounter].message_tags && res.data[dataCounter].message_tags[0]) {
                for(var messageCounter = 0; messageCounter < res.data[dataCounter].message_tags[0].length; messageCounter++) {
                    //console.log(res.data[dataCounter].message_tags);
                    if(res.data[dataCounter].message_tags[0][messageCounter].id == settings.facebook.id) {
                        var commentTracker = 0;
                        if(res.data[dataCounter].comments) {
                            for(var commentCounter = 0; commentCounter < res.data[dataCounter].comments.data.length; commentCounter++) {
                                // If the FROM ID of a comment is the same as the Facebook Page, increment count
                                if(res.data[dataCounter].comments.data[commentCounter].from.id == settings.facebook.id) {
                                    commentTracker++;
                                }
                            }
                            // The Facebook Page as not replied yet, lets add it to the array.
                            if(commentTracker === 0) {
                                var mentionObj = {
                                    fromID: res.data[dataCounter].from.id,
                                    status: res.data[dataCounter].message,
                                    statusID: res.data[dataCounter].id
                                };
                                mentionArray.push(mentionObj);
                            }
                        } else {
                            var mentionObj = {
                                fromID: res.data[dataCounter].from.id,
                                status: res.data[dataCounter].message,
                                statusID: res.data[dataCounter].id
                            };
                            mentionArray.push(mentionObj);
                        }
                    }
                }
            }
        }
        return callback(null, mentionArray);
    });
};

// https://developers.facebook.com/docs/reference/api/status/
var _replyStatus = function(statusID, message) {
    var statusIDArr = statusID.split('_');
    _getPageToken(function (error, pageToken) {
        if(error) {
            console.log(error);
            return;
        }
        // Using a page token will a "Error finding the requested story" error.
        // Using a user token will cause "An unexpected error has occurred. Please retry your request later." BUT the post does show up!
        // https://developers.facebook.com/x/bugs/218862188300393/
        // Currently leaving it as page token because that's the one we want when it starts to work
        FB.api('/' + statusIDArr[1] + '/comments', 'post', {message: message, access_token: pageToken}, function (res) {
            if(!res || res.error) {
                FB.api('/' + statusID + '/comments', 'post', {message: message, access_token: pageToken}, function (res) {
                    if(!res || res.error) {
                        console.log(!res ? 'error occurred' : res.error);
                        return;
                    }
                    console.log(res);
                });  
            }
            console.log(res);
        });
    });
};