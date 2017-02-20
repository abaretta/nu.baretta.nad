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
var muteState = false;
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
        allPossibleInputs[0].friendlyName = data.input0; // Coax 1
        allPossibleInputs[1].friendlyName = data.input1; // Coax 2
        allPossibleInputs[2].friendlyName = data.input2; // Optical 1
        allPossibleInputs[3].friendlyName = data.input3; // Optical 2
        allPossibleInputs[4].friendlyName = data.input4; // Computer
       	allPossibleInputs[5].friendlyName = data.input5; // Streaming
        allPossibleInputs[6].friendlyName = data.input6; // USB Dock
        allPossibleInputs[7].friendlyName = data.input7; // BT
        Homey.log("NAD D7050 app - got get_devices from front-end, tempIP =", tempIP, " tempDeviceName = ", tempDeviceName);
        Homey.log("NAD D7050 app - input 2: " + JSON.stringify(allPossibleInputs[0]));
        // FIXME: should check if IP leads to an actual NAD device
        // assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices
        socket.emit('continue', null);
    });

    socket.on('disconnect', function() {
        console.log("NAD D7050 app - Pairing is finished (done or aborted)");
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
            Homey.log("NAD D7050 app - getting device on/off status of " + device_data.id);
	    getStatus(device_data.id);
	    setInterval(function(){
                Homey.log("NAD D7050 app - test updating state every 10s for " + device_data.id);
		getStatus(device_data);
	    },10000);
            Homey.log("NAD D7050 app - onoffState: " + onoffState);
            callback(null, true);
        },

        set: function(device_data, turnon, callback) {

            Homey.log('NAD D7050 app - Setting device_status of ' + device_data.id + ' to ' + turnon);
            // turn amp 'on' 
            if (turnon) {
		powerOn(device_data);
                callback(null, true);
                // turnon standby mode  
            } else {
		powerOff(device_data);
                callback(null, true);
            }
        }
    },

    volume_mute: {

        get: function(device_data, callback) {
            Homey.log("NAD D7050 app - getting device mute status of " + device_data.id );
	    getStatus(device_data.id);
            callback(null, true);
        },

        set: function(device_data, mute, callback) {

            Homey.log('NAD D7050 app - Setting device_status of ' + device_data.id + ' to ' + mute);
            // mute amp 
            if (mute) {
    		Mute(device_data);
		muteState = true;
                callback(null, true);
                // unmute  
            } else {
    		unMute(device_data);
		muteState = false;
                callback(null, true);
            }
        }
    }, 

    volume_set: {

        get: function(device_data, callback) {

            Homey.log("NAD D7050 app - getting device volume " + device_data.id);
 	    getStatus(device_data.id);
            callback(null, true);
        },

        set: function(device_data, volume_set, callback) {
            Homey.log("NAD D7050 app - volume " + volume_set);
	    // mobile slider sends 0 - 1
            if (volume_set <= 1) volume_set = Math.round( volume_set * 99);
            Homey.log("NAD D7050 app - volume " + volume_set);
            Homey.log("NAD D7050 app - setting device volume " + device_data.id + " to " + volume_set);
    	    setVolume(device_data, volume_set);
            return callback(null, volume_set);
        }

    },

    input_selected: {

        get: function(device_data, callback) {
            Homey.log("NAD D7050 app - getting device input " + device_data.id);
 	    getStatus(device_data.id);
            callback(null, true);
        },

        set: function(device_data, input_selected, callback) {
            Homey.log("NAD D7050 app - setting device input " + device_data.id + " " + input_selected);
	    changeInputSource(device_data, input_selected);
            return callback(null, input_selected);
        }

    }
}

// end capabilities

// start flow condition handlers

Homey.manager('flow').on('condition.onoff', function(callback, args) {
    var device = args.device;
    Homey.log("NAD D7050 app - Getting power state for condition card.");
    module.exports.capabilities.onoff.get(args.device, (object, state) => {
        callback(null, state);
    });
});

Homey.manager('flow').on('condition.volume_mute', function(callback, args) {
    var device = args.device;
    Homey.log("NAD D7050 app - Getting mute state for condition card.");
    module.exports.capabilities.volume_mute.get(args.device, (object, state) => {
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
    module.exports.realtime( args.device, 'onoff', true);
    var device = args.device;
    powerOn(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.powerOff', function(callback, args) {
    module.exports.realtime( args.device, 'onoff', false);
    var device = args.device;
    powerOff(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.changeInput', function(callback, args) {
    module.exports.realtime( args.device, 'input_selected', args.input.inputName);
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
    module.exports.realtime( args.device, 'volume_mute', true);
    var device = args.device;
    Mute(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.unMute', function(callback, args) {
    module.exports.realtime( args.device, 'volume_mute', false);
    var device = args.device;
    unMute(device);
    callback(null, true); // we've fired successfully
});

Homey.manager('flow').on('action.setVolume', function(callback, args) {
    module.exports.realtime( args.device, 'volume_set', args.volume);
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
    module.exports.realtime( device, 'onoff', true);
    var command = '0001020901';
    sendCommandToDevice(device, command);
}

function powerOff(device) {
    module.exports.realtime( device, 'onoff', false);
    var command = '0001020900';
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
    module.exports.realtime( device, 'input_selected', input);
    var command = '000102030' + input;
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
    }, 300);
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
            Homey.log("NAD D7050 app - getting device on/off status of " + device_data.id);
             var command = '000102020900010202030001020204000102020a';
             sendCommandToDevice(device_data, command, function(receivedData) {
                Homey.log("NAD D7050 app - got callback, receivedData: " + receivedData);
        	console.log('NAD D7050 app - ReceivedData bytes: ' + receivedData.length);
        	console.log('NAD D7050 app - ReceivedData: ' + receivedData);
        	onoffState = receivedData.slice(0,10);
        		if(onoffState.indexOf('0001020901') >= 0) {
        			console.log("NAD D7050 app - on: " + onoffState);
				onoffState = true;
        			} else if (onoffState.indexOf('0001020900') >= 0) {
                                console.log("NAD D7050 app - in standby mode: " + onoffState);
                                onoffState = false;
				} else {
        			console.log("NAD D7050 app - no response - powered off: " + onoffState);
				onoffState = false;
				}
                Homey.log("NAD D7050 app - capability power on: " + onoffState);
   		module.exports.realtime( device_data, 'onoff', onoffState);

        	inputState = receivedData.slice(19,20);
        	console.log('NAD D7050 app - Selected input: ' + inputState);
    		module.exports.realtime( device_data, 'input_selected', inputState);

        	var volumeState_hex = receivedData.slice(28,30);
        	volumeState = Math.round(Number('0x' + volumeState_hex).toString(10)/2);
        	console.log('NAD D7050 app - Current volume: ' + volumeState);
   		module.exports.realtime( device_data, 'volume_set', volumeState);

        	muteState = receivedData.slice(30,40);
		        if(muteState.indexOf('0001020a01') >= 0) {
        			console.log('NAD D7050 app - Amp is muted: ' + muteState);
				muteState = true;
        			}
        		else {
        			console.log('NAD D7050 app - Amp is not muted: ' + muteState);
				muteState = false;
        		}
   		module.exports.realtime( device_data, 'volume_mute', muteState);
            }); 
	 }
	}
        catch (e){
                Homey.log("NAD D7050 app - caught error in getStatus function");
                //Nothing here, just catching errors
        }
}
// a helper method to add a device to the devices list
function initDevice(device_data) {
    devices[device_data.id] = {};
    devices[device_data.id].state = {
        onoff: true
    };
    getStatus(device_data);
devices[device_data.id].data = device_data;
}
