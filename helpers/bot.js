exports.bot = bot;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var colors = require('irc/lib/colors');

function bot()
{
	var self = this;
	self.conf = require('../config').botconf;

	self.once('preinitialization', function() {
		self.modules = require('../modules_manager');
		self.commands = require('../commands_manager');

		self.conf.loaded_modules.forEach(self.modules.load);

		setInterval(self.save_db.bind(self), 300 * 1000);

		client.conn.cyclingPingTimer.removeAllListeners('pingTimeout');
		client.conn.cyclingPingTimer.on('pingTimeout', function() {
			self.restart("Server silent for too long and don't reply to PINGs. Automatic restart triggered...");
		});
	});

	self.once('initialized', function() {
		var monitor_channel = 'I monitor ' + colors.wrap('bold', Object.keys(self.monitored_channels).length) + ' channels.',
			users_tracked = ' I see ' + colors.wrap('bold', Object.keys(client.users).length) + ' users.';

		helper.debug('The bot is now initializated. '+ monitor_channel + users_tracked);
		helper.debug('The bot run in ' + (self.conf.verbose ? 'verbose' : 'debug') + ' mode.');

		if (typeof process.env.RESPAWN !== 'undefined' && parseInt(process.env.RESPAWN) > 0)
			helper.error('The worker process has been respawaned by master process. Respawn number: ' + process.env.RESPAWN);

		helper.info('The bot is now initializated. ' + monitor_channel);
	});

	EventEmitter.call(this);
}
util.inherits(bot, EventEmitter);

bot.prototype.loggedin = false;
bot.prototype.initialized = false;
bot.prototype.users = {};
bot.prototype.restrict = {};
bot.prototype.monitored_channels = {}; // Filled when connected to IRC.
bot.prototype.channels_in_process = {
	requested: {}, // Channels aren't immediately removed from this object to have a flood protection
	waiting_to_join: {},
	waiting_to_op: {},
};
bot.prototype.modules = {};
bot.prototype.commands = {};

/*
 * List of flags:
 * 		a			is an admin (can add a monitored channel, set options, restart the bot ...)
 * 		A			is a superadmin (can stop the bot, load modules ...). This flag can be set only by other superadmins.
 * 		d			can use debug functions
 * 		D			can use DANGEROUS debug functions (eval ...). This flag can be set only by superadmins.
 * 		f			can set flags to other peoples (excluding A/D/f that can be set only by superadmins)
 */
bot.prototype.has_flags = function(account, flags, or) {
	var self = this;

	if (!(account in self.users))
		return false;

	var has_flag = or ? false : true;

	flags.split('').forEach(function(flag) {
		if (!or && self.users[account].indexOf(flag) === -1) has_flag = false;
		if (or && self.users[account].indexOf(flag) !== -1) has_flag = true;
	});

	return has_flag;
};

bot.prototype.set_flags = function(account, flags)
{
	var self = this;

	if (!account)
		return '';

	if (!(account in self.users))
		self.users[account] = '';

	if (flags[0] != '+' && flags[0] != '-')
		self.users[account] = '';

	var adding = true;
	flags.split('').forEach(function (flag) {
		if (flag == '+') {
			adding = true;
			return;
		}
		if (flag == '-') {
			adding = false;
			return;
		}

		if (adding) {
			if (self.users[account].indexOf(flag) == -1)
				self.users[account] += flag;
		} else {
			self.users[account] = self.users[account].replace(flag, '');
		}
	});

	// Remove the entry if there is no flags
	if (self.users[account] === '') {
		delete self.users[account];
		helper.debug('Flags for ' + account + ' have been removed.');
		return '';
	}

	helper.debug('Flags for ' + account + ' have been set to ' + self.users[account] + '.');
	return self.users[account];
}

