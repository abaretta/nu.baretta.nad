"use strict";

// We need network functions.
var net = require('net');
// Temporarily store the device's IP address and name. For later use, it gets added to the device's settings
var tempIP = '';
var tempDeviceName = '';
// Variable to hold responses from the AVR
var receivedData = "";
var onoffState = "";
var inputState = "";
var volumeState = "";
var muteState = "";
// The NAD D7050 IP network interface uses port 50001.
var IPPort = 50001;
// a list of devices, with their 'id' as key
// it is generally advisable to keep a list of
// paired and active devices in your driver's memory.
var devices = {};
//
// All inputs for the NAD D7050 amplifier and a more friendly name to use.
var allPossibleInputs = [{
        inputName: "0",
        friendlyName: "Coaxial1"
    },
    {
        inputName: "1",
        friendlyName: "Coaxial2"
    },
    {
        inputName: "2",
        friendlyName: "Optical1"
    },
    {
        inputName: "3",
        friendlyName: "Optical2"
    },
    {
        inputName: "4",
        friendlyName: "Computer"
    },
    {
        inputName: "5",
        friendlyName: "Streaming"
    },
    {
        inputName: "6",
        friendlyName: "USB Dock"
    },
    {
        inputName: "7",
        friendlyName: "BT"
    }
];
        Homey.log("NAD D7050 app - input 2: " + JSON.stringify(allPossibleInputs[2]));
        Homey.log("NAD D7050 app - input 2: " + JSON.stringify(allPossibleInputs[2].friendlyName));

// init gets run at the time the app is loaded. We get the already added devices then need to run the callback when done.
module.exports.init = function(devices_data, callback) {
    devices_data.forEach(function(device_data) {
        Homey.log('NAD D7050 app - init device: ' + JSON.stringify(device_data));
        initDevice(device_data);
	Homey.log("onoffState: " + onoffState + " inputState: " + inputState + " volumeState: " + volumeState + " muteState: " + muteState);     
    })
    //tell Homey we're happy to go
    callback();
}

// start of pairing functions
module.exports.pair = function(socket) {
    // socket is a direct channel to the front-end

    // this method is run when Homey.emit('list_devices') is run on the front-end
    // which happens when you use the template `list_devices`
    socket.on('list_devices', function(data, callback) {

        Homey.log("NAD D7050 app - list_devices data: " + JSON.stringify(data));
        // tempIP and tempDeviceName we got from when get_devices was run (hopefully?)

        var newDevices = [{
            data: {
                id: tempIP
            },
            name: tempDeviceName,
            settings: {
                "settingIPAddress": tempIP
            } // initial settings
        }];

        callback(null, newDevices);
    });


    // this is called when the user presses save settings button in start.html
    socket.on('get_devices', function(data, callback) {

        // Set passed pair settings in variables
        tempIP = data.ipaddress;
        tempDeviceName = data.deviceName;
       for(var i = 0; i < 8; i++) {
        allPossibleInputs[i].friendlyName = data.input+i;
        Homey.log("NAD D7050 app - i : " + i + " " + JSON.stringify(allPossibleInputs[i]) );
	}
        Homey.log("NAD D7050 app - got get_devices from front-end, tempIP =", tempIP, " tempDeviceName = ", tempDeviceName);
        Homey.log("NAD D7050 app - input 2: " + JSON.stringify(allPossibleInputs[0]));
        // FIXME: should check if IP leads to an actual NAD device
        // assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices
        socket.emit('continue', null);
    });

    socket.on('disconnect', function() {
        Homey.log("NAD D7050 app - Pairing is finished (done or aborted)");
    })
}
// end pair

module.exports.added = function(device_data, callback) {
    // run when a device has been added by the user 
    Homey.log("NAD D7050 app - device added: " + JSON.stringify(device_data));
    // update devices data array
    initDevice(device_data);
    Homey.log('NAD D7050 app - add done. devices =' + JSON.stringify(devices));
    callback(null, true);
}

module.exports.renamed = function(device_data, new_name) {
    // run when the user has renamed the device in Homey.
    // It is recommended to synchronize a device's name, so the user is not confused
    // when it uses another remote to control that device (e.g. the manufacturer's app).
    Homey.log("NAD D7050 app - device renamed: " + JSON.stringify(device_data) + " new name: " + new_name);
    // update the devices array we keep
    devices[device_data.id].data.name = new_name;
}

