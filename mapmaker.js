var numPoints = 10000;
var diagram, polygons, svg, cells, width, height, coastline;
var color = d3.scaleSequential(d3.interpolateSpectral);

function generateGrid() {
  d3.select('.cells').remove();
  d3.select('.coast').remove();
  svg = d3.select('svg').on('mousemove', (e) => moved(e));
  cells = svg.append('g').classed('cells', true);
  coast = svg.append('g').classed('coast', true);
  width = +svg.attr('width');
  height = +svg.attr('height');
  var points = d3.range(numPoints).map(() => [Math.random() * width, Math.random() * height]);
  // creating a voronoi layout and specifying the extent
  var voronoi = d3.voronoi().extent([[0, 0],[width, height]]);
  // relaxing the points
  points = voronoi(points).polygons().map(d3.polygonCentroid);
  // computing the voronoi diagram based on the random generated points, returns an array of edges and cells
  diagram = voronoi(points);
  // generating a polygon for each cell in the diagram, each polygon is given by an array of points
  polygons = diagram.polygons();
  findNeighbors(); 
}

function findNeighbors(){
  polygons.map(function(p,i){
    p.alt = 0; //set its altitude to 0
    var neighbors = [];
    diagram.cells[i].halfedges.forEach(function(e) { // get the edges of the cell at index i of the polygon
      var diaEdge = diagram.edges[e]; // get the edge in the diagram corresponding to the halfedge of the cell
      var neighborIndex;
      if(diaEdge.left && diaEdge.right){ // if there is a site on the left and right of the edge
        neighborIndex = diaEdge.left.index; // set the neighbor to be the left site
        if (neighborIndex == i){ neighborIndex = diaEdge.right.index;} // if neighborIndex is current index set neighbor to the right site
        neighbors.push(neighborIndex); // add the index to the list of neighbors
      }
    })
    p.neighbors = neighbors;
  })
}

function findCoast(){
  coastLine = [];
  polygons.map(function(p,i){
    if(p.alt > 0.2){ // if the polygon is land
      p.type = 'land'; // set the type to land
      diagram.cells[i].halfedges.forEach(function(e){
        var diaEdge = diagram.edges[e];
        if(diaEdge.left && diaEdge.right){
          var possibleCoast = diaEdge.left.index; // this is index that may be coastline, this happens when left or right of land water
          if(possibleCoast == i){possibleCoast = diaEdge.right.index;}
          if(polygons[possibleCoast].alt <= 0.2){ // the cell is in fact water
            coastLine.push({start: diaEdge[0], end: diaEdge[1]}); // add a new object that contains the start and end point for a coastline
          }
        }
      })
    }
    else{p.type = 'lake';} // assume all non land cells are lakes, easier to set oceans by starting in a known ocean and flood filling
  });
}

function addLandmass(x,y,type) {
    var startPoly = diagram.find(x, y).index;// finding the point in the diagram closed to this position
    if(type == "mainLand"){ // type mainland had a higher altitude and a sharpness value to avoid making a perfectly circular island
      var [alt, decrement, sharpness] = [0.9, 0.9, 0.2];
    }
    // type island has a lower and somewhat random altitude and since the mainland causes "spikes" to form the islands are not circular
    else{var [alt, decrement, sharpness] = [Math.random()*0.4+0.1, 0.99, 0];} 
    var queue = [];
    polygons[startPoly].alt += alt;// setting the starting polygon's altitude and marking it as used
    polygons[startPoly].used = 1;
    queue.push(startPoly);
    for (i=0; i<queue.length && alt > 0.01; i++){
      if(type == "mainLand"){ // the mainland sets its height based off of the current polygon's height
        alt = polygons[queue[i]].alt * decrement;
      }
      else{ // an island sets its height by radiating outwards and slowly decreasing
        alt = alt * decrement;
      }
      polygons[queue[i]].neighbors.forEach(function(j){ // go to every neighbor of the current
        var curPoly = polygons[j];
        if (!curPoly.used){
          if(sharpness == 0){var mod = 1;} // if there is no sharpness there should be no modification
          else{mod = Math.random() * sharpness + 1.1 - sharpness;}
          if(curPoly.alt < 1){curPoly.alt += alt * mod;} // add the calculated altitide to the polygon's current altitude
          curPoly.used = 1;
          queue.push(j);
        }
      })
    }
    polygons.map(function(p) {p.used = undefined;}); // mark all polygons as unused so next added land will still consider them  
}

function setOceans(){
  var curPoly = diagram.find(0,0).index; // starting in the top left corner, which is always an ocean
  var queue = [];
  queue.push(curPoly); // add the current polygon to the queue
  polygons[curPoly].used = 1;
  for(var i = 0; i < queue.length; i++){
    curPoly = polygons[queue[i]]; // get the next polygon in the queue
    curPoly.type = "ocean"; // set its type to ocean
    curPoly.neighbors.forEach(function(j){
      neighbor = polygons[j];
      if(neighbor.alt <= 0.2 && neighbor.used == undefined){ // if the neighboring polygon is water and not already used
        neighbor.used = 1;
        queue.push(j); // add the neighbor to the queue
      }
    })
  }
  polygons.map(function(p) {p.used = undefined;});
}

function createMap(numIsland){
  generateGrid(); 
  var x = Math.random()*(width*0.2) + width*0.4 // the mainland should be somewhat centered, but with a little randomness
  var y = Math.random()*(height*0.2) + height*0.4
  addLandmass(x, y, "mainLand");
  for(var i=0; i<numIsland; i++){
    x = Math.random()*(width*0.8) + width*0.1; // the islands are set to not be at the edge
    y = Math.random()*(height*0.8) + height*0.1;
    addLandmass(x, y, "smallIsland");
  }
  findCoast();
  setOceans();
  // The code below displays the map
  polygons.map(function(p, i) {
    if(p.alt > 0.2){
      cells.append("path")
            .attr("d", "M" + p.join("L") + "Z") // creating an svg path using the d attribute and svg string notation
            .attr("id", "poly"+i) // assigning each polygon an id of poly{index}
      var col = color(1-p.alt);
      cells.select("#poly"+i).attr("fill", col);
    }
  });
  coastLine.map(function(c){
    coast.append("path")
          .attr("d", "M"+ c.start + "L" + c.end + "Z");
  });
  
}

function moved(e){
  var mousePos = d3.pointer(e);
  var polyIndex = diagram.find(mousePos[0], mousePos[1]).index;
  var curPoly = polygons[polyIndex];
  document.getElementById("type").innerHTML = "Cell: " + curPoly.type + ", "+ curPoly.alt;
}