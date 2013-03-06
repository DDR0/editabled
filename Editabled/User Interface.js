/*global _, $, jQuery, console, c, editors*/
editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var pxStore = canvas.edLib.pxStore;
	var utils = canvas.edLib.utils;
	var cUtils = editors.utils; //Static Common Utils
	var writers = canvas.edLib.writers;
	
	var ui = canvas.edLib.ui = {};
	ui.tool = {
		type: 'pencil',
	};
	
	var drawLine = function(data) {
		//if(data.points.length < 2) data.points.push(data.points[0]);
		var boundingBox = cUtils.getBoundingBox(data.points);
		var iData = cUtils.croppedImage(writers.ui, boundingBox);
		cUtils.setLine(
			cUtils.normalizeCoords({
				x:data.points.x,
				y:data.points.y, 
				1:255, 3:255, 
				data:iData.data, 
				width:iData.width,
			}, boundingBox));
		writers.ui.putImageData(iData, boundingBox.x, boundingBox.y);
		//c.log('next');
	};
	
	/*pxStore.addEventListener('message', function(event) {
		var cmd = cUtils.eventNameFromCommand('on', event);
		if(typeof handlers[cmd] === 'function') {
			handlers[cmd](event.data); return;
		}
	});*/
	
	ui.draw = function (data) {
		var cPreview = data.preview;
		delete data.preview;
		
		switch(data.command) {
			case 'drawLine': 
				drawLine(data);
				break;
			case 'drawRect':
				c.log('draw rect', data);
				break;
			case 'blitRect':
				c.log('blit rect', data);
				break;
			default:
				throw "Bad UI draw command. (No '" + data.command + "' function defined.)";
		}
	};
	
	ui.pencilLeftStart = function(event) {
		ui.draw({'command': 'drawLine', 'preview':true, 'points': {x:[event.x], y:[event.y]}}); //Down has no access to the old position. You can only be down in one place, right?
	};
	
	ui.pencilLeftContinue = function(event) {
		ui.draw({'command': 'drawLine', 'preview':true, 'points': {x:[event.x, event.oldX], y:[event.y, event.oldY]}});
	};
	
	ui.pencilLeftFinish = function(event) {
	};
	
});