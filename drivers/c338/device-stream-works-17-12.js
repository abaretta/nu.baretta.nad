/* From Homey SDK 2.0 docs: The file device.js is a representation of an already paired device on Homey */
'use strict';

const Homey = require('homey');
const promiseStream = require('promise-stream-reader');

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

var reachable = 0;

class D7050Device extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        var interval = 10;

        this.log('device init');
        //console.dir(this.getSettings()); // for debugging
        //console.dir(this.getData()); // for debugging
        this.log('name: ', this.getName());
        this.log('class: ', this.getClass());
        let id = this.getData().id;
        this.log('id: ', id);

        devices[id] = {};
        devices[id].client = "";
        devices[id].receivedData = "";

        // console.dir(devices); // for debugging

        // register capability listeners
        this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
        this.registerCapabilityListener('volume_set', this.onCapabilityVolumeSet.bind(this));
        this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));
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

        this._conditionInput_selected = new Homey.FlowCardCondition('input_selected').register()
            .registerRunListener((args, state) => {
                var selected_input = args.input.inputName;
                if (selected_input == this.getCapabilityValue('input_selected')) {
                    this.log("Selected source equals current source: " + selected_input);
                    return Promise.resolve(true);
                } else {
                    this.log("Selected source differs from current source: " + selected_input);
                    return Promise.resolve(false);
                }
            })

        this._conditionInput_selected
            .getArgument('input')
            .registerAutocompleteListener((query, args) => {
                var items = this.searchForInputsByValue(query);
                return Promise.resolve(items);
            });

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
                this.log(" setVolume volume " + args.volume);
                this.onActionSetVolume(args.device, args.volume);
                return Promise.resolve(true);
            });

        let volumeUpAction = new Homey.FlowCardAction('volumeUp');
        volumeUpAction
            .register().registerRunListener((args, state) => {
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

        this.pollDevice(interval);
        /*        let hostIP = this.getData().id;
                if ((typeof (client) === 'undefined') || (typeof (client.destroyed) != 'boolean') || (client.destroyed == true)) {
                    this.log("Opening new net.Socket to " + hostIP + ":" + IPPort);
                    client = new net.Socket();
                    client.connect(IPPort, hostIP);
                } */

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
        this.log("Action called: mute");
        device.mute(device);
    }

    onActionToggleMute(device) {
        this.log("Action called: toggleMute");
        device.toggleMute(device);
    }

    onActionUnMute(device) {
        this.log("Action called: unMute");
        device.unMute(device);
    }

    onActionSetVolume(device, volume) {
        this.log("Action called: setVolume");
        var volume_percent = ((volume + 1) / 100).toFixed(2);
        this.log("volume_percent: " + volume_percent);
        device.setVolume(device, volume_percent);
    }

    onActionVolumeUp(device, step) {
        this.log("Action called: setVolumeUp");
        device.volumeUp(device, step);
    }

    onActionVolumeDown(device, step) {
        this.log("Action called: setVolumeDown");
        device.volumeDown(device, step);
    }

    onActionSetVolumeStep(device, volumeChange) {
        this.log("Action called: setVolumeStep");
        device.setVolumeStep(device, volumeChange);
    }

    onActioninput_selected(device, input) {
        this.log("Action called: changeInput");
        device.changeInputSource(device, input);
    }

    powerOn(device) {
        var command = '0001020901';
        device.sendCommand(device, command, 0);
        this.setCapabilityValue('onoff', true)
    }

    powerOff(device) {
        var command = '0001020900';
        device.sendCommand(device, command, 0);
        this.setCapabilityValue('onoff', false)
    }

    autoShutOffOn(device) {
        var command = '00010208010001020208';
        device.sendCommand(device, command, 0);
    }

    // NB: there is a bug in the D7050 that prevents auto-shutoff when spotify was used in some cases
    autoShutOffOff(device) {
        var command = '00010208000001020208';
        device.sendCommand(device, command, 0);
    }

    // NB: power save enables 'ECO standby'. While in this mode, the amp can only be turned on by using the physical button or IR.
    powerSaveOn(device) {
        var command = '00010207010001020207';
        device.sendCommand(device, command, 0);
    }

    powerSaveOff(device) {
        var command = '00010207000001020207';
        device.sendCommand(device, command, 0);
    }

    changeInputSource(device, input) {
        var command = '000102030' + input;
        this.log("Change input to: " + input);
        device.sendCommand(device, command, 0);
        this.setCapabilityValue('input_selected', input)
    }

    mute(device) {
        var command = '0001020a01';
        device.sendCommand(device, command, 0);
        this.setCapabilityValue('volume_mute', true)
    }

    unMute(device) {
        var command = '0001020a00';
        device.sendCommand(device, command, 0);
        this.setCapabilityValue('volume_mute', false)
    }

    toggleMute(device) {
        device.log("Volume_mute: " + this.getCapabilityValue('volume_mute'))
        if (this.getCapabilityValue('volume_mute') == true) {
            var command = '0001020a00';
            this.setCapabilityValue('volume_mute', false)
        } else {
            var command = '0001020a01';
            this.setCapabilityValue('volume_mute', true)
        }
        device.sendCommand(device, command, 0);
    }

    setVolume(device, targetVolume) {
        // volume ranges from 0 (-90dB) to 200 (10dB) on the D7050. Add 2 to compensate for max of 99 in GUI
        this.setCapabilityValue('volume_set', targetVolume);
        var Volume_hex = (200 * parseFloat(targetVolume.toFixed(2))).toString(16);
        if (Volume_hex.length < 2) Volume_hex = '0' + Volume_hex;
        this.log("setVolume targetVolume: " + targetVolume);
        this.log("Volume_hex: " + Volume_hex);
        var command = '00010204' + Volume_hex;
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
        this.log("currentVolume: " + currentVolume);
        //var targetVolume = currentVolume + 0.1;
        var targetVolume = currentVolume + (step / 100);
        targetVolume = targetVolume.toFixed(2);
        this.log("volumeUp targetVolume: " + targetVolume);
        this.log("targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
    }

    volumeDown(device, step) {
        var currentVolume = this.getCapabilityValue('volume_set');
        device.log("currentVolume: " + currentVolume);
        //var targetVolume = currentVolume - 0.1;
        var targetVolume = currentVolume - (step / 100);
        targetVolume = targetVolume.toFixed(2);
        device.log("volumeDown targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
    }

    async readStream(readableStream, bytes) {
        const reader = promiseStream();
        readableStream.pipe(reader);

        // Read 20 bytes of data from the stream
        //const part1 = await reader.read(20);
        return await reader.read(bytes);

        readableStream.unpipe(reader);
        //reader.destroy();
        //readableStream.destroy();
        return await 0
    }

    async sendCommand(device, command, poll) {
        try {
            //let hostIP = device;
            let hostIP = this.getData().id;
            this.log("hostIP: " + hostIP);
            //this.log("id: " + id);
            //let client = devices[hostIP].client;
            // check if client (net.Socket) already exists, if not then open one.
            if ((typeof (client) === 'undefined') || (typeof (client.destroyed) != 'boolean') || (client.destroyed == true)) {
                this.log("Opening new net.Socket to " + hostIP + ":" + IPPort);
                client = new net.Socket();
                client.connect(IPPort, hostIP, () => {
                    this.log("Writing command to client: " + command)
                    client.write(Buffer.from(command, 'hex'));
                });
                client.on('error', (err) => {
                    this.log("IP socket error: " + err.message);
                    if (typeof (client.destroy) == 'function') {
                        client.destroy();
                    }
                })
            } else {
                client.write(Buffer.from(command, 'hex'));
            }
            // add handler for any response or other data coming from the device
            if (poll == 1) {
                await this.readStream(client, 20).then((value) => {
                        this.log("readStream result value: " + value.toString('hex'))
                        devices[hostIP].receivedData = value.toString('hex');
                        //return await devices[hostIP].receivedData;
                    })
                    .catch(err => {
                        this.log(err)
                    });
            }

            devices[hostIP].client = client;
            this.log("Sent command: " + command);
            this.log("ReceivedData: " + devices[hostIP].receivedData);
            if (receivedData != 'undefined') {
                return await devices[hostIP].receivedData
            } else {
                return await 0;
            }
        } catch (err) {
            this.log(err)
        }
    }

    async readData(receivedData) {
        try {
            //if ((receivedData === 'undefined') || (receivedData.length == 0)) {
            this.log("ReceivedData passed to readData: " + receivedData)
            if (receivedData != 'undefined') {
                if (receivedData.length >= 40) {
                    this.log("NAD D7050 app - receivedData: " + receivedData);
                    reachable = 0;

                    var onoffstring = receivedData.slice(0, 10);
                    this.log("onoffstring: " + onoffstring);

                    if (onoffstring.indexOf('0001020901') >= 0) {
                        var onoffState = true;
                        this.log("NAD D7050 app - on: " + onoffstring);
                    } else if (onoffstring.indexOf('0001020900') >= 0) {
                        var onoffState = false;
                        this.log("NAD D7050 app - in standby mode: " + onoffstring);
                        // in standby mode the amplifier can be switched on using the app, so it is still available
                    } else {
                        this.log("NAD D7050 app - unintelligle response ");
                        return await 0;
                    }
                    var input_selected = receivedData.slice(19, 20);
                    this.log("input_selected: " + input_selected);
                    var volumeState_hex = receivedData.slice(28, 30);
                    //this.log("Volume_hex:" + volumeState_hex)
                    var volume = Math.round(Number('0x' + volumeState_hex).toString(10));
                    this.log("volume: " + volume);
                    // Convert volume 0 - 200 to percentage for volume_set
                    var volume_percent = volume / 200;
                    //this.log("Volume_percent:" + parseFloat(volume_percent.toFixed(2)))
                    //this.log("Volume_set:" + this.getCapabilityValue('volume_set'))
                    var mutestring = receivedData.slice(30, 40);
                    this.log("mutestring: " + mutestring);
                    if (mutestring.indexOf('0001020a01') >= 0) {
                        this.log('NAD D7050 app - Amp is muted: ' + mutestring);
                        var muteState = true;
                    } else {
                        this.log('NAD D7050 app - Amp is not muted: ' + mutestring);
                        var muteState = false;
                    }
                    if (this.getCapabilityValue('onoff') != onoffState) {
                        this.setCapabilityValue('onoff', onoffState);
                    }
                    if (this.getCapabilityValue('input_selected') != input_selected) {
                        this.setCapabilityValue('input_selected', input_selected);
                    }
                    if (this.getCapabilityValue('volume_set') != volume_percent.toFixed(2)) {
                        this.setCapabilityValue('volume_set', parseFloat(volume_percent.toFixed(2)));
                    }
                    if (this.getCapabilityValue('volume_mute') != muteState) {
                        this.setCapabilityValue('volume_mute', muteState);
                    }
                }
            } else if (receivedData === 'undefined') {
                reachable += 1;
                if (reachable >= 3) {
                    this.log("NAD D7050 app - unreachable, assume powered off ");
                    this.setCapabilityValue("onoff", false);
                    return await 0;
                }
            }
            return await 1;
        } catch (err) {
            this.log(err)
        }
    }

    fetch(HostIP, command, poll) {
        let promise = new Promise((resolve, reject) => {
            resolve(this.sendCommand(HostIP, command, poll));
        });

        return promise
            .then(result => this.readOutput(result))
            .catch(err => this.log(err));
    }

    readOutput(receivedData) {
        return new Promise((resolve, reject) => {
            resolve(this.readData(receivedData));
            reject(err => this.log(err));
        });
    }

    pollDevice(interval) {
        clearInterval(this.pollingInterval);
        let settings = this.getSettings();
        let hostIP = settings.settingIPAddress;
        let id = this.getData().id;
        let client = devices[id].client;
        // poll power, input, volume and mute state - refer to NAD-hex-switches.txt
        var command = '000102020900010202030001020204000102020a';

        this.pollingInterval = setInterval(() => {
            // poll status
            this.fetch(hostIP, command, 1);
            // .then(x => this.log('Result: ' + x));
        }, 1000 * interval);
    }

    // HELPER FUNCTIONS
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
}
module.exports = D7050Device;