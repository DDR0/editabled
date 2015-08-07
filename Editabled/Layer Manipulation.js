/* jshint worker: true, globalstrict: true, smarttabs: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, imageTree, c, cUtils, Uint8ClampedArray, newLayerCanvas, runOffset*/
"use strict";
var lData = {};

//These are impure functions for Pixel Store layer manipulation.

lData.getLayerOffset = function(lobj, path) { //Returns the absolute X and Y of the layer, as an object with x and y keys.
	return path.map(function(element, index) {
		return cUtils.getLayer(lobj, path.slice(0, index));
	}).reduce(function(a,b) {
		return {x:a.x+b.x, y:a.y+b.y};
	});
};


lData.setLine = function(layer, points, colour) {
	cUtils.setLine(
		_.defaults(
			{'data':new Uint8ClampedArray(layer.buffer), 'width':layer.width, 'chan':layer.channels}, 
			cUtils.normalizeCoords(points, layer), 
			colour));
};


lData.paintInteriorExterior = function(layer) { //Paints the interior pixels of the layer the exterior color of the layer.
	cUtils.setAll({
		data:new Uint8ClampedArray(layer.buffer), 
		chan:layer.channels, 
		0: layer.exteriorColour[0], 
		1: layer.exteriorColour[1], 
		2: layer.exteriorColour[2], 
		3: layer.exteriorColour[3]});
};


lData.sizeLayer = function(layer, box) { //Resizes the layer so that the bounding box would fit in to it.
	var x1Exp = Math.min(0, box.x1 - layer.x1); //x1Exp = Left side expansion required to make box fit in layer. Will be a negative number, since it only needs to go left-er.
	var y1Exp = Math.min(0, box.y1 - layer.y1);
	var x2Exp = -Math.min(0, layer.x2 - box.x2);
	var y2Exp = -Math.min(0, layer.y2 - box.y2);
	//c.log('recommended expansion xyxy: ', x1Exp,y1Exp,x2Exp,y2Exp);
	if(x1Exp||y1Exp||x2Exp||y2Exp) {
		var resizedLayer = cUtils.duplicateBoundingBox(layer);
		_.defaults(resizedLayer, layer);
		if(x1Exp) resizedLayer.x1 = cUtils.aCeil(resizedLayer.x1 + x1Exp - 1);
		if(y1Exp) resizedLayer.y1 = cUtils.aCeil(resizedLayer.y1 + y1Exp - 1);
		if(x2Exp) resizedLayer.x2 = cUtils.aCeil(resizedLayer.x2 + x2Exp + 1) - 1; //OK, this is I think needed because 0 overlaps in the aCeil math when we expand negatively. Since we expand in 512-pixel incrementns, we should ensure that we do not exceed by one and make a 516-pixel wide image, because I think that'd do bad things to some optimization somewhere. Waste of space, and all. At any rate, the -1 makes the math correct here (I measured) for round numbers of pixels. :) This is pure 'gut feeling', unfortunantly, since I don't know a way to directly profile this.
		if(y2Exp) resizedLayer.y2 = cUtils.aCeil(resizedLayer.y2 + y2Exp + 1) - 1; //The if statements keep the -1s from being applied if there is no change, if the layer has been initialized juuuust wrong, ie, equal to cUtils.aCeil(resizedLayer.y2 + y2Exp).
		resizedLayer.buffer = cUtils.newBuffer(resizedLayer.width, resizedLayer.height, resizedLayer.channels);
		c.log('resizing with', resizedLayer.exteriorColour);
		//TODO: Optimize the call to paintInteriorExterior to only update the bits that need it.
		lData.paintInteriorExterior(resizedLayer); //This call is a little over half the time it takes to execute this function.
		lData.moveLayerData(layer, resizedLayer, {area: layer, optimization:'line'});
		_.extend(layer, resizedLayer);
	}
};

