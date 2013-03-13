/* jshint worker: true, globalstrict: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, Uint8Array */
"use strict";

//Side note: Due to the webworker environment, we often get debug output back without so much as a hint as to where it came from. For this reason, ID tags are scattered about, taking the form of [xxxxx]. To find a tag from the output, just do a multifile search for it.

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

miscellaneousUtilities.init(self, self.cUtils = {});


var newLayerCanvas = function(cmd) {
	cmd.type = 'canvas';
	cmd.name = cmd.name || 'new layer';
	cmd.channels = cmd.channels || 8; //Uint8 rgba ∑ 4, Uint32 tool# = 4
	cmd.buffer = new ArrayBuffer((cmd.width*cmd.height)*cmd.channels);
	return cmd;
};


var newLayerFolder = function(cmd) {
	cmd.type = 'folder';
	cmd.name = cmd.name || 'new folder';
	cmd.layers = [];
	return cmd;
};


var pickImage = function(path) { //TODO: Returns an image from the imageTree.
	return imageTree.layers[0];
};


var addToImageTree = function(obj, path) { //TODO: Path is a list of indexes specifying where to add the new layer. Layer must be a type 'folder' to be subpathable. For example, the path [3,0,5] would mean, 'in the third folder from the top, in the top folder, the fifth element down is now obj and the old fifth element is now the sixth element.'
	imageTree.layers = [].concat(imageTree.layers.slice(0,path[0]), obj, imageTree.layers.slice(path[0]));
};


//var layers = [newCanvas({height:1, width:1, channels:4})];
var imageTree = newLayerFolder({});


// === Start event handlers. ===


self.onmessage = function(event) {
	var cmd = cUtils.eventNameFromCommand('on', event);
	self[cmd]((delete event.data.data.command, event.data.data));
};


var onPing = function() { //Fires off a simple message.
	self.postMessage({'command':'ping', 'data':'pong'});
};


var onAddLayer = function(data) {
	var path = data.path;
	delete data.path;
	addToImageTree(newLayerCanvas(data), path);
};


var onDrawLine = function(data) { //Draw a number of pixels to the canvas.
	var boundingBox = cUtils.getBoundingBox(data.points);
	var layer = pickImage(data.layer);
	var imageData = new Uint8ClampedArray(layer.buffer);
	cUtils.setLine(_.extend({'data':imageData, 'width':layer.width, 'chan':layer.channels}, data.points, data.tool.colour));
	//_.range(500000);
	sendUpdate(data.layer, boundingBox);
};


// === End event handlers. ===


var sendUpdate = function(layer, boundingBox) {
	layer = pickImage(layer);
	
	//Update background.
	var bufferToReturn = cUtils.convertBuffer(layer.buffer, {area:boundingBox, bufferWidth:layer.width, outputChannels:4, inputChannels:8});
	var bLength = bufferToReturn.byteLength;
	self.postMessage({
		'command': 'updatePaste',
		'data': {
			layer: 'underlay',
			bounds: {
				x:[boundingBox.x1, boundingBox.x2], 
				y:[boundingBox.y1, boundingBox.y2]},
			data: bufferToReturn,
		},
	}, [bufferToReturn]);
	if(bLength === bufferToReturn.byteLength) { //If the buffer was copied, byteLength won't be readable anymore.
		c.log("The return buffer was serialized! [#u1P7T]");
	}
};