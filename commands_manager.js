var commands = {};

function add(command)
{
	if (typeof command !== 'object' || command.constructor.name !== 'command') {
		helper.error('Trying to load an invalid command: type='+typeof command+' constructor.name='+command.constructor.name);
		return;
	}

	commands[command.name] = command;

	if (bot.conf.verbose)
		helper.debug('The command '+command.name+' has been loaded.');
}

function del(command)
{
	if (typeof command !== 'object' || command.constructor.name !== 'command') {
		helper.error('Trying to unload an invalid command: type='+typeof command+' constructor.name='+command.constructor.name);
		return;
	}

	delete commands[command.name];

	if (bot.conf.verbose)
		helper.debug('The command '+command.name+' has been unloaded.');
}

client.on('message#', function (nick, to, text, raw) {
	to = to.toLowerCase();

	if (!(to in bot.monitored_channels) && text.substr(0, 1) === bot.conf.commands_trigger)
		text = text.substr(1);
	else if (text.toLowerCase().indexOf(client.nick.toLowerCase()+': ') === 0)
		text = text.substr(client.nick.length+2);
	else
		return;

	var args = text.split(' ');
	var command = args.shift().toLowerCase();

	if (command in commands) {
		if (commands[command].flags != '' && !bot.has_flags(helper.get_account(nick), commands[command].flags, commands[command].flags_or))
			return;

		try
		{
			if (!commands[command].not_debug) helper.debug(command.toUpperCase() + ' command used by ' + nick);
			commands[command].code(nick, to, args, raw);
		}
		catch (e)
		{
			if (typeof e.type === 'string' && e.type === 'command')
				helper.error(e.name + ' has been throw: ' + e.message);
			else
				throw e;
		}
	}
});

exports.add = add;
exports.del = del;