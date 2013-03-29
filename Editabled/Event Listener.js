/*global _ $ jQuery console c editors*/

var edFocusedCanvas = false;
editors.map(function(index) {
	"use strict";
	var canvas = editors[index];
	var pxStore = canvas.edLib.pxStore;
	var utils = canvas.edLib.utils;
	var sUtils = editors.utils; //Static Utils
	var ui = canvas.edLib.ui;
	
	var oldMousePosition = {x:0, y:0};
	var mouseLeftButtonDown = false; //Since there is no difference between 'no button down' (code 0) and 'left button down' (also code 0), we have to store it manually in the mousedown event where we're garaunteed that no button pressed isn't an option.
	var buttonsDown = [];
	
	var stopAllPropagation = function(event) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		event.cancelBubble = true;
		return false;
	};
	
	var wacomPlugin = document.getElementById('wtPlugin');
	var pressure = function() { //We have two ways of getting the pressure, either by a mozilla-specific event property or by the Wacom plugin.
		var wacomPressure = function() {
			return wacomPlugin ? wacomPlugin.penAPI.pressure : null;
		};
		return function(event) {
			return wacomPressure() || event.pressure || event.mozPressure || 0.5;
		};
	}();
	
	var mouseLocation = function(event) { //Note: May not return a map containing mouse x/y.
		var loc = {
			x: event.offsetX || Math.ceil(event.pageX - $(canvas).offset().left),
			y: event.offsetY || Math.ceil(event.pageY - $(canvas).offset().top),
		};
		if(loc.x >= 0 && loc.y >= 0) return loc;
	};
	
	var pushMouseButtons = function(event) {
		buttonsDown[event.button] = true;
		//c.log(utils.tagStr('added'), buttonsDown);
	};
	
	var popMouseButtons = function(event) {
		buttonsDown[event.button] = false;
		//c.log(utils.tagStr('removed'), buttonsDown);
	};
	utils['popMouseButtons'] = popMouseButtons;
	
	var buttonDown = function(event) {return (!!event.button || mouseLeftButtonDown) && buttonsDown[event.button];};
	
	var sendMouseEventToUI = function(event, targetName, flags) { //Takes a DOM mouse event and a target function in the UI. Passes a 'nice' function to the UI. Returns mouse position where event was fired at. ——— The purpose of Event Listener.js is to feed the UI code events that are maximally useful. This way, we don't get the capturing and processing of the event mixed up with the code that details the effects of the event. (~100 lines of code that *aren't* cluttering up the logic in the UI drawing code.)
		flags = flags || {};
		var mLoc = mouseLocation(event);
		targetName = sUtils.eventName(ui.tool.type, targetName);
		//c.log(utils.tagStr('event ' + targetName));
		if((mLoc || flags.noNew) && ui[targetName]) {
			mLoc = mLoc || {};
			var fnArg = {
				x: mLoc.x, //Setting "prototype: mLoc" doesn't work. __proto__ only works in chrome.
				y: mLoc.y - utils.useMouseOffsetWorkaround, //For firefox, basically.
				oldX: oldMousePosition.x,
				oldY: oldMousePosition.y - utils.useMouseOffsetWorkaround,
				pressure: pressure(event),
			};
			sendEventToUI(targetName, fnArg);
			return mLoc;
		}
	};
	
	var sendEventToUI = function(targetName, args) {
		if(utils.useDelayInputWorkaround) {
			window.setTimeout(ui[targetName], 0, args);
		} else {
			ui[targetName](args);
		}
	};
	
	var startMouseEvent = function(event) {
		if(!event.altKey) {
			if(buttonsDown[event.button]) {
				var mLoc;
				sendMouseEventToUI(event, 'removePreview', {noNew:true});
				switch(event.button) {
					case 0:
						mLoc = sendMouseEventToUI(event, 'leftStart');
						if(mLoc) mouseLeftButtonDown = true;
						break;
					case 1:
						mLoc = sendMouseEventToUI(event, 'middleStart');
						break;
					case 2:
						mLoc = sendMouseEventToUI(event, 'rightStart');
						break;
				}
				if(mLoc) oldMousePosition = mLoc;
			}
			edFocusedCanvas = keyDownEvent;
			return stopAllPropagation(event);
		} else {
			return true;
		}
	};
	canvas.addEventListener('mousedown', function(event) {
		pushMouseButtons(event);
		return startMouseEvent(event);
	});
	canvas.addEventListener('mouseover', startMouseEvent);
	
	canvas.addEventListener('contextmenu', function(event) { //No context menu for us. We need that right mouse button! The button event itself will be captured by the 'mousedown' event, above.
		if(!event.altKey) {
			return stopAllPropagation(event);
		} else {
			return true;
		}
	});
	
	var continueMouseEvent = function(event, noSwallow) {
		if(!event.altKey) {
			var mLoc;
			if(buttonDown(event)) {
				switch(event.button) {
					case 0:
						mLoc = sendMouseEventToUI(event, 'leftContinue');
						break;
					case 1:
						mLoc = sendMouseEventToUI(event, 'middleContinue');
						break;
					case 2:
						mLoc = sendMouseEventToUI(event, 'rightContinue');
						break;
				}
			} else {
				sendMouseEventToUI(event, 'removePreview', {noNew:true});
				mLoc = sendMouseEventToUI(event, 'addPreview');
			}
			if(mLoc) oldMousePosition = mLoc;
			return stopAllPropagation(event);
		} else {
			return true;
		}
	};
	canvas.addEventListener('mousemove', function(event) {
		if(!edFocusedCanvas) {edFocusedCanvas = keyDownEvent;}
		return continueMouseEvent(event);
	});
	
	$(canvas).bind('mousewheel', function(event, magnitude) { //'wheel' seems to be the standards-supported event, but it's not supported in all browsers. This event relies on a jQuery extention.
		if(!event.altKey) {
			c.log('mouse scroll', magnitude);
			return stopAllPropagation(event);
		} else {
			return true;
		}
	});
	
	var finishMouseEvent = function(event) {
		if(!event.altKey) {
			if(buttonsDown[event.button]) {
				switch(event.button) {
					case 0:
						mouseLeftButtonDown = false;
						sendMouseEventToUI(event, 'leftFinish');
						break;
					case 1:
						sendMouseEventToUI(event, 'middleFinish');
						break;
					case 2:
						sendMouseEventToUI(event, 'rightFinish');
						break;
				}
				sendMouseEventToUI(event, 'addPreview');
			} else {
				sendMouseEventToUI(event, 'removePreview', {noNew:true});
			}
			return stopAllPropagation(event);
		} else {
			return true;
		}
	};
	canvas.addEventListener('mouseup', function(event) {
		editors.map(function(index) {
			editors[index].edLib.utils.popMouseButtons(event);
		});
		return finishMouseEvent(event);
	});
	canvas.addEventListener('mouseout', function(event) {
		edFocusedCanvas = false;
		return finishMouseEvent(event);
	});
	
	
	//This makes a mouse-up event fire even if we're not on the canvas, so that we don't release the mouse button off-canvas and then start drawing lines on canvas even though we're not pressing anything. Basically – it's a hack for not being able to ask 'is a mouse button actually down'.
	document.addEventListener('mouseup', function(event) {
		popMouseButtons(event);
	});
	
	
	var keyDownEvent = function(event, key) { //key is a numeric keycode
		var action = utils.codeToAction(key);
		c.log('key action: ', action);
		if(action && ui[action]) {
			var args = {
				pressedKeyCodes: keysDown,
			};
			sendEventToUI(action, args);
			return stopAllPropagation(event); //Don't do this for keys we don't use.
		} else {
			return true; //'true' being the opposite of 'stopAllPropagation'. Because stopAllPropagation returns false.
		}
	};
});


var keysDown = {};

document.addEventListener('keydown', function(event) {
	"use strict";
	var key = event.keyCode || event.which;
	if(!keysDown[key]) { //No reason to fire key presses repeatedly other than text input, which we're not doing here.
		keysDown[key] = true;
		c.log('Registered key ' + key + ' (on canvas: ' + !!edFocusedCanvas + ')');
		c.log('returned', edFocusedCanvas ? !!edFocusedCanvas : true);
		return edFocusedCanvas ? edFocusedCanvas(event, key) : true;
	} else {
		return true;
	}
});

document.addEventListener('keyup', function(event) {
	"use strict";
	var key = event.keyCode || event.which;
	keysDown[key] = false;
	c.log('Unregistered key ' + key);
	return true;
});