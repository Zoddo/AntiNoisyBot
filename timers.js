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


exports.recurrent = recurrent;