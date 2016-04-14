var modules = {};

function load(name)
{
	name = name.toLowerCase();
	if (name in modules)
	{
		helper.error('Trying to load an already loaded module: ' + name);
		return;
	}

	try
	{
		delete require.cache[require.resolve('./modules/' + name)];
		var mod = require('./modules/' + name).module;
		mod.load();
		modules[name] = mod;

		helper.debug('Module ' + name + ' has been loaded.');
	}
	catch (e)
	{
		if (typeof e.type === 'string' && e.type === 'module')
			helper.error(e.name + ' has been throw: ' + e.message);
		else
			throw e;
	}
}

function reload(name)
{
	name = name.toLowerCase();
	if (!(name in modules))
	{
		helper.error('Trying to reload a not loaded module: ' + name + '. Loading the module...');
		load(name);
		return;
	}

	try
	{
		var data = modules[name].reload_data();
		modules[name].unload();
		delete modules[name];
		delete require.cache[require.resolve('./modules/' + name)];

		var mod = require('./modules/' + name).module;
		mod.reload(data);
		modules[name] = mod;

		helper.debug('Module ' + name + ' has been reloaded.');
	}
	catch (e)
	{
		if (typeof e.type === 'string' && e.type === 'module')
		{
			if (e.name === 'unloadableModule')
				helper.error('The module ' + name + ' is unloadable.');
			else
				helper.error(e.name + ' has been throw: ' + e.message);
		}
		else
			throw e;
	}
}

function unload(name)
{
	name = name.toLowerCase();
	if (!(name in modules))
	{
		helper.error('Trying to unload a not loaded module: ' + name);
		return;
	}

	try
	{
		modules[name].unload();
		delete modules[name];
		delete require.cache[require.resolve('./modules/' + name)];

		helper.debug('Module ' + name + ' has been unloaded.');
	}
	catch (e)
	{
		if (typeof e.type === 'string' && e.type === 'module')
		{
			if (e.name === 'unloadableModule')
				helper.error('The module ' + name + ' is unloadable.');
			else
				helper.error(e.name + ' has been throw: ' + e.message);
		}
		else
			throw e;
	}
}

exports.load = load;
exports.reload = reload;
exports.unload = unload;