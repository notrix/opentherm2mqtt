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
	var target = data.slice(0, 1); // B, T, A, R, E
	var type = data.slice(1, 2); // 1, 4, 5, 9, C
	var id = parseInt(data.slice(3, 5), 16);
	var payload = data.slice(-4); // last 4 chars

	if (data.length === 9) {
		if (
			opentherm.process.targets.indexOf(target) !== -1 &&
			opentherm.process.types.indexOf(type) !== -1 &&
            id in opentherm.ids
		) {
            var topic = config.topics.values + '/' + opentherm.ids[id];
            switch (opentherm.types[id]) {
                case 'flag8':
                    if (target !== "A") {
                        topics[topic] = hex2dec(payload);

                        if ((topics[topic] & (1 << 1)) > 0) {
                            topics[config.topics.values + "/flame_status_ch"] = 1;
                        } else {
                            topics[config.topics.values + "/flame_status_ch"] = 0;
                        }

                        if ((topics[topic] & (1 << 2)) > 0) {
                            topics[config.topics.values + "/flame_status_dhw"] = 1;
                        } else {
                            topics[config.topics.values + "/flame_status_dhw"] = 0;
                        }

                        if ((topics[topic] & (1 << 3)) > 0) {
                            topics[config.topics.values + "/flame_status_bit"] = 1;
                        } else {
                            topics[config.topics.values + "/flame_status_bit"] = 0;
                        }
                    }
                    break;

                case 'f8.8':
                    topics[topic] = (parseInt(payload, 16) / 256).toFixed(2);
                    break;

                case 'u16':
                    topics[topic] = parseInt(payload, 16);
                    break;
            }

            // check for changes that need to be published
            for (var queue in topics) {
                if (topics[queue] !== previous[queue]) {
                    client.publish(queue, String(topics[queue]), {
                        retain: true,
                        qos: 1
                    });
                    previous[queue] = topics[queue];
                }
            }
		}
	}
});
