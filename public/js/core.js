var helios = angular.module('helios', ['ngRoute', 'ui.bootstrap', 'toggle-switch']);

helios.config(function($routeProvider, $locationProvider){
	$routeProvider
		// Main View : List of Devices
		.when('/', {
			templateUrl		: 'views/partials/list.html',
			controller 		: 'listController'
		})

		// View for Adding a device
		.when('/add', {
			templateUrl		: 'views/partials/add.html',
			controller 		: 'addDeviceController'
		})

		.when('/scan', {
			templateUrl		: 'views/partials/scan.html',
			controller 		: 'scanNetworkController'
		})

		.when('/device/:id/edit', {
			templateUrl		: 'views/partials/add.html',
			controller 		: 'editDeviceController'
		})

		.when('/error', {
			templateUrl		: 'views/partials/error.html'
		})

		.otherwise({
			redirectTo 		: 'views/partials/error.html'
		});
	$locationProvider.html5Mode(true)
});

helios.factory('DeviceBroker', function($http, $q){
	var broker = {};
	var devices = [];
	timestamp = 0;

	broker.update = function(){
		return $http.get('/api/devices')
			.success(function(data){
				devices 	= data;
				timestamp 	= Date.now();
 				return true;
			})
			.error(function(data){
				console.log("DeviceBroker::Update::HTTP Request failed.");
				return $q.reject(data);
			});
	}

	broker.getAll = function(){
		var deferred = $q.defer();
		if( Date.now() - timestamp > 120000 ){ // 2 mins
			console.log("DeviceBroker::GetAll::Data too old. Fetching new.");
			broker.update()
				.success(function(data){
					console.log("%j", data);
					deferred.resolve(devices);
				})
				.error(function(data){
					deferred.reject(data);
				});		
		}else{
			console.log("DeviceBroker::GetAll::Reusing data.");
			console.log("%j", devices);
			deferred.resolve(devices);
		}
		return deferred.promise;
	}

	broker.setOnline = function(device, online){
		_.find(devices, {'id': device.id}).online = online;
	}

	broker.add = function(device){
		if( _.contains(devices, device, 0) ){
			console.log("DeviceBroker::Added existing device.")
			return;
		}

		devices.push(device);
		console.log("DeviceBroker::Add:: Added %j.", device);
	}

	broker.remove = function(device){
		if( !_.contains(devices, device, 0) )
			return;

		_.remove(devices, function(d){
			return d.id === device.id;
		})
	}

	broker.edit = function(device){
		console.log("New device: %j.", device);
		console.log("Before edit: %j.", devices);

		// Quickly remove the old device, to avoid full reload.
		_.remove(devices, function(d){
			return d.id === device.id;
		})

		// Push newly updated device to the stack of devices
		devices.push(device);
		console.log("After edit: %j.", devices);

	}

	return broker;
})



helios.controller('mainController', function($scope, $http) {
});

