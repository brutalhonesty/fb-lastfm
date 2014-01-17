var settings = require('./settings.js');
var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
    api_key: settings.lastfm.apikey,
    secret: settings.lastfm.secret,
    useragent: 'FB-LastFM/v0.1' //Optional, defaults to lastfm-node.
});

module.exports.getTracks = function(username, callback) {
    lastfm.request("user.getrecenttracks", {
        user: username,
        handlers: {
            success: function(recentlyPlayed) {
                _checkNowPlaying(recentlyPlayed, function (error, nowPlaying) {
                    if(error) {
                        console.log(error);
                        return;
                    }
                    if(!nowPlaying) {
                        // Get most recent track
                        // Assume the first element is the lastest
                        return callback(null, recentlyPlayed.recenttracks.track[0]);
                    }
                    return callback(null, nowPlaying);
                });
            },
            error: function(error) {
                return callback(error);
            }
        }
    });
};

module.exports.getInfo = function(username, callback) {
    lastfm.request("user.getInfo", {
        user: username,
        handlers: {
            success: function(user) {
                return callback(null, user)
            },
            error: function(error) {
                return callback(error);
            }
        }
    });
};

// Checks the array for the now playing song
// Assuming the first element in the returned array from Last.FM is the latest track and has the attribute we need
var _checkNowPlaying = function(recentlyPlayed, callback) {
    if(recentlyPlayed.recenttracks.track[0]['@attr'].nowplaying) {
        return callback(null, recentlyPlayed.recenttracks.track[0]);
    }
    return callback();
};