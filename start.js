var cluster = require('cluster');

if (cluster.isMaster) {
	var spawn_number = 0;

	function spawn()
	{
		global.fork = cluster.fork({'RESPAWN': spawn_number});
		console.log('Forked into PID %s.', fork.process.pid);
		console.log('');

		spawn_number++;

		fork.once('exit', function(code, signal) {
			if ((signal || code !== 0) && signal !== 'SIGINT') {
				if (code === 20) spawn_number = 0; // Restart requested

				console.error('');console.error('');
				if (spawn_number < 3) {
					console.error('\u001b[01;31mERROR: The worker (PID: %d) has exited with %s. Respawning... \u001b[0m', fork.process.pid, signal || code);
					setTimeout(spawn, 2000);
				} else {
					console.error('\u001b[01;31mERROR: The worker (PID: %d) has exited with %s.\u001b[0m', fork.process.pid, signal || code);
					console.error('\u001b[01;31mThe worker has been respawned 2 times. It seems that there is a problem. Stopping ...\u001b[0m');
					process.exit(signal ? 30 : code);
				}
			}
		});
	}

	spawn();
	
	process.on('SIGINT', function() {
		if (fork && !fork.isDead())
			fork.kill('SIGINT');
		else
			process.exit();
	});
}

if (cluster.isWorker) {
	require('./bot.js');
}