module.exports.deleted = function(device_data) {
    // run when the user has deleted the device from Homey
    Homey.log("NAD D7050 app - device deleted: " + JSON.stringify(device_data));
    // remove from the devices array we keep
    delete devices[device_data.id];
}

// handling settings (wrench icon in devices)
module.exports.settings = function(device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed, for your convenience :)

    // always fire the callback, or the settings won't change!
    // if the settings must not be saved for whatever reason:
    // callback( "Your error message", null );
    // else callback( null, true );

    Homey.log('NAD D7050 app - Settings were changed: ' + JSON.stringify(device_data) + ' / ' + JSON.stringify(newSettingsObj) + ' / old = ' + JSON.stringify(oldSettingsObj) + ' / changedKeysArr = ' + JSON.stringify(changedKeysArr));

    try {
        changedKeysArr.forEach(function(key) {
            switch (key) {
                case 'settingIPAddress':
                    Homey.log('NAD D7050 app - IP address changed to ' + newSettingsObj.settingIPAddress);
                    // FIXME: check if IP is valid, otherwise return callback with an error
                    break;
            }
        })
        callback(null, true)
    } catch (error) {
        callback(error)
    }

}

// capabilities (for mobile cards)

module.exports.capabilities = {
    onoff: {

        get: function(device_data, callback) {
	    var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);
            Homey.log("NAD D7050 app - getting device on/off status of " + device_data.id);
	    setInterval(function(){
                Homey.log("NAD D7050 app - updating state every 10s for " + device_data.id);
		getStatus(device_data);
	    },10000);

            Homey.log("NAD D7050 app - onoffState: " + device.state.onoff);
            callback(null, device.state.onoff);
        },

        set: function(device_data, turnon, callback) {
            var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);

            device.state.onoff = turnon;

            Homey.log('NAD D7050 app - Setting device_status of ' + device_data.id + ' to ' + device.state.onoff);
            // turn amp 'on' 
            if (turnon) {
		powerOn(device_data);
                callback(null, true);
                // turnon standby mode  
            } else {
		powerOff(device_data);
                callback(null, false);
            }
        }
    },

    volume_mute: {

        get: function(device_data, callback) {
	    var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);
            Homey.log("NAD D7050 app - getting device mute status of " + device_data.id );
            callback(null, device.state.volume_mute);
        },

        set: function(device_data, mute, callback) {
            var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);

            device.state.volume_mute = mute;

            Homey.log('NAD D7050 app - Setting device_status of ' + device_data.id + ' to ' + device.state.volume_mute);
            // mute amp 
            if (mute) {
    		Mute(device_data);
                callback(null, true);
                // unmute  
            } else {
    		unMute(device_data);
                callback(null, false);
            }
        }
    }, 

    volume_set: {

        get: function(device_data, callback) {
	    var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);

            Homey.log("NAD D7050 app - getting device volume " + device_data.id);
            callback(null, device.state.volume_set);
        },

        set: function(device_data, volume_set, callback) {
            var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);
            Homey.log("NAD D7050 app - volume " + device.state.volume_set);
	    // mobile slider sends 0 - 1
            if (volume_set <= 1) volume_set = Math.round( volume_set * 99);
            Homey.log("NAD D7050 app - volume " + volume_set);
            Homey.log("NAD D7050 app - setting device volume " + device_data.id + " to " + volume_set);
	    // update state with volume 0 - 99
            device.state.volume_set = volume_set;

    	    setVolume(device_data, volume_set);
            return callback(null, device.state.volume_set);
        }

    },

    input_selected: {

        get: function(device_data, callback) {
       	    var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);

     	    Homey.log("NAD D7050 app - getting device input " + device_data.id);
            callback(null, device.state.input_selected);
        },

        set: function(device_data, input_selected, callback) {
            Homey.log("NAD D7050 app - setting device input " + device_data.id + " " + input_selected);
            var device = getDeviceByData(device_data);
            if (device instanceof Error) return callback(device);

            device.state.input_selected = input_selected;

	    changeInputSource(device_data, input_selected);
            return callback(null, device.state.input_selected);
        }

    }
}

