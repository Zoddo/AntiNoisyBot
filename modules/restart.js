var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var module = new module('restart');
var restart = new command('restart');
var quit = new command('quit');

restart.flags = 'a';
quit.flags = 'A';

module.load = function() {
	bot.commands.add(restart);
	bot.commands.add(quit);
};
module.unload = function() {
	bot.commands.del(restart);
	bot.commands.del(quit);
};

restart.code = function(from, channel, args) {
	var message = 'Restart requested by ' + from;
	if (args.length > 1)
		message += ' (' + args.join(' ') + ')';

	bot.restart(message);
};
quit.code = function(from, channel, args) {
	var message = 'Requested by ' + from;
	if (args.length > 1)
		message += ' (' + args.join(' ') + ')';

	bot.quit(message);
};

exports.module = module;