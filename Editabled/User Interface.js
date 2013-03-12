/*global _, $, jQuery, console, c, editors*/
editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var pxStore = canvas.edLib.pxStore;
	var utils = canvas.edLib.utils;
	var cUtils = editors.utils; //Static Common Utils
	var writers = canvas.edLib.writers;
	
	var ui = canvas.edLib.ui = {};
	ui.tool = { //The post-computation tool we'll be using.
		type: 'pencil',
		colour: {1:255, 3:255}, //0→red 1→green 2→blue 3→alpha, in case I forget and 1-index it again.
	};
	ui.activeLayer=[0]; //We set up layer 0 in Setup. activeLayer is a layer path, as described in Pixel Store.
	
	var drawLine = function(data) {
		if(data.to !== 'ui' && data.to !== undefined) {
			pxStore.postMessage({
				'command': 'drawLine',
				'data': (data.tool=ui.tool, data.layer=ui.activeLayer, data),
			});
		}	
		delete data.tool; delete data.layer; //Don't need these anymore.
		data.to = data.to || 'ui';
		
		var boundingBox = cUtils.getBoundingBox(data.points);
		var iData = cUtils.croppedImage(writers[data.to], boundingBox);
		var command = {
			x:data.points.x,
			y:data.points.y, 
			data:iData.data, 
			width:iData.width,
		};
		if(data.colour) {
			data.colour.map(function(value, index) {
				if(isFinite(value)) command[index] = value;
			});
		} else {
			command[0] = 255;
			command[3] = 255;
		}
		cUtils.setLine(
			cUtils.normalizeCoords(command, boundingBox)/*, true*/);
		writers[data.to].putImageData(iData, boundingBox.x, boundingBox.y);
	};
	
	ui.draw = function() {  //For the tests. They call ui.draw, and don't specify the .to property.
		arguments[0].to = 'underlay';
		drawLine.apply(this, arguments);
	};
	
	ui.pencilLeftStart = function(event) {
		drawLine({'to':'underlay', 'points': {x:[event.x], y:[event.y]}}); //Down has no access to the old position. You can only be down in one place, right?
	};
	
	ui.pencilLeftContinue = function(event) {
		drawLine({'to':'underlay', 'points': {x:[event.x, event.oldX], y:[event.y, event.oldY]}});
	};
	
	ui.pencilAddPreview = function(event) {
		drawLine({'points': {x:[event.x], y:[event.y]}});
	};
	
	ui.pencilRemovePreview = function(event) {
		drawLine({'points': {x:[event.oldX], y:[event.oldY]}, 'colour': [,,,0]});
	};
	
	
	
	pxStore.addEventListener('message', function(event) {
		var cmd = cUtils.eventNameFromCommand('on', event);
		if(typeof handlers[cmd] === 'function') {
			handlers[cmd](event.data.data); return;
		}
	});
	
	var handlers = {
		onUpdatePaste: function(data) {
			var imageData = writers[data.layer].createImageData(Math.abs(data.bounds.x[0]-data.bounds.x[1])+1, Math.abs(data.bounds.y[0]-data.bounds.y[1])+1);
			imageData.data.set(new Uint8ClampedArray(data.data));
			writers[data.layer].putImageData(imageData, data.bounds.x[0], data.bounds.y[0]);
		},
	};
	
});