// end capabilities

// start flow condition handlers

Homey.manager('flow').on('condition.onoff', function(callback, args) {
    var device = args.device;

    Homey.log("NAD D7050 app - Getting power state for condition card.");
    module.exports.capabilities.onoff.get(device, (object, state) => {
        callback(null, state);
    });
});

Homey.manager('flow').on('condition.volume_mute', function(callback, args) {
    var device = args.device;

    Homey.log("NAD D7050 app - Getting mute state for condition card.");
    module.exports.capabilities.volume_mute.get(device, (object, state) => {
        callback(null, state);
    });
});

Homey.manager('flow').on('condition.input_selected', function(callback, args) {
    var selected_input = args.input.inputName;
    Homey.log("NAD D7050 app - selected source " + selected_input);
    module.exports.capabilities.input_selected.get(args.device, (object, current_input) => {
        Homey.log("NAD D7050 app - callback current source " + current_input);
        if (selected_input == current_input) {
            Homey.log("NAD D7050 app - selected input equals current input " + selected_input);
            callback(null, true);
        } else {
            Homey.log("NAD D7050 app - selected input differs from current input " + selected_input);
            callback(null, false);
        }
    });
});

Homey.manager('flow').on('condition.input_selected.input.autocomplete', function(callback, value) {
    var inputSearchString = value.query;
    var items = searchForInputsByValue(inputSearchString);
    Homey.log("NAD D7050 app - selected source " + inputSearchString);
    callback(null, items);
});

// start flow action handlers

