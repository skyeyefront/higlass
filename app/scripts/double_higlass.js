import slugid from 'slugid';
import '../styles/higlass.css';

import d3 from 'd3';
import PIXI from 'pixi.js';
import {heatedObjectMap} from './colormaps.js'

export {TransferFunctionEditor} from './transfer.js';
export {heatedObjectMap} from './colormaps.js';



export function DoubleMassiveMatrixPlot() {
    var width = 550;
    var height = 400;
    var margin = {'top': 50, 'left': 30, 'bottom': 30, 'right': 120};
    let nTicks = 4;
    let zoomDispatch = null;
    let locationDispatch = null;
    let zoomCallback = null;
    let transferEditor = null;
    let xDomain = null, yDomain =  null;
    let drawRectZoom = 1;
    let rectData;
    let showDebug = 0;
    let chromInfo = null;

    var sparseData;

    function chart(selection) {
        selection.each(function([tileDirectory1, tileDirectory2]) {
            let resolution = 256;
            let minX = 0, maxX = 0, minY = 0, maxY = 0;
            let totalHeight = null, totalWidth = null;
            let maxZoom = 1;
            let yAxis = null, xAxis = null;
            let mirrorTiles = true;

            let xOrigScale = null, yOrigScale = null;
            let xScale = null, yScale = null, valueScale = null;
            let widthScale = null;

            let loadedTiles = {};
            let loadingTiles = {};

            let tileStatus = [];

            let renderer = null;
            let pMain = null;
            let tileGraphics = {};       // the pixi graphics objects which will contain the tiles

            let minArea = 0;
            let maxArea = 0;
            let xScaleDomain = null, yScaleDomain = null;

            let minValue = 0, maxValue = 0;
            let transferFunction = (count) => count > 0 ? Math.log2(1 + Math.log2(1 + count)) : 0;
            let maxTransfer = 1;
            let minVisibleValue = 0, maxVisibleValue = 1;

            let labelSort = (a,b) => { return b.area - a.area; };
            let gMain = null;
            let gDataPoints = null;
            let shownTiles = new Set();
            let pointMarkId = (d) => { return `p-${d.uid}`; };
            let slugId = slugid.nice();

            var pixiCanvas = d3.select(this).append('canvas')
                .attr('width', 0)
                .attr('height', 0)
                .style('left', `${margin.left}px`)
                .style('top', `${margin.top}px`)
                .style('position', 'absolute')

                renderer = PIXI.autoDetectRenderer(width - margin.right - margin.left, height - margin.top - margin.bottom, 
                        { 
                            //backgroundColor: 0xdddddd,
                            backgroundColor: 0xffffff,
                         antialias: true, 
                         view: pixiCanvas.node() 
                        });

            // setup the data-agnostic parts of the chart
            var svg = d3.select(this)
                .append('svg')
                .classed("mainSVG", true)
                .attr('width', width)
                .attr('height', height)
                .style('left', 0)
                .style('top', 0)
                .style('position', 'absolute');
       

            var gEnter = svg.append("g")
                .attr('transform', `translate(${margin.left}, ${margin.top})`)
                .on("mousemove", function(){
                    var coordinates = [0, 0];
                    coordinates = d3.mouse(this);
                    var x = coordinates[0];
                    var y = coordinates[1];
                })
                .classed('g-enter', true);

            var stage = new PIXI.Container();
            pMain = new PIXI.Graphics();
            stage.addChild(pMain);

            animate()

            function animate() {
                renderer.render(stage)
                requestAnimationFrame(animate);
            }

            let zoom = d3.behavior.zoom()
                .on("zoom", zoomHere)
                .on('zoomend', zoomEnd);

            gEnter.insert("rect", "g")
                .attr("class", "pane")
                .attr("width", width - margin.left - margin.right)
                .attr("height", height - margin.top - margin.bottom)
                .attr('pointer-events', 'all')
                
                gEnter.call(zoom);

            gEnter.on('mousemove', moveHere);

            function moveHere() {
                localLocationDispatch.move([xScale.invert(d3.mouse(this)[0]), yScale.invert(d3.mouse(this)[1])]) 
            }

            var gYAxis = gEnter.append("g")
                .attr("class", "y axis")

                .attr("transform", "translate("  + (width - margin.right - margin.left) + ",0)");

            var debug = gEnter.append("svg")
                .attr("width", width - margin.left - margin.right)
                .attr("height", height - margin.top - margin.bottom)
                .attr("id", "debug");
            
          

            var gXAxis = gEnter.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0,"+ (height - margin.bottom - margin.top) + ")");


            gMain = gEnter.append('g')
                .classed('main-g', true)

            gMain.append("clipPath")
                .attr("id", "clipHiC")
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)

                .attr("width", width - margin.left - margin.right)
                .attr("height", height - margin.top - margin.bottom);


            let localLocationDispatch = locationDispatch == null ? d3.dispatch('move') : locationDispatch;
            let localZoomDispatch = zoomDispatch == null ? d3.dispatch('zoom', 'zoomend') : zoomDispatch;

            localZoomDispatch.on('zoom.' + slugId, zoomChanged);
            localZoomDispatch.on('zoomend.' + slugId, zoomEnded);

            d3.selectAll("#mode input[name=debug]").on("change", function() {
                document.getElementById("debug").innerHTML = "";
                document.getElementById("debug1D").innerHTML = "";
                if(this.value == "debug") {
                    showDebug = 1;
                    loadedTiles = {};
                    loadingTiles = {};
                    draw();
                } else {
                    showDebug = 0;
                }
            });

            function zoomHere() {
                localZoomDispatch.zoom(zoom.translate(), zoom.scale());
            }

            function  zoomEnd() {
                localZoomDispatch.zoomend();
            }

            function zoomChanged(translate, scale) {
                // something changed the zoom.
                zoom.translate(translate);
                zoom.scale(scale);

                zoomed();
            }

            function zoomEnded() {
                calculateNewTiles();
            }


            function isTileLoading(tile) {//1.1.1
                // check if a particular tile is currently being loaded

                if (((tileId(tile) +".1") in loadingTiles) || (tileId(tile) + ".2") in loadingTiles)
                    return true;
                else
                    return false;
            }


            function isTileLoaded(tile) {
                // check if a particular tile is already loaded
                // go through the shownTiles dictionary to check
                // if this tile is already loaded

                if (tileId(tile) in loadedTiles) {
                    if ('path1' in loadedTiles[tileId(tile)] && 'path2' in loadedTiles[tileId(tile)])
                        return true;
                }
                return false;
            }

            $("svg.mainSVG").mousemove(function(e) {
                return; //turn off tooltips for difference displays 

                //genter mousemov
               $("#tooltip").empty();
                $('#tooltip').hide();

               var parentOffset = $(this).parent().offset();
               let maxW, maxH;
               maxW = $("canvas").width();
               maxH = $("canvas").height();
              
                
               if((e.pageX - parentOffset.left - margin.left) > 0 && (e.pageX - parentOffset.left - margin.left) <= maxW 
                    && (e.pageY - parentOffset.top - margin.top) > 0 && (e.pageY - parentOffset.top - margin.top) <= maxH){
                    $('#tooltip').show();
                    let length, tileX, tileY, xIndex, yIndex;
                    let index, value;

                    let xpos = Math.floor(xScale.invert(e.pageX - parentOffset.left - margin.left)/1000)*1000;
                    let ypos = Math.floor(yScale.invert(e.pageY - parentOffset.top - margin.top)/1000)*1000;
                   
                    for(let tileId in shownTiles) {

                   //tile's length in bp
                    length = totalWidth/Math.pow(2, loadedTiles[tileId].pos[0]);

                    //tile's starting point
                    tileX = length*loadedTiles[tileId].pos[1];
                    tileY = length*loadedTiles[tileId].pos[2];

                    if(xpos >= tileX && xpos < (tileX+length) && ypos >= tileY && ypos < (tileY+length)){
                        $("#tooltip").css('top', (e.pageY+10)+'px');
                        $("#tooltip").css('left', (e.pageX+10)+'px');
                        if(showDebug == 1) {
                            // it belongs to this tile
                            
                            $("#tooltip").append("<span >The tile's id is " + tileId + " </span><br/>");
                        }
                        
                       
                       // if(loadedTiles[tileId].pos[0] == 5) {

                            xIndex = (xpos-tileX)/length * 256;
                            yIndex = (ypos-tileY)/length * 256;
                            if(xpos > ypos){
                                index = Math.floor(xIndex)*256 + Math.floor(yIndex);
                            } else {
                                index = Math.floor(yIndex)*256 + Math.floor(xIndex);
                            }
                            
                            
                            value = loadedTiles[tileId].data[index];
                            if(value != null) {
                                $("#tooltip").append("<span>The value at (" + xpos + ", " + ypos + ") is " + value + ".</span>");
                            } 
                      //  }
                        break;
                        
                    }
                    if(xpos >= tileY && xpos < (tileY+length) && ypos >= tileX && ypos < (tileX+length)){
                       

                        $("#tooltip").css('top', (e.pageY+10)+'px');
                        $("#tooltip").css('left', (e.pageX+10)+'px');
                        if(showDebug == 1) {
                            // it belongs to this tile
                            $("#tooltip").append("<span >The tile is mirror of the tile " + tileId + " </span><br/>");
                        }
                        
                       
                       // if(loadedTiles[tileId].pos[0] == 5) {
                            yIndex = (xpos-tileY)/length * 256;
                            xIndex = (ypos-tileX)/length * 256;

                            
                            index = Math.floor(yIndex)*256 + Math.floor(xIndex);
                            value = loadedTiles[tileId].data[index];
                            if(value != null) {
                                $("#tooltip").append("<span>The value at (" + xpos + ", " + ypos + ") is " + value + ".</span>");
                            } 
                       // } 
                        break;
                        
                    } 

               }
            
               
               }
             
            });

            $("svg.mainSVG").mouseleave(function(e) {
                $('#tooltip').empty();
                $('#tooltip').hide();
            });

            function setPix(tile, pix, data1, data2) {
                var maxTransfer = transferFunction(maxValue);
                //valueScale.domain([countTransform(minVisibleValue), countTransform(maxVisibleValue)])
                valueScale.domain([-1,1]);

                let t1 = new Date().getTime();

                let rgbIdx = 0, ct=0;

                    try {
                        let t1 = new Date().getTime();
                        for (let i = 0; i < data1.length; i++) {

                            if (tile[1] == tile[2] && i / resolution < i % resolution) {
                                // this is the unused triangle of a triangular matrix
                                pix.data[i*4+3] = 0;
                                continue;
                            }

                            let d = Math.log((data1[i] + 1.) / (data2[i] + 1.));
                            ct = d; //countTransform(d);

                            rgbIdx = Math.max(0, Math.min(255, Math.floor(valueScale(ct))))

                            let rgb = heatedObjectMap[rgbIdx];


                            pix.data[i*4] = rgb[0];
                            pix.data[i*4+1] = rgb[1];
                            pix.data[i*4+2] = rgb[2];
                            pix.data[i*4+3] = rgb[3];
                        };
                    } catch (err) {

                        console.log('ct:', ct, 'rgbIdx:', rgbIdx);
                        console.log('ERROR:', err);

                    }

                return pix;
            }


            function tileDataToCanvas(tile, data1, data2, zoomLevel) {
                let canvas = document.createElement('canvas');

                canvas.width = 256;
                canvas.height = 256;

                let ctx = canvas.getContext('2d');

                ctx.fillStyle = 'transparent';
                ctx.fillRect(0,0,canvas.width, canvas.height);

                let pix = ctx.createImageData(canvas.width, canvas.height);
                pix = setPix(tile, pix, data1, data2);
                ctx.putImageData(pix, 0,0);

                return canvas;
            }

            function setSpriteProperties(sprite, tile) {
                let zoomLevel = tile[0], xTilePos = tile[1], yTilePos = tile[2];

                let tileWidth = totalWidth / Math.pow(2, zoomLevel);
                let tileHeight = totalHeight / Math.pow(2, zoomLevel);

                let tileX = minX + xTilePos * tileWidth;
                let tileY = minY + yTilePos * tileHeight;

                let tileEndX = minX + (xTilePos+1) * tileWidth;
                let tileEndY = minY + (yTilePos+1) * tileHeight;

                let spriteWidth = xOrigScale(tileEndX) - xOrigScale(tileX) ;
                let spriteHeight = yOrigScale(tileEndY) - yOrigScale(tileY)

                sprite.width = xOrigScale(tileEndX) - xOrigScale(tileX)
                sprite.height = yOrigScale(tileEndY) - yOrigScale(tileY)

                if (tile.mirrored) {
                    // this is a mirrored tile that represents the other half of a 
                    // triangular matrix
                    sprite.x = xOrigScale(tileY);
                    sprite.y = yOrigScale(tileX);

                    sprite.pivot = [xOrigScale.range()[1] / 2, yOrigScale.range()[1] / 2];
                    sprite.rotation = -Math.PI / 2;
                    sprite.scale.x *= -1;

                    sprite.width = spriteHeight;
                    sprite.height = spriteWidth;
                } else {
                    sprite.x = xOrigScale(tileX);
                    sprite.y = yOrigScale(tileY);
                }
            }

            function getClippingPath(tile) {
                let g = new PIXI.Graphics();

                let zoomLevel = tile[0], xTilePos = tile[1], yTilePos = tile[2];

                let tileWidth = totalWidth / Math.pow(2, zoomLevel);
                let tileHeight = totalHeight / Math.pow(2, zoomLevel);

                let tileX = minX + xTilePos * tileWidth;
                let tileY = minY + yTilePos * tileHeight;

                let tileEndX = minX + (xTilePos+1) * tileWidth;
                let tileEndY = minY + (yTilePos+1) * tileHeight;

                g.beginFill();
                
                if (tile[1] == tile[2]) {
                    g.drawPolygon([0, 0,
                                   0, tileHeight,
                                   tileWidth, tileHeight]);
                } else {
                    g.drawPolygon([0, 0,
                                   0, tileHeight,
                                   tileWidth, tileHeight,
                                    tileWidth, 0]);

                }
                g.endFill();

                return g;
            }

            function changeTextures() {
                // go through each tile shown tile and change its texture
                // this is normally called when the value of the color scale changes
                // it's a little slow at the moment so it's unused

                for (let tileId in loadedTiles) {
                    loadedTiles[tileId].canvasChanged = true;
                }

                for (let tileId in shownTiles) {
                    let sprite = tileGraphics[tileId].children[0];
                    let canvas = getCanvas(tileId);
                    let tile = loadedTiles[tileId];

                    let texture = null;
                    if (tile.pos[0] == maxZoom)
                        texture = PIXI.Texture.fromCanvas(canvas, PIXI.SCALE_MODES.NEAREST);
                    else
                        texture = PIXI.Texture.fromCanvas(canvas);

                    sprite.texture = texture;
                    
                    setSpriteProperties(sprite, loadedTiles[tileId].pos);
                };

            }

            function getCanvas(tileId) {
                let tile = loadedTiles[tileId]
                if (tile.canvasChanged) {
                    tile.canvas = tileDataToCanvas(tile.data, tile.pos[0]);
                }

                tile.canvasChanged = false;
                return tile.canvas;
            }

            function showTiles(tiles) {
                // refresh the display and make sure the tiles that need to be
                // displayed are displayed

                // check to make sure all the tiles we're trying to display
                // are already loaded
                let allLoaded = true;
                let allData = [];

                shownTiles = {};

                tiles.forEach((t) => {
                    allLoaded = allLoaded && isTileLoaded(t);
                });
                if (!allLoaded)
                    return;

                // don't process tiles that are outside of the viewport (i.e. from previous zooming)
                let visibleTiles = tiles.map((d) => { return loadedTiles[tileId(d)]; })
                    .filter((d) => { return d != undefined; })
                    .filter((d) => { return d.data != undefined; })
                    .filter((d) => { return d.data.length > 0; });

                let prevMinVisibleValue = minVisibleValue;
                let prevMaxVisibleValue = maxVisibleValue;

                minVisibleValue = Math.min( ...visibleTiles.map((x) => x.valueRange[0]));
                maxVisibleValue = Math.max( ...visibleTiles.map((x) => x.valueRange[1]));

                for (let i = 0; i < tiles.length; i++) {
                    shownTiles[tileId(tiles[i])] = true;

                    if (prevMinVisibleValue != minVisibleValue || prevMaxVisibleValue != maxVisibleValue) {
                        // we need to rescale our data which means redrawing it...
                        // and redrawing it means removing the graphics we have for it
                        let tileIdStr = tileId(tiles[i]);
                        if (tileIdStr in tileGraphics) {
                            pMain.removeChild(tileGraphics[tileIdStr]);
                            delete tileGraphics[tileIdStr];
                        }
                    }

                    // check if we already have graphics for these tiles
                    if (!(tileId(tiles[i]) in tileGraphics)) {
                        // tile isn't loaded into a pixi graphics container
                        // load that sucker
                        let newGraphics = new PIXI.Graphics();

                        let canvas = tileDataToCanvas(tiles[i], loadedTiles[tileId(tiles[i])].path1.data, loadedTiles[tileId(tiles[i])].path2.data);
                        //let canvas = getCanvas(tileId(tiles[i])); //loadedTiles[tileId(tiles[i])].canvas; //tileDataToCanvas(loadedTiles[tileId(tiles[i])].data, tiles[i][0]);
                        let sprite = null;

                        if (tiles[i][0] == maxZoom) {

                            sprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(canvas, PIXI.SCALE_MODES.NEAREST));
                        } else {
                            sprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(canvas));
                        }
                        //let sprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(canvas));

                        setSpriteProperties(sprite, tiles[i]);
                         /*  newGraphics.lineStyle(2, 0x0000FF, 1);
                                newGraphics.moveTo(sprite.x, sprite.y);
                                newGraphics.lineTo(sprite.x+sprite.width, sprite.y);
                                newGraphics.lineTo(sprite.x+sprite.width, sprite.y+sprite.height);
                                newGraphics.lineTo(sprite.x, sprite.y+sprite.height);
                                newGraphics.lineTo(sprite.x, sprite.y);*/
                        
                        let maskGraphics = getClippingPath(tiles[i]);
                        setSpriteProperties(maskGraphics, tiles[i]);

                        newGraphics.addChild(sprite);
                        //newGraphics.addChild(maskGraphics);
                        //newGraphics.mask = maskGraphics;
                        tileGraphics[tileId(tiles[i])] = newGraphics;

                        pMain.addChild(newGraphics);
                    } else {
                        //let canvas = //tileDataToCanvas(loadedTiles[tileId(tiles[i])].data, tiles[i][0]);
                        //console.log('tile:', tileId(tiles[i]), loadedTiles[tileId(tiles[i])]);
                    }
                }

                for (let tileIdStr in tileGraphics) {
                    if (!(tileIdStr in shownTiles)) {
                        pMain.removeChild(tileGraphics[tileIdStr]);
                        delete tileGraphics[tileIdStr];
                    }
                }


                if (prevMinVisibleValue != minVisibleValue || prevMaxVisibleValue != maxVisibleValue) {
                    //changeTextures();
                }

                let gTiles = gMain.selectAll('.tile-g')
                    .data(tiles, tileId)

                    let gTilesEnter = gTiles.enter()
                    let gTilesExit = gTiles.exit()

                gTilesEnter.append('g')
                    .attr('id', (d) => 'i-' + tileId(d))
                    .classed('tile-g', true)
                    .each(function(tile) {
                        let gTile = d3.select(this);

                        if (loadedTiles[tileId(tile)] === undefined)
                        return;

                    });

                gTilesExit.remove();

                // only redraw if the tiles have changed
                
                if (gTilesEnter.size() > 0 || gTilesExit.size() > 0)
                    draw();
            }

            function removeTile(tile) {
                // remove all of the elements associated with this tile
                //
            }

            function loadTileData(tile_value) {
                let t1 = new Date().getTime();
                if ('dense' in tile_value)
                    return tile_value['dense'];
                else if ('sparse' in tile_value) {
                    let values = Array.apply(null, 
                            Array(resolution * resolution)).map(Number.prototype.valueOf, 0);

                    for (let i = 0; i < tile_value.sparse.length; i++) {

                        if ('pos' in tile_value.sparse[i]) {
                            values[tile_value.sparse[i].pos[1] * resolution +
                                   tile_value.sparse[i].pos[0]] = tile_value.sparse[i].value;
                        } else {
                            let x = tile_value.sparse[i][0];
                            values[tile_value.sparse[i][0][1] * resolution +
                                   tile_value.sparse[i][0][0]] = tile_value.sparse[i][1];

                        }
                    }

                    return values;


                } else {
                    return [];
                }

            }

            function refreshTiles(currentTiles) {
                // be shown and add those that should be shown
                currentTiles.forEach((tile) => {
                    if (!isTileLoaded(tile) && !isTileLoading(tile)) {
                        // if the tile isn't loaded, load it
                        let tileSubPath = tile.join('.')
                        let tilePath1 = tileDirectory1 + "/" + tileSubPath;
                        let tilePath2 = tileDirectory2 + "/" + tileSubPath;

                        loadingTiles[tileId(tile) + ".1"] = true;
                        loadingTiles[tileId(tile) + ".2"] = true;

                        if(showDebug == 1)
                        {

                            if(!tileStatus[tile[0]])
                            {

                                tileStatus[tile[0]] = [];
                            }
                            if(!tileStatus[tile[0]][tile[1]])
                            {
                                tileStatus[tile[0]][tile[1]]= [];


                            }
                            if(!tileStatus[tile[0]][tile[1]][tile[2]])
                            {

                                tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Not Loaded'};
                            }


                            let Loaded;
                            let Time;

                        }

                    loadedTiles[tileId(tile)] = {};
                    d3.json(tilePath2)
                        .on("progress", function() {
                              if(showDebug == 1)
                              { 
                                tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loading'};
                              }                           
                            })
                        .on("load",function() {
                            if(showDebug == 1)
                            { 
                                tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loaded'};
                            }
                    })
                    .get(function(error, tile_json) {
                                    if (error != null) {
                                        loadedTiles[tileId(tile)].path2 = {data: loadTileData({'sparse': []})};
                                        //let canvas = tileDataToCanvas([], tile[0]);
                                        //loadedTiles[tileId(tile)].canvas = canvas;
                                        loadedTiles[tileId(tile)].pos = tile;
                                        if(showDebug == 1)
                                        {

                                        tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Error','Message':String(error.statusText)};
                                        
                                   
                                        }

                                    } else {
                                        let tile_value = tile_json._source.tile_value;
                                        let data = loadTileData(tile_value);

                                        loadedTiles[tileId(tile)].path2 = {data: data};
                                        loadedTiles[tileId(tile)].pos = tile;
                                        loadedTiles[tileId(tile)].path2.valueRange = [tile_value.min_value, tile_value.max_value];

                                        if(showDebug == 1)
                                        {
                                            tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loaded'};
                                            draw();                          
                                        }
                                    }

                                    delete loadingTiles[tileId(tile) + ".2"];
                                    showTiles(currentTiles);
                                });

                    d3.json(tilePath1)
                        .on("progress", function() {
                              if(showDebug == 1)
                              { 
                                tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loading'};
                              }                           
                            })
                        .on("load",function() {
                            if(showDebug == 1)
                            { 
                                tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loaded'};
                            }
                    })
                    .get(function(error, tile_json) {
                                    if (error != null) {
                                        loadedTiles[tileId(tile)].path2 = {data: loadTileData({'sparse': []})};
                                        //let canvas = tileDataToCanvas([], tile[0]);
                                        //loadedTiles[tileId(tile)].canvas = canvas;
                                        loadedTiles[tileId(tile)].pos = tile;
                                        if(showDebug == 1)
                                        {

                                        tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Error','Message':String(error.statusText)};
                                        
                                   
                                        }

                                    } else {
                                        let tile_value = tile_json._source.tile_value;
                                        let data = loadTileData(tile_value);

                                        loadedTiles[tileId(tile)].path1 = {data: data};
                                        loadedTiles[tileId(tile)].pos = tile;
                                        loadedTiles[tileId(tile)].path1.valueRange = [tile_value.min_value, tile_value.max_value];

                                        if(showDebug == 1)
                                        {
                                            tileStatus[tile[0]][tile[1]][tile[2]] = {'status':'Loaded'};
                                            draw();                          
                                        }
                                    }

                                    delete loadingTiles[tileId(tile) + ".1"];
                                    showTiles(currentTiles);
                                });

                    } else {
                        showTiles(currentTiles);
                    }
                });
                
            }


            d3.json(tileDirectory1 + '/tileset_info', function(error, tile_info) {
                // set up the data-dependent sections of the chart
             //   console.log('tile_info:', tile_info);
                tile_info = tile_info._source.tile_value;
                console.log('tile_info:', tile_info);

                resolution = tile_info.bins_per_dimension;

                minX = tile_info.min_pos[0];
                maxX = tile_info.max_pos[0] + 0.001;

                minY = tile_info.min_pos[1];
                maxY = tile_info.max_pos[1];

                minValue = tile_info.min_value;
                maxValue = tile_info.max_value;

                if (transferEditor != null) {
                    transferEditor.domain = [0.001, maxValue+1];
                    //transferFunction = tF.binnedMap(10000);

                    transferEditor.onChange(tF => {
                       transferFunction = tF.binnedMap(10000); 
                       changeTextures();
                    });

                }


                maxTransfer = transferFunction(maxValue);

                minArea = tile_info.min_importance;
                maxArea = tile_info.max_importance;

                maxZoom = tile_info.max_zoom;

                if (xDomain == null) {
                    xScaleDomain = [minX, maxX];
                } else {
                    xScaleDomain = xDomain;
                }

                if (yDomain == null) {
                    yScaleDomain = [minY, maxY];
                } else {
                    yScaleDomain = yDomain;
                }

                //totalWidth = maxX - minX;
                //totalHeight = maxY - minY;
                totalHeight = tile_info.max_width;
                totalWidth = tile_info.max_width;

                xScale = d3.scale.linear()
                    .domain(xScaleDomain)
                    .range([0, width - margin.left - margin.right]);

                yScale = d3.scale.linear()
                    .domain(yScaleDomain)
                    .range([0, height - margin.top - margin.bottom]);

                valueScale = d3.scale.linear()
                    .domain([countTransform(minValue+1), countTransform(maxValue+1)])
                    .range([255,0]);

                xOrigScale = xScale.copy();
                yOrigScale = yScale.copy();

                zoom.x(xScale)
                    .y(yScale)
                    .scaleExtent([1,Math.pow(2, maxZoom + 2)]);

                yAxis = d3.svg.axis()
                    .scale(yScale)
                    .orient("right")
                    .tickSize(-(width - margin.left - margin.right))
                    .tickPadding(6)
                    .ticks(nTicks);

                xAxis = d3.svg.axis()
                    .scale(xScale)
                    .orient("bottom")
                    .tickSize(-(height - margin.top - margin.bottom))
                    .tickPadding(6)
                    .ticks(nTicks);

                gYAxis.call(yAxis);
                gXAxis.call(xAxis);

                let newTiles = []

                let newTile = [0,0,0]
                newTile.mirrored = true;
                newTiles.push(newTile);

                newTile = [0,0,0]
                newTile.mirrored = false;
                newTiles.push(newTile);

                //refreshTiles([[0,0,0]]);
                calculateNewTiles();
            });

            function zoomed() {
                var reset_s = 0;

                if ((xScale.domain()[1] - xScale.domain()[0]) >= (maxX - minX)) {
                    zoom.x(xScale.domain([minX, maxX]));
                    reset_s = 1;
                }
                if ((yScale.domain()[1] - yScale.domain()[0]) >= (maxY - minY)) {
                    //zoom.y(yScale.domain([minY, maxY]));
                    zoom.y(yScale.domain([minY, maxY]));
                    reset_s += 1;
                }
                if (reset_s == 2) { // Both axes are full resolution. Reset.
                    zoom.scale(1);
                    zoom.translate([0,0]);
                }
                else {
                    if (xScale.domain()[0] < minX) {
                        xScale.domain([minX, xScale.domain()[1] - xScale.domain()[0] + minX]);

                        zoom.translate([xOrigScale.range()[0] - xOrigScale(xScale.domain()[0]) * zoom.scale(),
                                zoom.translate()[1]])
                    }
                    if (xScale.domain()[1] > maxX) {
                        var xdom0 = xScale.domain()[0] - xScale.domain()[1] + maxX;
                        xScale.domain([xdom0, maxX]);

                        zoom.translate([xOrigScale.range()[0] - xOrigScale(xScale.domain()[0]) * zoom.scale(),
                                zoom.translate()[1]])
                    }
                    if (yScale.domain()[0] < minY) {
                        yScale.domain([minY, yScale.domain()[1] - yScale.domain()[0] + minY]);

                        zoom.translate([zoom.translate()[0], yOrigScale.range()[0] - yOrigScale(yScale.domain()[0]) * zoom.scale()])
                    }
                    if (yScale.domain()[1] > maxY) {
                        var ydom0 = yScale.domain()[0] - yScale.domain()[1] + maxY;
                        yScale.domain([ydom0, maxY]);

                        zoom.translate([zoom.translate()[0], yOrigScale.range()[0] - yOrigScale(yScale.domain()[0]) * zoom.scale()])
                    }
                }

                // control the pixi zooming
                pMain.position.x = zoom.translate()[0];
                pMain.position.y = zoom.translate()[1];
                pMain.scale.x = zoom.scale();
                pMain.scale.y = zoom.scale();

                
                
            
                if (zoomCallback)
                    zoomCallback(xScale, zoom.scale());

                draw();

            }

            function drawRect(tiles) {
                document.getElementById("debug").innerHTML = ''; 
                document.getElementById("debug1D").innerHTML = "";
               // var debug1D = document.getElementById("debug1D");

                var rectData = rectInfo(tiles);
                var rect1DData = [];
                var x = [];

                d3.select("#debug1D").attr("width", width - margin.left - margin.right)
                    .attr("height", height - margin.top - margin.bottom);
                d3.select("#d1D")
                    .attr('transform', 'translate('+margin.left+', '+0+')');

               for(var i=0; i<rectData.length; i++) {
                    if(x.indexOf(rectData[i].x) === -1) {
                        rect1DData.push(rectData[i]);
                        x.push(rectData[i].x);
                    }
                }


                d3.select("#debug1D").selectAll('rect.boxy1d')
                    .data(rect1DData)
                    .enter()
                    .append('rect').classed('boxy1d', true);
            
                d3.select("#debug1D").selectAll('rect.boxy1d')
                    .style('fill-opacity',0.2)
                    .style('fill', function(d) { return "green"})
                    .style("stroke-opacity", 1)
                    .style("stroke", function(d) { return "green"})
                    .attr('x', function(d) { return xScale(d.x)})
                    .attr('y', function(d) {  return 35})
                    .attr('width', function(d) { return d.width})
                    .attr('height', 100)
                    .attr('pointer-events', 'all');

                debug.selectAll('rect.boxy')
                    .data(rectData)
                    .enter()
                    .append('rect').classed('boxy', true); 

                debug.selectAll('text.rectText')
                    .data(rectData)
                    .enter()
                    .append('text')
                    .classed('rectText', true)
                    .text(function(d) { return d.id + " "+ d.message})
                    .attr('x', function(d) { return xScale(d.x)+5})
                    .attr('y', function(d) { return yScale(d.y)+10})
                    .attr('fill', 'black');


                debug.selectAll('rect.boxy')
                    .style('fill-opacity',0.2)
                    .style('fill', function(d) { return d.color})
                    .style("stroke-opacity", 1)
                    .style("stroke", function(d) { return d.color})
                    .attr('x', function(d) { return xScale(d.x)})
                    .attr('y', function(d) {  return yScale(d.y)})
                    .attr('width', function(d) { return d.width})
                    .attr('height', function(d) { return d.height})
                    .append("rect:title")
                    .text(function(d) { return "Tile zoom: " + tiles[0][0] + "\n"  + "Tile id: " +d.id + "\n"  + d.message })
                    .attr('pointer-events', 'all');
            }

            function rectInfo(tiles){

                rectData = [];
                let zoomlevel = tiles[0][0];
                let length = totalWidth/Math.pow(2, zoomlevel);
                let w = length/(maxX-minX)* (width - margin.left - margin.right);
                let h =  length/(maxX-minX)* (height - margin.top - margin.bottom);
                let message;
                let color;

                for (var i = 0; i < tiles.length; i++) {
                    message = "";
                    if(tileStatus[zoomlevel] != null && tileStatus[zoomlevel][tiles[i][1]] != null && tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]] != null) {
                        message += "Status: "+ tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].status;             
                        if(tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].status == "Error") {
                            message += " \n" + tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].Message;
                            color = "red";
                        } else if (tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].status == "Loading") {
                            message += " \nTime Elapsed: " + tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].TimeElapsed + " \nAmount Loaded: " + tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].Loaded;
                            color = "blue";
                        } else if(tileStatus[zoomlevel][tiles[i][1]][tiles[i][2]].status == "Loaded") {
                            color = "green";
                        } else {
                            color = "orange";
                        }
                    }
                    else {
                        message = "not requested";
                        color = "gray";
                    }   
                    
                    if(tiles[i][1] != tiles[i][2]) {
                        
                        rectData.push({
                            y: 0+length*tiles[i][1],
                            x: 0+length*tiles[i][2],
                            width: zoom.scale()* w,
                            height: zoom.scale()*h,
                            id: '('+ tiles[i][0] +', '+tiles[i][1]+', '+tiles[i][2]+') mirror',
                            message: message,
                            color: color
                        });
                    }
                    rectData.push({
                        x: 0+length*tiles[i][1],
                        y: 0+length*tiles[i][2],
                        width: zoom.scale()* w,
                        height: zoom.scale()*h,
                        id: '('+ tiles[i][0] +', '+tiles[i][1]+', '+tiles[i][2]+')',
                        message: message,
                        color: color
                    });
                }

                let uniqueRect = [], uniqueID = [];
                for(var i=0; i<rectData.length; i++) {
                    if(uniqueID.indexOf(rectData[i].id) === -1) {
                        uniqueRect.push(rectData[i]);
                        uniqueID.push(rectData[i].id);
                    }
                }

                return uniqueRect;
            }

            function calculateNewTiles() {
                // this will become the tiling code
                let zoomScale = Math.max((maxX - minX) / (xScale.domain()[1] - xScale.domain()[0]), 1);
                let zoomLevel = Math.round(Math.log(zoomScale) / Math.LN2) + 1;


                //Changed from return since refresh tiles wasnt being called, since no more tiles are loaded
                // zoom level stays at max zoom
                if (zoomLevel > maxZoom){
                   zoomLevel = maxZoom;
                }

                var tileWidth = totalWidth /  Math.pow(2, zoomLevel);
                var tileHeight = totalHeight / Math.pow(2, zoomLevel);

                let epsilon = 0.000001;
                let tiles = [];

                // the visible tile positions are calculated here
                let rows = d3.range(Math.max(0,Math.floor((zoom.x().domain()[0] - minX) / tileWidth)),
                            Math.min(Math.pow(2, zoomLevel), Math.ceil(((zoom.x().domain()[1] - minX) - epsilon) / tileWidth)));

                let cols = d3.range(Math.floor((zoom.y().domain()[0] - minY) / tileHeight),
                        Math.ceil(((zoom.y().domain()[1] - minY) - epsilon) / tileHeight));

                for (let i = 0; i < rows.length; i++) {

                    for (let j = 0; j < cols.length; j++) { 
                        if (mirrorTiles) {
                            if (rows[i] >= cols[j]) {
                                // if we're in the upper triangular part of the matrix, then we need to load
                                // a mirrored tile
                                let newTile = [zoomLevel, cols[j], rows[i]];
                                newTile.mirrored = true;
                                tiles.push(newTile); 
                            } else {
                                // otherwise, load an original tile
                                let newTile = [zoomLevel, rows[i], cols[j]];
                                newTile.mirrored = false;
                                tiles.push(newTile); 

                            }

                            if (rows[i] == cols[j]) {
                                // on the diagonal, load original tiles
                                let newTile = [zoomLevel, rows[i], cols[j]];
                                newTile.mirrored = false;
                                tiles.push(newTile);
                            }

                        } else {
                            let newTile = [zoomLevel, rows[i], cols[j]];
                            newTile.mirrored = false;

                            tiles.push(newTile)
                        }

                    }
                }

                refreshTiles(tiles);
                if(showDebug == 1) {
                    document.getElementById("debug").innerHTML = '';
                    document.getElementById("debug1D").innerHTML = "";
                    drawRect(tiles);
                }

            }


            function draw() {
                // draw the scene, if we're zooming, then we need to check if we
                // need to redraw the tiles, otherwise it's irrelevant
                //

                gYAxis.call(yAxis);
                gXAxis.call(xAxis);


            }


        });

    }
    //endchart

   

    function countTransform(count) {
        return Math.sqrt(Math.sqrt(count + 1));
    }

    function tileId(tile) {
        // uniquely identify the tile with a string
        return tile.join(".") + '.' + tile.mirrored;
    }

    function pointId(d) {
        return d.uid;
    }

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    chart.minX = function(_) {
        if (!arguments.length) return minX;
        minX = _;
        return chart;
    };

    chart.minY = function(_) {
        if (!arguments.length) return minY;
        minY = _;
        return chart;
    };

    chart.maxX = function(_) {
        if (!arguments.length) return maxX;
        maxX = _;
        return chart;
    };

    chart.maxY = function(_) {
        if (!arguments.length) return maxY;
        maxY = _;
        return chart;
    };

    chart.maxZoom = function(_) {
        if (!arguments.length) return maxZoom;
        maxZoom = _;
        return chart;
    };

    chart.zoomTo = function(_) {
        // 
        return zoomTo;
    };

    chart.xScale = function(_) {
        return xScale;
    };

    chart.zoomLevel = function(_) {
        return zoom.scale();
    };

    chart.zoomCallback = function(_) {
        if (!arguments.length) return zoomCallback;
        else zoomCallback = _;
        return chart;
    }

    chart.nTicks = function(_) {
        if (!arguments.length) return nTicks;
        else nTicks = _;
        return chart;
    }

    chart.zoomDispatch = function(_) {
        if (!arguments.length) return zoomDispatch;
        else zoomDispatch = _;
        return chart;
    }

    chart.locationDispatch = function(_) {
        if (!arguments.length) return locationDispatch;
        else locationDispatch = _;
        return chart;
    }

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        else margin = _;
        return chart;
    }

    chart.transferEditor = function(_) {
        if (!arguments.length) return transferEditor;
        else transferEditor = _;
        return chart;
    }

    chart.xDomain = function(_) {
        if (!arguments.length) return xDomain;
        else xDomain = _;
        return chart;
    }

    chart.yDomain = function(_) {
        if (!arguments.length) return yDomain;
        else yDomain = _;
        return chart;
    }

    chart.chromInfo = function(_) {
        if (!arguments.length) return chromInfo;
        else chromInfo = _;
        return chart;
    }

    return chart;

}

