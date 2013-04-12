/*jshint -W018 */
/*global _, c*/
var miscellaneousUtilities = {}; //These are stateless functions. They're used by both the Pixel Store worker and all the normal UI js.
miscellaneousUtilities.init = function(globalObject, targetObject) {
	"use strict";
	globalObject.miscellaneousUtilities = undefined; //We can't delete this in a worker context.
	var t = targetObject;
	
	
	/* MISC UTILITIES */
	
	
	t.eventName = function(header, name) {
		return header+_.head(name).toUpperCase()+name.slice(1, name.length);
	};
	
	t.eventNameFromCommand = function(header, event) {
		return t.eventName(header, event.data.command);
	};
	
	//t.sum = function(list) {return list.reduce(function(a,b) {return a+b;});};
	
	
	/* BITMAP FUNCTIONS */
	
	
	t.getBoundingBox = function(points) {
		var xs = _.sortBy(points.x, function(a) {return a;}); //points.x.sort() just sorts the array in place
		var ys = _.sortBy(points.y, function(a) {return a;});
		var minx = _.first(xs); var maxx = _.last(xs); 
		var miny = _.first(ys); var maxy = _.last(ys);
		return {                           //Expects points to be a list of objects with an x and a y value.
			get x() {return minx;},        //Moving x/y or mid_x/mid_y moves the entire rectangle.
			set x(val) {                   //Warning: height and width are inclusive of the last pixel! Subtract 1 for a conventional measure.
				var diff = minx - val;     //Setting width/height grows and contracts the rectangle around the center.
				minx = minx - diff;        //You can use x1/x2/y1/y2 to get and set the corners of the rectangle independently.
				maxx = maxx - diff;
			},
			get y() {return miny;},
			set y(val) {
				var diff = miny - val;
				miny = miny - diff;
				maxy = maxy - diff;
			},
			
			get mid_x() {return (minx+maxx)/2;},
			set mid_x(val) {
				var diff = (minx+maxx)/2 - val;
				minx = minx - diff;
				maxx = maxx - diff;
			},
			get mid_y() {return (miny+maxy)/2;},
			set mid_y(val) {
				var diff = (miny+maxy)/2 - val;
				miny = miny - diff;
				maxy = maxy - diff;
			},
			
			get x1() {return minx;},
			set x1(val) {minx=val;},
			get y1() {return miny;},
			set y1(val) {miny=val;},
			
			get x2() {return maxx;},
			set x2(val) {maxx=val;},
			get y2() {return maxy;},
			set y2(val) {maxy=val;},
			
			get width() {return maxx-minx+1;},
			set width(val) {
				var diff = val - (maxx-minx+1);
				minx -= diff/2;
				maxx += diff/2;
			},
			get height() {return maxy-miny+1;},
			set height(val) {
				var diff = val - (maxy-miny+1);
				miny -= diff/2;
				maxy += diff/2;
			},
		};
	};
	
	t.duplicateBoundingBox = function(oldBox) {
		return t.getBoundingBox({x:[oldBox.x1, oldBox.x2], y:[oldBox.y1, oldBox.y2]});
	};
	
	t.croppedImage = function(largeImage, boundingBox) { //Only for RGBA images. Have a look at moveLayerData for shifting around multichannel image data.
		return largeImage.getImageData(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
	};
	
	t.convertBuffer = function(oldBuffer, options) { //Returns a copy of part of the old buffer. Options are: "area", takes a boundingBox (as returned by getBoundingBox, above); "outputChannels", which takes an integer or iteratable list containing the index of the target channel to map to. The index of the list is the OLD CHANNEL, and the contents at that index are the NEW CHANNEL. For example, to switch from [rgba] to [rgb], you would use [0,1,2] (or just the integer 3, which would be equivalent), with inputChannels set to 4. To switch back, use [0,1,2,,], with inputChannels set to 3. Number of output channels is implied by list length. Essentially a map of input chan → output chan. "inputChannels" is always an integer value.
		var width = options.area.width;
		var height = options.area.height;
		var depthIn = options.inputChannels || 4;
		var depthOut = options.outputChannels || 4;
		if(typeof depthOut === "number") {
		      depthOut = _.range(depthOut); }
		var bufferWidth = options.bufferWidth;
		var outputLength = width * height * depthOut.length;
		var imageToReturn = new ArrayBuffer(outputLength);
		var oldUint8Arrays = new Uint8ClampedArray(oldBuffer);
		var returnUintArray = new Uint8ClampedArray(imageToReturn);
		
		if(!depthOut.length) {
			throw "[F6nwj] options.outputChannels doesn't have a valid length (" + depthOut.length + ")";
		} else if(!options.bufferWidth) {
			throw "[ILH48] options.bufferWidth isn't valid (" + options.bufferWidth + ")";
		}
		
		var copyChans = function(newChan, oldChan) {
			if(isFinite(newChan)) {
				returnUintArray[(newy*width+newx)*depthOut.length+newChan] = oldUint8Arrays[(oldy*bufferWidth+oldx)*depthIn+oldChan];
			}
		};
		
		for (var oldx = options.area.x1, newx = 0; oldx <= options.area.x2; oldx++, newx++) {
			for (var oldy = options.area.y1, newy = 0; oldy <= options.area.y2; oldy++, newy++) {
				depthOut.map(copyChans);
			}
		}
		
		return imageToReturn;
	};
	
	t.normalizeCoords = function(cmd, newOrigin) { //Cmd is a standard drawing command with [xs]/[ys], and newOrigin is a map containing an x/y value to be zeroed to. If you had a [100]/[100] points lists, and you passed in a bounding box that started at 90/90, then you would get a standard draw event back out but with the points lists [10]/[10]. "bufferWidth" is how many pixels wide the old buffer is.
		_.range(cmd.x.length).map(function(index) {
			cmd.x[index] -= newOrigin.x1;
			cmd.y[index] -= newOrigin.y1;
		});
		return cmd;
	};
	
	t.setAll = function(cmd) {
		cmd.chan = cmd.chan || 4;
		var pixels = cmd.data.length/cmd.chan;
		index = 0;
		for (var index = 0; index < pixels; index++) {
			for (var channel = 0; channel < cmd.chan; channel++) {
				if(isFinite(cmd[channel])) cmd.data[index*cmd.chan+channel] = cmd[channel];
			}
		}
	};
	
	t.setPixels = function(cmd) { //cmd.data should be a uint8 list. cmd.x/y: A list of x values and a corresponding list of y values to plot points at. drawUpdateRect is an optional arg, for use if you'd like to see the rectangle that was used when drawing the line. (For debug use only.)
		if(!cmd.width) throw "width field required, must be greater than 0"; //missing height/data will cause crash soon enough
		cmd.chan = cmd.chan || 4; //The number of channels deep the current graphic is. Default mapping is RGBA, or four channels. (Channels are numerically defined, like a list, in the command.)
		_.range(cmd.x.length).map(function(index) {
			var base_position = (cmd.x[index] + cmd.y[index]*cmd.width)*cmd.chan;
			_.range(cmd.chan).map(function(index) {
				if(isFinite(cmd[index])) cmd.data[base_position+index] = cmd[index];
			});
		});
	};
	
	t.setLine = function(cmd, drawUpdateRect) {
		if(drawUpdateRect) t.setAll({data:cmd.data, 0:_.random(0,127), 1:_.random(127,255), 2:_.random(127,255), 3:255});
		var newXs = [cmd.x[0]]; //NOTE: This means that there is one pixel of overdraw for mouse-drawn multiline segments, since the mouse starts and ends at the same point if you're dragging it. Bounding box is calculated from points. Not a problem, as long as we're not calculating transparency in an additional manner. (Then, you'll see you draw two pixels at points where the mouse was sampled.)
		var newYs = [cmd.y[0]];
		_.range(1, cmd.x.length).map(function(index) {
			var startX = _.last(newXs) + 0.5;
			var startY = _.last(newYs) + 0.5;
			var finalX = cmd.x[index] + 0.5;
			var finalY = cmd.y[index] + 0.5;
			var distX = finalX - startX;
			var distY = finalY - startY;
			var signX = distX >= 0 ? 1 : -1;
			var signY = distY >= 0 ? 1 : -1;
			var maximumDist = Math.abs(distX) >= Math.abs(distY) ? Math.abs(distX) : Math.abs(distY);
			if(Math.abs(maximumDist) <= 1) { //The final pixel is next to the original one. No extra points needed.
				newXs.push(cmd.x[index]);
				newYs.push(cmd.y[index]);
				return;
			}
			//maximumDist += maximumDist > 0 ? -1 : +1; //interior line distance
			var xSteps = _.range(1, maximumDist).map(function(step) {
				var percent = step/maximumDist;
				return Math.floor(startX + distX*percent);
			});
			var ySteps = _.range(1, maximumDist).map(function(step) {
				var percent = step/maximumDist;
				return Math.floor(startY + distY*percent);
			});
			newXs = newXs.concat(xSteps, cmd.x[index]);
			newYs = newYs.concat(ySteps, cmd.y[index]);
		});
		
		cmd.x = newXs;
		cmd.y = newYs;
		//c.log('lines', [cmd.x, cmd.y])
		t.setPixels(cmd);
	};
	
	t.newBuffer = function (width, height, depth) {
		return new ArrayBuffer(width*height*depth);
	};
	
	
	/* COMMON LAYER FUNCTION */
	
	
	t.getLayer = function unpackLayers(lobj, path) { //Returns the layer object the path is pointing at.
		if(path.length) {
			return unpackLayers(lobj.layers[_.head(path)], _.tail(path)); //lobj = layer object, be it a window, folder, or canvas
		} else {
			return lobj;
		}
	};
	
	t.insertLayer = function(lobj, path, layer) { //Puts the layer in the layer stack at path.
		var parentObj = t.getLayer(lobj, _.initial(path));
		if(parentObj.type === 'canvas') throw {'message': "Tried to add layer inside a canvas layer.", 'layers': layers, 'path': path};
		var index = _.last(path);
		parentObj.layers = parentObj.layers.slice(0, index).concat(layer, parentObj.layers.slice(index, parentObj.layers.length));
	};
	
	t.removeLayer = function(lobj, path) { //Removes, and returns, the layer specified by path.
		var parentObj = t.getLayer(lobj, _.initial(path));
		var index = _.last(path);
		var layer = parentObj[index];
		parentObj.layers = parentObj.layers.slice(0, index).concat(parentObj.layers.slice(index+1, parentObj.layers.length));
		return layer;
	};
	
	var sizeIncreaseStep = 128; //TODO: Make this 512 when it's been proven to work a bit more.
	t.aCeil = function(num, step) { //A "sign-agnostic ceiling function". Returns the next multiple of sizeIncreaseStep away from 0. (Behaves like the Anura % operator.)
		step = step || sizeIncreaseStep;
		if(!(num%step)) return num; //No change needed. (0 remains unchanged.) Will pass bad values like NaN or ±Infinity, though.
		//if(!num) return num; //No change for 0;
		var negative = num < 0 ? -1 : 1;
		num = Math.abs(num);
		num = (Math.floor(num/step)+1)*step;
		return negative * num;
	};
	t.aFloor = function(num, step) {
		return t.aCeil(num, -step);
	};
};