/*jshint smarttabs:true*/

miscellaneousUtilities.init(window, editors.utils = {});

editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var utils = canvas.edLib.utils = {};
	var edLib = canvas.edLib;
	var ui = canvas.edLib.ui = {};
	var writers = edLib.writers = {};
	var pxStore = edLib.pxStore;
	
	var cUtils = editors.utils;

	var imageTree = null; //Set up in User Interface.
	
	utils.tag = Math.random().toString(36).slice(2,7);
	utils.tagStr = function(str) {return "["+utils.tag+"] "+str;};
	
	var isFirefox = navigator.userAgent.indexOf("Firefox") >= 0; //Faking the UA string will just affect tweaks, nothing will out-and-out break.
	utils.useDelayInputWorkaround = false; //Firefox grabs mouse move input in preference to rendering, which causes ridiculous delays while it repeatedly grabs the mouse and defers painting the results. The solution is to delay the rendering results running by using window.setTimeout(). This adds a noticable though not lethal lag in rendering, so we should only use it when we need to.
	utils.useMouseOffsetWorkaround = false; //Firefox, for some reason, writes to the canvas one pixel below the crosshair's center.
	
	
	/* LAYERS */
	var newLayerThumbnail = function() {
		return {
			buffer: new Uint8ClampedArray(30*20*4), //We might want this to be… uh, dynamic. Later. Someday.
			width: 30,
			height: 20,
		};
	};
	
	var wCounter = 0;
	utils.newLayerWindow = function(cmd) { //This is the only layer structure with a width/height, because we need to do a bit of path-tracing to figure out where to send the mouse-clicks. For now.
		var newWin = {
			type: 'window',
			name: cmd.name || 'Window #'+(++wCounter),
			width: cmd.width,
			height: cmd.height,
			layers: cmd.layers || [],
		};
		return _.extend(newWin, cUtils.getBoundingBox({
			x:[cmd.x||0, (cmd.x||0)+cmd.width],
			y:[cmd.y||0, (cmd.y||0)+cmd.height]
		}));
	};
	
	var fCounter = 0;
	utils.newLayerFolder = function(cmd) {
		return {
			type: 'folder',
			name: cmd.name || 'Folder #'+(++fCounter),
			thumbnail: newLayerThumbnail(),
			layers: cmd.layers || [],
			x: cmd.x || 0,
			y: cmd.y || 0,
		};
	};
	
	//These should have x/y locations so we can offset the update from Pixel Store if we've moved. This improves our caching model so we don't have to re-render the entire screen.
	var cCounter = 0;
	utils.newLayerCanvas = function(cmd) {
		return {
			type: 'canvas',
			name: cmd.name || 'Layer #'+(++cCounter),
			thumbnail: newLayerThumbnail(),
			channels: [],
			x: cmd.x || 0,
			y: cmd.y || 0,
		};
	};




	utils.addLayer = function(data) {
		edLib.pxStore.postMessage({command:'addLayer', data:data});
		c.error('todo: implement adding layer here');
	};

	utils.changeLayerData = function(data) {
		edLib.pxStore.postMessage({command:'changeLayerData', data:data});
		var layer = cUtils.getLayer(utils.imageTree, data.path);
		_.keys(data.delta).forEach(function(key) {
			layer[key] += data.delta[key];
		});
	};

	utils.initializeLayerTree = function(data) {
		edLib.pxStore.postMessage({command:'initializeLayerTree', data:data});
		utils.imageTree = utils.newLayerWindow(data);
		cUtils.insertLayer(utils.imageTree, [0], utils.newLayerWindow(data));
		cUtils.insertLayer(utils.imageTree, [0,0], utils.newLayerCanvas(data));
		cUtils.insertLayer(utils.imageTree, [1], utils.newLayerCanvas(data));
	};

	utils.setLayerData = function(data) {
		edLib.pxStore.postMessage({command:'setLayerData', data:data});
		var layer = cUtils.getLayer(utils.imageTree, data.path);
		_.keys(data.delta).forEach(function(key) {
			layer[key] = data.delta[key];
		});
	};

	utils.drawLine = function(data) {
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
			_.extend(command, ui.tool.colour);
		}
		cUtils.setLine(
			cUtils.normalizeCoords(command, boundingBox)/*, true*/);
		writers[data.to].putImageData(iData, boundingBox.x, boundingBox.y);
	};
});