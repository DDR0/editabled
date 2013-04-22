/* jshint worker: true, globalstrict: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, Uint8Array, imageTree, lData*/
"use strict";

//Side note: Due to the webworker environment, we often get debug output back without so much as a hint as to where it came from. For this reason, ID tags are scattered about, taking the form of [xxxxx]. To find a tag from the output, just do a multifile search for it.

self.importScripts('Underscore 1.4.4.js', "Static Utilities.js", "Layer Manipulation.js"); //~/*.js on Chrome, ~/Editabled/*.js on Firefox. Fixed with soft filesystem link.

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
		logger = function dumper() {self.dump('ps: ' + _.reduce(arguments, function(a,b,s,l) {return a+b+(s+1!==l.length?", ":".");}) + '\n');};
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
var newLayerWindow = function(cmd) { //Note: These layer objects are usable as bounding boxes.
	if(!cmd.width || !cmd.height) c.error('The pixel store tried to create a newLayerWindow with a width/height of ' + cmd.width + '/' + cmd.height + '.');
	cmd = cmd || {};
	_.extend(cmd, cUtils.getBoundingBox({
		x:[cmd.x||0, (cmd.x||0)+cmd.width-1],
		y:[cmd.y||0, (cmd.y||0)+cmd.height-1]
	}));
	cmd.type = 'window';
	cmd.name = cmd.name || 'Window #'+(++wCounter);
	cmd.layers = [];
	return cmd;
};

var fCounter = 0;
var newLayerFolder = function(cmd) {
	cmd = cmd || {};
	_.extend(cmd, cUtils.getBoundingBox({
		x:[cmd.x||0, (cmd.x||0)+cmd.width-1],
		y:[cmd.y||0, (cmd.y||0)+cmd.height-1]
	}));
	cmd.type = 'folder';
	cmd.name = cmd.name || 'Folder #'+(++fCounter);
	cmd.layers = [];
	return cmd;
};

var cCounter = 0;
var newLayerCanvas = function(cmd) {
	cmd = cmd || {};
	_.extend(cmd, cUtils.getBoundingBox({
		x:[cmd.x||0, (cmd.x||0)+cmd.width-1],
		y:[cmd.y||0, (cmd.y||0)+cmd.height-1]
	}));
	cmd.type = 'canvas';
	cmd.name = cmd.name || 'Canvas #'+(++cCounter);
	cmd.channels = cmd.channels || 8; //Uint8 rgba ∑ 4, Uint32 tool# = 4
	cmd.buffer = cUtils.newBuffer(cmd.width, cmd.height, cmd.channels);
	cmd.exteriorColour = [128,,,255]; //This is what is returned when we access outside the layer data.
	return cmd;
};



// === Start event handlers. ===

var runOffset; //This offset will be used later by Layer Manipulation's renderLayerData. It is how much we translated the input coords by.
self.onmessage = function(event) {
	if(event.data && event.data.data && event.data.data.tool) {
		runOffset = lData.getLayerOffset(imageTree, event.data.data.tool.layer);
	} else {runOffset = {x:0, y:0};}
	if(event.data && event.data.data && event.data.data.points) {
		var points = event.data.data.points;
		points.x = points.x.map(function(point) {return point-runOffset.x;});
		points.y = points.y.map(function(point) {return point-runOffset.y;});
	}
	
	var cmd = cUtils.eventNameFromCommand('on', event);
	self[cmd]((delete event.data.data.command, event.data.data));
};


var onPing = function() { //Fires off a simple message.
	self.postMessage({'command':'ping', 'data':'pong'});
};


var onInitializeLayerTree = function(data) {
	self.imageTree = newLayerWindow(_.clone(data));
	cUtils.insertLayer(imageTree, [0], newLayerCanvas(_.extend(_.clone(data), {x:0,y:0})));
	c.log(imageTree);
};


var onAddLayer = function(data) {
	cUtils.insertLayer(imageTree, data.path, newLayerCanvas(_.omit(data, 'path')));
};


var onDrawLine = function(data) { //Draw a number of pixels to the canvas.
	var boundingBox = cUtils.getBoundingBox(data.points);
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	lData.sizeLayer(layer, boundingBox);
	
	//c.log(data.points.x, data.points.y, layer.x, layer.y, layer);
	var imageData = new Uint8ClampedArray(layer.buffer);
	cUtils.setLine(_.defaults({'data':imageData, 'width':layer.width, 'chan':layer.channels}, cUtils.normalizeCoords(data.points, layer), data.tool.colour));
	//_.range(500000); //Test line-drawing with a busy wait.
	sendUpdate(data.tool.layer, boundingBox);
};

var onFlash = function() { //For testing. Refreshes the entire window.
	var window = cUtils.getLayer(imageTree, []);
	var boundingBox = cUtils.getBoundingBox({x:[0,100-1], y:[0,200-1]});
	sendUpdate([0], boundingBox); //Write it to the output. Just a little hack until layer-specific rendering works... It just uses getLayer atm.
};

var onForcefill = function(data) {
	c.log('pxs forcefilling');
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	var canvas = cUtils.getLayer(imageTree, []);
	cUtils.setAll(_.defaults({data: new Uint8ClampedArray(layer.buffer)}, data.tool.colour));
	sendUpdate([0], cUtils.duplicateBoundingBox(layer));
};


// === End event handlers. ===


var sendUpdate = function(layerPath, boundingBox) {
	/*
	//c.log('bounding box', boundingBox);
	var layer = cUtils.getLayer(imageTree, layerPath);
	var offset = lData.getLayerOffset(imageTree, layerPath); //This function could use some more testing.
	//Just update background for now.
	var bufferToReturn = cUtils.convertBuffer(layer.buffer, {area:boundingBox, bufferWidth:layer.width, outputChannels:4, inputChannels:8});
	
	*/
	var renderLayer = lData.renderLayerData(imageTree, boundingBox); //Render every layer to the underlay, for now, until we've got it working.
	//c.log(renderLayer);
	
	var bLength = renderLayer.buffer.byteLength;
	//c.log(new Uint8ClampedArray(bufferToReturn));
	self.postMessage({
		'command': 'pasteUpdate',
		'data': {
			layer: 'underlay',
			bounds: {
				x:[/*runOffset.x + */renderLayer.x1, /*runOffset.x + */renderLayer.x2], 
				y:[/*runOffset.y + */renderLayer.y1, /*runOffset.y + */renderLayer.y2]},
			data: renderLayer.buffer,
		},
	}, [renderLayer.buffer]);
	if(bLength === renderLayer.buffer.byteLength) { //If the buffer was copied, byteLength won't be readable anymore.
		c.log("The return buffer was serialized! [#u1P7T]");
		throw new Error("The return buffer was serialized! [#u1P7T]");
	}
};