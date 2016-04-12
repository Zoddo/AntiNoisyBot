var recurrent = {
	channels_in_process: function () {
		Object.keys(bot.channels_in_process.requested).forEach(function (channel) {
			if (bot.channels_in_process.requested[channel].time + 600 * 1000 < Date.now())
				delete bot.channels_in_process.requested[channel];
		});
	},
	ban_expiration: function() {
		db.each("SELECT * FROM channels_bans WHERE expire < strftime('%s', 'now')", [], function (err, row) {
			helper.ban.del(row.channel, row.type, row.mask);
		}, helper.ban.process);
	},
};

var processing_channel = {
	join: function (channel, from) {
		bot.channels_in_process.waiting_to_join[channel] = {'from': from};
		client.join(channel, function() {
			if (!(channel in bot.channels_in_process.waiting_to_join)) {
				// events.check_wanted_join() will handle this case
				return;
			}

			delete bot.channels_in_process.waiting_to_join[channel];

			client.once('names' + channel, function (nicks) {
				if (typeof nicks[from] === 'undefined' || nicks[from] != '@') {
					helper.error(from + ' has sent to me an unauthorized invitation to join ' + channel);
					helper.debug(from + " isn't opped in " + channel);
					client.part(channel, 'Unthorized request to join this channel');
					client.notice(from, "You aren't opped in \002" + channel + "\002. So, I can't idle in this channel.");
					client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
					return;
				}

				bot.channels_in_process.waiting_to_op[channel] = {'from': from};
				client.send('CHANSERV', 'OP', channel);
				setTimeout(function () {
					if (channel in bot.channels_in_process.waiting_to_op) {
						delete bot.channels_in_process.waiting_to_op[channel];

						helper.error(from + ' has sent to me an unauthorized invitation to join ' + channel);
						helper.debug("I can't get OP in " + channel);
						client.part(channel, 'Unthorized request to join this channel');
						client.notice(from, "I'm unable to get OP in \002" + channel + '\002. Do you have set \002+o\002 flag in ChanServ?');
						client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
					}
				}, 30 * 1000);
			});
		});
		setTimeout(function () {
			if (channel in bot.channels_in_process.waiting_to_join) {
				delete bot.channels_in_process.requested[channel];
				delete bot.channels_in_process.waiting_to_join[channel];

				helper.error(from + ' has sent to me an invitation to join ' + channel + " but I'm unable to join the channel");
				client.notice(from, "I'm unable to join \002" + channel + '\002.');
				client.notice(from, 'If you need help, you can join \002' + bot.conf.channel + '\002.');
			}
		}, 10 * 1000);
	},
};


exports.recurrent = recurrent;
exports.processing_channel = processing_channel;