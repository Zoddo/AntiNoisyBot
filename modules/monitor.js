var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var util = require('util');
var colors = require('irc/lib/colors');
var module = new module('monitor');
var monitor = new command('monitor');
var unmonitor = new command('unmonitor');

monitor.flags = 'a';
unmonitor.flags = 'a';

module.load = function() {
	bot.commands.add(monitor);
	bot.commands.add(unmonitor);

	client.on('invite', on_invite);
	client.on('op', on_op);
};
module.unload = function() {
	bot.commands.del(monitor);
	bot.commands.del(unmonitor);

	client.removeListener('invite', on_invite);
	client.removeListener('op', on_op);
};

monitor.code = function(from, channel, args) {
	if (!args[0] || args[0].length < 2 || args[0][0] != '#') {
		client.say(channel, 'Error: Invalid channel name');
		return;
	}

	var report_only = (typeof args[1] === 'string' && args[1] === 'report_only') ? true : false;
	var report_only_msg = report_only ? ' in report only mode' : '';

	setImmediate(helper.monitor_channel, args[0], report_only, function () {
		client.say(channel, 'The channel ' + args[0] + ' is now monitored' + report_only_msg + '.');
	});
};
unmonitor.code = function(from, channel, args) {
	if (!args[0])
		return;

	if(typeof args[1] === 'string' && args[1] === 'silent') client.part(args[0]);

	setImmediate(helper.unmonitor_channel, args[0], function () {
		client.say(channel, 'The channel ' + args[0] + ' is now ' + colors.wrap('bold', 'unmonitored') + '.');
	});
};

function on_invite(channel, from, message)
{
	if (!bot.initialized)
		return;

	if (channel in client.chans) {
		helper.debug('Get an /INVITE to ' + channel + " but I'm already in this channel.");
		return;
	}

	if (bot.has_restrict('noinvite', message.host, helper.get_account(from))) {
		helper.error(util.format('%s has tried to invite the bot on %s but is restricted to do that.', helper.get_identifier(message), channel));
		return;
	}

	db.get("SELECT name FROM channels WHERE name = ?", channel, function(err, row) {
		if (typeof row !== 'undefined' || channel in bot.channels_in_process.waiting_to_op || channel == bot.conf.channel) {
			helper.debug('Get an /INVITE to ' + channel + ' that is already a known channel. Trying to rejoin.');
			client.join(channel);
		} else {
			if (channel in bot.channels_in_process.requested || channel in bot.channels_in_process.waiting_to_join)
				return;

			helper.debug(util.format('%s has sent me an INVITE for %s.', helper.get_identifier(message), channel));
			client.notice(from, 'Your request to add ' + bot.conf.nickname + ' to \002' + channel + '\002 has been received.');
			client.notice(from, ' ');
			client.notice(from, 'Please set the \002+o\002 flags to \002' + bot.conf.nickname + '\002 in ChanServ.');
			client.notice(from, 'This can be done by this command:');
			client.notice(from, '\002/msg ChanServ FLAGS ' + channel + ' ' + bot.conf.nickname + ' +o\002');
			client.notice(from, ' ');
			client.notice(from, "I'll join the channel in \0021 minute\002. You must be op in this channel");
			client.notice(from, 'and I will try to get op with ChanServ to validate the request.');

			bot.channels_in_process.requested[channel] = {from: from, time: Date.now()};
			setTimeout(join, 60 * 1000, channel, from, message);
		}
	});
}

function join(channel, from, message)
{
	bot.channels_in_process.waiting_to_join[channel] = {'from': from};
	client.join(channel, function() {
		if (!(channel in bot.channels_in_process.waiting_to_join)) {
			return;
		}

		delete bot.channels_in_process.waiting_to_join[channel];

		client.once('names' + channel, function (nicks) {
			if (typeof nicks[from] === 'undefined' || nicks[from] != '@') {
				helper.error(helper.get_identifier(message) + ' has sent me an unauthorized invitation to join ' + channel);
				helper.debug(from + " isn't opped in " + channel);
				client.part(channel, 'Unthorized request to join this channel');
				client.notice(from, "You aren't opped in \002" + channel + "\002. So, I can't idle in this channel.");
				client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
				return;
			}

			bot.channels_in_process.waiting_to_op[channel] = {'from': from};
			client.send('CHANSERV', 'OP', channel);
			setTimeout(function () {
				if (channel in bot.channels_in_process.waiting_to_op) {
					delete bot.channels_in_process.waiting_to_op[channel];

					helper.error(helper.get_identifier(message) + ' has sent me an unauthorized invitation to join ' + channel);
					helper.debug("I can't get OP in " + channel);
					client.part(channel, 'Unthorized request to join this channel');
					client.notice(from, "I'm unable to get OP in \002" + channel + '\002. Do you have set \002+o\002 flag in ChanServ?');
					client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
				}
			}, 30 * 1000);
		});
	});
	setTimeout(function () {
		if (channel in bot.channels_in_process.waiting_to_join) {
			delete bot.channels_in_process.requested[channel];
			delete bot.channels_in_process.waiting_to_join[channel];

			helper.error(helper.get_identifier(message) + ' has sent me an invitation to join ' + channel + " but I'm unable to join the channel");
			client.notice(from, "I'm unable to join \002" + channel + '\002.');
			client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
		}
	}, 10 * 1000);
}

function on_op(channel, oper)
{
	if (channel in bot.channels_in_process.waiting_to_op && oper.toLowerCase() == 'chanserv') {
		var from = bot.channels_in_process.waiting_to_op[channel].from;
		delete bot.channels_in_process.waiting_to_op[channel];

		// Wait 10 seconds to be sur that there is no other bot that try to deop me.
		setTimeout(function () {
			delete bot.channels_in_process.requested[channel];

			if (client.chans[channel].users[client.nick] != '@') {
				helper.error(from + ' has sent me an invitation to join ' + channel + " but I'm get deopped during the op test");
				client.part(channel, "I'm unable to be OP in this channel");
				client.notice(from, "I'm able to get OP in \002" + channel + '\002 but I was deopped by someone.');
				client.notice(from, 'Maybe there is a misconfigured bot that automatically deops me?');
				client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
				return;
			}

			helper.monitor_channel(channel);
			client.notice(from, 'I now monitor \002' + channel + '\002. By default, I remove my bans after \00224 hours\002.');
			client.notice(from, "To follow policies of some channels, I'll not stay OP. When I need to do some actions,");
			client.notice(from, "I'll request the OP status to ChanServ then execute actions before immediately auto-deopping.");
			client.notice(from, 'If you have some questions or need help, you can join \002' + bot.conf.channel + '\002.');
			client.send('MODE', channel, '-o', client.nick);
		}, 10 * 1000);
	}
}

exports.module = module;