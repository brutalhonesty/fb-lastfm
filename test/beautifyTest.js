var settings = require('../settings.js');
var beautify = require('js-beautify').js_beautify
console.log(beautify('module.exports = ' + JSON.stringify(settings), { indent_size: 4 }))