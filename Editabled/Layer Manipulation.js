/* jshint worker: true, globalstrict: true, smarttabs: true, strict: false */
/* global console, _, self, miscellaneousUtilities, cUtils, ArrayBuffer, DataView, Uint8Array, imageTree, c, cUtils, Uint8ClampedArray*/
"use strict";
var lData = {};

//These are impure functions for Pixel Store layer manipulation.

lData.sizeLayer = function(layer, box) { //Resizes the layer so that the bounding box would fit in to it.
	var x1Exp = Math.min(0, box.x1 - layer.x1); //x1Exp = Left side expansion required to make box fit in layer. Will be a negative number, since it only needs to go left-er.
	var y1Exp = Math.min(0, box.y1 - layer.y1);
	var x2Exp = -Math.min(0, layer.x2 - box.x2);
	var y2Exp = -Math.min(0, layer.y2 - box.y2);
	//c.log('recommended expansion xyxy: ', !!x1Exp||!!y1Exp||!!x2Exp||!!y2Exp);
	if(x1Exp||y1Exp||x2Exp||y2Exp) {
		//c.log('layer 1.1', layer);
		var resizedLayer = cUtils.duplicateBoundingBox(layer);
		_.defaults(resizedLayer, layer);
		if(x1Exp) resizedLayer.x1 = cUtils.aCeil(resizedLayer.x1 + x1Exp - 1);
		if(y1Exp) resizedLayer.y1 = cUtils.aCeil(resizedLayer.y1 + y1Exp - 1);
		if(x2Exp) resizedLayer.x2 = cUtils.aCeil(resizedLayer.x2 + x2Exp + 1) - 1; //OK, this is I think needed because 0 overlaps in the aCeil math when we expand negatively. Since we expand in 512-pixel incrementns, we should ensure that we do not exceed by one and make a 516-pixel wide image, because I think that'd do bad things to some optimization somewhere. Waste of space, and all. At any rate, the -1 makes the math correct here (I measured) for round numbers of pixels. :) This is pure 'gut feeling', unfortunantly, since I don't know a way to directly profile this.
		if(y2Exp) resizedLayer.y2 = cUtils.aCeil(resizedLayer.y2 + y2Exp + 1) - 1; //The if statements keep the -1s from being applied if there is no change, if the layer has been initialized juuuust wrong, ie, equal to cUtils.aCeil(resizedLayer.y2 + y2Exp).
		resizedLayer.buffer = cUtils.newBuffer(resizedLayer.width, resizedLayer.height, resizedLayer.channels);
		lData.moveLayerData(layer, resizedLayer, {area: layer, optimization:'line'});
		//c.log('layer 2.1', resizedLayer);
		//c.log('layer 1.2', layer);
		_.extend(layer, resizedLayer);
		//c.log('layer 1.3', layer);
	}
};

lData.moveLayerData = function(oldLayer, newLayer, options) { //Copies the layer image data from the oldLayer to the newLayer in a reasonably efficient manner.
	/*  oldLayer: The old layer of data to copy from. (type "layerCanvas")
	    newLayer: The new layer of data to copy to. (May actually be the
	      same as oldLayer.)
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
	
	var oldOffsetX = -oldLayer.x,                                         newOffsetX = -newLayer.x;
	var oldOffsetY = -oldLayer.y,                                         newOffsetY = -newLayer.y;
	var oldArray = new Uint8ClampedArray(oldLayer.buffer),                newArray = new Uint8ClampedArray(newLayer.buffer);
	
	//TODO: Clip the copy rectangle so that it fits inside the read and write layers.
	
	var oldBlockStart, newBlockStart, blockLength, line, column, channel;
	//TODO: OldBaseX doesn't need to === 0. Remove once a test case is available.
	if(oldBaseX===0 && newBaseX===0 && width===oldLayer.width && width===newLayer.width && oldLayer.channels===newLayer.channels && _.isEqual(channels, defaultChannels) ) { //We want to copy full lines into full lines. This means we don't have to skip spaces (columns), but can copy the entire contiguous section in one go.
		//TODO: oldBlockStart & oldBlockStart are UNVERIFIED correct for non-0 values.
		oldBlockStart = (oldOffsetX+(oldBaseY+oldOffsetY)*width)*oldLayer.channels;
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
			newArray.set(oldArray.subarray(oldBlockStart, oldBlockStart+blockLength), newBlockStart);
		}
		c.log("Line copy.");
	} else { //There are no optimizations we can apply. Since an individual pixel's data either isn't contiguous or isn't consistent between source and destination, it can't be directly copied. Since we can't copy pixels, we can't copy blocks but must copy each and every channel over manually.
		if(options.optimization && options.optimization !== "none") throw new Error("Block-level or line-level layer copy operation specified, but only channel-level copy possible.");
		var copyChans = function(to, from) {newArray[newBlockStart+to] = oldArray[oldBlockStart+from];};
		for(line = 0; line < height; line++) {
			oldBlockStart = (
				(oldOffsetY + oldBaseY + line) * oldLayer.width + //Y offset, including line.
				oldOffsetX + oldBaseX) *                          //X offset
				oldLayer.channels;                                //Size of a pixel, in Uint8s.
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