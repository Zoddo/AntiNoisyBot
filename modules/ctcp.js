var module = require('../objects/module.js').module;
var ctcp = new module('ctcp');

ctcp.load = function() {
	client.on('ctcp-privmsg', onCTCP);
};

ctcp.unload = function() {
	client.removeListener('ctcp-privmsg', onCTCP);
};

function onCTCP(from, to, text)
{
	var args = text.split(' ');
	var command = args.shift().toUpperCase();

	switch (command) {
		case 'TIME':
			client.ctcp(from, 'notice', 'TIME ' + Date());
			break;

		case 'VERSION':
			client.ctcp(from, 'notice', 'VERSION AntiNoisyBot by Zoddo | An IRC bot to prevent noisy (quit/join flood due to unstable connection, etc.) | https://github.com/Zoddo/AntiNoisy');
			break;

		case 'SOURCE':
			client.ctcp(from, 'notice', 'SOURCE https://github.com/Zoddo/AntiNoisy');
			break;
	}
}

exports.module = ctcp;