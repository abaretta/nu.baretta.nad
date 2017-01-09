"use strict";

// We need network functions.
var net = require('net');
// Temporarily store the device's IP address and name. For later use, it gets added to the device's settings
var tempIP = '';
var tempDeviceName = '';
// Variable to hold responses from the AVR
var receivedData = "";
// The NAD D7050 IP network interface uses port 50001.
var IPPort = 50001;
// a list of devices, with their 'id' as key
// it is generally advisable to keep a list of
// paired and active devices in your driver's memory.
var devices = {};
// All known inputs for supported Denon/Marantz AV receivers and a more friendly name to use.
// If you find your favorite input missing, please file a bug on the GitHub repository.
var allPossibleInputs = [
		{	inputName: "0",
	 		friendlyName: "Coax 1"
		},
		{	inputName: "1",
	 		friendlyName: "Coax 2"
		},
		{	inputName: "2",
	 		friendlyName: "Optical 1"
		},
		{	inputName: "3",
	 		friendlyName: "Optical 2"
		},
		{	inputName: "4",
	 		friendlyName: "Computer"
		},
		{	inputName: "5",
	 		friendlyName: "Streaming"
		},
		{	inputName: "6",
			friendlyName: "USB Dock"
		},
		{	inputName: "7",
			friendlyName: "BT"
		}
];

// init gets run at the time the app is loaded. We get the already added devices then need to run the callback when done.
module.exports.init = function( devices_data, callback ) {
	devices_data.forEach(function(device_data){
		Homey.log('NAD D7050 app - init device: ' + JSON.stringify(device_data));
	  initDevice( device_data );
	})
	//tell Homey we're happy to go
	  callback();
}

// start of pairing functions
module.exports.pair = function( socket ) {
// socket is a direct channel to the front-end

// this method is run when Homey.emit('list_devices') is run on the front-end
// which happens when you use the template `list_devices`
	socket.on('list_devices', function( data, callback ) {

		Homey.log( "NAD D7050 app - list_devices data: " + JSON.stringify(data));
// tempIP and tempDeviceName we got from when get_devices was run (hopefully?)

		var newDevices = [{
			data: {
				id				: tempIP
			},
			name: tempDeviceName,
			settings: { "settingIPAddress": tempIP } // initial settings
		}];

		callback( null, newDevices );
	});


// this is called when the user presses save settings button in start.html
	socket.on('get_devices', function( data, callback ) {

		// Set passed pair settings in variables
		tempIP = data.ipaddress;
		tempDeviceName = data.deviceName;
		Homey.log ( "NAD D7050 app - got get_devices from front-end, tempIP =", tempIP, " tempDeviceName = ", tempDeviceName );
// FIXME: should check if IP leads to an actual NAD device
// assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices
		socket.emit ( 'continue', null );
	});

		socket.on('disconnect', function() {
			console.log("NAD D7050 app - Pairing is finished (done or aborted)");
	  })
}
// end pair

module.exports.added = function( device_data, callback ) {
    // run when a device has been added by the user 
		Homey.log("NAD D7050 app - device added: " + JSON.stringify(device_data));
		// update devices data array
    initDevice( device_data );
		Homey.log('NAD D7050 app - add done. devices =' + JSON.stringify(devices));
		callback( null, true );
}

module.exports.renamed = function( device_data, new_name ) {
    // run when the user has renamed the device in Homey.
    // It is recommended to synchronize a device's name, so the user is not confused
    // when it uses another remote to control that device (e.g. the manufacturer's app).
		Homey.log("NAD D7050 app - device renamed: " + JSON.stringify(device_data) + " new name: " + new_name);
		// update the devices array we keep
		devices[device_data.id].data.name = new_name;
}

module.exports.deleted = function( device_data ) {
    // run when the user has deleted the device from Homey
		Homey.log("NAD D7050 app - device deleted: " + JSON.stringify(device_data));
		// remove from the devices array we keep
    delete devices[ device_data.id ];
}

// handling settings (wrench icon in devices)
module.exports.settings = function( device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback ) {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed, for your convenience :)

    // always fire the callback, or the settings won't change!
    // if the settings must not be saved for whatever reason:
    // callback( "Your error message", null );
    // else callback( null, true );

		Homey.log ('NAD D7050 app - Settings were changed: ' + JSON.stringify(device_data) + ' / ' + JSON.stringify(newSettingsObj) + ' / old = ' + JSON.stringify(oldSettingsObj) + ' / changedKeysArr = ' + JSON.stringify(changedKeysArr));

		try {
      changedKeysArr.forEach(function (key) {
					switch (key) {
						case 'settingIPAddress':
							Homey.log ('NAD D7050 app - IP address changed to ' + newSettingsObj.settingIPAddress);
							// FIXME: check if IP is valid, otherwise return callback with an error
							break;
					}
      })
      callback(null, true)
    } catch (error) {
      callback(error)
    }

}

// capabilities

