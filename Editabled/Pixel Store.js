/* jshint worker: true, globalstrict: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, Uint8Array, imageTree, lData*/
"use strict";

//Obsolete, now - the worker logging utilities built-in have been improved.
//Side note: Due to the webworker environment, we often get debug output back without so much as a hint as to where it came from. For this reason, ID tags are scattered about, taking the form of [xxxxx]. To find a tag from the output, just do a multifile search for it.

self.importScripts('Underscore 1.4.4.js', "Shared Utilities.js", "Layer Manipulation.js"); //~/*.js on Chrome, ~/Editabled/*.js on Firefox. Fixed with soft filesystem link.

//Define c, our console. Make some attempt to work around non-conforming browsers.
var c;
if(typeof console === 'undefined') {(function() {
	var logger;
	if(typeof self.dump === 'undefined') { //Chrome, because Firefox doesn't support messages for WorkerConsole.
		logger = function() {};
	} else { //Firefox, because Chrome doesn't support self.dump().
		logger = function dumper() {self.dump('ps: ' + _.reduce(arguments, function(a,b,s,l) {return a+b+(s+1!==l.length?", ":".");}) + '\n');};
		logger("Using dump-based logger.");
	}
	c = {
		info: logger,
		log: logger,
		warn: logger,
		error: logger
	};
	//This is untested, and might crash? :<
	self.postMessage({'command': 'logMessage', 'data': "Warning: Nonstandard logger used by web worker."});
})();} else {
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
	cmd.name = cmd.name || 'Window #'+(wCounter++);
	cmd.layers = [];
	cmd.writer = 'default';
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
	cmd.name = cmd.name || 'Folder #'+(fCounter++);
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
	cmd.name = cmd.name || 'Canvas #'+(cCounter++);
	cmd.channels = cmd.channels || 8; //Uint8 rgba ∑ 4, Uint32 tool# = 4
	cmd.buffer = cUtils.newBuffer(cmd.width, cmd.height, cmd.channels);
	cmd.exteriorColour = new Uint8ClampedArray([,,,255]); //This is what is returned when we access outside the layer data. It must be a Uint8ClampedArray, or else renderLayerData will be 4x as slow as it is.
	return cmd;
};


// === Start event handlers. ===

var onInitializeLayerTree = function(data) {
	data.name = '';
	self.imageTree = newLayerWindow(_.clone(data)); //Parent window. Should (but doesn't) stay synched to editor size.
	cUtils.insertLayer(imageTree, [0], newLayerWindow(_.clone(data))); //Graphic window. Bottom of the stack, because all ui elements go on it.
	cUtils.insertLayer(imageTree, [0,0], newLayerCanvas(_.extend(_.clone(data), {x:0,y:0}))); //Give us a layer to draw on, initially.
	cUtils.insertLayer(imageTree, [1], newLayerWindow(_.clone(data))); //Tool-bar window. Should be (but isn't) shrink-wrapped to the height of the toolbar.
	cUtils.insertLayer(imageTree, [1,0], newLayerCanvas((function() { //Tool-bar canvas, where we draw the tools.
			var barHeight = 100;
			var newData = _.clone(data); 
			newData.y = newData.height-barHeight; 
			newData.height = barHeight; 
			return newData;
		})()));
	
	cUtils.getLayer(self.imageTree, []).writer = 'none';
	cUtils.getLayer(self.imageTree, [1]).writer = 'staticWidgets';
	var toolbarLayer = cUtils.getLayer(self.imageTree, [1,0]); //Flood-fill the toolbar layer so we can see it. Set it's exterior overdraw to transparent, though, because we don't want to occlude the canvas we're drawing on!
	cUtils.setAll(_.defaults({data: new Uint8ClampedArray(toolbarLayer.buffer)}, {0:255, 3:255}));
	toolbarLayer.exteriorColour = new Uint8ClampedArray([,,,,]);
	c.log(cUtils.getLayer(self.imageTree, [1]).writer);
	sendUpdate([1], cUtils.getLayer(self.imageTree, []));
};

