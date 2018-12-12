"use strict";
// need Homey module, see SDK Guidelines
const Homey = require('homey');

class D7050Driver extends Homey.Driver {

    onPair( socket ){
      // socket is a direct channel to the front-end

      var devices = [
        {
          "data": { "id" : "initial_id" },
          "name": "initial_name",
          "settings": { "settingIPAddress": "0.0.0.0", "input0": "Coaxial1", "input1": "Coaxial2", "input2": "Optical1","input3": "Optical2","input4": "Computer","input5": "Streaming","input6": "USB Dock","input7": "BT" } // initial settings
        }
      ];

      // this is called when the user presses save settings button in start.html
        socket.on('get_devices', function( data, callback ) {

          console.log ( "NAD D7050 app - get_devices data: " + JSON.stringify(data) );
          console.log ( "NAD D7050 app - get_devices devices: " + JSON.stringify(devices) );

      // TODO: should check if IP leads to an actual NAD 7050 device
      // assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices


      // get MAC address from IP
//      Homey.ManagerArp.getMAC(inputIPAddress)
//              .then( result => {
//                      let inputIdentifier = result.mac;
//                      console.log ("got ARP: "+inputIdentifier);
//                      inputDone();
//              })
//              .catch( err => {
//                      let inputIdentifier = inputIPAddress;
//                      console.log ("ARP failed: "+inputIdentifier);
//                      inputDone();
//              })

          devices = [
          {
              data: { id : data.ipaddress },
              name: data.deviceName,
              settings: { "settingIPAddress": data.ipaddress, "input0": data.input0, "input1": data.input1, "input2": data.input2, "input3": data.input3, "input4": data.input4,"input5": data.input5,"input6": data.input6,"input7": data.input7 } // initial settings
          }];

          // ready to continue pairing
          letsContinue(socket);

        });

        // this method is run when Homey.emit('list_devices') is run on the front-end
        // which happens when you use the template `list_devices`
        // pairing: start.html -> get_devices -> list_devices -> add_devices
                socket.on('list_devices', function( data, callback ) {

            console.log( "NAD D7050 app - list_devices data: " + JSON.stringify(data));
            console.log( "NAD D7050 app - list_devices devices: " + JSON.stringify(devices));

                        callback( null, devices );
                });


        // this happens when user clicks away the pairing windows
                socket.on('disconnect', function() {
                        console.log("NAD D7050 app - Pairing is finished (done or aborted)");        // using console.log because this.log or Homey.log is not a function
          })

          function letsContinue(socket) {
            socket.emit ( 'continue', null );
          }
    };
}

module.exports = D7050Driver;
