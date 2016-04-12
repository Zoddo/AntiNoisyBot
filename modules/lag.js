var module = require('../objects/module.js').module;
var lag = new module('lag');

lag.load = function()
{
	outputDelay(300, 1000);
};

lag.unload = function()
{
	clearTimeout(lag.timeout);
};

function getHrDiffTime(time)
{
	// ts = [seconds, nanoseconds]
	var ts = process.hrtime(time);
	// convert seconds to miliseconds and nanoseconds to miliseconds as well
	return (ts[0] * 1000) + (ts[1] / 1000000);
};

function outputDelay(interval, maxDelay)
{
	var before = process.hrtime();

	lag.timeout = setTimeout(function() {
		var delay = getHrDiffTime(before) - interval;

		if (delay > maxDelay)
		{
			helper.debug('Heavy cycle detected: ' + delay + ' ms.');
		}

		outputDelay(interval, maxDelay);
	}, interval);
};

exports.module = lag;