lData.moveLayerData = function(oldLayer, newLayer, options) { //Copies the layer image data from the oldLayer to the newLayer in a reasonably efficient manner.
	/*  oldLayer: The old layer of data to copy from. (type "layerCanvas")
	    newLayer: The new layer of data to copy to. (May be the old layer.)
	    options: (map)
	      oldOrigin.x/y and newOrigin.x/y are optional. They specify the
	        origin point for the rectange being copied from the old layer
	        to the new layer, on their respective layers. Will default to
	        area.x/y if not supplied, or the layer x/y if area not supplied.
	      channels (optional) specifies the mapping of the channels from old
	        to new. This works like convertBuffer's outputChannels option.
	        Basically, key is old channel, value is new channel. Works with
	        lists or maps. An undefined value means to ignore the channel.
	      area: A bounding box, telling what to move. Optional if
	        oldOrigin.x/y, newOrigin.x/y, width, and height and height are
	        defined.
	      width (optional) is the width of the square area to copy.
	        This is an inclusive measurement, like a boundingBox.
	      height (optional) is height of the area to copy. Inclusive.
	      optimization: Either 'block', 'line', or 'none'. Ensures that the
	        layer is being copied at at least the specified optimization
	        level. Optional, doesn't affect actual optimization applied.
	*/
	var oldBaseX = options.oldOrigin ? options.oldOrigin.x : oldLayer.x,  newBaseX = options.newOrigin ? options.newOrigin.x : newLayer.x;
	var oldBaseY = options.oldOrigin ? options.oldOrigin.y : oldLayer.y,  newBaseY = options.newOrigin ? options.newOrigin.y : newLayer.y;  
	var oldChans = oldLayer.channels,                                     newChans = newLayer.channels;  
	var defaultChannels = _.range(Math.min(oldChans, newChans));
	var channels = options.channels    || defaultChannels;
	var width    = options.width       || options.area.width;
	var height   = options.height      || options.area.height;
	
	var oldOffsetX = -oldLayer.x,                                         newOffsetX = -newLayer.x + (oldBaseX - newBaseX);
	var oldOffsetY = -oldLayer.y,                                         newOffsetY = -newLayer.y + (oldBaseY - newBaseY);
	var oldArray = new Uint8ClampedArray(oldLayer.buffer),                newArray = new Uint8ClampedArray(newLayer.buffer);
	
	//TODO: Clip the copy rectangle so that it fits inside the read and write layers.
	
	var oldBlockStart, newBlockStart, blockLength, line, column, channel;
	if(oldBaseX === newBaseX && width===oldLayer.width && width===newLayer.width && oldLayer.channels===newLayer.channels && _.isEqual(channels, defaultChannels) ) { //We want to copy full lines into full lines. This means we don't have to skip spaces (columns), but can copy the entire contiguous section in one go.
		oldBlockStart = (oldOffsetX+(oldBaseY+oldOffsetY)*width)*oldLayer.channels; //Commented out oldBaseY because it was cancelling out some math and causing the equasion to be 0.
		newBlockStart = (newOffsetX+(newBaseY+newOffsetY)*width)*newLayer.channels;
		blockLength = width*height*oldLayer.channels;
		newArray.set(oldArray.subarray(oldBlockStart, oldBlockStart+blockLength), newBlockStart);
		c.log('Block copy!');
	} else if(oldLayer.channels===newLayer.channels && _.isEqual(channels, defaultChannels) ) { //Even though we have to stop copying to avoid overwriting some columns, each line of data we want to copy is still contiguous, and we can copy that.
		if(options.optimization === "block") throw new Error("Block-level layer copy operation specified, but only line-level copy possible.");
		blockLength = width*channels.length;
		for (line = 0; line < height; line++) {
			oldBlockStart = (
				(oldOffsetY + oldBaseY + line) * oldLayer.width + //Y offset, including line.
				oldOffsetX + oldBaseX) *                          //X offset
				oldLayer.channels;                                //Size of a pixel, in Uint8s.
			newBlockStart = (
				(newOffsetY + newBaseY + line) * newLayer.width +
				newOffsetX + newBaseX) *
				newLayer.channels;
			//c.log(oldBlockStart, blockLength, newBlockStart, oldArray.length, newArray.length);
			if(oldBlockStart+blockLength < oldArray.length && newBlockStart < + blockLength < newArray.length) {
				newArray.set(oldArray.subarray(oldBlockStart, oldBlockStart+blockLength), newBlockStart);
			}
		}
		c.log("Line copy.");
	} else { //There are no optimizations we can apply. Since an individual pixel's data either isn't contiguous or isn't consistent between source and destination, it can't be directly copied. Since we can't copy pixels, we can't copy blocks but must copy each and every channel over manually.
		if(options.optimization && options.optimization !== "none") throw new Error("Block-level or line-level layer copy operation specified, but only channel-level copy possible.");
		var copyChans = function(to, from) {newArray[newBlockStart+to] = oldArray[oldBlockStart+from];};
		for(line = 0; line < height; line++) {
			oldBlockStart = (
				(oldOffsetY + oldBaseY + line) * oldLayer.width +
				oldOffsetX + oldBaseX) *
				oldLayer.channels;
			newBlockStart = (
				(newOffsetY + newBaseY + line) * newLayer.width +
				newOffsetX + newBaseX) *
				newLayer.channels;
			for(column = 0; column < width; column++, oldBlockStart+=oldChans, newBlockStart+=newChans) {
				channels.forEach(copyChans);
			}
		}
		c.log("Channel copy.");
	}
};

