var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('unban');
var unban = new command('unban');

module.load = function() {
	bot.commands.add(unban);

	if (!bot.initialized)
		bot.once('initialized', initialize);
	else
		initialize();
};
module.unload = function() {
	bot.commands.del(unban);

	bot.removeListener('initialized', initialize);
	if (bot.conf.unstable_connections_channel.toLowerCase() in client.chans)
		client.part(bot.conf.unstable_connections_channel);
};

unban.code = function(from, channel, args, message) {
	if (bot.has_flags(helper.get_account(from), 'a') && args.length > 0)
		this.code_admin(from, channel, args, message);
	else if (channel === bot.conf.unstable_connections_channel.toLowerCase())
		this.code_user(from, channel, args, message);
};
unban.code_user = function(from, channel, args, message) {
	if (bot.has_restrict('nounban', message.host, helper.get_account(from))) {
		helper.error(helper.get_identifier(message) + ' has tried to use the unban command but is restricted to do that.');
		client.notice(from, "ERROR: You're not allowed to unban yourself. Please poke a channel operator.");
		quiet(channel, message);
		return;
	}

	db.each("SELECT * FROM channels_bans WHERE mask = ? AND type = ?", ['*!*@'+message.host, helper.BAN_UNSTABLE_CONNECTION], function (err, row) {
		helper.ban.del(row.channel, row.type, row.mask);
	}, function(err, rows) {
		if (rows > 0) {
			client.say(channel, from + ": Your request has been received and will be processed in few seconds.");
			helper.ban.process();
			setTimeout(function() {
				if (client.chanData(channel).users[from] === '')
					client.send('REMOVE', channel, from, "You have been unbanned. If you need help, please join " + bot.conf.channel);
			}, 5*60*1000);
		} else {
			quiet(channel, message, "You've not been banned by " + bot.conf.nickname, true);
			client.notice(from, "ERROR: You've not been banned by " + bot.conf.nickname);
		}
	});
};
unban.code_admin = function(from, channel, args, message) {
	db.each("SELECT * FROM channels_bans WHERE mask = ?", [args[0]], function (err, row) {
		helper.ban.del(row.channel, row.type, row.mask);
	}, function(err, rows) {
		if (rows > 0) {
			client.say(channel, rows + " bans have been found. Removing...");
			helper.ban.process();
		} else {
			client.say(channel, "ERROR: No matching bans found.");
		}
	});
};

function initialize()
{
	client.join(bot.conf.unstable_connections_channel);
}

function quiet(channel, message, reason, remove)
{
	if (client.chanData(channel).users[message.nick] !== '')
		return;

	if (remove) client.send('REMOVE', channel, message.nick, reason);
	client.send('MODE', channel, '+q', '*!'+message.user+'@'+message.host, '');
	setTimeout(function() {
		client.send('MODE', channel, '-q', '*!'+message.user+'@'+message.host, '');
	}, 15*60*1000);
}

exports.module = module;