var runOffset; //This offset will be used later by Layer Manipulation's renderLayerData. It is how much we translated the input coords by.
self.onmessage = function(event) {
	//.log('recieved message from ' + event.origin + '.');
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


var onAddLayer = function(data) {
	cUtils.insertLayer(imageTree, data.path, newLayerCanvas(_.omit(data, 'path')));
};

var onChangeLayerData = function(data) {
	var layer = cUtils.getLayer(self.imageTree, data.path);
	data.delta && _.keys(data.delta).forEach(function(key) {
		layer[key] += data.delta[key];
	});
	data.abs && _.keys(data.abs).forEach(function(key) {
		layer[key] = data.abs[key];
	});
	calcLayerPaintUpdate(data);
};

//This function calculates the camera area that needs painting, based on what data has been changed. It is conservative by default, because the conservative path is the only one that will produce a visible error.
var calcLayerPaintUpdate = function(data) {
	var layer = cUtils.getLayer(self.imageTree, data.path);
	var camera = cUtils.getLayer(self.imageTree, []);
	var updateRect = cUtils.duplicateBoundingBox(camera);

	//TODO: Make camera movement preview work with this update rect. Right now, if you move twice before the preview gets back to you, the update is pasted in the wrong place. Instead of using screen-space coordinates, the paste-back MUST use layer coordinates which the front-end translates to screen-space.
	//Calculate the rect containing new data for moved layer. The front-end has all the old data, and the preview has moved it.
	//if(data.delta.x > 0) {
	//	updateRect.x2 = updateRect.x1 + data.delta.x;
	//} else if(data.delta.x < 0) {
	//	updateRect.x1 = updateRect.x2 + data.delta.x;
	//}
	//if(data.delta.y > 0) {
	//	updateRect.y2 = updateRect.y1 + data.delta.y;
	//} else if(data.delta.y < 0) {
	//	updateRect.y1 = updateRect.y2 + data.delta.y;
	//}

	c.log('computed delta is (before camera clip)', updateRect.width, 'by', updateRect.height);
	c.log('computed update for', data.path);
	sendUpdate(data.path, updateRect);
};


var onDrawLine = function(data) { //Draw a number of pixels to the canvas.
	var boundingBox = cUtils.getBoundingBox(data.points);
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	lData.sizeLayer(layer, boundingBox);
	
	lData.setLine(layer, data.points, data.tool.colour);
	
	//_.range(500000); //Test: Simulate an expensive line-draw with a busy wait.
	sendUpdate(data.tool.layer, boundingBox);
};

var onFlash = function() { //For testing. Refreshes the paint layer.
	var layer = cUtils.getLayer(imageTree, [0]);
	runOffset = {x:0, y:0}; //We have to reset this because this function isn't relative.
	//layer = cUtils.getBoundingBox({x:[0,100-1], y:[0,200-1]});
	sendUpdate([0], layer); //Write it to the output. Just a little hack until layer-specific rendering works... It just uses getLayer atm.
};

var onForcefill = function(data) {
	c.log('pxs forcefilling');
	var layer = cUtils.getLayer(imageTree, data.tool.layer);
	var canvas = cUtils.getLayer(imageTree, []);

	cUtils.setAll(_.defaults({data: new Uint8ClampedArray(layer.buffer)}, data.tool.colour));

	//Disable the next line to make forcefill highlight the *defined* layer.
	var dtc = data.tool.colour;
	layer.exteriorColour = new Uint8ClampedArray([dtc[0], dtc[1], dtc[2], dtc[3]]);

	onFlash();
};


// === End event handlers. ===


var sendUpdate = function(layerPath, boundingBox) {
	//var camera = cUtils.getLayer(self.imageTree, []);
	//c.log('cam:', camera.x1, camera.y1, camera.x2, camera.y2);
	//c.log('bnd:', boundingBox.x1, boundingBox.y1, boundingBox.x2, boundingBox.y2);

	var view = cUtils.getLayer(self.imageTree, typeof layerPath[0] === 'number' ? [layerPath[0]] : []);
	if(view.writer === 'none') {throw new Error('The view specified for rendering was marked unrenderable, as \'none\'. (path: [' + layerPath + '])');}

	var renderLayer = lData.renderLayerData(view, boundingBox); //Render every layer to the activeLayer, for now, until we've got it working.
	var originalByteLength = renderLayer.buffer.byteLength;
	self.postMessage({
		'command': 'pasteUpdate',
		'data': {
			layer: (view.writer !== 'default' ? view.writer : '') || 'activeLayer',
			offset: runOffset, //TODO: The front-end should take this into account when posting updates; but it currently doesn't.
			bounds: {
				x:[/*runOffset.x + */renderLayer.x1, /*runOffset.x + */renderLayer.x2], 
				y:[/*runOffset.y + */renderLayer.y1, /*runOffset.y + */renderLayer.y2]},
			data: renderLayer.buffer,
		},
	}, [renderLayer.buffer]);

	//If the buffer was copied, byteLength won't be readable anymore.
	if(originalByteLength === renderLayer.buffer.byteLength) {
		throw new Error("The return buffer was serialized! [#u1P7T]");
	}
};