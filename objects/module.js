var exceptions = require('./exceptions').module;

function module(name)
{
	var self = this;

	if (typeof name !== 'string')
		throw new exceptions.invalidModule('Invalid name');

	self.name = name;
};

module.prototype.load = function()
{
	var self = this;
	throw new exceptions.invalidModule('Module not implemented: ' + self.name);
};
module.prototype.unload = function()
{
	throw new exceptions.unloadableModule;
};
module.prototype.reload_data = function() {};
module.prototype.reload = function()
{
	this.load();
};

exports.module = module;