helios.controller('listController', function($scope, $route, $http, $modal, DeviceBroker, ModalFactory) {
	// Env Variables
	$scope.loading = true;

	// Setup lodash
	$scope._ = _;

	DeviceBroker.getAll()
		.then(function(response){
			$scope.loading = false;
			$scope.devices = response;
		});

	$scope.act = function(device){

		if( device.online ){	
			/* Three choices:
				1. Nothing is stored. Promt for username AND password.
				2. Username is stored. Promt for password.
				3. Username is stored, and cert injected. No promt.
			*/

			console.log("Acting on device %j", device);

			// Payload skeleton
			var payload = {
				device: {
					id: device.id
				},
				user: {
					username: null,
					password: null
				}
			}

			if( device.ssh_username && device.cert_injected ){
				$http.post('/api/shutdown', payload)
				.then(function(result){
					DeviceBroker.setOnline(device, false);
					console.log("Success");
				}, function(error){
					console.log(error);
				});
				return;
			}

			var passwordModal;

			if( !device.ssh_username && !device.cert_injected ){
				passwordModal = ModalFactory.generatePasswordModal(true);
			}else if( device.ssh_username && !device.cert_injected ){
				passwordModal = ModalFactory.generatePasswordModal(false);
			}
 	
 			passwordModal.result.then(function(user){
 				payload.username = user.username;
 				payload.password = user.password;

 				$http.post('/api/device/shutdown', payload)
 				.then(function(result){
 					console.log("Successfully shutdown target device, with username / password combination");
 					DeviceBroker.setOnline(device, false);
 				}, function(error){
 					console.log("Error: " + error);
 				});
 			});
		}else{
			$http.get('/api/device/wake/' + device.id)
				.success(function(data) {
					console.log("Successfully sent magic packet to js.", device);
					DeviceBroker.setOnline(device, true);
				})
				.error(function(data){
					console.log("Error in sending magic packet to %j.", device);
				});
		}

	}




	$scope.act_ = function(device){
		var api_selection = '/api/device/';
		if( device.online ){
			$http.post(api_selection + 'shutdown', {device:device})
				.success( function(data){
					console.log("Success: " + data);
				}).error(function(data, status){
					if( status !== 422 && data !== 'Please provide a password' ){
						console.log("Error: "  + data)
						return;
					}

					var passwordModal = ModalFactory.generatePasswordModal();
					passwordModal.result.then(function(details){
						var json = {
							device: device,
							user: {
								username: details.username,
								password: details.password
							} 
						}

						$http.post(api_selection + 'shutdown', json)
							.success(function(data){
								console.log("Successfully turned off %j.", device);
								DeviceBroker.setOnline(device, false);
							})
							.error(function(data){
								console.log("Shutdown error!");
							});
					});
			});
		}else{
			$http.get('/api/device/wake/' + device.id)
				.success(function(data) {
					console.log("Successfully sent magic packet to js.", device);
					DeviceBroker.setOnline(device, true);
				})
				.error(function(data){
					console.log("Error in sending magic packet to %j.", device);
				});

		}
	}

	$scope.delete = function(device){
		console.log("Attempting to delete %j", device);
		$http.delete('/api/device/' + device.id)
			.success(function(data){
				DeviceBroker.remove(device)
			})
			.error(function(data){
				console.log("Error: " + data);
			});
	}

	$scope.edit = function(device){
		editDevice.setID(device);
	}
});

helios.controller('passwordModalController', function($scope, $modalInstance, getUsername){
	$scope.promtForUsername = getUsername;
	$scope.ok = function(){
		var result = {
			username: null,
			password: null
		}

		if( getUsername )
			result.username = $scope.username;

		result.password = $scope.password;
		$modalInstance.close(result);
	}
	$scope.cancel = function(){
		$modalInstance.dismiss('cancel');
	}
});

helios.controller('errorModalController', function($scope, $modalInstance, content){
	$scope.content = content;
	$scope.ok = function(){
		$modalInstance.close();
	}
});


helios.factory('ModalFactory', function($modal){
	var service = {
		generateErrorModal: 	generateErrorModal,
		generatePasswordModal: 	generatePasswordModal,
		generateWaitModal: 		generateWaitModal
	}
	return service;

	///////////////

	function generateErrorModal(title, message){

		return $modal.open({
			templateUrl: '/views/partials/popups/error.html',
			controller: 'errorModalController',
			resolve:{
				content: function(){
					return {title, message};
				}
			}
		});
	}

	function generatePasswordModal(getUsername){
		return $modal.open({
			templateUrl: '/views/partials/popups/password.html',
			controller: 'passwordModalController',
			resolve:{
				getUsername: function(){
					return getUsername || false;
				}
			}
		});
	}

	function generateWaitModal(){
		return $modal.open({
			templateUrl: '/views/partials/popups/wait.html',
		});
	}
});




