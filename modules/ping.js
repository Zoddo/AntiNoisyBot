var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var module = new module('ping');
var ping = new command('ping', true);

module.load = function()
{
	bot.commands.add(ping);
};
module.unload = function()
{
	bot.commands.del(ping);
};

ping.code = function(from, channel, args)
{
	client.say(channel, 'pong ' + args.join(' '));
};

exports.module = module;