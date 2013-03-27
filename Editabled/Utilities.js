/*jshint smarttabs:true, es5:true*/

miscellaneousUtilities.init(window, editors.utils = {});

editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var utils = canvas.edLib.utils = {};
	var edLib = canvas.edLib;
	
	var cUtils = editors.utils;
	
	utils.tag = Math.random().toString(36).slice(2,7);
	utils.tagStr = function(str) {return "["+utils.tag+"] "+str;};
	
	var isFirefox = navigator.userAgent.indexOf("Firefox") >= 0; //Faking the UA string will just affect tweaks, nothing will out-and-out break. If you say you're someone different, that's your problem.
	utils.useDelayInputWorkaround = isFirefox; //Firefox grabs mouse move input in preference to rendering, which causes ridiculous delays while it repeatedly grabs the mouse and defers painting the results. The solution is to delay the rendering results running by using window.setTimeout(). This adds a noticable though not lethal lag in rendering, so we should only use it when we need to.
	utils.useMouseOffsetWorkaround = isFirefox; //Firefox, for some reason, writes to the canvas one pixel below the crosshair's center.
	
	(function tmp() {
		var mappings = { //We'll cache the inversion of this. For now. Note that inclusion here doesn't mean swallowing, the named event must be present for that in UI.js.
		//	 16: 'shift', //Don't need events for these, everything is *registered* anyway.
		//	 17: 'ctrl',
		//	 18: 'alt',
			 37: 'left',
			 38: 'up',
			 39: 'right',
			 40: 'down',
			 67: 'cycleColour',
		//	 91: 'meta', //We'll not use meta, as it should be reserved for OS commands, eg, meta-r for 'run'.
		//	117: 'menu', //The menu key isn't swallowed correctly on chrome. It still brings up the menu. Also, I'm using it as my linux 'compose key' – on firefox, it shows up as key #0, while on chrome the event isn't fired at all.
		};
		var codeToAction = mappings;
		var actionToCode = _.invert(mappings);
		utils.codeToAction = function(code) {
			return codeToAction[code];
		};
		utils.actionToCode = function(code) {
			return actionToCode[code];
		};
	})();
	
	
	/* LAYERS */
	
	
	utils.layer = function(cmd) { //When passing a layer message to Pixel Store, pass it through this which will keep the near-side layer data in synch. We need to maintain two copies, since, assuming Pixel Store is in the middle of five minuites of doing *something*, we have no way of getting the data out of it. So, we duplicate!
		edLib.pxStore.postMessage(cmd);
		switch(cmd.command) {
			case 'addLayer':
				//utils.imageTree.push({type:'layer'});
				c.error('todo: implement adding layer here');
				break;
			case 'initializeLayerTree':
				utils.imageTree = utils.newLayerWindow(cmd);
				cUtils.insertLayer(utils.imageTree, [0], utils.newLayerCanvas(cmd));
				break;
			default:
				c.warn('Couldn\'t mirror a layer command.', cmd);
		}
	};
	
	var newLayerThumbnail = function() {
		return {
			buffer: new Uint8ClampedArray(30*20*4), //We might want this to be… uh, dynamic. Later. Someday.
			width: 30,
			height: 20,
		};
	};
	
	var wCounter = 0;
	utils.newLayerWindow = function(cmd) { //width/height, optional name
		return {
			type: 'window',
			name: cmd.name || 'Window #'+(++wCounter),
			width: cmd.width,
			height: cmd.height,
			layers: cmd.layers || [],
		};
	};
	
	var fCounter = 0;
	utils.newLayerFolder = function(cmd) {
		return {
			type: 'folder',
			name: cmd.name || 'Folder #'+(++fCounter),
			thumbnail: newLayerThumbnail(),
			layers: cmd.layers || [],
		};
	};
	
	var cCounter = 0;
	utils.newLayerCanvas = function(cmd) {
		return {
			type: 'canvas',
			name: cmd.name || 'Layer #'+(++cCounter),
			thumbnail: newLayerThumbnail(),
			channels: [],
		};
	};
});