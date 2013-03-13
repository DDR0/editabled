editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var pxStore = canvas.edLib.pxStore;
	var utils = canvas.edLib.utils;
	var sUtils = editors.utils; //Static Common Utils
	var writers = canvas.edLib.writers;
	var ui = canvas.edLib.ui;
	
	
	
	var pingWorker = function() {
		var handlers = {
			onPing: function(data) {
				c.log(utils.tagStr("Worker said:"), data.data);
			},
		};
		
		pxStore.addEventListener('message', function(event) {
			var cmd = sUtils.eventNameFromCommand('on', event);
			if(typeof handlers[cmd] === 'function') {
				handlers[cmd](event.data); return;
			}
		});
		
		//Test above messaging.
		pxStore.postMessage({'command': 'ping', 'data': 'ping', });
		console.log(utils.tagStr('Messager said: ping'));
	};
	
	
	
	var floodCanvas = function(layer) {
		var ctx = writers[layer];
		ctx.rect(0,0,10000,10000);
		ctx.fillStyle="#333";
		ctx.fill(); 
	};
	
	
	
	var drawingTests = function(run) {
		
		run = run || ['25pt', '\\', '/', 'vLines', 'hLines', 'angles'];
		var cmd;
		var x = 10; var y = 10;
		if(_.contains(run, '25pt')) { // Draw a 25-dot square with one pixel between dots.
			_.range(25).map(function(step) {
				ui.draw({'command': 'drawLine', 
				         'preview':true,
				         'points': {x:[x+step%5*2],
				                    y:[y+Math.floor(step/5)*2] }});
			});
		}
		
		x = 40;
		if(_.contains(run, '\\')) {
			cmd = {'command': 'drawLine', 
			           'preview':true,
			           'points': {x:[x+0, x+8],
			                      y:[y+0, y+8] }};
			//c.log('command \\:', cmd.points);
			ui.draw(cmd);
			
			x = 70;
			cmd = {'command': 'drawLine', 
			           'preview':true,
			           'points': {x:[x+8, x+0],
			                      y:[y+8, y+0] }};
			//c.log('command \\:', cmd.points);
			ui.draw(cmd);
		}
		
		x = 100;
		if(_.contains(run, '/')) {
			cmd = {'command': 'drawLine', 
			           'preview':true,
			           'points': {x:[x+8, x+0],
			                      y:[y+0, y+8] }};
			//c.log('command \\:', cmd.points);
			ui.draw(cmd);
			
			x=130;
			cmd = {'command': 'drawLine', 
			           'preview':true,
			           'points': {x:[x+0, x+8],
			                      y:[y+8, y+0] }};
			//c.log('command \\:', cmd.points);
			ui.draw(cmd);
		}
		
		x = 150;
		if(_.contains(run, 'vLines')) { // ^ 
			_.range(1,6).map(function(step) {
				cmd = {'command': 'drawLine', 
				       'preview':true,
				       'points': {x:_.range(step).map(function(substep) {return x+(step-1)*5;}),
				                  y:_.range(step).map(function(substep) {return y+substep*5;}) }};
				//c.log('command vMultiLine', cmd.points);
				ui.draw(cmd);
			});
		}
		
		x = 10; y = 25;
		if(_.contains(run, 'hLines')) { //Test drawing line segments 5px long.
			_.range(1,6).map(function(step) {
				cmd = {'command': 'drawLine', 
				       'preview':true,
				       'points': {x:_.range(step).map(function(substep) {return x+(step-1)*30+substep*5;}),
				                  y:_.range(step).map(function(substep) {return y;}) }};
				//c.log('command hMultiLine', cmd.points);
				ui.draw(cmd);
			});
		}
		
		y = 40;
		if(_.contains(run, 'angles')) {
			var tmp = function() {
				var ctx = writers.ui;
				ctx.strokeStyle = '#0F0';
				ctx.lineWidth = 1;
				var strokeLine = function(cmd) {
					ctx.beginPath();
					ctx.moveTo(cmd.points.x[0]+nativeOffset.x,cmd.points.y[0]+nativeOffset.y);
					ctx.lineTo(cmd.points.x[1]+nativeOffset.x,cmd.points.y[1]+nativeOffset.y);
					ctx.stroke();
				};
				var tgtX=4, tgtY=0;
				var stepSize = 3; //lines
				var blockSize = 20; //space between each square containing a line, including the square
				var nativeOffset = {x:0, y:20};
				_.range(0,5).map(function(yOffset) {
					tgtY = yOffset;
					cmd = {'command': 'drawLine', 
				           'preview':true,
				           'points': {x:[x + blockSize*tgtY, x + blockSize*tgtY + tgtX*stepSize],
				                      y:[y, y + tgtY*stepSize] }};
					strokeLine(cmd); //Must be first, since ui.draw hoses cmd.
					ui.draw(cmd);
				});
				_.range(1,5).map(function(xOffset) {
					tgtX = xOffset;
					cmd = {'command': 'drawLine', 
				           'preview':true,
				           'points': {x:[x + blockSize*(tgtX+4), x + blockSize*(tgtX+4) + (4-tgtX)*stepSize],
				                      y:[y, y + tgtY*stepSize] }};
					strokeLine(cmd);
					ui.draw(cmd);
				});
				
			}();
		}
	};
	
	
	
	// ------------------------------
	
	
	
	//pingWorker();
	//floodCanvas('underlay');
	//drawingTests();
	
});