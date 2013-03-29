/* jshint worker: true, globalstrict: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, Uint8Array, imageTree*/
"use strict";

//Side note: Due to the webworker environment, we often get debug output back without so much as a hint as to where it came from. For this reason, ID tags are scattered about, taking the form of [xxxxx]. To find a tag from the output, just do a multifile search for it.

self.importScripts('Underscore 1.4.4.js', "Static Utilities.js"); //~/*.js on Chrome, ~/Editabled/*.js on Firefox. Fixed with soft filesystem link.

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


var wCounter = 0;
var newLayerWindow = function(cmd) {
	if(!cmd.width || !cmd.height) c.error('The pixel store tried to create a newLayerWindow with a width/height of ' + cmd.width + '/' + cmd.height + '.');
	cmd.x = cmd.x || 0; cmd.y = cmd.y || 0;
	cmd = cmd || {};
	cmd.type = 'window';
	cmd.name = cmd.name || 'Window #'+(++wCounter);
	cmd.layers = [];
	return cmd;
};

var fCounter = 0;
var newLayerFolder = function(cmd) {
	cmd = cmd || {};
	cmd.x = cmd.x || 0; cmd.y = cmd.y || 0;
	cmd.type = 'folder';
	cmd.name = cmd.name || 'Folder #'+(++fCounter);
	cmd.layers = [];
	return cmd;
};

var cCounter = 0;
var newLayerCanvas = function(cmd) {
	cmd = cmd || {};
	cmd.x = cmd.x || 0; cmd.y = cmd.y || 0;
	cmd.type = 'canvas';
	cmd.name = cmd.name || 'Canvas #'+(++cCounter);
	cmd.channels = cmd.channels || 8; //Uint8 rgba ∑ 4, Uint32 tool# = 4
	cmd.buffer = new ArrayBuffer((cmd.width*cmd.height)*(cmd.channels || 4));
	cmd.exteriorColour = [255,,,255]; //This is what is returned when we are *outside* the layer.
	return cmd;
};

var addToImageTree = function(obj, path) { //TODO: Path is a list of indexes specifying where to add the new layer. Layer must be a type 'folder' to be subpathable. For example, the path [3,0,5] would mean, 'in the third folder from the top, in the top folder, the fifth element down is now obj and the old fifth element is now the sixth element.'
	imageTree.layers = [].concat(imageTree.layers.slice(0,path[0]), obj, imageTree.layers.slice(path[0]));
};




// === Start event handlers. ===


self.onmessage = function(event) {
	var cmd = cUtils.eventNameFromCommand('on', event);
	self[cmd]((delete event.data.data.command, event.data.data));
};


var onPing = function() { //Fires off a simple message.
	self.postMessage({'command':'ping', 'data':'pong'});
};


var onInitializeLayerTree = function(data) {
	self.imageTree = newLayerWindow(_.clone(data));
	addToImageTree(newLayerCanvas(_.clone(data)), [0]);
};


var onAddLayer = function(data) {
	addToImageTree(newLayerCanvas(_.omit(data, 'path')), data.path);
};


var onDrawLine = function(data) { //Draw a number of pixels to the canvas.
	var boundingBox = cUtils.getBoundingBox(data.points);
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	var imageData = new Uint8ClampedArray(layer.buffer);
	cUtils.setLine(_.defaults({'data':imageData, 'width':layer.width, 'chan':layer.channels}, data.points, data.tool.colour));
	//_.range(500000); //Test line-drawing with a busy wait.
	sendUpdate(data.tool.layer, boundingBox);
};

var onFlash = function() {
	var window = cUtils.getLayer(imageTree, []);
	var boundingBox = cUtils.getBoundingBox({x:[window.x, window.x + window.width], y:[window.y, window.y + window.height]});
	sendUpdate([0], boundingBox); //Write it to the output. Just a little hack until layer-specific rendering works... It just uses getLayer atm.
};

var onForcefill = function(data) {
	c.log('pxs forcefilling');
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	var canvas = cUtils.getLayer(imageTree, []);
	cUtils.setAll(_.defaults({data: new Uint8ClampedArray(layer.buffer)}, data.tool.colour));
	var boundingBox = cUtils.getBoundingBox({x:[canvas.x, canvas.x + canvas.width], y:[canvas.y, canvas.y + canvas.height]});
	sendUpdate([0], boundingBox);
	c.log(data.tool);
};


// === End event handlers. ===


var sendUpdate = function(layer, boundingBox) {
	layer = cUtils.getLayer(imageTree, layer);
	
	//Update background.
	var bufferToReturn = cUtils.convertBuffer(layer.buffer, {area:boundingBox, bufferWidth:layer.width, outputChannels:4, inputChannels:8});
	var bLength = bufferToReturn.byteLength;
	self.postMessage({
		'command': 'pasteUpdate',
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