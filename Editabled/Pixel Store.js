/* jshint worker: true, globalstrict: true, strict: false */
/* global console, _, self, miscellaneousUtilities, utils, ArrayBuffer, DataView, Uint8Array */
"use strict";

self.importScripts('Underscore 1.4.4.js', "Miscellaneous Utilities.js"); //~/*.js on Chrome, ~/Editabled/*.js on Firefox. Fixed with soft filesystem link.

//Could import, but it's a bit of a pain. Comment out for final release.
var c;
if(typeof console === 'undefined') {
	var logger;
	if(typeof self.dump === 'undefined') { //Chrome, because Firefox doesn't support messages for WorkerConsole.
		logger = function() {};
		c = {
			log: logger,
			warn: logger,
			error: logger
		};
	} else { //Firefox, because Chrome doesn't support self.dump().
		logger = function(text) {self.dump('ps: '+text+'\n');};
		c = {
			log: logger,
			warn: logger,
			error: logger
		};
	}
} else {
	c = console;
}

miscellaneousUtilities.init(self, self.utils = {});



var canvasHeight = 1;
var canvasWidth = 1;
var numberOfChannels = 4;
var canvas = {'type':'canvas',
          'buffer':new ArrayBuffer((canvasWidth*canvasHeight)*numberOfChannels),
          'width':canvasWidth, 'height':canvasHeight, 'depth':numberOfChannels,
         };


var onPing = function(data) { //Fires off a simple message.
	self.postMessage({'command':'ping', 'data':'pong'});
};


var onDrawLine = function(data) { //Draw a number of pixels to the canvas.
	c.log('Recieved: ' + data.points);
};

self.onmessage = function(event) {
	var cmd = utils.eventNameFromCommand('on', event);
	self[cmd](event.data); return;
	var buffer = canvas.buffer;
	var bView = new DataView(buffer);
	bView.setInt8(1, 250);
	buffer = canvas.buffer.slice(0,canvas.buffer.byteLength);
	var bLength = buffer.byteLength;
	self.postMessage({'command':'refresh', 'data':buffer, 'draw_rect': 'all'}, [buffer]);
	if(bLength === buffer.byteLength) { //If the buffer was copied, byteLength won't be readable anymore.
		c.log("The return buffer wasn't copied! [#7nZPb]");
	}
};