bot.prototype.has_restrict = function(restrict, host, account) {
	if (!restrict || !(restrict in this.restrict))
		return false;

	if (host && this.restrict[restrict].host.indexOf(host) !== -1)
		return true;
	if (account && this.restrict[restrict].account.indexOf(account) !== -1)
		return true;

	return false;
};
bot.prototype.add_restrict = function(restrict, host, account) {
	if (!restrict)
		return false;

	if (!(restrict in this.restrict))
		this.restrict[restrict] = {account: [], host: []};

	if (host && this.restrict[restrict].host.indexOf(host) === -1)
		this.restrict[restrict].host.push(host);
	if (account && this.restrict[restrict].account.indexOf(account) === -1)
		this.restrict[restrict].account.push(account);

	return true;
};
bot.prototype.del_restrict = function(restrict, host, account) {
	if (!restrict || !(restrict in this.restrict))
		return false;

	var index;

	if (host && (index = this.restrict[restrict].host.indexOf(host)) !== -1)
		this.restrict[restrict].host.splice(index, 1);
	if (account && (index = this.restrict[restrict].account.indexOf(account)) !== -1)
		this.restrict[restrict].account.splice(index, 1);

	return true;
};

bot.prototype.load_db = function(callback) {
	var self = this;

	self.users = {};
	db.each("SELECT * FROM users", [], function(err, row) {
		self.users[row['account']] = row['flags'];
	}, function(err, rows) {
		var func = function(callback) {
			self.restrict = {};
			db.each("SELECT * FROM restrict", [], function(err, row) {
				if (!(row['restrict'] in self.restrict))
					self.restrict[row['restrict']] = {account: [], host: []};

				if (row['account'] !== null)
					self.restrict[row['restrict']].account.push(row['account']);
				if (row['host'] !== null)
					self.restrict[row['restrict']].host.push(row['host']);
			}, function() {
				self.emit('load_db');
				if (typeof callback === 'function') callback();
			});
		};

		if (rows === 0) {
			console.error('');
			console.error('\u001b[01;31mNo admin accounts found. Creating one with full privileges...\u001b[0m');
			const readline = require('readline');
			const rl = readline.createInterface(process.stdin, process.stdout);

			rl.question('Enter account name: ', function(account) {
				self.set_flags(account, 'aAdf');
				console.log('Account %s created with flags %s.', account, self.users[account]);
				console.log('');

				func(function () {
					self.save_db();
					callback();
				});
			});
		} else {
			func(callback);
		}
	});
};
bot.prototype.save_db = function() {
	var self = this;

	// @todo backup database before saving

	db.serialize(function() {
		// users
		db.run("BEGIN TRANSACTION");
		db.run("DELETE FROM users");
		Object.keys(self.users).forEach(function(account) {
			db.run("INSERT INTO users (account, flags) VALUES (?, ?)", [account, self.users[account]]);
		});
		db.run("COMMIT TRANSACTION");

		// restrictions
		db.run("BEGIN TRANSACTION");
		db.run("DELETE FROM restrict");
		Object.keys(self.restrict).forEach(function(restrict) {
			self.restrict[restrict].account.forEach(function(account) {
				db.run("INSERT INTO restrict (restrict, account) VALUES (?, ?)", [restrict, account]);
			});
			self.restrict[restrict].host.forEach(function(host) {
				db.run("INSERT INTO restrict (restrict, host) VALUES (?, ?)", [restrict, host]);
			});
		});
		db.run("COMMIT TRANSACTION");

		db.run("VACUUM");
	});

	self.emit('save_db');
};

bot.prototype.reload = function() {
	// @todo implement
};
bot.prototype.restart = function(message) {
	this.restart_requested = true;
	client.disconnect(message);
	this.save_db();
	this.emit('restart', message);
	this.emit('shutdown', message, true);
	setTimeout(process.exit, 5000, 3);
};
bot.prototype.quit = function(message) {
	this.exit_requested = true;
	client.disconnect(message);
	this.save_db();
	this.emit('quit', message);
	this.emit('shutdown', message, false);
	setTimeout(process.exit, 5000);
};

bot.prototype.restart_requested = false;
bot.prototype.exit_requested = false;