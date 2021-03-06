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

		case 'no_deop':
			if (['true', 'yes', 'on', 'enable', '1'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].no_deop = true;
				helper.op.channels[target].no_deop = true;
				db.run("UPDATE channels SET no_deop = ? WHERE name = ?", [true, target], function () {
					client.say(channel, 'The bot will now remain op on ' + colors.wrap('bold', target) + '.');
				});
			} else if (['false', 'no', 'off', 'disable', '0'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].no_deop = false;
				helper.op.channels[target].no_deop = false;
				db.run("UPDATE channels SET no_deop = ? WHERE name = ?", [false, target], function () {
					client.say(channel, 'The bot will now auto-deop on ' + colors.wrap('bold', target) + '.');
				});
			} else {
				client.say(channel, 'ERROR: Invalid value: ' + args[0]);
			}
			break;

		case 'banchannel_unstable':
			if (['true', 'yes', 'on', 'enable', '1'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].banchannel_unstable = true;
				convert_unstable_bans.channel_to_banchannel(target, function() {
					helper.op.mode(target, '+b', '$j:' + bot.conf.unstable_banchannel + '$' + bot.conf.unstable_connections_channel);
					db.run("UPDATE channels SET banchannel_unstable = ? WHERE name = ?", [true, target], function () {
						client.say(channel, 'Operation succeeded.');
					});
				});
			} else if (['false', 'no', 'off', 'disable', '0'].indexOf(args[0]) !== -1) {
				bot.monitored_channels[target].banchannel_unstable = false;
				convert_unstable_bans.banchannel_to_channel(target, function() {
					helper.op.mode(target, '-b', '$j:' + bot.conf.unstable_banchannel + '$' + bot.conf.unstable_connections_channel);
					db.run("UPDATE channels SET banchannel_unstable = ? WHERE name = ?", [false, target], function () {
						client.say(channel, 'Operation succeeded.');
					});
				});
			} else {
				client.say(channel, 'ERROR: Invalid value: ' + args[0]);
			}
			break;

		default:
			client.say(channel, 'ERROR: Invalid command: ' + command);
	}
};

var convert_unstable_bans = {
	channel_to_banchannel: function(channel, callback) {
		db.each("SELECT mask FROM channels_bans WHERE channel = ? AND type = ?", [channel, helper.BAN_UNSTABLE_CONNECTION], function(err, row) {
			helper.op.mode(bot.conf.unstable_banchannel, '+b', row['mask'] + '$' + bot.conf.unstable_connections_channel);
			helper.op.mode(channel, '-b', row['mask'] + '$' + bot.conf.unstable_connections_channel);
		}, callback);
	},

	banchannel_to_channel: function(channel, callback) {
		db.each("SELECT mask FROM channels_bans WHERE channel = ? AND type = ?", [channel, helper.BAN_UNSTABLE_CONNECTION], function(err, row) {
			helper.op.mode(bot.conf.unstable_banchannel, '-b', row['mask'] + '$' + bot.conf.unstable_connections_channel);
			helper.op.mode(channel, '+b', row['mask'] + '$' + bot.conf.unstable_connections_channel);
		}, callback);
	}
};

exports.module = module;