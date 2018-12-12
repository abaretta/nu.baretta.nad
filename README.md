# NAD D7050 IP control app for Athom Homey

This app lets you control NAD D7050 and C338 amplifiers from within flows or the mobile interface via a Homey home automation controller (by Athom). Homey is NodeJS based and allows for apps to extend its functionality.

In its current state, the app requires that you enter the amplifier's IP address so it is advised to set it up to have a fixed IP address or a 'static lease' from the DHCP server.

Note that this SDK2 version differs from the previous version in that it stays connected with the amplifier. This means you cannot use it in combination with the NAD iPhone app as the port on the amplifier will be 'busy'. I will make this a configurable option later on. I also plan to add custom names for sources in the mobile interface, and the setting of default volume and source. And possibly mDNS discovery.

Also note that the app is not yet tested on Homey V2.

![](https://drive.google.com/uc?id=0B4QdLfQ7j41JUHRfTmRHT3JGT0k)

Supported flow actions:

* switch on / standby
* select input
* set volume
* mute / unmute
* enabling / disabling auto shut off
* enabling / disabling power saving mode
* increase / decrease volume

Supported flow conditions:

* device on/off
* device muted/unmuted
* input selected

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

