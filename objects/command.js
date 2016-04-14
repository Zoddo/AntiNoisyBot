var exceptions = require('./exceptions').command;

function command(name, not_debug)
{
	var self = this;

	if (typeof name !== 'string')
		throw new exceptions.invalidCommand('Invalid name');

	self.name = name;
	self.not_debug = (typeof not_debug === 'boolean') ? not_debug : false;
};

command.prototype.flags = '';
command.prototype.flags_or = false;

command.prototype.code = function(args, raw) {
	var self = this;
	throw new exceptions.invalidCommand('Command not implemented: ' + self.name);
};

exports.command = command;