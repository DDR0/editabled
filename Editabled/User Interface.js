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
		layer: [0],
		
	};
	
	ui.drawLine = function(data) {
		if(data.to !== 'ui' && data.to !== undefined) {
			pxStore.postMessage({
				'command': 'drawLine',
				'data': (data.tool=ui.tool, data),
			});
		}	
		delete data.tool; //Don't need these anymore.
		data.to = data.to || 'ui';
		
		var boundingBox = cUtils.getBoundingBox(data.points);
		var iData = writers[data.to].createImageData(boundingBox.width, boundingBox.height);
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
			//_.extend(command, ui.tool.colour);
			command[0] = 255;
			command[3] = 255;
		}
		cUtils.setLine(
			cUtils.normalizeCoords(command, boundingBox)/*, true*/);
		writers[data.to].putImageData(iData, boundingBox.x, boundingBox.y);
	};
	
	ui.draw = function() {  //For the tests. They call ui.draw, and don't specify the .to property.
		arguments[0].to = 'uiCache';
		ui.drawLine.apply(this, arguments);
	};
	
	ui.pencilLeftStart = function(event) {
		ui.drawLine({'to':'uiCache', 'points': {x:[event.x], y:[event.y]}}); //Down has no access to the old position. You can only be down in one place, right?
	};
	
	ui.pencilLeftContinue = function(event) {
		ui.drawLine({'to':'uiCache', 'points': {x:[event.x, event.oldX], y:[event.y, event.oldY]}});
	};
	
	ui.pencilAddPreview = function(event) {
		ui.drawLine({'points': {x:[event.x], y:[event.y]}});
	};
	
	ui.pencilRemovePreview = function(event) {
		ui.drawLine({'points': {x:[event.oldX], y:[event.oldY]}, 'colour': [,,,0]});
	};
	
	
	ui.cycleColour = function(event) { //event, has event.pressedKeyCodes for keys already pressed! :D
		//c.log('cycling colour', event.pressedKeyCodes);
		_.range(3).map(function(index) {
			ui.tool.colour[index] = Math.random()*255;
		});
		//delete ui.tool.colour[Math.round(Math.random()*2)];
		c.log(ui.tool.colour);
	};
	
	
	//Some of the debuggier functions follow.
	
	
	ui.flash = function(event) { //Does a full refresh of the pixels from Pixel Store. This should only be for debugging.
		c.log('flashing memory to screen');
		_.keys(writers).map(function(name) {
			writers[name].clearRect(0,0,10000,10000);
		});
		pxStore.postMessage({
			command: 'flash',
			data: {},
		});
	};
	
	ui.forcefill = function(event) {
		c.log('Forcefilling layer ' + ui.tool.layer);
		pxStore.postMessage({
			command: 'forcefill',
			data: {tool:_.defaults({colour:{2:128,3:255}}, ui.tool)},
		});
	};
	
	
	ui.setActiveLayer = function(layer) {ui.tool.layer = layer;};
	
	
	ui.selectPencil = function() {ui.tool.type = 'pencil';};
	
	
	
	//Update functions, fired by Pixel Store.
	
	
	pxStore.addEventListener('message', function(event) {
		var cmd = cUtils.eventNameFromCommand('on', event);
		if(typeof handlers[cmd] === 'function') {
			handlers[cmd](event.data.data); return;
		}
	});
	
	var handlers = {
		onPasteUpdate: function(data) {
			var imageData = writers[data.layer].createImageData(Math.abs(data.bounds.x[0]-data.bounds.x[1])+1, Math.abs(data.bounds.y[0]-data.bounds.y[1])+1);
			imageData.data.set(new Uint8ClampedArray(data.data));
			writers[data.layer].putImageData(imageData, data.bounds.x[0], data.bounds.y[0]);
			writers.uiCache.clearRect(data.bounds.x[0], data.bounds.y[0], Math.abs(data.bounds.x[0]-data.bounds.x[1])+1, Math.abs(data.bounds.y[0]-data.bounds.y[1])+1);
		},
	};
	
});