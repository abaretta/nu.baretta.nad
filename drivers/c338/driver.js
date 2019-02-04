"use strict";
// need Homey module, see SDK Guidelines
const Homey = require('homey');

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

class C338Driver extends Homey.Driver {

  onPair(socket) {
    // socket is a direct channel to the front-end

    var devices = [{
      "name": "My Device",
      "data": {
        "id": "abcd"
      }
    }]

    // this is called when the user presses save settings button in start.html
    socket.on('get_devices', (data, callback) => {

      this.log("get_devices data: " + JSON.stringify(data));

      // TODO: should check if IP leads to an actual NAD 7050 device
      // assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices

      // generate pseudo-random ID
      var id = guid();
      devices = [{
        data: {
          id: id
        },
        name: data.deviceName,
        settings: {
          "settingIPAddress": data.ipaddress,
          "stayConnected": data.stayConnected
        } // initial settings
      }];

      //console.log("NAD C338 app - get_devices devices: " + JSON.stringify(devices));

      // ready to continue pairing
      letsContinue(socket);
      callback(null, devices);

    });

    // this method is run when Homey.emit('list_devices') is run on the front-end
    // which happens when you use the template `list_devices`
    // pairing: start.html -> get_devices -> list_devices -> add_devices
    socket.on('list_devices', (data, callback) => {
      this.log("list_devices data: " + JSON.stringify(data));
      this.log("list_devices devices: " + JSON.stringify(devices));

      callback(null, devices);
    });

    // this happens when user clicks away the pairing windows
    socket.on('disconnect', () => {
      this.log("NAD C338 app - Pairing is finished (done or aborted)"); // using console.log because this.log or Homey.log is not a function
    })

    function letsContinue(socket) {
      socket.emit('continue', null);
    }
  };
}

module.exports = C338Driver;