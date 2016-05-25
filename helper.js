var op = require('./helpers/op');
var colors = require('irc/lib/colors');

const BAN_NORMAL = 1;
const BAN_QUIET = 2;
const BAN_UNSTABLE_CONNECTION = 3;

function update_db(callback)
{
	db.serialize();
	db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'config'", [], function(err, row) {
		if (typeof row === 'undefined') {
			db.run("CREATE TABLE config(name TEXT UNIQUE, value TEXT)");
			db.run("INSERT INTO config VALUES ('db_version', '0')");
		}

		db.get("SELECT value FROM config WHERE name = 'db_version'", [], function (err, row) {
			const LAST_VERSION = '4';

			if (row.value != LAST_VERSION) {
				console.log('Updating database from version %d to version %d ...', row.value, LAST_VERSION);

				switch (row.value) // This switch has no break statements to update to the last structure in one time
				{
					case '0': // update from version 0
						db.run("CREATE TABLE channels(name TEXT UNIQUE, ban_unstable INT DEFAULT '86400', ban_nickflood INT DEFAULT '86400', report_only INT NOT NULL DEFAULT '0')");
						db.run("CREATE TABLE channels_bans(channel TEXT, type INT, mask TEXT, expire INT, FOREIGN KEY(channel) REFERENCES channels(name))");

					case '1': // update from version 1
						db.run("CREATE TABLE users(account TEXT NOT NULL UNIQUE, flags TEXT NOT NULL)");
						db.run("CREATE TABLE restrict(host TEXT DEFAULT NULL, account TEXT DEFAULT NULL, restrict TEXT NOT NULL)");

					case '2': // update from version 2
						db.run("ALTER TABLE channels ADD COLUMN no_deop INT NOT NULL DEFAULT '0'");

					case '3': // update from version 3
						db.run("ALTER TABLE channels ADD COLUMN banchannel_unstable INT NOT NULL DEFAULT '0'");
				}
			}

			db.run("UPDATE config SET value = ? WHERE name = 'db_version'", LAST_VERSION, function () {
				db.parallelize();
				if (typeof callback === 'function') callback();
			});
		});
	});
}

function connect_irc()
{
	console.log('Connecting to %s ...', bot.conf.server);
	client.connect();

	client.on('registered', function() {
		debug('Connected.');
		client.send('MODE', client.nick, '+Qi-w');

		debug('Logging in with NickServ ...');
		// Using NICKSERV command instead of PRIVMSG ensure that we send the message
		// to the real NICKSERV and not to an usurper (when services are down)
		client.send('NICKSERV', 'IDENTIFY', bot.conf.nickname, bot.conf.password);
		client.on('notice', events.identified);

		bot.emit('preinitialization');
	});
}

function initialize()
{
	if (bot.conf.debug && typeof bot.conf.channel_debug === 'string' && bot.conf.channel_debug)
		client.join(bot.conf.channel_debug);

	client.join(bot.conf.channel, function() {
		db.each("SELECT * FROM channels", [], function(err, row) {
			bot.monitored_channels[row['name'].toLowerCase()] = {
				ban_unstable: row['ban_unstable'],
				ban_nickflood: row['ban_nickflood'],
				report_only: row['report_only'],
				no_deop: row['no_deop'],
				banchannel_unstable: row['banchannel_unstable'],
				points: {},
				already_detected: {},
			};
			op.add_channel(row['name'], row['no_deop']);
			client.join(row['name']);
		}, function() {
			client.join(bot.conf.unstable_banchannel, function() {
				op.add_channel(bot.conf.unstable_banchannel, true);
			});
			setTimeout(function () {
				bot.initialized = true;
				bot.emit('initialized');
			}, 5000);
		});
	});
}

function monitor_channel(channel, report_only, callback)
{
	db.get("SELECT name FROM channels WHERE name = ?", channel, function(err, row) {
		if (typeof row !== 'undefined') {
			error('!!!BUG!!! helper.monitor_channel() called for ' + channel + ", but it's an already monitored channel.");
			return;
		}

		db.run("INSERT INTO channels (name, report_only) VALUES (?, ?)", [channel, (report_only ? true : false)], function() {
			// We read the row just inserted to get default values
			db.get("SELECT * FROM channels WHERE name = ?", channel, function(err, row) {
				bot.monitored_channels[channel.toLowerCase()] = {
					ban_unstable: row['ban_unstable'],
					ban_nickflood: row['ban_nickflood'],
					report_only: row['report_only'],
					no_deop: row['no_deop'],
					banchannel_unstable: row['banchannel_unstable'],
					points: {},
					already_detected: {},
				};

				if (!(channel in client.chans))
					client.join(channel);
				else
					op.add_channel(channel, row['no_deop']);

				debug(channel + ' is now a monitored channel.');

				if (typeof callback === 'function') callback();
			});
		});
	});
}

function unmonitor_channel(channel, callback)
{
	db.get("SELECT name FROM channels WHERE name = ?", channel, function(err, row) {
		if (typeof row === 'undefined') {
			error('!!!BUG!!! helper.unmonitor_channel() called for ' + channel + ", but it's not a monitored channel.");
			return;
		}

		db.run("DELETE FROM channels WHERE name = ?", channel, function() {
			delete bot.monitored_channels[channel.toLowerCase()];

			if (channel in client.chans)
				client.part(channel, 'This channel is now unmonitored');

			debug(channel + ' is now unmonitored.');

			if (typeof callback === 'function') callback();
		});
		db.run("DELETE FROM channels_bans WHERE channel = ?", channel);
	});
}



