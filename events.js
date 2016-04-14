var colors = require('irc/lib/colors');

function identified(nick, to, text)
{
	if (nick == 'NickServ' && to == client.nick && text.indexOf('You are now identified for ') > -1) {
		bot.loggedin = true;
		helper.debug('We are now logged in with NickServ.');

		if (client.nick != bot.conf.nickname) {
			helper.debug('Regaining our nickname ...');
			client.send('NICKSERV', 'REGAIN', bot.conf.nickname);
		}

		helper.initialize();
		client.removeListener('notice', identified);
	}
}

function check_wanted_join(channel, nick)
{
	if (nick == client.nick) {
		if (channel == bot.conf.channel || (typeof bot.conf.channel_debug === 'string' && bot.conf.channel_debug && channel == bot.conf.channel_debug))
			return;

		if (channel in bot.channels_in_process.waiting_to_join || channel in bot.channels_in_process.waiting_to_op)
			return;

		if (channel in bot.monitored_channels)
			return;

		db.get("SELECT * FROM channels WHERE name = ?", channel, function(err, row) {
			if (typeof row === 'undefined') {
				helper.error('We have forced me to join ' + channel);
				client.part(channel, "I'm joined this channel against my will");
			} else {
				bot.monitored_channels[channel] = {
					ban_unstable: row['ban_unstable'],
					ban_nickflood: row['ban_nickflood'],
					report_only: row['report_only'],
					points: {},
					already_detected: {},
				};

				helper.op.add_channel(channel);
			}
		});
	}
}

function get_invite(channel, from)
{
	if (!bot.initialized) return;

	if (channel in client.chans) {
		helper.debug('Get an /INVITE to ' + channel + " but I'm already in this channel.");
		return;
	}

	db.get("SELECT name FROM channels WHERE name = ?", channel, function(err, row) {
		if (typeof row !== 'undefined' || channel in bot.channels_in_process.waiting_to_op || channel == bot.conf.channel) {
			helper.debug('Get an /INVITE to ' + channel + ' that is already a known channel. Trying to rejoin.');
			client.join(channel);
		} else {
			if (channel in bot.channels_in_process.requested || channel in bot.channels_in_process.waiting_to_join)
				return;

			helper.debug("I'm get an INVITE for " + channel);
			client.notice(from, 'Your request to add ' + bot.conf.nickname + ' to \002' + channel + '\002 has been received.');
			client.notice(from, ' ');
			client.notice(from, 'Please set the \002+o\002 flags to \002' + bot.conf.nickname + '\002 in ChanServ.');
			client.notice(from, 'This can be done by this command:');
			client.notice(from, '\002/msg ChanServ FLAGS ' + channel + ' ' + bot.conf.nickname + ' +o\002');
			client.notice(from, ' ');
			client.notice(from, "I'll join the channel in \0021 minute\002. You must be op in this channel");
			client.notice(from, 'and I will try to get op with ChanServ to validate the request.');

			bot.channels_in_process.requested[channel] = {from: from, time: Date.now()};
			setTimeout(timers.processing_channel.join, 60 * 1000, channel, from);
		}
	});
}

var op = {
	process_waiting_to_op: function (channel, oper) {
		if (channel in bot.channels_in_process.waiting_to_op && oper.toLowerCase() == 'chanserv') {
			var from = bot.channels_in_process.waiting_to_op[channel].from;
			delete bot.channels_in_process.waiting_to_op[channel];

			// Wait 10 seconds to be sur that there is no other bot that try to deop me.
			setTimeout(function () {
				delete bot.channels_in_process.requested[channel];

				if (client.chans[channel].users[client.nick] != '@') {
					helper.error(from + ' has sent to me an invitation to join ' + channel + " but I'm get deopped during the op test");
					client.part(channel, "I'm unable to be OP in this channel");
					client.notice(from, "I'm able to get OP in \002" + channel + '\002 but I was deopped by someone.');
					client.notice(from, 'There is a misconfigured bot that automatically deop me?');
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
	},
};

function mode_add(channel, by, mode, argument, message)
{
	if (mode == 'o' && argument.toLowerCase() == client.nick.toLowerCase())
		client.emit('op', channel, by, message);
}

function mode_del(channel, by, mode, argument, message)
{
	if (mode == 'o' && argument.toLowerCase() == client.nick.toLowerCase())
		client.emit('deop', channel, by, message);
}

var monitor = {
	quit: function (nick, reason, channels, message) {
		if (bot.initialized && nick != client.nick) {
			// Check if affected by "notrigger" restriction
			var user = client.userData(nick);
			if (bot.has_restrict('notrigger', user.hostname, user.account))
				return;

			if (typeof reason === 'undefined')
				reason = '';

			// How many points?
			var points = bot.conf.noisy_points.default;
			Object.keys(bot.conf.noisy_points).forEach(function(value) {
				if (reason.indexOf(value) === 0)
					points = bot.conf.noisy_points[value];
			});

			// No points to add...
			if (points === 0)
				return;

			// If connected, add a margin
			if (user.account != '')
				points /= (points < bot.conf.noisy_points_max/2) ? 1.5 : 2;

			channels.forEach(function (channel) {
				monitor.process_channels(channel, nick, reason, message, points);
			});
		}
	},
	process_channels: function (channel, nick, reason, message, points) {
		if (channel in bot.monitored_channels) {
			// If the host has already been detected in the last 4 hours, we do nothing
			if (message.host in bot.monitored_channels[channel].already_detected &&
				bot.monitored_channels[channel].already_detected[message.host] + (240 * 60 * 1000) > Date.now())
					return;

			// We add the points for this quit
			if (!(message.host in bot.monitored_channels[channel].points))
				bot.monitored_channels[channel].points[message.host] = 0;
			bot.monitored_channels[channel].points[message.host] += points;

			// Remove the points when expired...
			setTimeout(function() {
				bot.monitored_channels[channel].points[message.host] -= points;
			}, bot.conf.noisy_points_expire);

			// If we have reached the max points numbers
			if (bot.monitored_channels[channel].points[message.host] >= bot.conf.noisy_points_max) {
				// We add a ban (if not in report_only mode) and report that in the main channel.
				if (!bot.monitored_channels[channel].report_only)
					helper.ban.add(channel, helper.BAN_UNSTABLE_CONNECTION, '*!*@'+message.host, bot.monitored_channels[channel].ban_unstable);

				helper.info('[' + colors.wrap('bold', channel) + '] Noisy detected from ' + colors.wrap('bold', message.host) + '.');

				bot.monitored_channels[channel].already_detected[message.host] = Date.now();
			}
		}
	},
};

function on_kick(channel, nick, by, reason)
{
	if (nick == client.nick) {
		helper.error("I've been kicked from " + channel + ': ' + reason);
		helper.debug("Kicked from " + channel + ' by ' + by);
	}
}

function on_error(message)
{
	helper.error('Got ERROR from uplink: ' + message.prefix + ' ' + message.rawCommand + ' ' + message.args.join(' '));
}

exports.identified = identified;
exports.check_wanted_join = check_wanted_join;
exports.get_invite = get_invite;
exports.op = op;
exports.mode_add = mode_add;
exports.mode_del = mode_del;
exports.monitor = monitor;
exports.on_kick = on_kick;
exports.on_error = on_error;