/*global _, c*/
var miscellaneousUtilities = {};
miscellaneousUtilities.init = function(globalObject, targetObject) {
	"use strict";
	globalObject.miscellaneousUtilities = undefined; //We can't delete this in a worker context.
	var t = targetObject;
	
	t.eventName = function(header, name) {
		return header+_.head(name).toUpperCase()+name.slice(1, name.length);
	};
	
	t.eventNameFromCommand = function(header, event) {
		return t.eventName(header, event.data.command);
	};
	
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
	
	t.croppedImage = function(largeImage, boundingBox) {
		return largeImage.getImageData(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
	};
	
	t.normalizeCoords = function(cmd, newOrigin) { //Cmd is a standard drawing command with [xs]/[ys], and newOrigin is a map containing an x/y value to be zeroed to. If you had a [100]/[100] points lists, and you passed in a bounding box that started at 90/90, then you would get a standard draw event back out but with the points lists [10]/[10].
		_.range(cmd.x.length).map(function(index) {
			cmd.x[index] -= newOrigin.x1;
			cmd.y[index] -= newOrigin.y1;
		});
		return cmd;
	};
	
	t.setPixels = function(cmd) { //cmd.data should be a uint8 list. cmd.x/y: A list of x values and a corresponding list of y values to plot points at.
		if(!cmd.width) throw "width field required"; //missing height/data will cause crash soon enough
		cmd.chan = cmd.chan || 4; //The number of channels deep the current graphic is. Default mapping is RGBA, or four channels. (Channels are numerically defined, like a list, in the command.)
		_.range(cmd.x.length).map(function(index) {
			var base_position = (cmd.x[index] + cmd.y[index]*cmd.width)*cmd.chan;
			_.range(cmd.chan).map(function(index) {
				if(isFinite(cmd[index])) cmd.data[base_position+index] = cmd[index];
			});
		});
	};
	
	t.setLine = function(cmd) {
		var newXs = [cmd.x[0]];
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
};