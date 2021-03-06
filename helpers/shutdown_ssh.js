var config = require(__base + 'config.json');

module.exports.shutdown = function(device, username, password){
	var Client = require('ssh2').Client;

	var conn = new Client();
	conn.on('ready', function() {
	  console.log('Client :: ready');
	  conn.exec('sudo -S shutdown -P now', { pty: true }, function(err, stream) {
	    if (err) throw err;
	    var b = '', pwsent = false;
	    stream.on('close', function(code, signal) {
	      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
	      conn.end();
	    }).on('data', function(data) {
	    	if(!pwsent){
				b += data.toString();
				if(b.substr(-2) === ': ' ){
					pwsent = true;
					stream.write(password + '\n');
					b = '';
				}
	  		}
	    }).stderr.on('data', function(data) {
	      console.log('STDERR: ' + data);
	    });
	  });
	}).connect({
	  host: device.ip,
	  port: 22,
	  username: username,
	  password: password
	});
};



module.exports.shutdown_cert = function(device, username){
  var Client = require('ssh2').Client;
  var conn = new Client;

  	var conn = new Client();
	conn.on('ready', function() {
	  console.log('Client :: ready');
	  conn.exec('sudo shutdown -P now', { pty: true }, function(err, stream) {
	    if (err) throw err;
	    stream.on('close', function(code, signal) {
	      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
	      conn.end();
	    }).stderr.on('data', function(data) {
	      console.log('STDERR: ' + data);
	    });
	  });
	}).connect({
		host: device.ip,
		port: 22,
		username: username,
		privateKey: require('fs').readFileSync(config.ssh_key)
	});

}