helios.controller('addDeviceController', function($scope, $rootScope, $location, $route, $http, $modal, DeviceBroker, $q, ModalFactory) {
	// Setup page variables
	$scope.OKButton = "Add";

	$scope.storeUser = true;
	$scope.userSudoer = true;

	$scope.injectOpts = {};
	$scope.injectOpts.user = true;
	$scope.injectOpts.cert = true;
	$scope.injectOpts.permissions = true;

	// Create device JSON object
	$scope.device = {};

	// Injection Progress
	$scope.injecting = false;


	// Hacky selection transfer from Scan page
	// TODO: Fix.
	if( $rootScope.device !== undefined ){
		$scope.device = $rootScope.device;
		$rootScope.device = null;
	}else{
		$scope.device = {};
	}

	$scope.test = function(){

		console.log("Test");

		var device = {
			id: 26,
			name: "Virtual",
			ip: "192.168.1.123",
			mac: "08:00:27:fe:c0:f6",
			ssh_username: "heliosshutdownuser",
			cert_injected: false
		}
		
		device.cert_injected = true;


		$http.put('/api/device/' +  device.id, {device: device})
		.then(function(result){
			console.log("Remote DB updated");
		}, function(error){
			console.log("Remote error");
		});


	}

	$scope.submit = function(device){


		// Verify inserted data



		console.log("Submitting device: %j", $scope.device);

		var error = undefined;
		if( $scope.device.mac === undefined || !$scope.device.mac.match(MACRegex) ){	
			error = "Error: MAC malformed.";
		}else if( $scope.device.ip === undefined || !$scope.device.ip.match(IPRegex) ){
			error = "Error: IP malformed.";
		}else if( $scope.device.name === undefined || !($scope.device.name.length > 0) ){
			error = "Error: Device name too short";
		}
		if( error ){
			console.log(error);
			return;
		}

		// Override ssh_username based on selection of user
		if( $scope.storeUser ){
			$scope.device.ssh_username = $scope.injectOpts.user? undefined : $scope.device.ssh_username;
		}

		// User selected not to store shutdown info
		if( !$scope.storeUser ){
			// Make sure  cert opts are false
			$scope.device.cert_injected = false;

			$http.post('/api/device', $scope.device)
			.then(function(result){
				console.log("Device added without remote config");	
				DeviceBroker.add($scope.device);
				$location.path('/');
			}, function(error){
				console.log("Error adding device, without remote config");
				ModalFactory.generateErrorModal("An error occured.", "An error occured while submitting device info. Please re-check the information and try again.");
			});
			// Early termination ftw
			return;
		}  

		// User chose to select custom user, without injecting the cet
		if( $scope.storeUser && $scope.injectOpts.user == false && !$scope.injectOpts.cert){
			$scope.device.ssh_username;
			$scope.device.cert_injected = false;

			$http.post('/api/device', $scope.device)
			.then(function(result){
				console.log("Device added without remote config");
				DeviceBroker.add($scope.device);
				$location.path('/');
			}, function(error){
				console.log("Error adding device w. custom user, without remote config");
				ModalFactory.generateErrorModal("An error occured.", "An error occured while submitting device info. Please re-check the information and try again.");
			});
			// Early temrination ftw
			return;
		}	


		// Promt user for password
		var passwordModal = ModalFactory.generatePasswordModal();

		// When username and password entry is gotten, perform remote configuration
		passwordModal.result.then(function(user){
			console.log("Remotely configuring");

			// Set username to undefined should default username be selected
			var inject = {
				username : $scope.injectOpts.user? undefined : $scope.device.ssh_username
			}


			var injectOpts = $scope.injectOpts;
			var loadingModal = ModalFactory.generateWaitModal();
			var device = $scope.device;

			// User chose to select custom user, and injecting cert into it.
			if( $scope.storeUser && $scope.injectOpts.user !== undefined && $scope.injectOpts.cert ){
				$scope.injectOpts.user = false;


				$http.post('/api/config/remote', { injectOpts, inject, device, user })
				.then(function(result){
					console.log("Device added after remotely configuring");
					DeviceBroker.add($scope.device);
					loadingModal.close();
				}, function(error){
					loadingModal.close();
					ModalFactory.generateErrorModal("An error occured.", "An error occured while submitting device info. Please re-check the information and try again.");
				});
				// Early termination
				return;
			}

			$http.post('/api/config/remote', { injectOpts, inject, device, user })
			.then(function(result){
				console.log("Injection successful.");
				loadingModal.close();

				// Cert was injected successfully!
				$scope.device.cert_injected = true;
				$scope.device.ssh_username = inject.username;

				$http.post('/api/device', $scope.device)
				.then(function(result){
					console.log("Device added after remotely configuring");
					DeviceBroker.add($scope.device);
					$location.path('/');
				}, function(error){
					console.log("Error adding device, without remote config");
					ModalFactory.generateErrorModal("An error occured.", "An error occured while submitting device info. Please re-check the information and try again.");
				});

			}, function(error){
				console.log("Injection error!");
				console.log(error);
				console.log("Adding device, only for username/password");

				$scope.device.cert_injected = false;
				$scope.device.ssh_username = undefined;

				loadingModal.close();

				ModalFactory.generateErrorModal("An error occured.", 
					"An error occured while remotely configuring the device. Until further notice, use username and password for shutdown of target.");

			});
		});	

	};


	$scope.cancel = function(){
		$location.path('/');
	}
});

