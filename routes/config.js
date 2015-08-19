var config 	= require("../config.json");

var SSH2Shell = require ('ssh2shell');

module.exports = function(app, db){
	app.post('/api/config/cert', function(req, res){

		console.log("API::Config::Cert: Injecting Helios certificate into target: %j", req.body);

		var ip				= req.body.device.ip;
		var port 			= req.body.device.port || '22';

		var username 		= req.body.username || 'test';
		var password 		= req.body.password || 'password';
		var sshFolder 		= req.body.sshFolder || '.ssh';
		var authKeysFile 	= req.body.authKeysFile || 'authorized_keys';


		// Helios
		var heliosHttpPrefix 	= config.ssl_enabled ? "https://" : "http://";
		var heliosPort 			= config.ssl_enabled ? config.ssl_port : config.port;
		var heliosIP 			= require('ip').address();


		// Concats options to shorthand variables
		var heliosHost 			= heliosHttpPrefix + heliosIP + ":" + heliosPort;
		console.log("heliosHost = " + heliosHost);

		// Set up taget machine for injection
		var targetCertInject = {
			server: {     
				host:         ip,
				port:         port,
				userName:     username,
				password:     password
			},
			commands: [
				"wget --no-check-certificate " +  heliosHost +"/api/helios/cert -O HeliosCertificate.key",
				"msg:Helios certificate downloaded.",
				"sudo useradd -r " + config.ssh_user +" -m",
				"sudo mkdir -p ~/../" + config.ssh_user +"/.ssh",
				"sudo chown " + config.ssh_user + ":" + config.ssh_user +" ~/../" + config.ssh_user +"/.ssh",
				"sudo chmod 777 ~/../" + config.ssh_user +"/.ssh",
				"sudo cat HeliosCertificate.key >> ~/../" + config.ssh_user +"/.ssh/authorized_keys",
				"sudo chown " + config.ssh_user + ":" + config.ssh_user +" ~/../" + config.ssh_user +"/.ssh/authorized_keys",
				"sudo chmod 600 ~/../" + config.ssh_user +"/.ssh/authorized_keys",
				"sudo chmod 700 ~/../" + config.ssh_user +"/.ssh",
				"sudo rm HeliosCertificate.key"
			],
			onEnd: function( sessionText, sshObj ) {
				console.log("API::Config::Cert: SSH session ended.");
				console.log(sessionText);
				//res.sendStatus(200);
			},
			onCommandTimeout: function(command, response, sshObj, stream, connection){
				console.log("API::Config::Cert: SSH command timed out.")
				//res.sendStatus(404);
			}

		};
		//var SSH2Shell = require ('ssh2shell');
		var SSH = new SSH2Shell(targetCertInject);
	
		/*SSH.on("error", function onError(err, type, close, callback) {
			console.log("API::Config::Cert: SSH error.");
			console.log(type);
			console.log(err);
			res.sendStatus(404);
		});*/

		SSH.connect();
	});
	
	app.get('/api/config/shutdown', function(req, res){

		console.log("API::Config::Shutdown: Elevating Helios shutdown user, to allow shutdown on target: %j");
		
		var ip				= '192.168.1.134';
		var port 			= '22';
		var username 		= 'test';
		var password 		= 'password';


		// Helios
		var heliosHttpPrefix 	= config.ssl_enabled ? "https://" : "http://";
		var heliosPort 			= config.ssl_enabled ? config.ssl_port : config.port;
		var heliosIP 			= require('ip').address();
		// Concats options to shorthand variables
		var heliosHost 			= heliosHttpPrefix + heliosIP + ":" + heliosPort;
		console.log("heliosHost = " + heliosHost);


		var targetPermInject = {
			server: {     
				host:         ip,
				port:         port,
				userName:     username,
				password:     password
			},
			commands: [
				"wget --no-check-certificate " +  heliosHost +"/api/helios/sudoers -O ~/heliosshutdownuser",
				"sudo chmod 0440 ~/heliosshutdownuser",
				"sudo chown root:root ~/heliosshutdownuser",
				"sudo mv ~/heliosshutdownuser /etc/sudoers.d/"
			],
			onEnd: function( sessionText, sshObj ) {
				console.log("API::Config::Permissions: SSH session ended.");
				console.log(sessionText);
				//res.sendStatus(200);
			},
			verbose:             true/false,  //optional default:false 
  			debug:               true/false
		};

	
		/*SSH.on("error", function onError(err, type, close, callback) {
			console.log("API::Config::Shutdown: SSH error.");
			console.log(type);
			console.log(err);
			res.sendStatus(404);
		});*/
		var SSH = new SSH2Shell(targetPermInject);
		SSH.connect();
	});
	
	
}