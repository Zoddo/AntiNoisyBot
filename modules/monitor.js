var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var colors = require('irc/lib/colors');
var module = new module('monitor');
var monitor = new command('monitor');
var unmonitor = new command('unmonitor');

monitor.flags = 'a';
unmonitor.flags = 'a';

module.load = function() {
	bot.commands.add(monitor);
	bot.commands.add(unmonitor);
};
module.unload = function() {
	bot.commands.del(monitor);
	bot.commands.del(unmonitor);
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

exports.module = module;