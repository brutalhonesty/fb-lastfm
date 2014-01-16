var lastFM = require('../lastfm.js');
var username = '';
lastFM.getInfo(username, function (error, userInfo) {
	if(error) {
		console.log(error);
		return;
	}
	console.log(userInfo);
});