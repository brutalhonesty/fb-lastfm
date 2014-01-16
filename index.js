var fbLastFM = require('./fbLastFM.js');
var settings = require('./settings.js');
var LastFmNode = require('lastfm').LastFmNode;
var lastfm = new LastFmNode({
	api_key: settings.lastfm.apikey,
	secret: settings.lastfm.secret,
	useragent: 'FB-LastFM/v0.1' //Optional, defaults to lastfm-node.
});

lastfm.request("user.getrecenttracks", {
    user: "brutalhonesty08",
    handlers: {
        success: gotTracks,
        error: missingTracks
    }
});
fbLastFM.start();
var gotTracks = function(recentlyPlayed) {
	checkNowPlaying(recentlyPlayed, function (error, nowPlaying) {
		if(error) {
			console.log(error);
			return;
		}
		if(!nowPlaying) {
			// Get most recent track
			// Assume the first element is the lastest
			// recentlyPlayed.recenttracks.track[0]
		}
		// Do something with now playing
	});
};

// Something went wrong with the 'getrecenttracks' call
var missingTracks = function(error) {
	console.log(error);
};

// Checks the array for the now playing song
// Assuming the first element in the returned array from Last.FM is the latest track and has the attribute we need
var checkNowPlaying = function(recentlyPlayed, callback) {
	if(recentlyPlayed.recenttracks.track[0].@attr.nowplaying) {
		return callback(null, recentlyPlayed.recenttracks.track[0]);
	}
	return callback();
};