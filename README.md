# NAD Electronics amplifiers app for Athom Homey

This app lets you control NAD D7050 amplifiers from within flows or the mobile interface via a Homey home automation controller (by Athom). Note that the app may (or should) also work on NAD C338, 368 and C388 amplifiers with a BluOS Module fitted, however this is untested. There are differences in the inputs, let me know if you have such and amplifier and you want to use it with Homey. I can then add a driver for the inputs supported by that model. I will probably add a driver for the C338 shortly, it seems the only difference compared to the D7050 (feature wise) is that it has a phono input instead of bluetooth.
 
In its current state, the app requires that you enter the amplifier's IP address so it is advised to set it up to have a fixed IP address or a 'static lease' from the DHCP server.

In this SDK2 version an option is added to let the Homey app 'stay connected' to the amplifier. This means that Homey doesn't need to set up a new connection each time. However, it also means that the use of the Homey app cannot be combined with the NAD Electronics network (iPhone) app. 

Also note that the app has not yet been tested on Homey V2, however it does not use any (known ;-) unsupported features.

# Support for 

![](https://drive.google.com/uc?id=0B4QdLfQ7j41JUHRfTmRHT3JGT0k)

Supported flow actions:

* switch on / standby
* select input
* set volume
* mute / unmute
* enabling / disabling auto shut off
* enabling / disabling power saving mode
* increase / decrease volume inc. option with custom step size

Supported flow conditions:

* device on/off
* device muted/unmuted
* input selected

Supported flow triggers:

* device on/off
* volume changed

Mobile capabilities:

* on/off
* volume
* input selection

Standby modes

The NAD D7050 features two standby power saving modes: 'ECO mode' and 'Network standby'. In Network standby mode the device is fully reachable via the network but still uses 15W continuously.

In ECO mode the amplifier only uses about 1W. However in this mode it can only be switched on via IR or by physically touching the on/off button on top of the device. 

Auto shutoff

The 'auto shutoff' feature activates the chosen power saving mode after idling for 15 minutes. 

===============================================================================
# Changelog

**Version 0.0.6:**
- SDK2 rewrite

**Version 0.0.5:**
- Small bugfix

**Version 0.0.4:**
- Added mobile volume and input selector functionality

**Version 0.0.3:**
- Added flow conditions and volume up/down action
- Added mobile on/off functionality

**Version 0.0.2:**
- Textual corrections

**Version 0.0.1:**
- Initial version

