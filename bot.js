console.log('Welcome to AntiNoisyBot!');

var bot_helper = require('./helpers/bot');
global.bot = new bot_helper.bot();
var irc = require('irc');
var sqlite3 = require('sqlite3');
global.helper = require('./helper');
global.events = require('./events');
global.timers = require('./timers');

helper.debug('Loading database ...');
global.db = new sqlite3.Database('database.sqlite');

global.client = new irc.Client(bot.conf.server, bot.conf.nickname, {
	userName: bot.conf.nickname,
	realName: bot.conf.nickname + ' - ' + bot.conf.channel,
	port: 6697,
	autoRejoin: true,
	showErrors: true,
	debug: bot.conf.debug && bot.conf.verbose,
	secure: true,
	stripColors: true,
	channelPrefixes: '#',
	autoConnect: false,
	millisecondsOfSilenceBeforePingSent: 120 * 1000,
});


db.once('open', function () {
	helper.update_db(function () {
		bot.load_db(helper.connect_irc);
	});
});

bot.once('preinitialization', function() {
	client.on('join', events.check_wanted_join);
	client.on('+mode', events.mode_add);
	client.on('-mode', events.mode_del);
	client.on('op', events.op.process_waiting_to_op);
	client.on('kick', events.on_kick);
	client.on('error', events.on_error);

	client.on('quit', events.monitor.quit);
});

bot.once('initialized', function() {
	client.on('invite', events.get_invite);

	setInterval(timers.recurrent.channels_in_process, 300 * 1000);
	setInterval(timers.recurrent.ban_expiration, 3600 * 1000);
	// We can do a verification in 1 minute
	setTimeout(timers.recurrent.ban_expiration, 60 * 1000);
});



client.once('registered', function () {
	client.conn.on('close', function () {
		db.close(process.exit(bot.exit_requested ? 0 : (bot.restart_requested ? 20 : 2)));
		setTimeout(process.exit, 1800, bot.exit_requested ? 0 : 3);
	});
});

process.on('SIGINT', function() {
    console.log('Receiving SIGINT, exiting');

	if (!client.conn.requestedDisconnect) {
		bot.quit('Receiving SIGINT, exiting');
	} else {
		bot.exit_requested = true;
		bot.save_db();
		bot.emit('shutdown', 'Receiving SIGINT, exiting', false);
		db.close(process.exit);
		setTimeout(process.exit, 5000);
	}
});