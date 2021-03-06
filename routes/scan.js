var nmap = require('node-libnmap');
var arp = require('node-arp');
var Q = require('q');
var _ = require('lodash');
var ip = require('ip');
var os = require('os');


module.exports = function(app, db){
	app.get('/api/scan', function(req, res){

		var nmapOptions = {};

		if( os.platform() === 'darwin' ){
			console.log("OS X Detected. Using verison 10.10 settings.");
			nmapOptions.nmap = '/usr/local/bin/nmap';
		}

		// Runs nmap to find devices on local network
		nmap.nmap('discover', nmapOptions, function(err, report){
			if (err) throw err

			// function for using arp to resolve mac, from IP
			function arpRequest(device){
				var deferred = Q.defer();
				arp.getMAC(device.ip, function(err, mac){
					if(err) throw err;
					
					// Since ARP does not generate 2 digit hex consequently, we prepend 0s
					mac = _.map(mac.split(":"), function(p) { return p.length == 2 ? p : 0 + p; }).join(":");

					device.mac = mac;
					console.log("Resolved MAC for IP: %s, to: %s.", device.ip, device.mac);
					deferred.resolve(device);
				})
				return deferred.promise;
			}
					
			// Create promise request array
			var arpRequests = [];
			var devices = [];

			var heliosIP = ip.address();
			
			for( var i = 0 ; i < report[0].neighbors.length ; i++ ){
				// Filter out Helios' own IP
				if( report[0].neighbors[i] === heliosIP ){
					console.log("Filtered IP: " + report[0].neighbors[i]);
					continue;
				}

				device = {};
				device.ip = report[0].neighbors[i];
				devices.push(device);
				arpRequests.push(arpRequest(device));
			}

			// Execute promises
			Q.all(arpRequests).then(function(promises){
				res.json(devices);
			});

		});

	});

}