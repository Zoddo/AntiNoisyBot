var channels = {};
var exec_queue = {};
var mode_queue = {};

function exec(channel, callback)
{
	if (!(channel in channels)) {
		error('!!!BUG!!! Call to helper.op.exec() on an unknown channel: ' + channel);
		return;
	}

	exec_queue[channel].push(callback);
	request_op(channel);
}

function mode(channel, mode, arg)
{
	if (!(channel in channels)) {
		error('!!!BUG!!! Call to helper.op.mode() on an unknown channel: ' + channel);
		return;
	}

	mode_queue[channel].push({mode: mode, arg: (arg ? arg : '')});
	request_op(channel);
}

function request_op(channel)
{
	if (client.chans[channel].users[client.nick] != '@' && (!channels[channel].op_requested || channels[channel].deop_requested)) {
		client.send('CHANSERV', 'OP', channel);
		channels[channel].op_requested = true;
	}
}

function process(channel)
{
	// First, we request de-op at the end
	mode_queue[channel].push({mode: '-o', arg: client.nick});

	// We call callbacks.
	exec_queue[channel].forEach(function (callback) {
		callback();
	});

	// Then, we set modes.
	var mode = [], arg = [];
	mode_queue[channel].forEach(function (value) {
		mode.push(value.mode);
		if (value.arg !=  '') arg.push(value.arg);

		if (mode.length && mode.length >= bot.conf.max_modes) {
			client.send('MODE', channel, mode.join(''), arg.join(' '), '');
			mode = [], arg = [];
		}
	});
	if (mode.length > 0)
		client.send('MODE', channel, mode.join(''), arg.join(' '), '');

	channels[channel].deop_requested = true;
	exec_queue[channel] = [];
	mode_queue[channel] = [];
}

function add_channel(channel)
{
	if (channel in bot.monitored_channels && channel in client.chans && !(channel in channels)) {
		channels[channel] = {
			op_requested: false,
			deop_requested: false,
		};

		exec_queue[channel] = [];
		mode_queue[channel] = [];
	}
}

function del_channel(channel)
{
	if (channel in channels) {
		delete channels[channel];
		delete exec_queue[channel];
		delete mode_queue[channel];
	}
}


bot.on('preinitialization', function() {
	client.on('join', function (channel, nick) {
		if (channel in bot.monitored_channels && nick == client.nick) {
			add_channel(channel);

			client.once('names' + channel, function (nicks) {
				if (nicks[client.nick] == '@') {
					channels[channel].deop_requested = true;
					client.send('MODE', channel, '-o', client.nick);
				}
			});
		}
	});

	client.on('op', function (channel) {
		if (channel in channels) {
			channels[channel].op_requested = false;
			setTimeout(process, 1000, channel); // We wait 1 second to allow other scripts to do some work
		}
	});

	client.on('deop', function (channel) {
		if (channel in channels)
			channels[channel].deop_requested = false;
	});

	client.on('part', function (channel, nick) {
		if (nick == client.nick)
			del_channel(channel);
	});
});


exports.exec = exec;
exports.mode = mode;
exports.add_channel = add_channel;
exports.del_channel = del_channel;