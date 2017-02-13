# NAD D7050 IP control app for Athom Homey

This app lets you control a NAD D7050 amplifier from within flows on a Homey device (by Athom). Homey is NodeJS based and allows for apps to extend its functionality.

In its current state, the app requires that you enter the amplifier's IP address so it is advised to set it up to have a fixed IP address or a 'static lease' from the DHCP server.

The app is based on the Marantz app by  Marco van den Hout. 

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

The 'auto shutoff' feature activates the chosen power saving mode after idling for 15 minutes. Note that the D7050 appears to have a bug which prevents auto-shutoff when Spotify connect is used in certain cases.

# TODO

* Sort out initial state for volume and selected input mobile capabilities
* Add settings for customizing input names

# Changelog

**Version 0.0.4:**
- Added mobile volume and input selector functionality

**Version 0.0.3:**
- Added flow conditions and volume up/down action
- Added mobile on/off functionality

**Version 0.0.2:**
- Textual corrections

**Version 0.0.1:**
- Initial version

