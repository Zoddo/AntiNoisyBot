var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('set');
var chanset = new command('chanset');

chanset.flags = 'a';

module.load = function()
{
	bot.commands.add(chanset);
};
module.unload = function()
{
	bot.commands.del(chanset);
};

chanset.code = function(from, channel, args)
{
	var target = (args[0].indexOf('#') !== 0) ? channel : args.shift();
	var command = args.shift();
	
	if (!(target in bot.monitored_channels)) {
		client.say(channel, 'ERROR: Invalid channel: ' + target);
		return;
	}
	
	switch (command)
	{
		case 'ban_unstable':
		case 'ban_nickflood':
			var duration = Number(args[0]);
			if (isNaN(duration) || duration < 0) {
				client.say(channel, 'ERROR: Invalid number: ' + args[0]);
				return;
			}
			
			bot.monitored_channels[target][command] = duration;
			db.run("UPDATE channels SET " + command + " = ? WHERE name = ?", [duration, target], function () {
				client.say(channel, 'The ' + command + ' of ' + colors.wrap('bold', target) + ' is now ' + duration);
			});
			break;
		
		case 'report_only':
			if (['true', 'yes', 'on', 'enable', '1'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].report_only = true;
				db.run("UPDATE channels SET report_only = ? WHERE name = ?", [true, target], function () {
					client.say(channel, 'The report_only mode of ' + colors.wrap('bold', target) + ' is now enabled.');
				});
			} else if (['false', 'no', 'off', 'disable', '0'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].report_only = false;
				db.run("UPDATE channels SET report_only = ? WHERE name = ?", [false, target], function () {
					client.say(channel, 'The report_only mode of ' + colors.wrap('bold', target) + ' is now disabled.');
				});
			} else {
				client.say(channel, 'ERROR: Invalid value: ' + args[0]);
			}
			break;
			
		default:
			client.say(channel, 'ERROR: Invalid command: ' + command);
	}
};

exports.module = module;