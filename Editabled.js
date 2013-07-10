/*global _, $, jQuery, console*/
//Loads the external scripts for the editor, and draws a little 'loading' text.

var c = console;	//A shortcut, I'm tired of typing 'console.log' every damn time.
var editors = [];		//The global 'library', how components talk to eachother.

window.loadEditabled = function() {
	"use strict";
	
	var loadOtherScriptsCount = 0;
	
	var baseURL = "Editabled/";
	var jsAr = [		
		{url: "Static Utilities.js",        type: "script"},
		{url: "Pixel Store.js",             type: "canvas-worker", name: "pxStore"},
		{url: "Utilities.js",               type: "script"},
		{url: "Setup.js",                   type: "script"},
		{url: "User Interface.js",          type: "script"},
		{url: "Event Listener.js",          type: "script"},
		{url: "Tests.js",                   type: "script"},
		];
	var jsArRecieved = [];
	
	var launchGame;
	launchGame = function() {
		jsArRecieved.map(function(data, index) {
			var js = jsAr[index];
			if(js.type === 'script') {
				jQuery.globalEval(data);
			} else if(js.type === 'canvas-worker') {
				editors.map(function(index) {
					var editor = editors[index];
					editor.edLib[js.name] = new Worker(baseURL + js.url);
				});
			} else {
				throw "script type '"+js.type+"' invalid";
			}
		});
	};
	
	var continueIfLoaded = function() {
		loadOtherScriptsCount += 1;
		if(loadOtherScriptsCount === jsAr.length) {
			launchGame();
		}
	};
	
	var failToLoad = _.once(function(err) {
		c.warn('AJAX error ' + err.status + ": " + err.statusText + ".\n" + err.responseText);
		window.alert('Well, bother. An error occured while downloading the editor. Check that we\'re still connected to the internet, then try again. If that didn\'t work, then we\'re hooped. Sorry.');
	});
	
	window.setTimeout(function() { //The 50ms delay is required, here. Sticking the ajax in the DOMContentLoaded event, after the drawing of the text, doesn't help one iota in chrome. Works in Firefox, though.
		jsAr.map(function(js, index) {
			js = js.url;
			//c.log('loader: fetching ' + js);
			$.ajax({
				async: true,
				type: "GET",
				url: baseURL + js,
				dataType: 'text',
				
				error: failToLoad,
				success: function(data){
					jsArRecieved[index] = data;
					continueIfLoaded();
				},
			});
		});
	}, 50);
	
	window.addEventListener('DOMContentLoaded', function() {
		//Draw 'loading' text.
		editors = $(".image-editor");
		editors.map(function(index) {
			var editor = editors[index];
			editor.width = $(editor).width();
			editor.height = $(editor).height();
			editor.edLib = {};
			
			var ctx = editor.getContext('2d'); //ctx = ConTeXt.
			ctx.strokeStyle = '#000';
			ctx.fillStyle = '#FFF';
			ctx.lineWidth = 2;
			var textHeight = 15;
			ctx.font = textHeight + "pt Fixedsys";
			var text = "Loading Editabled";
			var textWidth = ctx.measureText(text).width;
			ctx.strokeText(text,  editor.width/2 - textWidth/2, editor.height/2 + textHeight/4);
			ctx.fillText(  text,  editor.width/2 - textWidth/2, editor.height/2 + textHeight/4);
		});
	});
	
	return true;
}();
delete window.loadEditabled;