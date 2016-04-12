var botconf = {
	nickname: 'AntiNoisyBot',
	password: 'Your nickserv password here',
	server: 'chat.freenode.net',
	channel: '#AntiNoisyBot',
	max_part_number: 4,
	max_part_time: (60*30) * 1000,
	max_modes: 4, // Maximum number of mode that can be set in one command
	instable_connections_channel: '#AntiNoisyBot-banned', // Where to redirect instable connections
	debug: true,
	channel_debug: '#AntiNoisyBot-debug',
	verbose: true,

	loaded_modules: [
		'ping',
		'ctcp',
		'monitor',
		'flags',
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