lData.renderLayerData = function(imageTree, boundingBox, output) { //Takes an imageTree and a standard bounding box. Returns a new layer with a buffer formatted for drawing to <canvas>. If output (a layer) is given, then the results will be rendered appropriately to it instead.
	boundingBox = cUtils.duplicateBoundingBox(boundingBox);
	boundingBox.x += runOffset.x; //Set in Pixel Store's onMessage.
	boundingBox.y += runOffset.y;
	boundingBox.channels = 4;
	var boundingBox_ = boundingBox; //It would seem the use of boundingBox in duplicateBoundingBox implicitily declares a new boundingBox at the top of the function, overriding the variable we wish to duplicate. As a workaround, we take another reference to it.
	
	var layerPaths = cUtils.listLayerPaths(imageTree).reverse(); //A higher layer number means it'll be rendered first. listLayerPaths returns [0,1,2,…], but we want to consider the last layer first, ie, start → […,2,1,0] → result.
	
	var trace = layerPaths.map(function(layerPath) {
		var boundingBox = cUtils.duplicateBoundingBox(boundingBox_); //We'll be changing the contents, here, so we should make a copy. The bounding box might be important.
		var layerOffset = lData.getLayerOffset(imageTree, layerPath);
		var layer = cUtils.getLayer(imageTree, layerPath);
		
		//Sanity-check our layers.
		if(typeof layer.exteriorColour.byteLength !== "number") {throw new Error('layerExteriorColour does not have a byteLength. layerExteriorColour must be a Uint8ClampedArray for speed purposes.');}
		if(layer.exteriorColour.byteLength < boundingBox_.channels) {throw new Error('layerExteriorColour has a bytelength of '+layer.exteriorColour.byteLength+'. However, we are rendering to '+boundingBox_.channels+' channels. While this will still work, it will work about 20x slower and it will do so silently. (This meant that one missing comma in Pixel Store would produce a slowdown in a very complex function in Layer Manipulation, without any hint as to why.)');}
		
		var positionOffset = {x:layerOffset.x-layer.x, y:layerOffset.y-layer.y};
		boundingBox.x -= positionOffset.x + layer.x;
		boundingBox.y -= positionOffset.y + layer.y;
		var normalizedQueryBox = {x:-layer.x+boundingBox.x, y:-layer.y+boundingBox.y}; //This is the actual x/y offset, which we can use with width/height, to find the location of a pixel at screen x/y.
		normalizedQueryBox = cUtils.getBoundingBox({
			x:[normalizedQueryBox.x, normalizedQueryBox.x+boundingBox.width -1],
			y:[normalizedQueryBox.y, normalizedQueryBox.y+boundingBox.height-1],
		});
		//c.log(layer, boundingBox, normalizedQueryBox);
		
		var properties = Object.create(null); //Create *empty* map. Put all referenced keys in this map.
		properties.layerWidth = layer.width;
		properties.layerHeight = layer.height;
		properties.layerChannels = layer.channels;
		properties.layerExteriorColour = layer.exteriorColour;
		properties.array = new Uint8ClampedArray(layer.buffer);
		properties.boxX = normalizedQueryBox.x;
		properties.boxY = normalizedQueryBox.y;
		return properties;
	});
		
	//I am unsure of how well the following depth-first trace will perform,
	//when the total size of every layer that needs to be checked exceeds various
	//caches, since we'll have to hit every layer all the time. The alternative
	//would be to add each layer under the results in a breadth-first search, but
	//then we'd have to check the alpha of each pixel of the result each time we
	//added another layer. It might be that the two processes are equivalent under
	//the hood -- but, without tests, who knows?
	
	//c.log('tracing', trace);
	//c.log(boundingBox);
	
	var renderedLayer = newLayerCanvas(boundingBox);
	var flattenedImage = new Uint8ClampedArray(renderedLayer.buffer);
	//cUtils.setAll({data:flattenedImage, 0:128, 1:128, 3:255});
	
	var chans = renderedLayer.channels;
	var pixel = new Uint8ClampedArray(chans), initialAlpha;
	var existingPixelX, existingPixelY, existingPixelStart, existingPixelSource;
	var x, y, z, currentTraceDepth, traceAtDepth;
	
	var renderedLayerWidth = renderedLayer.width;
	var renderedLayerHeight = renderedLayer.height;
	var renderedLayerChannels = renderedLayer.channels;
	var traceLength = trace.length;
	
	for (x=0; x < renderedLayerWidth; x++) {
		for (y=0; y < renderedLayerHeight; y++) {
			for(z=0; z < chans; z++) {pixel[z] = 0;}
			
			//300ms here. v
			currentTraceDepth = 0;
			while (currentTraceDepth < traceLength && pixel[3] < 242) { //Quit early if we already have a fully opaque pixel. Or close enough to a fully opaque one, since I doubt the floating-point math will work out quite right. The result will be rounded to the nearest whole number when it's inserted into the returned buffer, so we'll achieve full saturation of the channel, 255 for anything greater than 254.5. … Also … mercy, does this mean that that test is done every time we assign a value to an element in Editabled? //Switched to using Uint8Clamped array for pixel accumulator, less accurate but -1/5 second runtime.
				traceAtDepth = trace[currentTraceDepth]; //Saves ~20ms.
				existingPixelX = traceAtDepth.boxX + x;
				existingPixelY = traceAtDepth.boxY + y;
				if(existingPixelX >= 0 && existingPixelX < traceAtDepth.layerWidth && existingPixelY >= 0 && existingPixelY < traceAtDepth.layerHeight) { // existingPixelY <= traceAtDepth.layerHeight makes the thing run 2x slower, same with x version.
					existingPixelStart = (existingPixelX + traceAtDepth.layerWidth * existingPixelY) * traceAtDepth.layerChannels;
					existingPixelSource = traceAtDepth.array;
				} else { //Out of bounds.
					existingPixelStart = 0;
					existingPixelSource = traceAtDepth.layerExteriorColour;
				}
				
				initialAlpha = pixel[3]/255;
				for(z=0; z < chans; z++) { //Pixel colour accumulator.
					pixel[z] = pixel[z]*initialAlpha + existingPixelSource[existingPixelStart+z]*(1-initialAlpha);
				}
				
				++currentTraceDepth;
			}
			
			//100ms here. v
			for(z=0; z < chans; z++) { //No check is needed here for finite, because -- since it's being taken from a Uint8ClampedArray -- no non-finite values will find their way here.
				flattenedImage[(x+renderedLayerWidth*y)*renderedLayerChannels+z] = pixel[z];
			}
		}
	}
	
	//c.log(renderedLayer);
	return renderedLayer;
};