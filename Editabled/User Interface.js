/*global _, $, jQuery, console, c, editors*/
editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var edLib = canvas.edLib;
	var pxStore = edLib.pxStore;
	var utils = edLib.utils;
	var cUtils = editors.utils; //Static (Common) Utilities
	var writers = edLib.writers;
	
	var ui = canvas.edLib.ui;

	ui.tool = { //The post-computation tool we'll be using.
		type: 'pencil',
		colour: {0: 255, 1:255, 2:255, 3:255}, //0→red 1→green 2→blue 3→alpha, in case I forget and 1-index it again.
		layer: [0,0],
		
	};
	ui.focusedWindow = [0];

	
	ui.draw = function() {  //For the tests. They call ui.draw, and don't specify the .to property.
		arguments[0].to = 'uiCache';
		//arguments[0].absolutePosition = true;
		utils.drawLine.apply(this, arguments);
	};
	
	ui.pencilLeftStart = function(event) {
		utils.drawLine({'to':'uiCache', 'points': {x:[event.x], y:[event.y]}}); //Down has no access to the old position. You can only be down in one place, right?
	};
	
	ui.pencilLeftContinue = function(event) {
		utils.drawLine({'to':'uiCache', 'points': {x:[event.x, event.oldX], y:[event.y, event.oldY]}});
	};
	
	ui.pencilAddPreview = function(event) {
		utils.drawLine({'points': {x:[event.x], y:[event.y]}});
	};
	
	ui.pencilRemovePreview = function(event) {
		utils.drawLine({'points': {x:[event.oldX], y:[event.oldY]}, 'colour': [,,,0]});
	};
	
	
	ui.cycleColour = function(event) { //event has event.pressedKeyCodes for keys already pressed
		//c.log('cycling colour', event.pressedKeyCodes);
		_.range(3).map(function(index) {
			ui.tool.colour[index] = Math.random()*255;
		});
		//delete ui.tool.colour[Math.round(Math.random()*2)];
		c.log(ui.tool.colour);
	};
	
	var previewTranslate = function(x,y, path) {	//We use ctx.getImageData here because this isn't a poll-sensitive operation. It's just triggered by keys. Alternatively, we only need to do it once at the beginning of the drag, during the wait where we find if the mouse has travelled far enough for it to be a proper drag.
		var ctx = edLib.writers['activeLayer'];
		var layer = cUtils.getLayer(utils.imageTree, path);
		var imageData = ctx.getImageData(0,0,layer.width-1,layer.height-1);
		ctx.clearRect(0,0,layer.width-1,layer.height-1);
		ctx.putImageData(imageData, x, y);
	};
	
	var jumpMove = function(x,y) {
		previewTranslate(x, y, []);
		utils.changeLayerData({delta:{x:x, y:y}, path: ui.focusedWindow}); //Should be 1/8th of a screen.
	};
	ui.mediumMoveLeft = function(event)  {jumpMove(+100, 0);};
	ui.mediumMoveRight = function(event) {jumpMove(-100, 0);};
	ui.mediumMoveUp = function(event)    {jumpMove(0, +100);};
	ui.mediumMoveDown = function(event)  {jumpMove(0, -100);};
	
	
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
	
	//So, we can use ctx.drawImage(canvas,x,y,w,h) to move around an existing canvas
	//We should probably keep a record of this stuff anyway, though. It'll be useful to read when we do the preview for the fill object.
	//There are two ways to approach it. First, we can snapshot the canvas when we begin, using getImageData. This isn't fast enough to run every frame, but perhaps it'd be fine to run once when the tool is selected? Alternatively, we can copy each update into a buffer, and store it. However, the copying to the buffer might be more time-consuming than the call to getImageData.
	
	var handlers = {
		onPasteUpdate: function(data) { //This doesn't use requestAnimationFrame because it doesn't seem to have any impact on performance.
			var imageData = writers[data.layer].createImageData(Math.abs(data.bounds.x[0]-data.bounds.x[1])+1, Math.abs(data.bounds.y[0]-data.bounds.y[1])+1);
			var update = new Uint8ClampedArray(data.data);
			imageData.data.set(update);
			writers[data.layer].putImageData(imageData, data.bounds.x[0], data.bounds.y[0]);
			writers.uiCache.clearRect(data.bounds.x[0], data.bounds.y[0], Math.abs(data.bounds.x[0]-data.bounds.x[1])+1, Math.abs(data.bounds.y[0]-data.bounds.y[1])+1);
		},
	};

	//c.log(utils.tagStr('|'), utils.imageTree);
	
});