var botconf = {
	nickname: 'AntiNoisyBot',
	password: 'Your nickserv password here',
	server: 'chat.freenode.net',
	channel: '#AntiNoisyBot',
	max_modes: 4, // Maximum number of mode that can be set in one MODE command
	unstable_connections_channel: '#AntiNoisyBot-banned', // Where to redirect instable connections
	debug: true,
	channel_debug: '#AntiNoisyBot-debug',
	verbose: true,

	noisy_points_max: 10,
	noisy_points_expire: (60*30) * 1000, // in milliseconds
	noisy_points: {
		'default': 2, // 5 quits

		//'quit reason': points,
		'Remote host closed the connection': 3,
		'Ping timeout': 3, // 4 quits, unstable connection...
		'Max SendQ exceeded': 7, // Probably a spambot

		'Changing host': 0, // Fake quit because of host change
		'*.net *.split': 0, // Network problem...
		'Killed': 0, // Disconnected by oper
		'K-Lined': 0, // Already banned from network, setting a channel ban after that is useless...
	},

	loaded_modules: [
		'ping',
		'ctcp',
		'monitor',
		'flags',
		'set',
		'restrict',
		'module',
		'database',
		'restart',
		'raw',
		// 'lag',
		// 'eval',
	],

	commands_trigger: '!',
	enable_eval: false, //      /!\ DANGEROUS COMMAND /!\
};


exports.botconf = botconf;