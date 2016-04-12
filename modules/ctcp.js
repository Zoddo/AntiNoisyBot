var module = require('../objects/module.js').module;
var ctcp = new module('ctcp');

ctcp.load = function()
{
	client.on('ctcp-version', onVersion);
};

ctcp.unload = function()
{
	client.removeListener('ctcp-version', onVersion);
};

function onVersion(from)
{
	client.ctcp(from, 'notice', 'VERSION AntiNoisyBot by Zoddo | An IRC bot to prevent noisy (quit/join flood due to unstable connection, etc.) | https://github.com/Zoddo/AntiNoisy');
}

exports.module = ctcp;