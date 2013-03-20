/*global _, $, jQuery, console, c, editors, miscellaneousUtilities*/

var glob; //A global variable, for debugging in the console.
miscellaneousUtilities.init(window, editors.utils = {});

editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var canvasDOM = $(canvas);
	var edLib = canvas.edLib;
	
	edLib.utils = {};
	var utils = edLib.utils;
	
	utils.tag = Math.random().toString(36).slice(2,7);
	utils.tagStr = function(str) {return "["+utils.tag+"] "+str;};
	
	var isFirefox = navigator.userAgent.indexOf("Firefox") >= 0; //Faking the UA string will just affect tweaks, nothing will out-and-out break. If you say you're someone different, that's your problem.
	utils.useDelayInputWorkaround = isFirefox; //Firefox grabs mouse move input in preference to rendering, which causes ridiculous delays while it repeatedly grabs the mouse and defers painting the results. The solution is to delay the rendering results running by using window.setTimeout(). This adds a noticable though not lethal lag in rendering, so we should only use it when we need to.
	utils.useMouseOffsetWorkaround = isFirefox; //Firefox, for some reason, writes to the canvas one pixel below the crosshair's center.
	
	(function tmp() {
		var mappings = { //We'll cache the inversion of this. For now.
			 /*16: 'shift', //Don't need events for these, everything is *registered* anyway.
			 17: 'ctrl',
			 18: 'alt',*/
			 67: 'cycleColour',
			 //91: 'meta', //We'll not use meta, as it should be reserved for OS commands, eg, meta-r for 'run'.
			//117: 'menu', //The menu key isn't swallowed correctly on chrome. It still brings up the menu. Also, I'm using it as my linux 'compose key' – on firefox, it shows up as key #0, while on chrome the event isn't fired at all.
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
	
	var canvasPosition = canvasDOM.offset();
	var extraCanvases = _.range(4).map(function() {
		var extraCanvas = $("<canvas>")
			.attr({
				'width': canvas.width,
				'height': canvas.height,
			})
			.css({
				"position": "absolute",
				//"background": "yellow",
				"pointer-events": "none",
			})
			.css(canvasPosition);
		extraCanvas.appendTo("body");
		return extraCanvas;
	});
	extraCanvases[0].css('z-index', -2);
	extraCanvases[1].css('z-index', -1);
	//Original canvas stays here, unmodified, at 0.
	extraCanvases[2].css('z-index', 1);
	extraCanvases[3].css('z-index', 2);
	
	//Disable resizing for now, because it'll require support for layers and resizing -- which we don't have yet.
	canvasDOM.css({'width': canvas.width+'px', 'height': canvas.height+'px',});
	
	var pxStore = canvas.edLib.pxStore;
	pxStore.postMessage({'command': 'addLayer', 'data': {
		'width': canvas.width,
		'height': canvas.height,
		'path': [0],
	}});
	
	edLib.writers = {}; //We'll write the buffered output of the pixel store to two layers, overlay and underlay. Underlay will contain the RGBA render of the active layer, and any layers below. Overlay, will contain the RGBA render of the remaining layers. These will blend together using whatever method the browser uses for compositing. ui will be where the tool itself is rendered as it's being used. uiGhost is where the ghost of the tool renders, *if* the overlay pixel isn't totally transparent. This is because, since we've got a layered image, the tool should appear *in* the layer it's working on, and hence underneath any layers on top of it.
	var writers = edLib.writers;
	
	writers.uiGhost = extraCanvases[3][0].getContext('2d');  //If the pencil is obscured by drawing something, it should appear here as a ghostly purple outline. This lets you get 'inside' the picture's layers. Purple intensity is related to alpha of overlay.
	writers.overlay = extraCanvases[2][0].getContext('2d');  //Output of 'above this layer' from pixel store.
	writers.ui = canvas.getContext('2d');                    //The preview object for the mouse is written here.
	writers.uiCache = extraCanvases[1][0].getContext('2d');  //The 'fast render', to be ereased by the pixel store update event, is written here. This is a preview of sorts for the action that the pixel store will take.
	writers.underlay = extraCanvases[0][0].getContext('2d'); //Output of 'this layer and less' from the pixel store.
	
	var ctx = writers.ui;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	extraCanvases[0].css('background', canvasDOM.css('background-color'));
	canvasDOM.css('background', 'transparent');
});