helios.controller('editDeviceController', function($scope, $routeParams, $rootScope, $location, $route, $http, DeviceBroker){
	$scope.OKButton = "Update";
	var device 	= $http.get('/api/device/' + $routeParams.id)
		.success( function(data){
			$scope.device 		= data;
			/*$scope.device.id 	= data.id;
			$scope.device.name 	= data.name;
			$scope.device.ip 	= data.ip;
			$scope.device.mac 	= data.mac;*/
			//$scope.device.store_ssh_username = data.store_ssh_username;
			//if( $scope.device.store_ssh_username )
			//	$scope.device.ssh_username = data.ssh_username;
		})
		.error(function(data){
			console.log("Error in getting device to edit.");
			$location.path('/error');
		});

	$scope.submit = function(){
		console.log("Attempting to update device with ID " + $scope.device.id);
		var newDevice = {
			name: $scope.device.name,
			ip 	: $scope.device.ip,
			mac : $scope.device.mac,
			store_ssh_username : $scope.device.store_ssh_username
		};
		if( newDevice.store_ssh_username )
			newDevice.ssh_username = $scope.device.ssh_username;


		$http.put('api/device/'+$scope.device.id, {device: newDevice})
			.success(function(data){
				console.log("Updated device! %j", $scope.device);
				
				DeviceBroker.edit($scope.device);
				// Redirect to main
				$location.path('/');
			})
			.error(function(data, status){
				console.log("Error: " + data);
				$location.path('/error');
			});
	}

	$scope.cancel = function(){
		$location.path('/');
	}
});

helios.controller('scanNetworkController', function($http, $scope, $rootScope, DeviceBroker, $location){
	$scope.loading = true;

	// Setup lodash
	$scope._ = _;

	var devices = $http.get('/api/scan')
		.success(function(data){
			$scope.devices = data;
			$scope.loading = false;
		})
		.error(function(error){

		});

	$scope.select = function(device){
		$rootScope.device = device;
		console.log("Selected scanned device: %j", $rootScope.device);
		$location.path('/add');
	}
});










// Directives
var IPRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

helios.directive('ipAddress', function(){
	return {
		restrict: 'A',
		require: 'ngModel',

		link: function($scope, $element, $attrs, ngModel) {
			$scope.$watch($attrs.ngModel, function(value) {
				var isValid = (IPRegex.test(value));
				ngModel.$setValidity('invalidIP', isValid);
			});
		}
	}
});

var MACRegex = new RegExp("^(([A-Fa-f0-9]{2}[:\.-]){5}[A-Fa-f0-9]{2})$");
helios.directive('macAddress', function(){
	return{
		restrict: 'A',
		require: 'ngModel',
		
		link: function($scope, $element, $attrs, ngModel) {
			$scope.$watch($attrs.ngModel, function(value) {
				var isValid = (MACRegex.test(value));
				ngModel.$setValidity('invalidḾac', isValid);
			});
		}
	}
});









