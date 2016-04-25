var channels = {};
var exec_queue = {};
var mode_queue = {};

function exec(channel, callback)
{
	if (!(channel in channels)) {
		helper.error('!!!BUG!!! Call to helper.op.exec() on an unknown channel: ' + channel);
		return;
	}

	exec_queue[channel].push(callback);
	request_op(channel);
}

function mode(channel, mode, arg)
{
	if (!(channel in channels)) {
		helper.error('!!!BUG!!! Call to helper.op.mode() on an unknown channel: ' + channel);
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
	} else if (channels[channel].no_deop) {
		setTimeout(process, 1000, channel); // Wait 1 second to allow to set multiples mode in one command.
	}
}

function process(channel)
{
	// First, we request de-op at the end
	if (!channels[channel].no_deop) {
		mode_queue[channel].push({mode: '-o', arg: client.nick});
		channels[channel].deop_requested = true;
	}

	// We call callbacks.
	exec_queue[channel].forEach(function (callback) {
		callback();
	});

	// Then, we set modes.
	var mode = [], arg = [];
	mode_queue[channel].forEach(function (value) {
		if (arg.length && arg.length >= bot.conf.max_modes && value.arg != '') {
			client.send('MODE', channel, mode.join(''), arg.join(' '), '');
			mode = [], arg = [];
		}

		mode.push(value.mode);
		if (value.arg !=  '') arg.push(value.arg);
	});
	if (mode.length > 0)
		client.send('MODE', channel, mode.join(''), arg.join(' '), '');

	exec_queue[channel] = [];
	mode_queue[channel] = [];
}

function add_channel(channel, no_deop)
{
	if (channel.toLowerCase() in bot.monitored_channels && channel in client.chans && !(channel in channels)) {
		channels[channel] = {
			op_requested: false,
			deop_requested: false,
			no_deop: no_deop || false,
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
		if (channel.toLowerCase() in bot.monitored_channels && nick == client.nick) {
			add_channel(channel, bot.monitored_channels[channel.toLowerCase()].no_deop);

			client.once('names' + channel, function (nicks) {
				if (nicks[client.nick] == '@' && !channels[channel].no_deop) {
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


exports.channels = channels;
exports.exec = exec;
exports.mode = mode;
exports.add_channel = add_channel;
exports.del_channel = del_channel;