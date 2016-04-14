var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('flags');
var flags = new command('flags');
var setflags = new command('setflags');

flags.flags = 'faA';
setflags.flags = 'fA';
flags.flags_or = setflags.flags_or = true;

module.load = function() {
	bot.commands.add(flags);
	bot.commands.add(setflags);
};
module.unload = function() {
	bot.commands.del(flags);
	bot.commands.del(setflags);
};

flags.code = function(from, channel, args) {
	if (!args[0])
		return;

	if (!(args[0] in bot.users) || bot.users[args[0]] == '')
		client.say(channel, 'The account ' + colors.wrap('bold', args[0]) + ' has ' + colors.wrap('bold', 'no') + ' flags.');
	else
		client.say(channel, 'The account ' + colors.wrap('bold', args[0]) + ' has flags ' + colors.wrap('bold', bot.users[args[0]]) + '.');
};
setflags.code = function(from, channel, args) {
	if (!args[0])
		return;

	var uflags;
	if (args[1]) uflags = args[1];
	else uflags = '';

	// Check if the user is allowed to set all the flags (A/D/f are reserved to superadmins).
	if (/[ADf]/.test(uflags) && !bot.has_flags(helper.get_account(from), 'A')) {
		helper.debug('ERROR: ' + from + '(' + helper.get_account(from) + ') has tried to set flags ' + uflags + ' to ' + args[0] + '.');
		client.say(channel, 'ERROR: You aren\'t allowed to set these flags.');
		return;
	}

	var newflags = bot.set_flags(args[0], uflags);

	if (newflags != '')
		client.say(channel, 'The flags for nickserv account ' + colors.wrap('bold', args[0]) + ' have been set to ' + colors.wrap('bold', newflags) + '.');
	else
		client.say(channel, 'The flags for nickserv account ' + colors.wrap('bold', args[0]) + ' have been removed.');
};

exports.module = module;