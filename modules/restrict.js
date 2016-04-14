var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var module = new module('restrict');
var restrict = new command('restrict');

restrict.flags = 'a';

module.load = function() {
	bot.commands.add(restrict);
};
module.unload = function() {
	bot.commands.del(restrict);
};

restrict.code = function(from, channel, args) {
	if (args.length < 4 || ['account', 'host', 'nick'].indexOf(args[0]) === -1)
		return;

	var type = args.shift();
	var id = args.shift();
	var action = args.shift();

	if (type == 'nick') {
		if (!(id.toLowerCase() in client.users)) {
			client.say(channel, 'ERROR: Unknown nick: ' + id);
			return;
		}

		var user = client.users[id.toLowerCase()];
		if (user.account)
			this.exec(channel, 'account', user.account, action, args);
		if (!user.account || action == 'has')
			this.exec(channel, 'host', user.hostname, action, args);
	} else
		this.exec(channel, type, id, action, args);
};

restrict.exec = function(channel, type, id, action, restricts) {
	switch (action) {
		case 'add':
			restricts.forEach(function(restrict) {
				if (bot.add_restrict(restrict, (type == 'host' ? id : null), (type == 'account' ? id : null)))
					client.say(channel, 'The restriction \002' + restrict + '\002 has been added to ' + type + ' \002' + id + '\002.');
			});
			break;

		case 'del':
			restricts.forEach(function(restrict) {
				if (bot.del_restrict(restrict, (type == 'host' ? id : null), (type == 'account' ? id : null)))
					client.say(channel, 'The restriction \002' + restrict + '\002 has been removed from ' + type + ' \002' + id + '\002.');
			});
			break;

		case 'has':
			restricts.forEach(function(restrict) {
				if (bot.has_restrict(restrict, (type == 'host' ? id : null), (type == 'account' ? id : null)))
					client.say(channel, 'The ' + type + ' ' + id + ' \002has\002 the restriction \002' + restrict + '\002.');
				else
					client.say(channel, 'The ' + type + ' ' + id + ' \002doesn\'t\002 has the restriction \002' + restrict + '\002.');
			});
			break;
	}
};

exports.module = module;