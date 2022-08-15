var numPoints = 10000;
var diagram, polygons, svg, cells, width, height, coastline;
var color = d3.scaleSequential(d3.interpolateSpectral);

function generateGrid() {
  d3.select('.cells').remove();
  d3.select('.coast').remove();
  svg = d3.select('svg');
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
      diagram.cells[i].halfedges.forEach(function(e){
        var diaEdge = diagram.edges[e];
        if(diaEdge.left && diaEdge.right){
          var possibleCoast = diaEdge.left.index; // this is index that may be coastline, this happens when left or right are ocean
          if(possibleCoast == i){possibleCoast = diaEdge.right.index;}
          if(polygons[possibleCoast].alt <= 0.2){ // this mean it is an ocean
            coastLine.push({start: diaEdge[0], end: diaEdge[1]});
          }
        }
      })
    }
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