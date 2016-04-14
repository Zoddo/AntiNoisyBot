var module = require('../objects/module.js').module;
var command = require('../objects/command.js').command;
var module = new module('database');
var dbsave = new command('dbsave');
var dbreload = new command('dbreload');

dbsave.flags = 'a';
dbreload.flags = 'ad';

module.load = function() {
	bot.commands.add(dbsave);
	bot.commands.add(dbreload);
};
module.unload = function() {
	bot.commands.del(dbsave);
	bot.commands.del(dbreload);
};

dbsave.code = function(from, channel, args) {
	bot.save_db();
	client.say(channel, 'The database has been saved.');
};
dbreload.code = function(from, channel, args) {
	bot.load_db(function() {
		client.say(channel, 'The database has been reloaded from the filesystem.');
	});
};

exports.module = module;