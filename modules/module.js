var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('monitor');
var modload = new command('modload');
var modreload = new command('modreload');
var modunload = new command('modunload');

modload.flags = 'A';
modreload.flags = 'A';
modunload.flags = 'A';

module.load = function()
{
	bot.commands.add(modload);
	bot.commands.add(modreload);
	bot.commands.add(modunload);
};
module.unload = function()
{
	bot.commands.del(modload);
	bot.commands.del(modreload);
	bot.commands.del(modunload);
};

modload.code = function(from, channel, args)
{
	if (!args[0])
		return;

	bot.modules.load(args[0]);
	client.say(channel, 'The module ' + colors.wrap('bold', args[0]) + ' has been loaded.');
};
modreload.code = function(from, channel, args)
{
	if (!args[0])
		return;

	bot.modules.reload(args[0]);
	client.say(channel, 'The module ' + colors.wrap('bold', args[0]) + ' has been reloaded.');
};
modunload.code = function(from, channel, args)
{
	if (!args[0])
		return;

	bot.modules.unload(args[0]);
	client.say(channel, 'The module ' + colors.wrap('bold', args[0]) + ' has been unloaded.');
};

exports.module = module;