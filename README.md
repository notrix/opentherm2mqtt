# opentherm2mqtt

OpenThermGateway2MQTT

## What

Control (parts of) the world of OpenTherm using mqtt.

## How

* Connect a USB Serial cable to your Raspberry Pi
* Install Node.js
* Run `npm install`
* Copy config.yml.dist to config.yml to enable custom settings
* Run `node otg2mqtt.js` to allow mqtt publishing of OpenTherm realtime data
* Listen to default topics: value/otg/#
* Publish to default topics: control/otg/[command] (control/otg/cs: 30)

## Why

I want to create Skynet at home.

## Related projects;

OpenTherm gateway, more info see http://otgw.tclcode.com
Mqtt, more info see http://mqtt.org
