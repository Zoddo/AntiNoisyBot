var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('eval');
var ceval = new command('eval');

ceval.flags = 'AdD';

module.load = function() {
	bot.commands.add(ceval);
};
module.unload = function() {
	bot.commands.del(ceval);
};

ceval.code = function(from, channel, args) {
	if (bot.conf.enable_eval && bot.conf.debug) {
		var value;

		try {
			value = eval(args.join(' '));
		} catch (e) {
			client.say(channel, colors.wrap('dark_red', colors.wrap('bold', 'Exception thrown: ') + e));
			return;
		}

		if (value !== undefined)
			client.say(channel, colors.wrap('bold', 'Return value: ') + value);
	} else
		helper.debug(from + ' try to use the EVAL command.');
};

exports.module = module;