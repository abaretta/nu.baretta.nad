/* From Homey SDK 2.0 docs: The file device.js is a representation of an already paired device on Homey */
'use strict';

const Homey = require('homey');
const promiseStream = require('promise-stream-reader');
const utf8 = require('utf8');

// We need network functions.
var net = require('net');

// keep a list of devices in memory
var devices = [];

var IPPort = 30001;
// C338 sources: 'Stream', 'Wireless', 'TV', 'Phono', 'Coax1', 'Coax2', 'Opt1', 'Opt2'

var allPossibleInputs = [{
    inputName: "0",
    friendlyName: "Coax1"
}, {
    inputName: "1",
    friendlyName: "Coax2"
}, {
    inputName: "2",
    friendlyName: "Opt1"
}, {
    inputName: "3",
    friendlyName: "Opt2"
}, {
    inputName: "4",
    friendlyName: "Stream"
}, {
    inputName: "5",
    friendlyName: "Wireless"
}, {
    inputName: "6",
    friendlyName: "TV"
}, {
    inputName: "7",
    friendlyName: "Phono"
}];

var reachable = 0;

class C338Device extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        var interval = 10;

        this.log('device init');
        this.log('name: ', this.getName());
        this.log('class: ', this.getClass());
        let id = this.getData().id;
        this.log('id: ', id);
        let settings = this.getSettings();
        this.log('settings: ', this.getSettings());
        this.log('settings IP address: ' + settings["settingIPAddress"])

        devices[id] = {};
        devices[id].client = {};
        devices[id].receivedData = "";

        // console.dir(devices); // for debugging

        // register capability listeners
        this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
        this.registerCapabilityListener('volume_set', this.onCapabilityVolumeSet.bind(this));
        this.registerCapabilityListener('input_selected_c338', this.onCapabilityinput_selected.bind(this));
        this.registerCapabilityListener('volume_up', this.onCapabilityVolumePlus.bind(this));
        this.registerCapabilityListener('volume_down', this.onCapabilityVolumeMin.bind(this));
        // Would be nice to be able to have the mute function in the mobile interface as well
        //this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));

        // flow conditions
        this._conditionOnoff = new Homey.FlowCardCondition('onoff').register()
            .registerRunListener(() => {
                var result = (this.getCapabilityValue('onoff'));
                return Promise.resolve(result);
            })

        this._conditionMute = new Homey.FlowCardCondition('volume_mute').register()
            .registerRunListener(() => {
                var result = (this.getCapabilityValue('volume_mute'));
                return Promise.resolve(result);
            })

        this._conditionInput_selected = new Homey.FlowCardCondition('input_selected_c338').register()
            .registerRunListener((args) => {
                var selected_input = args.input.inputName;
                if (selected_input === this.getCapabilityValue('input_selected_c338')) {
                    this.log("Selected source equals current source: " + selected_input);
                    return Promise.resolve(true);
                } else {
                    this.log("Selected source differs from current source: " + selected_input);
                    return Promise.resolve(false);
                }
            })

        this._conditionInput_selected
            .getArgument('input')
            .registerAutocompleteListener((query) => {
                var items = this.searchForInputsByValue(query);
                return Promise.resolve(items);
            });

        this._conditionInput_selected
            .getArgument('input')
            .registerAutocompleteListener((query) => {
                var items = this.searchForInputsByValue(query);
                return Promise.resolve(items);
            });

        // register flow card actions
        let powerOnAction = new Homey.FlowCardAction('powerOn');
        powerOnAction
            .register().registerRunListener((args) => {
                this.powerOn(args.device);
                return Promise.resolve(true);
            });

        let powerOffAction = new Homey.FlowCardAction('powerOff');
        powerOffAction
            .register().registerRunListener((args) => {
                this.log("Flow card action powerOff args " + args);
                this.powerOff(args.device);
                return Promise.resolve(true);
            });

        let muteAction = new Homey.FlowCardAction('mute');
        muteAction
            .register().registerRunListener((args) => {
                this.log("Flow card action mute args " + args.device);
                this.onActionMute(args.device);
                return Promise.resolve(true);
            });

        let unMuteAction = new Homey.FlowCardAction('unMute');
        unMuteAction
            .register().registerRunListener((args) => {
                this.log("Flow card action unMute ");
                this.onActionUnMute(args.device);
                return Promise.resolve(true);
            });

        let toggleMuteAction = new Homey.FlowCardAction('toggleMute');
        toggleMuteAction
            .register().registerRunListener((args) => {
                this.log("Flow card action toggleMute ");
                this.onActionToggleMute(args.device);
                return Promise.resolve(true);
            });

        let volumeUpActionOrig = new Homey.FlowCardAction('volumeUp');
        volumeUpActionOrig
            .register().registerRunListener((args) => {
                this.log("Flow card action volumeUp (default) ");
                this.onActionVolumePlus(this);
                return Promise.resolve(true);
            });

        let volumeDownActionOrig = new Homey.FlowCardAction('volumeDown');
        volumeDownActionOrig
            .register().registerRunListener((args) => {
                this.log(" setVolume volume Down (default) ");
                this.onActionVolumeMin(this);
                return Promise.resolve(true);
            });

        let volumeUpAction = new Homey.FlowCardAction('volume_up');
        volumeUpAction
            .register().registerRunListener((args) => {
                this.log("Flow card action volumeUp ");
                this.onActionVolumeUp(this, args.volume);
                return Promise.resolve(true);
            });

        let volumeDownAction = new Homey.FlowCardAction('volume_down');
        volumeDownAction
            .register().registerRunListener((args) => {
                this.log(" setVolume volume Down ");
                this.onActionVolumeDown(this, args.volume);
                return Promise.resolve(true);
            });

        let changeInputAction = new Homey.FlowCardAction('input_selected_c338');
        changeInputAction
            .register()
            .registerRunListener((args) => {
                this.log("Flow card action changeInput args " + args.input.inputName);
                this.log(" changeInput input " + args.input.inputName);
                this.onActioninput_selected(args.device, args.input.inputName);
                return Promise.resolve(true);
            });

        changeInputAction
            .getArgument('input')
            .registerAutocompleteListener((query) => {
                var items = this.searchForInputsByValue(query);
                return Promise.resolve(items);
            });

        this.pollDevice(interval);
    } // end onInit

    // this method is called when the Device is added
    onAdded() {
        let id = this.getData().id;
        this.log('device added: ', id);
        devices[id] = {};
        devices[id].client = {};
        devices[id].receivedData = "";
        var interval = 10;
        this.pollDevice(interval);
    }

    // this method is called when the Device is deleted
    onDeleted() {
        let id = this.getData().id;
        this.log('device deleted: ', id);
        delete devices[id];
        clearInterval(this.pollingInterval);
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityOnoff(value, opts, callback) {
        // ... set value to real device
        this.log("Capability called: onoff value: ", value);
        if (value) {
            this.powerOn(this);
        } else {
            this.powerOff(this);
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

    onCapabilityVolumeUp(value, opts, callback) {
        this.log("Capability called: volume_up");
        //this.volumeUp(this, value);
        this.onActionVolumeUp(this, value);
        callback(null);
    }

    onCapabilityVolumeDown(value, opts, callback) {
        this.log("Capability called: volume_down");
        //this.volumeDown(this, value);
        this.onActionVolumeDown(this, value);
        callback(null);
    }

    onCapabilityVolumePlus(value, opts, callback) {
        this.log("Capability called: volumePlus");
        this.onActionVolumePlus(this);
        callback(null);
    }

    onCapabilityVolumeMin(value, opts, callback) {
        this.log("Capability called: volumeMin");
        this.onActionVolumeMin(this);
        callback(null);
    }

    onCapabilityVolumeSet(value, opts, callback) {
        var targetVolume = value;
        this.log("Capability called: volume_set, value: " + value + " calculated volume: " + targetVolume);
        this.setVolume(this, targetVolume);
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
        var currentVolume = this.getCapabilityValue('volume_set');
        this.log("currentVolume: " + currentVolume);
        this.log("typeof currentVolume: " + typeof (currentVolume));
        if (step == 'undefined') {
            step = 5;
        }
        var targetVolume = currentVolume + (step / 100);
        targetVolume = targetVolume.toFixed(2);
        this.log("volumeUp targetVolume: " + targetVolume);
        this.log("setVolumeUp targetVolume type: " + typeof (targetVolume));
        device.setVolume(device, targetVolume);
    }

    onActionVolumeDown(device, step) {
        this.log("Action called: setVolumeDown");
        var currentVolume = this.getCapabilityValue('volume_set');
        device.log("currentVolume: " + currentVolume);
        if (step == 'undefined') {
            step = 5;
        }
        var targetVolume = currentVolume - (step / 100);
        targetVolume = targetVolume.toFixed(2);
        device.log("volumeDown targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
        this.log("setVolumeDown targetVolume type: " + typeof (targetVolume));
    }

    onActionVolumePlus(device) {
        this.log("Action called: setVolumePlus");
        var command = 'Main.Volume=+';
        device.sendCommand(command, 0);
    }

    onActionVolumeMin(device) {
        this.log("Action called: setVolumePlus");
        var command = 'Main.Volume=-';
        device.sendCommand(command, 0);
    }

    onActioninput_selected(device, input) {
        this.log("Action called: changeInput");
        device.changeInputSource(device, input);
    }

    // this method is called when a user changes settings
    onSettings(settings, newSettingsObj, changedKeysArr, callback) {
        try {
            for (var i = 0; i < changedKeysArr.length; i++) {
                switch (changedKeysArr[i]) {
                    case 'settingIPaddress':
                        this.log('IP address changed to ' + newSettingsObj.settingIPaddress);
                        settings.settingIPaddress = newSettingsObj.settingIPaddress;
                        break;

                    case 'stayConnected':
                        this.log('stayConnected changed to ' + newSettingsObj.stayConnected);
                        settings.stayConnected = newSettingsObj.stayConnected;
                        break;

                    default:
                        this.log("Key not matched: " + i);
                        break;
                }
            }
            callback(null, true)
        } catch (error) {
            callback(error, null)
        }
    }

    powerOn(device) {
        var command = 'Main.Power=On';
        device.sendCommand(command, 0);
        this.setCapabilityValue('onoff', true)
            .catch(this.error);
    }

    powerOff(device) {
        var command = 'Main.Power=Off';
        device.sendCommand(command, 0);
        this.setCapabilityValue('onoff', false)
            .catch(this.error);
    }

    autoShutOffOn(device) {
        var command = 'Main.AutoStandby=On';
        device.sendCommand(command, 0);
    }

    // NB: there is a bug in the C338 that prevents auto-shutoff when spotify was used in some cases
    // in the meantime the Spotify connect feature has been disabled... Need to re-test
    autoShutOffOff(device) {
        var command = 'Main.AutoStandby=Off';
        device.sendCommand(command, 0);
    }

    // NB: power save enables 'ECO standby'. While in this mode, the amp can only be turned on by using the physical button or IR.
    powerSaveOn(device) {
        var command = 'Main.Control';
        device.sendCommand(command, 0);
    }

    powerSaveOff(device) {
        var command = 'Main.ControlStandby';
        device.sendCommand(command, 0);
    }

    changeInputSource(device, input) {
        var inputName = allPossibleInputs[input]["friendlyName"];
        var command = ('Main.Source=' + inputName);
        this.log("Change input: " + command);
        device.sendCommand(command, 0);
        this.setCapabilityValue('input_selected_c338', input)
            .catch(this.error);

    }

    mute(device) {
        var command = 'Mute=On';
        this.setCapabilityValue('volume_mute', true)
            .catch(this.error);
        device.sendCommand(command, 0);
    }

    unMute(device) {
        var command = 'Mute=Off';
        this.setCapabilityValue('volume_mute', false)
            .catch(this.error);
        device.sendCommand(command, 0);
    }

    toggleMute(device) {
        device.log("Volume_mute: " + this.getCapabilityValue('volume_mute'))
        if (this.getCapabilityValue('volume_mute') == true) {
            device.unMute(device)
        } else {
            device.mute(device)
        }
    }

    setVolume(device, targetVolume) {
        // volume ranges from -80 to 0 on the C338. 
        // volHomey=0.0125 * volNad + 1
        // volNad=(volHomey-1)/0.0125
        // var Volume_hex = (200 * parseFloat(targetVolume).toFixed(2)).toString(16);
        //var Volume_Homey = 0.0125 * device + 1; 
        var VolumeNad = (targetVolume - 1) / 0.0125;
        if (VolumeNad < -80) {
            VolumeNad = -80
        }
        if (VolumeNad > 0) {
            VolumeNad = 0
        }
        this.log("setVolume targetVolume: " + targetVolume);
        this.log("VolumeNad: " + parseFloat(VolumeNad).toFixed(0));
        var command = 'Main.Volume=' + parseFloat(VolumeNad).toFixed(0);
        this.log("setVolume: " + targetVolume + " command: " + command);
        device.sendCommand(command, 0);
        device.setCapabilityValue('volume_set', targetVolume)
            .catch(this.error);
    }

    volumeUp(device, step) {
        var currentVolume = this.getCapabilityValue('volume_set');
        this.log("currentVolume: " + currentVolume);
        var targetVolume = currentVolume + (step / 100);
        targetVolume = targetVolume.toFixed(2);
        this.log("volumeUp targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
    }

    volumeDown(device, step) {
        var currentVolume = this.getCapabilityValue('volume_set');
        device.log("currentVolume: " + currentVolume);
        var targetVolume = currentVolume - (step / 100);
        targetVolume = targetVolume.toFixed(2);
        device.log("volumeDown targetVolume: " + targetVolume);
        device.setVolume(device, targetVolume);
    }

    async readStream(readableStream, bytes) {
        const reader = promiseStream();
        readableStream.pipe(reader);
        // Read 20 bytes of data from the stream
        return await reader.read(bytes);
    }

    async sendCommand(command, poll) {
        try {
            let settings = this.getSettings();
            let id = this.getData().id;
            let ip = settings["settingIPAddress"];
            let stayConnected = settings["stayConnected"];
            let client = devices[id].client;
            devices[id].receivedData = "";
            // check if client (net.Socket) already exists, if not then open one.
            // console.dir(client)
            if ((typeof (client) === 'undefined') || (typeof (client.destroyed) != 'boolean') || (client.destroyed === true)) {
                this.log("Opening new net.Socket to " + ip + ":" + IPPort);
                client = new net.Socket();
                client.connect(IPPort, ip);

                client.on('error', (err) => {
                    this.log("IP socket error: " + err.message);
                    reachable += 1;
                    if (reachable >= 3) {
                        this.log("NAD C338 app - unreachable, assume powered off ");
                        this.setCapabilityValue("onoff", false)
                            .catch(this.error);
                        //this.setUnavailable("Amplifier offline");
                        return 0;
                    }
                    if (typeof (client.destroy) == 'function') {
                        this.log("Destroy connection")
                        client.destroy();
                    }
                })
                // Closing connection after time-out to free up port, unless 'stayConnected' is defined
                if (stayConnected != 'undefined' && stayConnected != true) {
                    setTimeout(() => {
                        client.end();
                        //this.log("Closing connection");
                    }, 1500);
                }

                devices[id].client = client;
            }
            this.log("Writing command to client: " + command + " ip: " + ip)
            command += "\r";
            var commandEncoded = utf8.encode(command);
            client.write(Buffer.from(commandEncoded));

            // add handler for any response or other data coming from the device
            /*            if (poll == 1) {

                            await this.readStream(client, 20).then((value) => {
                                    devices[id].receivedData = value.toString('hex');
                                })
                                .catch(err => {
                                    this.log(err)
                                });
                        } 
                        if ((devices[id].receivedData != 'undefined') && (typeof (devices[id].receivedData) == 'string')) {
                            reachable = 0;
                            this.setAvailable();
                            this.log("Poll: " + poll + " ReceivedData: " + devices[id].receivedData);
                            return devices[id].receivedData
                        } else {
                            this.log("ReceivedData undefined: " + devices[id].receivedData)
                            return 0;
                        }
            */
        } catch (err) {
            this.log("sendCommand error: " + err)
        }
    }

    readData(receivedData) {
        try {
            if ((typeof (receivedData) == 'string') && (receivedData.length >= 40)) {
                this.log("NAD C338 app - receivedData: " + receivedData);
                reachable = 0;
                this.setAvailable();
                var onoffstring = receivedData.slice(0, 10);

                if (onoffstring.indexOf('0001020901') >= 0) {
                    var onoffState = true;
                } else if (onoffstring.indexOf('0001020900') >= 0) {
                    var onoffState = false;
                    // in standby mode the amplifier can be switched on using the app, so it is still available
                } else {
                    this.log("NAD C338 app - unintelligible response ");
                    var onoffState = false;
                    return 0;
                }
                var input_selected = receivedData.slice(19, 20);
                var volumeState_hex = receivedData.slice(28, 30);
                var volume = Math.round(Number('0x' + volumeState_hex).toString(10));
                // Convert volume 0 - 200 to percentage for volume_set
                var volume_percent = parseFloat(volume / 200).toFixed(2);
                var mutestring = receivedData.slice(30, 40);
                if (mutestring.indexOf('0001020a01') >= 0) {
                    var muteState = true;
                } else {
                    var muteState = false;
                }
                this.log("Amp on: " + onoffState + " Source: " + input_selected + " Vol: " + volume + "/" + volume_percent + " Mute: " + muteState)

                if (this.getCapabilityValue('onoff') != onoffState) {
                    this.setCapabilityValue('onoff', onoffState)
                        .catch(this.error);

                }
                if (this.getCapabilityValue('input_selected_c338') != input_selected) {
                    this.setCapabilityValue('input_selected_c388', input_selected)
                        .catch(this.error);

                }
                if (this.getCapabilityValue('volume_set') != volume_percent) {
                    this.setCapabilityValue('volume_set', parseFloat(volume_percent))
                        .catch(this.error);

                }
                if (this.getCapabilityValue('volume_mute') != muteState) {
                    this.setCapabilityValue('volume_mute', muteState)
                        .catch(this.error);

                }
                return 1;
            }
        } catch (err) {
            this.log("readData error: " + err)
        }
    }

    async executeAsyncTask(command, poll) {
        try {
            const receivedData = await this.sendCommand(command, poll)
            // return await this.readData(receivedData)
        } catch (err) {
            this.log("AsyncTask error: " + err)
        }
    }

    pollDevice(interval) {
        clearInterval(this.pollingInterval);
        let id = this.getData().id;
        // poll power, input, volume and mute state - refer to NAD-hex-switches.txt
        //var command = '000102020900010202030001020204000102020a';
        var command = 'Main?';

        this.pollingInterval = setInterval(() => {
            // poll status
            this.executeAsyncTask(command, 1)
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
module.exports = C338Device;