Homey.manager('flow').on('action.powerOn', function(callback, args) {
    var device = args.device;
    powerOn(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.powerOff', function(callback, args) {
    var device = args.device;

    powerOff(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.changeInput', function(callback, args) {
    var input = args.input.inputName;
    var device = args.device;
    changeInputSource(device, input);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.changeInput.input.autocomplete', function(callback, value) {
    var inputSearchString = value.query;
    var items = searchForInputsByValue(inputSearchString);
    callback(null, items);
});

Homey.manager('flow').on('action.mute', function(callback, args) {
    var device = args.device;
    Mute(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.unMute', function(callback, args) {
    var device = args.device;

    unMute(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.setVolume', function(callback, args) {
    var device = args.device;
    var targetVolume = args.volume;
    setVolume(device, targetVolume);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.volumeUp', function(callback, args) {
    var device = args.device;

    var volumeincrease = args.volume;
    module.exports.capabilities.volume_set.get(device, (object, volume_set) => {
        Homey.log("NAD D7050 app - callback current volume " + volume_set);
        var targetVolume = volume_set + volumeincrease;
        Homey.log("NAD D7050 app - setting volume to " + targetVolume);
        // set max
        if (targetVolume >= 99) {
            targetVolume = 99;
        }
        Homey.log("NAD D7050 app - correcting volume to " + targetVolume);
	module.exports.realtime( args.device, 'volume_set', targetVolume);
        // volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI 
        var Volume_hex = (2 * targetVolume + 2).toString(16);
        // pad volume levels to 2 digits
        if (Volume_hex.length < 2) Volume_hex = '0' + Volume_hex;
        var command = '00010204' + Volume_hex;
        sendCommandToDevice(device, command);
    });
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.volumeDown', function(callback, args) {
    var device = args.device;

    var volumedecrease = args.volume;
    module.exports.capabilities.volume_set.get(device, (object, volume_set) => {
        Homey.log("NAD D7050 app - callback current volume " + volume_set);
        var targetVolume = volume_set - volumedecrease;
        Homey.log("NAD D7050 app - setting volume to " + targetVolume);
        // set min
        if (targetVolume <= 0) {
            targetVolume = 0;
        }
        Homey.log("NAD D7050 app - correcting volume to " + targetVolume);
	module.exports.realtime( args.device, 'volume_set', targetVolume);
        // volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI 
        var Volume_hex = (2 * targetVolume + 2).toString(16);
        // pad volume levels to 2 digits
        if (Volume_hex.length < 2) Volume_hex = '0' + Volume_hex;
        var command = '00010204' + Volume_hex;
        sendCommandToDevice(device, command);
    });
    callback(null, true); // we've fired successfully
});

function powerOn(device) {
    var command = '0001020901';
    module.exports.realtime( device, 'onoff', true);
    sendCommandToDevice(device, command);
}

function powerOff(device) {
    var command = '0001020900';
    module.exports.realtime( device, 'onoff', false);
    sendCommandToDevice(device, command);
}

function autoShutOffOn(device) {
    var command = '00010208010001020208';
    sendCommandToDevice(device, command);
}

// NB: there is a bug in the D7050 that prevents auto-shutoff when spotify was used in some cases
function autoShutOffOff(device) {
    var command = '00010208000001020208';
    sendCommandToDevice(device, command);
}

// NB: power save enables 'ECO standby'. While in this mode, the amp can only be turned on by using the physical button or IR.
function powerSaveOn(device) {
    var command = '00010207010001020207';
    sendCommandToDevice(device, command);
}

function powerSaveOff(device) {
    var command = '00010207000001020207';
    sendCommandToDevice(device, command);
}

function changeInputSource(device, input) {
    var command = '000102030' + input;
    module.exports.realtime( device, 'input_selected', input);
    sendCommandToDevice(device, command);
}

function Mute(device) {
    module.exports.realtime( device, 'volume_mute', true);
    var command = '0001020a01';
    sendCommandToDevice(device, command);
}

function unMute(device) {
    module.exports.realtime( device, 'volume_mute', false);
    var command = '0001020a00';
    sendCommandToDevice(device, command);
}

function setVolume(device, targetVolume) {
    // volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI 
    module.exports.realtime( device, 'volume_set', targetVolume);
    var Volume_hex = (2 * targetVolume + 2).toString(16);
    if (Volume_hex.length < 2) Volume_hex = '0' + Volume_hex;
    var command = '00010204' + Volume_hex;
    sendCommandToDevice(device, command);
}

function sendCommandToDevice(device, command, callbackCommand) {
    module.exports.getSettings(device, function(err, settings) {
        Homey.log("NAD D7050 app - got settings " + JSON.stringify(settings));
        tempIP = settings.settingIPAddress;
        sendCommand(tempIP, command, callbackCommand);
    });
}

function sendCommand(hostIP, command, callbackCommand) {
    // clear variable that holds data received from the amp 
    receivedData = "";
    Homey.log("NAD D7050 app - sending " + command + " to " + hostIP);
    var client = new net.Socket();
    client.on('error', function(err) {
        Homey.log("NAD D7050 app - IP socket error: " + err.message + " command: " + command);
    })
    client.connect(IPPort, hostIP);
    client.write(Buffer.from(command, 'hex'));
    // get a response
    var i = 0;
    client.on('data', function(data) {
        var tempData = data.toString('hex');
       // receivedData = data.toString('hex');
        receivedData += tempData;
	i++;
	if(i==2){
  //      Homey.log("NAD D7050 app - got: " + tempData);
        Homey.log("NAD D7050 app - receivedData: " + receivedData);
	}
    })

    // fallback in case no response is received - after a delay, close connection
    setTimeout(function() {
        client.end();
        Homey.log("NAD D7050 app - send callback, receivedData: " + receivedData);
        // if we got a callback function, call it with the receivedData
        if (callbackCommand && typeof(callbackCommand) == "function") {
            callbackCommand(receivedData);
        }
    }, 150);
}

function searchForInputsByValue(value) {
    var possibleInputs = allPossibleInputs;
    var tempItems = [];
    for (var i = 0; i < possibleInputs.length; i++) {
        var tempInput = possibleInputs[i];
        if (tempInput.friendlyName.indexOf(value) >= 0) {
            tempItems.push({
                icon: "",
                name: tempInput.friendlyName,
                inputName: tempInput.inputName
            });
        }
    }
    return tempItems;
}

function getStatus(device_data) {
	try{
        if (typeof cap !== undefined){
	      	var device = getDeviceByData(device_data);
   		var command = '000102020900010202030001020204000102020a';
		var interval = setInterval(poll,2000);
		var retry = 0;
            	function poll(){
                Homey.log("NAD D7050 app - get status for " + device_data.id + " retry: " + retry);

              	sendCommandToDevice(device_data, command, function(receivedData) {
        	Homey.log('NAD D7050 app - ReceivedData bytes: ' + receivedData.length);
		if(receivedData.length == 40 || retry == 2) { 
                Homey.log("NAD D7050 app - data received or retry = " + retry + ", clear interval ");
		clearInterval(interval);
                Homey.log("NAD D7050 app - getstatus on/off of " + device_data.id);
                Homey.log("NAD D7050 app - got callback, receivedData: " + receivedData);
        	Homey.log('NAD D7050 app - ReceivedData: ' + receivedData);
		// old states
		var oldonoffState = device.state.onoff;
		var oldinputState = device.state.input_selected;
		var oldvolumeState = device.state.volume_set;
		var oldmuteState = device.state.volume_mute;

        	var onoffstring = receivedData.slice(0,10);

        		if(onoffstring.indexOf('0001020901') >= 0) {
        			Homey.log("NAD D7050 app - on: " + onoffstring);
				device.state.onoff = true;
        			} else if (onoffstring.indexOf('0001020900') >= 0) {
                                Homey.log("NAD D7050 app - in standby mode: " + onoffstring);
                                device.state.onoff = false;
				// in standby mode the amplifier can be switched on using the app, so it is still available.
				module.exports.setAvailable( device_data );
				} else {
        			Homey.log("NAD D7050 app - no response - powered off. " );
				device.state.onoff = false;
				}

                Homey.log("NAD D7050 app - capability power on: " + device.state.onoff);
		// update realtime data only in case it changed
		if(oldonoffState != device.state.onoff) {
   		module.exports.realtime( device_data, 'onoff', device.state.onoff);
// 		Causes the device to go to 'Offline' status. Unfortunately, you can't turned it back on when the amplifier is in stanby mode after powering it on
		if (device.state.onoff == false) {
			module.exports.setUnavailable( device_data, "Offline" );
			} else {
			module.exports.setAvailable( device_data );
			} 
		}

        	device.state.input_selected = receivedData.slice(19,20);

        	Homey.log('NAD D7050 app - Selected input: ' + device.state.input_selected);
		
		if(oldinputState != device.state.input_selected) {
    		module.exports.realtime( device_data, 'input_selected', device.state.input_selected);
		}

        	var volumeState_hex = receivedData.slice(28,30);
        	device.state.volume_set = Math.round(Number('0x' + volumeState_hex).toString(10)/2);

        	Homey.log('NAD D7050 app - Current volume: ' + device.state.volume_set);

		if(oldvolumeState != device.state.volume_set) {
		var mobilevol = device.state.volume_set/100;
   		//module.exports.realtime( device_data, 'volume_set', device.state.volume_set);
   		module.exports.realtime( device_data, 'volume_set', mobilevol);
		}

        	var mutestring = receivedData.slice(30,40);
		        if(mutestring.indexOf('0001020a01') >= 0) {
        			Homey.log('NAD D7050 app - Amp is muted: ' + mutestring);
				device.state.volume_mute = true;
        			}
        		else {
        			Homey.log('NAD D7050 app - Amp is not muted: ' + mutestring);
				device.state.volume_mute = false;
        		}
		if(oldmuteState != device.state.volume_mute){
   		module.exports.realtime( device_data, 'volume_mute', device.state.volume_mute);
		}
	    } else {
       			Homey.log('NAD D7050 app - no response, retry: ' + retry);
			retry++; 
	           }
            }); 
          }
	 }
	}
        catch (err){
                Homey.log("NAD D7050 app - caught error in getStatus function: " + err.message);
        }
}

// a helper method to get a device from the devices list by it's device_data object
function getDeviceByData(device_data) {
    var device = devices[device_data.id];
    if (typeof device === 'undefined') {
        return new Error("invalid_device");
    } else {
        return device;
    }
}

// a helper method to add a device to the devices list
function initDevice(device_data) {
    devices[device_data.id] = {};
    devices[device_data.id].state = {
        onoff: true
    };
    devices[device_data.id].state = {
        volume_mute: false
    };
    devices[device_data.id].state = {
        volume_set: 0 
    };
    devices[device_data.id].state = {
        input_selected: 5
    };
    getStatus(device_data);
devices[device_data.id].data = device_data;
}