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

var parameter = {
    "Main.AutoSense": "",
    "Main.AutoStandby": "",
    "Main.Bass": "",
    "Main.Brightness": 3,
    "Main.ControlStandby": "On",
    "Main.Model": "NADC338",
    "Main.Mute": "",
    "Main.Power": "",
    "Main.Source": "",
    "Main.Version": 1.65,
    "Main.Volume": -20,
    "Main.AnalogGain": 0
}

var responseLine = [];

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
        this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));

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


        let bassOnAction = new Homey.FlowCardAction('bassOn');
        bassOnAction
            .register().registerRunListener((args) => {
                this.log("Flow card action bass on ");
                this.bassOn(this);
                return Promise.resolve(true);
            });

        let bassOffAction = new Homey.FlowCardAction('bassOff');
        bassOffAction
            .register().registerRunListener((args) => {
                this.log("Flow card action bass off ");
                this.bassOff(this);
                return Promise.resolve(true);
            });

        let standbyOnAction = new Homey.FlowCardAction('standbyOn');
        standbyOnAction
            .register().registerRunListener((args) => {
                this.log("Flow card action standby on ");
                this.standbyOn(this);
                return Promise.resolve(true);
            });

        let standbyOffAction = new Homey.FlowCardAction('standbyOff');
        standbyOffAction
            .register().registerRunListener((args) => {
                this.log("Flow card action standby off ");
                this.standbyOff(this);
                return Promise.resolve(true);
            });

        let autoStandbyOnAction = new Homey.FlowCardAction('autoStandbyOn');
        autoStandbyOnAction
            .register().registerRunListener((args) => {
                this.log("Flow card action auto-standby on ");
                this.autoStandbyOn(this);
                return Promise.resolve(true);
            });

        let autoStandbyOffAction = new Homey.FlowCardAction('autoStandbyOff');
        autoStandbyOffAction
            .register().registerRunListener((args) => {
                this.log("Flow card action auto-standby off ");
                this.autoStandbyOff(this);
                return Promise.resolve(true);
            });

        let autoSenseOnAction = new Homey.FlowCardAction('autoSenseOn');
        autoSenseOnAction
            .register().registerRunListener((args) => {
                this.log("Flow card action auto-sense on ");
                this.autoSenseOn(this);
                return Promise.resolve(true);
            });

        let autoSenseOffAction = new Homey.FlowCardAction('autoSenseOff');
        autoSenseOffAction
            .register().registerRunListener((args) => {
                this.log("Flow card action auto-sense off ");
                this.autoSenseOff(this);
                return Promise.resolve(true);
            });

        let setBrightnessAction = new Homey.FlowCardAction('setBrightness');
        setBrightnessAction
            .register().registerRunListener((args) => {
                this.log("Flow card action brightness: " + args.brightness);
                this.setBrightness(this, args.brightness);
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
            this.unMute(this);
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
        this.log("Action called: setVolume: " + volume);
        // NadVol = 92 x (HomeyVol - 80)
        //var volume_percent = ((volume + 1) / 100).toFixed(2);
        //this.log("volume_percent: " + volume_percent);
        device.setVolume(device, volume);
    }

    onActionVolumePlus(device) {
        this.log("Action called: setVolumePlus");
        var command = 'Main.Volume+';
        device.sendCommand(command, 0);
    }

    onActionVolumeMin(device) {
        this.log("Action called: setVolumePlus");
        var command = 'Main.Volume-';
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

    autoStandbyOn(device) {
        var command = 'Main.AutoStandby=On';
        device.sendCommand(command, 0);
    }

    autoStandbyOff(device) {
        var command = 'Main.AutoStandby=Off';
        device.sendCommand(command, 0);
    }

    standbyOn(device) {
        var command = 'Main.ControlStandby=On';
        device.sendCommand(command, 0);
    }

    standbyOff(device) {
        var command = 'Main.ControlStandby=Off';
        device.sendCommand(command, 0);
    }

    autoSenseOn(device) {
        var command = 'Main.AutoSense=On';
        device.sendCommand(command, 0);
    }

    autoSenseOff(device) {
        var command = 'Main.AutoSense=Off';
        device.sendCommand(command, 0);
    }

    bassOn(device) {
        var command = 'Main.Bass=On';
        device.sendCommand(command, 0);
    }

    bassOff(device) {
        var command = 'Main.Bass=Off';
        device.sendCommand(command, 0);
    }

    setBrightness(device, value) {
        var command = 'Main.Brightness=' + value;
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
        var command = 'Main.Mute=On';
        this.setCapabilityValue('volume_mute', true)
            .catch(this.error);
        device.sendCommand(command, 0);
    }

    unMute(device) {
        var command = 'Main.Mute=Off';
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
        // output from get volume ranges from -80 to 12 on the C338, in 0.5 steps
        // Homey volume: 0 - 1 (percentage)
        // volumeNad = (volumeNad+80)/92
        var volumeNad = -80 + (parseFloat(targetVolume * 184).toFixed(0) * 0.5);
        this.log("setVolume targetVolume: " + targetVolume);
        this.log("VolumeNad: " + volumeNad);
        var command = 'Main.Volume=' + volumeNad;
        this.log("setVolume: " + targetVolume + " command: " + command);
        device.sendCommand(command, 0);
        device.setCapabilityValue('volume_set', targetVolume)
            .catch(this.error);
    }

    /* use internal '+' and '-' control
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
        */

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
                        this.setUnavailable("Amplifier offline");
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
            if (poll == 1) {
                // min bytes Main? output: 203, max. 217
                await this.readStream(client, 203).then((value) => {
                    this.log("length of readStream output: " + value.length);
                        var trimmedData = this.myTrim(value.toString()); 
                       // this.log("trimmedData: " + trimmedData);
                        //this.log(trimmedData);
                        devices[id].receivedData = utf8.decode(trimmedData);
                        this.log("UTF8 decoded: ");
                        this.log(devices[id].receivedData);
                        responseLine = devices[id].receivedData.toString().replace(/=/g, ':').split("\n");
                        this.log("responseline: " + responseLine);
                    })
                    .catch(err => {
                        this.log(err)
                    });
            }
            if ((devices[id].receivedData != 'undefined') && (typeof (devices[id].receivedData) == 'string')) {
                reachable = 0;
                this.setAvailable();
                //this.log("Poll: " + poll + " ReceivedData: " + devices[id].receivedData);
                return devices[id].receivedData
            } else {
                this.log("ReceivedData undefined: " + devices[id].receivedData)
                return 0;
            }
        } catch (err) {
            this.log("sendCommand error: " + err)
        }
    }

    readData(receivedData) {
        try {
            if ((typeof (receivedData) == 'string') && (receivedData.length >= 203)) {
                this.log("NAD C338 app - receivedData: " + receivedData);
                reachable = 0;
                this.setAvailable();

                //responseLine.forEach(function (value) {
                responseLine.forEach((value) => {
                    var array = value.split(":");
                    parameter[array[0]] = [array[1]];
                    this.log("parameter: " + [array[0]] + " " + parameter[array[0]]);
                });

                this.log("Main.Power: " + parameter["Main.Power"]);
                this.log("Main.Source: " + parameter["Main.Source"]);

                var onoffstring = parameter["Main.Power"];

                if (onoffstring == "On") {
                    var onoffState = true;
                } else if (onoffstring == "Off") {
                    var onoffState = false;
                    // in standby mode the amplifier can be switched on using the app, so it is still available
                } else {
                    this.log("NAD C338 app - unintelligible response ");
                    var onoffState = false;
                    return 0;
                }

                var input_selectedName = parameter["Main.Source"];
                var inputNumber = this.searchForInputsByValue(input_selectedName);
                var input_selected = inputNumber[0]["inputName"];
                this.log("Source: " + input_selected)
                this.log("SourceName: " + input_selectedName);

                // HomeyVolPercent = (volNad + 80) / 92;
                // NadVol = 92 x (HomeyVol - 80)
                var volNad = parseInt(parameter["Main.Volume"]);
                //var volume_percent = parseFloat((volNad + 80) / 92).toFixed(2);
                var volume_percent = parseFloat((volNad + 80) / 92).toFixed(2);
                this.log("VolNad: " + volNad);
                this.log("Volume percent: " + volume_percent);

                var muteString = parameter["Main.Mute"];
                this.log("muteString: " + muteString);
                if (muteString == "On") {
                    var muteState = true;
                } else {
                    var muteState = false;
                }
                this.log("Amp on: " + onoffState + " Source: " + input_selected + "/" + input_selectedName + " Vol: " + volNad + "/" + volume_percent + " Mute: " + muteState)

                if (this.getCapabilityValue('onoff') != onoffState) {
                    this.setCapabilityValue('onoff', onoffState)
                        .catch(this.error);
                }
                if (this.getCapabilityValue('input_selected_c338') != input_selected) {
                    this.setCapabilityValue('input_selected_c338', input_selected)
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
            return await this.readData(receivedData)
        } catch (err) {
            this.log("AsyncTask error: " + err)
        }
    }

    pollDevice(interval) {
        clearInterval(this.pollingInterval);
        let id = this.getData().id;
        // poll power, input, volume and mute state - refer to NAD-hex-switches.txt
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

    myTrim(x) {
        return x.replace(/^\s+|\s+$/gm, '');
    }


}
module.exports = C338Device;