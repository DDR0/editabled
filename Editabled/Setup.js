/*global _, $, jQuery, console, c, editors, miscellaneousUtilities*/

var glob; //A global variable, for debugging in the console.
miscellaneousUtilities.init(window, editors.utils = {});

editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	
	canvas.edLib = {};
	var edLib = canvas.edLib;
	
	edLib.utils = {};
	var utils = edLib.utils;
	
	edLib.writers = {}; //We'll write the buffered output of the pixel store to two layers, overlay and underlay. Underlay will contain the RGBA render of the active layer, and any layers below. Overlay, will contain the RGBA render of the remaining layers. These will blend together using whatever method the browser uses for compositing. ui will be where the tool itself is rendered as it's being used. uiGhost is where the ghost of the tool renders, *if* the overlay pixel isn't totally transparent. This is because, since we've got a layered image, the tool should appear *in* the layer it's working on, and hence underneath any layers on top of it.
	var writers = edLib.writers;
	
	edLib.utils.tag = Math.random().toString(36).slice(2,7);
	edLib.utils.tagStr = function(str) {return "["+edLib.utils.tag+"] "+str;};
	edLib.utils.useDelayInputWorkaround = navigator.userAgent.indexOf("Firefox") >= 0;
	
	var canvasPosition = $(canvas).offset();
	var extraCanvases = _.range(3).map(function() {
		var extraCanvas = $("<canvas>")
			.attr({'width':canvas.width,'height':canvas.height})
			.css({
				"position": "absolute",
				//"background": "yellow",
				"pointer-events": "none",
			})
			.css(canvasPosition);
		extraCanvas.appendTo("body");
		return extraCanvas;
	});
	extraCanvases[0].css('z-index', -10);
	extraCanvases[1].css('z-index', 10);
	extraCanvases[2].css('z-index', 20);
	
	writers.uiGhost = extraCanvases[2][0].getContext('2d');
	writers.overlay = extraCanvases[1][0].getContext('2d');
	writers.ui = canvas.getContext('2d');
	writers.underlay = extraCanvases[0][0].getContext('2d');
	
	var ctx = writers.ui;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	extraCanvases[0].css('background', $(canvas).css('background-color'));
	$(canvas).css('background', 'transparent');
});