module.exports.capabilities = {
    onoff: {

        get: function( device_data, callbackCapability ){

					Homey.log("NAD D7050 app - getting device on/off status of " + device_data.id);
					var command = '0001020209';
					sendCommandToDevice ( device_data, command, function(receivedData) {
						Homey.log("NAD D7050 app - got callback, receivedData: " + receivedData);
// if the response contained "0001020901", the amplifier was on, "0001020900" means it was in standby mode.
						if (receivedData.indexOf('0001020901') >= 0) {
							Homey.log("NAD D7050 app - telling capability power is on");
							callbackCapability (null, true);
						}	else {
							Homey.log("NAD D7050 app - telling capability power is standby");
							callbackCapability (null, false);
						}
					} );
        },

        set: function( device_data, turnon, callbackCapability ) {

	        Homey.log('NAD D7050 app - Setting device_status of ' + device_data.id + ' to ' + turnon);

					if (turnon) {
						//var command = new Buffer('0001020901','hex')
						var command = '0001020901';
						sendCommandToDevice ( device_data, command );
						callbackCapability (null, true);

					} else {
						var command = '0001020900';
						sendCommandToDevice ( device_data, command );
						callbackCapability (null, true);

					}
        }
    }
}

// end capabilities

// start flow action handlers

Homey.manager('flow').on('action.powerOn', function( callback, args ){
	var device = args.device;
	powerOn ( device );
  callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.powerOff', function( callback, args ){
	var device = args.device;
	powerOff ( device );
  callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.changeInput', function( callback, args ){
	var input = args.input.inputName;
	var device = args.device;
	changeInputSource ( device, input );
  callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.changeInput.input.autocomplete', function( callback, value ) {
	var inputSearchString = value.query;
	var items = searchForInputsByValue( inputSearchString );
	callback( null, items );
});

Homey.manager('flow').on('action.mute', function( callback, args ){
	var device = args.device;
	mute ( device );
  callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.unMute', function( callback, args ){
	var device = args.device;
	unMute ( device );
  callback( null, true ); // we've fired successfully
});

Homey.manager('flow').on('action.setVolume', function( callback, args ){
	var device = args.device;
	var targetVolume = args.volume;
	setVolume ( device, targetVolume );
  callback( null, true ); // we've fired successfully
});

function powerOn ( device ) {
	var command = '0001020901';
	sendCommandToDevice ( device, command );
}

function powerOff ( device ) {
	var command = '0001020900';
	sendCommandToDevice ( device, command );
}

function autoShutOffOn ( device ) {
	var command = '00010208010001020208';
	sendCommandToDevice ( device, command );
}

function autoShutOffOff ( device ) {
	var command = '00010208000001020208';
	sendCommandToDevice ( device, command );
}

// NB: power save enables 'ECO standby'. While in this mode, the amp can only be turned on by using the physical button or IR.
function powerSaveOn ( device ) {
	var command = '00010207010001020207';
	sendCommandToDevice ( device, command );
}

function powerSaveOff ( device ) {
	var command = '00010207000001020207';
	sendCommandToDevice ( device, command );
}

function changeInputSource ( device, input ) {
		var command = '000102030' + input;
		sendCommandToDevice ( device, command );
}

function mute ( device ) {
	var command = '0001020a01';
	sendCommandToDevice ( device, command );
}

function unMute ( device ) {
	var command = '0001020a00';
	sendCommandToDevice ( device, command );
}

// There's probably a nicer way to do this
function padWithZeroes(n, width) { while(n.length<width) n = '0' + n; return n;}

function setVolume ( device, targetVolume ) {
// volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI 
	var Volume_hex = (2*targetVolume+2).toString(16);
// pad volume levels to 2 digits
	var Volume_hex_pad = padWithZeroes(Volume_hex,2);
	var command = '00010204' + Volume_hex;
	sendCommandToDevice ( device, command );
}

function sendCommandToDevice ( device, command, callbackCommand ) {
	module.exports.getSettings (device, function(err, settings){
		Homey.log ( "NAD D7050 app - got settings "+JSON.stringify(settings) );
		tempIP = settings.settingIPAddress;
		sendCommand ( tempIP, command, callbackCommand );
	});
}

function sendCommand ( hostIP, command, callbackCommand ) {
	// clear variable that holds data received from the AVR
	receivedData = "";
	var displayCommand=command;
	Homey.log ( "NAD D7050 app - sending "+displayCommand+" to "+hostIP );
	var client = new net.Socket();
	client.on('error', function(err){
	    Homey.log("NAD D7050 app - IP socket error: "+err.message);
	})
	client.connect(IPPort, hostIP);
	client.write(new Buffer(command, 'hex'));

// get a response
	client.on('data', function(data){
			//var tempData = data.toString().replace("\r", ";");
			var tempData = data.toString('hex').replace("\r", ";");
			Homey.log("NAD D7050 app - got: " + tempData);
			receivedData += tempData;
	})

// after a delay, close connection
	setTimeout ( function() {
		receivedData = receivedData.replace("\r", ";")
		Homey.log("NAD D7050 app - closing connection, receivedData: " + receivedData );
		client.end();
// if we got a callback function, call it with the receivedData
		if (callbackCommand && typeof(callbackCommand) == "function") {
			callbackCommand(receivedData);
		}
  }, 1000);
}

function searchForInputsByValue ( value ) {
	var possibleInputs = allPossibleInputs;
	var tempItems = [];
	for (var i = 0; i < possibleInputs.length; i++) {
		var tempInput = possibleInputs[i];
		if ( tempInput.friendlyName.indexOf(value) >= 0 ) {
			tempItems.push({ icon: "", name: tempInput.friendlyName, inputName: tempInput.inputName });
		}
	}
	return tempItems;
}

// a helper method to add a device to the devices list
function initDevice( device_data ) {
    devices[ device_data.id ] = {};
    devices[ device_data.id ].state = { onoff: true };
    devices[ device_data.id ].data = device_data;
}