var ban = {
	queue_add: [],
	queue_del: [],

	add: function (channel, type, mask, expire, immed) {
		if (!(channel.toLowerCase() in bot.monitored_channels)) {
			error('!!!BUG!!! Attempted to set a ban on an unmonitored channel: ' + channel + ' / mask: ' + mask);
			return;
		}

		ban.queue_add.push({
			channel: channel,
			type: type,
			mask: mask,
			expire: expire ? (Date.now()/1000 + expire) : null,
		});

		if (typeof immed === 'undefined' || immed)
			ban.process();
	},

	del: function (channel, type, mask) {
		if (!(channel.toLowerCase() in bot.monitored_channels)) {
			error('!!!BUG!!! Attempted to set a ban on an unmonitored channel: ' + channel + ' / mask: ' + mask);
			return;
		}

		ban.queue_del.push({
			channel: channel,
			type: type,
			mask: mask,
		});
	},

	process: function () {
		ban.queue_del.forEach(function (value) {
			switch (value.type)
			{
				case BAN_QUIET:
					op.mode(value.channel, '-q', value.mask);
					break;

				case BAN_UNSTABLE_CONNECTION:
					var channel;
					if (value.channel in bot.monitored_channels && bot.monitored_channels[value.channel].banchannel_unstable) {
						channel = bot.conf.unstable_banchannel;
					} else {
						channel = value.channel
					}

					op.mode(channel, '-b', value.mask + '$' + bot.conf.unstable_connections_channel);
					break;

				default: //BAN_NORMAL
					value.type = BAN_NORMAL;
					op.mode(value.channel, '-b', value.mask);
			}

			db.run("DELETE FROM channels_bans WHERE channel = ? AND type = ? AND mask = ?", [value.channel, value.type, value.mask]);
		});

		ban.queue_add.forEach(function (value) {
			switch (value.type)
			{
				case BAN_QUIET:
					op.mode(value.channel, '+q', value.mask);
					break;

				case BAN_UNSTABLE_CONNECTION:
					var channel;
					if (value.channel in bot.monitored_channels && bot.monitored_channels[value.channel].banchannel_unstable) {
						channel = bot.conf.unstable_banchannel;
					} else {
						channel = value.channel
					}

					op.mode(channel, '+b', value.mask + '$' + bot.conf.unstable_connections_channel);
					break;

				default: //BAN_NORMAL
					value.type = BAN_NORMAL;
					op.mode(value.channel, '+b', value.mask);
			}

			db.run("INSERT INTO channels_bans VALUES (?, ?, ?, ?)", [value.channel, value.type, value.mask, value.expire]);
		});

		ban.queue_add = [];
		ban.queue_del = [];
	},
};

function get_account(nick)
{
	nick = nick.toLowerCase();

	if (!(nick in client.users))
		return '';

	return client.users[nick].account;
}

function get_identifier(message)
{
	var id = message.nick + '!' + message.user + '@' + message.host;

	var account = get_account(message.nick);
	if (account)
		id += ' (' + account + ')';

	return id;
}

function error(message)
{
	console.error('\u001b[01;31mERROR: ' + message + '\u001b[0m');
	if (typeof client !== 'undefined') {
		if (bot.conf.channel.toLowerCase() in client.chans && !client.conn.requestedDisconnect)
			client.say(bot.conf.channel, colors.wrap('light_red', 'ERROR: ' + message));

		if (typeof bot.conf.channel_debug === 'string' && bot.conf.channel_debug.toLowerCase() in client.chans && !client.conn.requestedDisconnect)
			client.say(bot.conf.channel_debug, colors.wrap('light_red', 'ERROR: ' + message));
	}
}

function info(message)
{
	if (typeof client !== 'undefined') {
		if (bot.conf.channel.toLowerCase() in client.chans && !client.conn.requestedDisconnect)
			client.say(bot.conf.channel, message);
	}
}

function debug(message)
{
	if (bot.conf.debug) {
		console.log('DEBUG: ' + message);
		if (typeof client !== 'undefined' && typeof bot.conf.channel_debug === 'string'
			&& bot.conf.channel_debug.toLowerCase() in client.chans && !client.conn.requestedDisconnect)
		{
			client.say(bot.conf.channel_debug, 'DEBUG: ' + message);
		}
	}
}

exports.op = op;
exports.BAN_NORMAL = BAN_NORMAL;
exports.BAN_QUIET = BAN_QUIET;
exports.BAN_UNSTABLE_CONNECTION = BAN_UNSTABLE_CONNECTION;
exports.update_db = update_db;
exports.connect_irc = connect_irc;
exports.initialize = initialize;
exports.monitor_channel = monitor_channel;
exports.unmonitor_channel = unmonitor_channel;
exports.ban = ban;
exports.get_account = get_account;
exports.get_identifier = get_identifier;
exports.error = error;
exports.info = info;
exports.debug = debug;