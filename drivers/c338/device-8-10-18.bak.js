/* From Homey SDK 2.0 docs: The file device.js is a representation of an already paired device on Homey */
'use strict';

const Homey = require('homey');

// We need network functions.
var net = require('net');

// keep a list of devices in memory
var devices = [];

// client holds net.Socket
var client = "";
// receivedData holds unparsed data received from the client (data received over the network)
var receivedData = "";

var IPPort = 50001;
var allPossibleInputs = [{
    inputName: "0",
    friendlyName: "Coaxial1"
}, {
    inputName: "1",
    friendlyName: "Coaxial2"
}, {
    inputName: "2",
    friendlyName: "Optical1"
}, {
    inputName: "3",
    friendlyName: "Optical2"
}, {
    inputName: "4",
    friendlyName: "Computer"
}, {
    inputName: "5",
    friendlyName: "Streaming"
}, {
    inputName: "6",
    friendlyName: "USB Dock"
}, {
    inputName: "7",
    friendlyName: "BT"
}];

class D7050Device extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        var interval = 10;

        this.log('device init');
        console.dir(this.getSettings()); // for debugging
        console.dir(this.getData()); // for debugging
        this.log('name: ', this.getName());
        this.log('class: ', this.getClass());
        let id = this.getData().id;
        this.log('id: ', id);

        devices[id] = {};
        devices[id].client = "";
        devices[id].receivedData = "";

        console.dir(devices); // for debugging

        this.pollDevice(interval);

        // register capability listeners
        this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
        this.registerCapabilityListener('volume_set', this.onCapabilityVolumeSet.bind(this));
        //this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));
        this.registerCapabilityListener('volume_up', this.onCapabilityVolumeUp.bind(this));
        this.registerCapabilityListener('volume_down', this.onCapabilityVolumeDown.bind(this));
        this.registerCapabilityListener('input_selected', this.onCapabilityinput_selected.bind(this));
        this.registerCapabilityListener('volume_mute', this.onCapabilityMute.bind(this));

        // flow conditions
        this._conditionOnoff = new Homey.FlowCardCondition('onoff').register()
            .registerRunListener((args, state) => {
                var result = (this.getCapabilityValue('onoff'));
                return Promise.resolve(result);
            })

        this._conditionMute = new Homey.FlowCardCondition('volume_mute').register()
            .registerRunListener((args, state) => {
                var result = (this.getCapabilityValue('volume_mute'));
                return Promise.resolve(result);
            })

        /*    this._conditionInput_selected = new Homey.FlowCardCondition('input_selected').register()
                .registerRunListener((args, state) => {
                    var result = (this.getCapabilityValue('input_selected') );
                    return Promise.resolve(result);
                }) */

        // register flow card actions
        let powerOnAction = new Homey.FlowCardAction('powerOn');
        powerOnAction
            .register().registerRunListener((args, state) => {
                // this.log("Flow card action powerOn args.zone: "+JSON.stringify(args.zone));
                this.powerOn(args.device);
                return Promise.resolve(true);
            });

        let powerOffAction = new Homey.FlowCardAction('powerOff');
        powerOffAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action powerOff args " + args);
                this.powerOff(args.device);
                return Promise.resolve(true);
            });

        let muteAction = new Homey.FlowCardAction('mute');
        muteAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action mute args " + args);
                this.onActionMute(args.device);
                return Promise.resolve(true);
            });

        let unMuteAction = new Homey.FlowCardAction('unMute');
        unMuteAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action unMute args " + args);
                this.onActionUnMute(args.device);
                return Promise.resolve(true);
            });

        let toggleMuteAction = new Homey.FlowCardAction('toggleMute');
        toggleMuteAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action toggleMute args " + args);
                this.onActionToggleMute(args.device);
                return Promise.resolve(true);
            });

        let setVolumeAction = new Homey.FlowCardAction('setVolume');
        setVolumeAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action setVolume args " + args);
                this.log(" setVolume volume " + args.volume);
                this.onActionSetVolume(args.device, args.volume);
                return Promise.resolve(true);
            });

        let volumeUpAction = new Homey.FlowCardAction('volumeUp');
        volumeUpAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action setVolumeUp args " + args);
                this.log(" setVolume volume up " + args.volume);
                this.onActionVolumeUp(args.device, args.volume);
                return Promise.resolve(true);
            });
                    
        let volumeDownAction = new Homey.FlowCardAction('volumeDown');
        volumeDownAction
            .register().registerRunListener((args, state) => {
                this.log("Flow card action setVolumeDown args " + args);
                this.log(" setVolume volume Down " + args.volume);
                this.onActionVolumeDown(args.device, args.volume);
                return Promise.resolve(true);
            });

            /*  let setVolumeStepAction = new Homey.FlowCardAction('setVolumeStep');
          setVolumeStepAction
                  .register().registerRunListener((args, state) => {
                          this.log("Flow card action setVolumeStep args: "+args);
                          this.log(" setVolumeStep volumeChange "+args.volumeChange);
                          this.onActionSetVolumeStep (args.device, args.volumeChange);
                      //    this.onActionSetVolumeStep (args.device, args.zone.zone, args.volumeChange);
                          return Promise.resolve(true);
                  }
          ); */

        let changeInputAction = new Homey.FlowCardAction('input_selected');
        changeInputAction
            .register()
            .registerRunListener((args, state) => {
                this.log("Flow card action changeInput args " + args);
                this.log(" changeInput input " + args.input.inputName);
                this.onActioninput_selected(args.device, args.input.inputName);
                // this.onActionChangeInput(args.device, args.input.inputName);
                //     this.onActionChangeInput (args.device, args.zone.zone, args.input.inputName);
                return Promise.resolve(true);
            });

        changeInputAction
            .getArgument('input')
            .registerAutocompleteListener((query, args) => {
                var items = this.searchForInputsByValue(query);
                return Promise.resolve(items);
            });

        /*   new Homey.FlowCardAction('customCommand').register().registerRunListener((args, state) => {
                   this.log("Flow card action customCommand args "+args);
                   this.log(" customCommand command "+args.command);
                   this.onActionCustomCommand (args.device, args.command);
                   return Promise.resolve(true);
           }); */

    } // end onInit

    // this method is called when the Device is added
    onAdded() {
        let id = this.getData().id;
        this.log('device added: ', id);
        devices[id] = {};
        devices[id].client = "";
        devices[id].receivedData = "";
        //                              console.dir(devices);                           // for debugging
        var interval = 10;
        this.pollDevice(interval);
    }

    // this method is called when the Device is deleted
    onDeleted() {
        let id = this.getData().id;
        this.log('device deleted: ', id);
        delete devices[id];
        clearInterval(this.pollingInterval);
        //                              console.dir(devices);                           // for debugging
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityOnoff(value, opts, callback) {
        // ... set value to real device
        this.log("Capability called: onoff value: ", value);
        if (value) {
            this.powerOn(this, "Whole unit");
        } else {
            this.powerOff(this, "Whole unit");
        }
        // Then, emit a callback ( err, result )
        callback(null);
    }

    onCapabilityVolumeMute(value, opts, callback) {
        this.log("Capability called: volume_mute value: ", value);
        if (value) {
            this.mute(this);
        } else {
            this.muteOff(this);
        }
        callback(null);
    }

    onCapabilityVolumeSet(value, opts, callback) {
        var targetVolume = value;
        this.log("Capability called: volume_set, value: " + value + " calculated volume: " + targetVolume);
        this.setVolume(this, targetVolume);
        callback(null);
    }

    onCapabilityVolumeUp(value, opts, callback) {
        this.log("Capability called: volume_up");
        this.volumeUp(this);
        callback(null);
    }

    onCapabilityVolumeDown(value, opts, callback) {
        this.log("Capability called: volume_down");
        this.volumeDown(this);
        callback(null);
    }

    onCapabilityMute(value, opts, callback) {
        this.log("Capability called: mute");
        this.mute(this);
        callback(null);
    }

    onCapabilityinput_selected(value, opts, callback) {
        this.log("Capability called: input_selected. Value: " + value);
        this.changeInputSource(this, value);
        callback(null);
    }

    onActionMute(device) {
        console.log("Action called: mute");
        device.mute(device);
    }

    onActionToggleMute(device) {
        console.log("Action called: toggleMute");
        device.toggleMute(device);
    }

    onActionUnMute(device) {
        console.log("Action called: unMute");
        device.unMute(device);
    }

    onActionSetVolume(device, volume) {
        console.log("Action called: setVolume");
        device.setVolume(device, volume);
    }

    onActionVolumeUp(device, step) {
        console.log("Action called: setVolumeUp");
        device.volumeUp(device, step);
    }

    onActionVolumeDown(device, step) {
        console.log("Action called: setVolumeDown");
        device.volumeDown(device, step);
    }

    onActionSetVolumeStep(device, volumeChange) {
        console.log("Action called: setVolumeStep");
        device.setVolumeStep(device, volumeChange);
    }

    onActioninput_selected(device, input) {
        console.log("Action called: changeInput");
        device.changeInputSource(device, input);
    }

    // Note: customCommand affects all zones for a device, so you can run a customCommand from Zone2 and it will run just as if it was run from mainZone
    /*        onActionCustomCommand( device, command ) {
                    console.log("Action called: customCommand");
                    command += '\r';
                    device.sendCommand ( device, command );
            } */

    powerOn(device) {
        var command = '0001020901';
        //module.exports.realtime( device, 'onoff', true);
        device.sendCommand(device, command, 0);
        //sendCommandToDevice(device, command);
    }

    powerOff(device) {
        var command = '0001020900';
        //module.exports.realtime( device, 'onoff', false);
        device.sendCommand(device, command, 0);
        //sendCommandToDevice(device, command);
    }

    autoShutOffOn(device) {
        var command = '00010208010001020208';
        //sendCommandToDevice(device, command);
        device.sendCommand(device, command, 0);
    }

    // NB: there is a bug in the D7050 that prevents auto-shutoff when spotify was used in some cases
    autoShutOffOff(device) {
        var command = '00010208000001020208';
        //sendCommandToDevice(device, command);
        device.sendCommand(device, command, 0);
    }

    // NB: power save enables 'ECO standby'. While in this mode, the amp can only be turned on by using the physical button or IR.
    powerSaveOn(device) {
        var command = '00010207010001020207';
        //sendCommandToDevice(device, command);
        device.sendCommand(device, command, 0);
    }

    powerSaveOff(device) {
        var command = '00010207000001020207';
        //sendCommandToDevice(device, command);
        device.sendCommand(device, command, 0);
    }

    changeInputSource(device, input) {
        var command = '000102030' + input;
        console.log("Change input to: " + input);
        device.sendCommand(device, command, 0);
    }

    mute(device) {
        var command = '0001020a01';
        device.sendCommand(device, command, 0);
    }

    unMute(device) {
        var command = '0001020a00';
        device.sendCommand(device, command, 0);
    }

    toggleMute(device) {
        device.log("Volume_mute: " + this.getCapabilityValue('volume_mute'))
        if (this.getCapabilityValue('volume_mute') == true) {
            var command = '0001020a00';
        } else {
            var command = '0001020a01';
        }
        device.sendCommand(device, command, 0);
    }
 
    setVolume(device, targetVolume) {
        // volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI
        var Volume_hex = (200 * targetVolume + 2).toString(16);
        if (Volume_hex.length < 2) Volume_hex = '0' + Volume_hex;
        this.log("Volume_hex: " + Volume_hex);
        var command = '00010204' + Volume_hex;
        //sendCommandToDevice(device, command);
        this.log("setVolume: " + targetVolume + " command: " + command);
        device.sendCommand(device, command, 0);
    }

    setVolumeStep(device, volumeChange) {
        // Step up or down the volume. Argument volumeChange is the difference (e.g. +10 is 10 steps up or -5 is 5 steps down)
        var upOrDown = null;
        if (volumeChange > 0) {
            upOrDown = 'UP';
        }
        if (volumeChange < 0) {
            upOrDown = 'DOWN';
        }
        if (upOrDown !== null) {

            for (var i = 0; i < Math.abs(volumeChange); i++) {
                setTimeout(device.sendCommand, (i * 750), device, command, 0);
            }
        }
    }

    volumeUp(device, step) {
        var currentVolume = this.getCapabilityValue('volume_set');
        device.log("currentVolume: " + currentVolume);
        var targetVolume = currentVolume + 0.1;
        device.log(targetVolume);
        device.log("targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
   //     device.sendCommand(device, command, 0);
    }

    volumeDown(device, step) {
        var currentVolume = this.getCapabilityValue('volume_set');
        device.log("currentVolume: " + currentVolume);
        var targetVolume = currentVolume - 0.1;
        device.log("targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
    //    device.sendCommand(device, command, 0);
    }

    sendCommand(device, command, poll) {

        let settings = this.getSettings();
        let hostIP = settings.settingIPAddress;
        let id = this.getData().id;
        let client = devices[id].client;
        // for logging strip last char which will be the newline \n char
        //let displayCommand=command.substring(0, command.length -1);
        //console.log ( "Sending "+displayCommand+" to "+device.getName()+" at "+hostIP );
        console.dir(this.getSettings());
        // check if client (net.Socket) already exists, if not then open one.
        if ((typeof (client) === 'undefined') || (typeof (client.destroyed) != 'boolean') || (client.destroyed == true)) {
            console.log("Opening new net.Socket to " + hostIP + ":" + IPPort);
            client = new net.Socket();
            client.connect(IPPort, hostIP);
            // add handler for any response or other data coming from the device
            client.on('data', function (data) {
                //let tempData = data.toString().replace(/\r/g, ";");
                let tempData = data.toString('hex');
                devices[id].receivedData += tempData;
            })
        }
        client.on('error', function (err) {
            console.log("IP socket error: " + err.message);
            if (typeof (client.destroy) == 'function') {
                client.destroy();
            }
        })
        devices[id].client = client;
        //                              console.log ( " Writing "+command.toString().replace("\r", ";")+" to client " );
        //                              console.dir(client);                    // for debugging, spit out the whole net.Socket to the console
        client.write(Buffer.from(command, 'hex'));
        console.log("Sent command: " + command);
        console.log("ReceivedData: " + devices[id].receivedData);
        if (poll == 1) {
            //   device.parseResponse ([id].receivedData)
            var receivedData = devices[id].receivedData;
            console.log("Parsing response, receivedData: " + receivedData);
            var onoffstring = receivedData.slice(0, 10);
            console.log("onoffstring: " + onoffstring);
            if (onoffstring.indexOf('0001020901') >= 0) {
                console.log("NAD D7050 app - on: " + onoffstring);
                this.setCapabilityValue("onoff", true);
            } else if (onoffstring.indexOf('0001020900') >= 0) {
                console.log("NAD D7050 app - in standby mode: " + onoffstring);
                this.setCapabilityValue("onoff", true);
                // in standby mode the amplifier can be switched on using the app, so it is still available
            } else {
                console.log("NAD D7050 app - no response - powered off. ");
                this.setCapabilityValue("onoff", false);
            }
            var input_selected = receivedData.slice(19, 20);
            console.log("input_selected: " + input_selected);
            //this.setCapabilityValue("input_selected", input_selected);
            var volumeState_hex = receivedData.slice(28, 30);
            var volume_set = Math.round(Number('0x' + volumeState_hex).toString(10) / 2);
            console.log("volume_set: " + volume_set);
            // error 'out of range' 
            //this.setCapabilityValue("volume_set", volume_set);
            var mutestring = receivedData.slice(30, 40);
            console.log("mutestring: " + mutestring);
            if (mutestring.indexOf('0001020a01') >= 0) {
                console.log('NAD D7050 app - Amp is muted: ' + mutestring);
                this.setCapabilityValue("volume_mute", true);
            } else {
                console.log('NAD D7050 app - Amp is not muted: ' + mutestring);
                this.setCapabilityValue("volume_mute", false);
            }
            // done with the receivedData, clear it for the next responses
        }
        devices[id].receivedData = "";

    }

    searchForInputsByValue(value) {
        var possibleInputs = allPossibleInputs;
        var tempItems = [];
        for (var i = 0; i < possibleInputs.length; i++) {
            var tempInput = possibleInputs[i];
            if (tempInput.friendlyName.indexOf(value) >= 0) {
                tempItems.push({
                    icon: "",
                    name: tempInput.friendlyName,
                    description: "",
                    inputName: tempInput.inputName
                });
            }
        }
        return tempItems;
    }


    // HELPER FUNCTIONS
    pollDevice(interval) {
        console.dir(this.getSettings()); // for debugging
        console.dir(this.getData());
        clearInterval(this.pollingInterval);
        let settings = this.getSettings();
        let hostIP = settings.settingIPAddress;
        let id = this.getData().id;
        let client = devices[id].client;
        var command = '000102020900010202030001020204000102020a';


        this.pollingInterval = setInterval(() => {
            // poll status
            try {
                this.sendCommand(hostIP, command, 1);
                /*  if (this.getCapabilityValue('onoff') != result.onoff) {
                      this.setCapabilityValue('onoff', result.onoff);
                  }
                  if (this.getStoreValue('mode') != result.mode) {
                      this.setStoreValue('mode', result.mode);
                  }
                  if (this.getCapabilityValue('measure_temperature') != result.temperature) {
                      this.setCapabilityValue('measure_temperature', result.temperature);
                  }
                  if (this.getCapabilityValue('measure_humidity') != result.humidity) {
                      this.setCapabilityValue('measure_humidity', result.humidity);
                  }
 */
            } catch (error) {
                console.log("Error: " + error)
            }
        }, 1000 * interval);
    }

}
module.exports = D7050Device;