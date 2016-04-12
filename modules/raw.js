var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var module = new module('raw');
var raw = new command('raw');

raw.flags = 'ad';

module.load = function()
{
	bot.commands.add(raw);
};
module.unload = function()
{
	bot.commands.del(raw);
};

raw.code = function(from, channel, args)
{
	console.log('SEND: ' + args.join(' '));

	if (!client.conn.requestedDisconnect) {
		client.conn.write(args.join(' ') + '\r\n');
	}
};

exports.module = module;