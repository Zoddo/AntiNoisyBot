var module = {
	invalidModule: function (message) {
		this.name = 'invalidModule';
		this.type = 'module';
		this.message = message;
	},
	unloadableModule: function () {
		this.name = 'unloadableModule';
		this.type = 'module';
	},
};

var command = {
	invalidCommand: function (message) {
		this.name = 'invalidCommand';
		this.type = 'command';
		this.message = message;
	},
};

exports.module = module;
exports.command = command;