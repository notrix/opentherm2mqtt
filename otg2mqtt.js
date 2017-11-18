/*
* Description: Connect OpenTherm gateway to MQTT
* Author: https://github.com/githubcdr/
* Project: http://otgw.tclcode.com/
* Thanks to hekkers.net
*/

var SerialPort = require('serialport'),
	mqtt = require('mqtt'),
    readYaml = require('read-yaml'),
    Readline = SerialPort.parsers.Readline,
	previous = [],
	topics = [];

(function () {
	var convertBase = function (num) {
		this.from = function (baseFrom) {
			this.to = function (baseTo) {
				return parseInt(num, baseFrom).toString(baseTo);
			};
			return this;
		};
		return this;
	};

	// binary to decimal
	this.bin2dec = function (num) {
		return convertBase(num).from(2).to(10);
	};

	// binary to hexadecimal
	this.bin2hex = function (num) {
		return convertBase(num).from(2).to(16);
	};

	// decimal to binary
	this.dec2bin = function (num) {
		return convertBase(num).from(10).to(2);
	};

	// decimal to hexadecimal
	this.dec2hex = function (num) {
		return convertBase(num).from(10).to(16);
	};

	// hexadecimal to binary
	this.hex2bin = function (num) {
		return convertBase(num).from(16).to(2);
	};

	// hexadecimal to decimal
	this.hex2dec = function (num) {
		return convertBase(num).from(16).to(10);
	};

	return this;
})();

var opentherm = readYaml.sync('opentherm.yml');

try {
    var config = readYaml.sync('config.yml');
} catch(err) {
	config = readYaml.sync('config.yml.dist');
}

var serialPort = new SerialPort(config.device, {
	baudRate: 9600
});

var parser = serialPort.pipe(new Readline({ delimiter: '\r\n' }));

serialPort.on('open', function () {
   console.log('Serial port open');
});

var mqttOptions = config.mqtt.options;
mqttOptions.will = {
    topic: config.topics.status,
    payload: 'offline',
    retain: true,
    qos: 1
};

client = mqtt.connect(config.mqtt.host, mqttOptions);
client.publish(config.topics.logs, 'service started');
client.publish(config.topics.status, 'online', {
	retain: true,
	qos: 1
});
client.subscribe(config.topics.control + '/#');

client.on('message', function (topic, message) {
    var code = topic.substring(topic.lastIndexOf('/') + 1);
    serialPort.write(code.toLocaleUpperCase() + '=' + message + '\r\n' );

    client.publish(config.topics.logs + '/' + code, message);
});

parser.on('data', function (data) {
	// check for OT packets
	opentherm_target = data.slice(0, 1); // B, T, A, R, E
	opentherm_type = data.slice(1, 2); //
	opentherm_id = parseInt(data.slice(3, 5), 16); //
	opentherm_payload = data.slice(-4); // last 4 chars

	if (data.length === 9) {
		console.log(data.toString());
		if (opentherm_target === "B" || opentherm_target === "T" || opentherm_target === "A" || opentherm_target === "R" || opentherm_target === "E") {
		//if (opentherm_target === "B" || opentherm_target === "T" || opentherm_target === "A") {
			if (opentherm_type === "1" || opentherm_type === "4" || opentherm_type === "C" || opentherm_type === "9") {
				// if (opentherm_type === "1" || opentherm_type === "4") {
				if (opentherm_id in opentherm.ids) {
					var topic = config.topics.values + '/' + opentherm.ids[opentherm_id];
					switch (opentherm.types[opentherm_id]) {
						case 'flag8':
							if (opentherm_target !== "A") {
								topics[topic] = hex2dec(opentherm_payload);

								if ((topics[topic] & (1 << 1)) > 0) {
									topics["value/otg/flame_status_ch"] = 1;
								} else {
									topics["value/otg/flame_status_ch"] = 0;
								}

								if ((topics[topic] & (1 << 2)) > 0) {
									topics["value/otg/flame_status_dhw"] = 1;
								} else {
									topics["value/otg/flame_status_dhw"] = 0;
								}

								if ((topics[topic] & (1 << 3)) > 0) {
									topics["value/otg/flame_status_bit"] = 1;
								} else {
									topics["value/otg/flame_status_bit"] = 0;
								}
							}
							break;

						case 'f8.8':
							topics[topic] = (parseInt(opentherm_payload, 16) / 256).toFixed(2);
							break;

						case 'u16':
							topics[topic] = parseInt(opentherm_payload, 16);
							break;
					}

					// check for changes that need to be published
					for (var value in topics) {
						if (topics[value] !== previous[value]) {
							client.publish(value, String(topics[value]), {
								retain: true,
                                qos: 1
							});
							previous[value] = topics[value];
						}
					}
				}
			}
		}
	}
});
