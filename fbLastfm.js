var fb = require('fb');
var request = require('request');
var settings = require('./settings.js');
var userToken = settings.facebook.userAccessToken;

module.exports.start = function() {

};

var _register = function() {

};

var _getMessage = function(callback) {
	_getPageToken(function (error, pageAccessToken) {
		if(error) {
			return callback(error);
		}
		FB.api('/' + settings.facebook.name + '/conversations?access_token=' + pageAccessToken, function (res) {
			if(!res || res.error) {
				return callback(!res ? 'error occurred' : res.error);
			}
			// TODO return message
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

var _untrack = function() {

};