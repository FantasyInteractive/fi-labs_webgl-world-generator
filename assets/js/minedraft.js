//-------------------------------
// CONFIG
//-------------------------------
var config =
{
	chunk_size: 		64,
	terrain_depth: 		64,
	terrain_variation: 	16,
	quality: 			32,
	water_level: 		32,
	seed: 				null,
	status: 			''
}

// const
var BLOCK_SIZE		 			= 16;
var WIDTH 						= window.innerWidth;
var HEIGHT 						= window.innerHeight;
var AMBIENT_LIGHT				= 0xCCCCCC;
var DIRT_LAYER_THICKNESS		= {min:2,max:5};
var GRAVEL_LAYER_THICKNESS		= {min:2,max:5};
var CORE_STONE_LAYER_THICKNESS	= {min:3,max:8};
var LAVA_LAYER_THICKNESS		= {min:16,max:24};

// user
var EYE_LEVEL 	= 2.6;

// blocks
var AIR 		= 0x0;
var GRASS 		= 0x1;
var DIRT 		= 0x2;
var NIL 		= 0x3;
var WATER 		= 0x4;
var SAND 		= 0x5;
var WOOD 		= 0x6;
var LEAVES 		= 0x7;
var COBBLE 		= 0x8;
var RAW_STONE	= 0x9;
var CORE_STONE	= 0xA;
var COBBLE		= 0xB;
var GRAVEL		= 0xC;
var LAVA		= 0xD;
var TNT			= 0xDEAD;

var ALL_BLOCK_TYPES =
[
	GRASS,  DIRT,   WATER,     SAND,        WOOD,
	LEAVES, COBBLE, RAW_STONE, CORE_STONE,  COBBLE,
	GRAVEL, LAVA,   TNT
];

// controls
var MOVEMENT_SPEED		= 1000;
var LOOK_SPEED			= 0.125;
var LOOK_VERTICAL		= true;
var CONSTRAIN_VERTICAL	= false;
var VERTICAL_MIN		= 1.1;
var VERTICAL_MAX		= 2.2;
var NO_CLIP				= false;

//-------------------------------
// CONSTRUCTOR
//-------------------------------

/**
 * Creates a new minedraft (game) object.
 * @param containerID Viewport container div.
 * @param seed World seed (optional)
 */
function minedraft( containerID, seed )
{
	
	// get viewport
	this.viewport              = document.getElementById( containerID );
	this.viewport.style.width  = window.innerWidth + 'px';
	this.viewport.style.height = window.innerHeight + 'px';
	
	// create renderer
	this.renderer = new THREE.WebGLRenderer( { antialias: true } );
	this.renderer.setClearColorHex( 0xDAF0FD );
	this.renderer.setSize( WIDTH, HEIGHT );
	
	// make internal clock
	this.clock = new THREE.Clock();

	// create environment
	this.scene            = new THREE.Scene();
	this.container        = new THREE.Object3D();
	this.scene.fog        = new THREE.FogExp2( 0xDAF0FD, 0.00015 );
	this.camera           = new THREE.PerspectiveCamera( 50, WIDTH / HEIGHT, 1, 20000 );
	this.ambientLight     = new THREE.AmbientLight( AMBIENT_LIGHT );
	this.directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
	this.directionalLight.position.set( 1, 1, 0.5 ).normalize();
	this.scene.add( this.camera );
	this.scene.add( this.ambientLight );
	this.scene.add( this.directionalLight );
	this.scene.add( this.container );
	
	// set a random seed or pick from constructor
	config.seed 		= seed || parseInt(Math.random()*999999);
	
	// construct the global geometry
	this.globalGeometry = new THREE.Geometry();
	
	// basic project for TNT dispatches (ray cast)
	this.projector 		= new THREE.Projector();
	
	// prepare all material types
	materials.initialize();
	
	// move the camera for a bird's-eye-view.
	this.camera.position.x = parseInt(config.chunk_size)*BLOCK_SIZE*2;
	this.camera.position.y = parseInt(config.chunk_size)*BLOCK_SIZE*2;
	this.camera.position.z = parseInt(config.chunk_size)*BLOCK_SIZE*2;
	var target = new THREE.Vector3( parseInt(config.chunk_size)*BLOCK_SIZE, 
									parseInt(config.chunk_size)*BLOCK_SIZE,
									parseInt(config.chunk_size)*BLOCK_SIZE
									);
	this.camera.lookAt( target );
	
	// create controls
	/*this.controls 					= new THREE.FirstPersonControls( this.camera, this.viewport );
	this.controls.target 			= target;
	this.controls.lat 				= -42.9;
	this.controls.lon 				= 223;
	this.controls.phi 				= 2.32;
	this.controls.movementSpeed 	= MOVEMENT_SPEED;
	this.controls.lookSpeed 		= LOOK_SPEED;
	this.controls.lookVertical 		= LOOK_VERTICAL;
	this.controls.constrainVertical = CONSTRAIN_VERTICAL;
	this.controls.verticalMin 		= VERTICAL_MIN;
	this.controls.verticalMax 		= VERTICAL_MAX;
	this.controls.noFly		 		= !NO_CLIP;
	this.controls.freeze 			= true;*/
	
	// append the webgl dom
	this.viewport.appendChild( this.renderer.domElement );
	
	// generate initial world
	this.generate();
	
	// append SPACE key as TNT dispatch
	var _this = this;
	document.onkeypress=function(e){
		var e=window.event || e;
		if(e.charCode == 32)
			_this.fire();
	}
}

//-------------------------------
// TERRAIN
//-------------------------------

/**
 * Randomizes the seed and generates the world.
 * @see minedraft#generate()
 */
minedraft.prototype.generateWithRandomSeed = function()
{
	config.seed = parseInt(Math.random()*999999);
	this.generate();
}

/**
 * Generate world data and terrain mesh.
 */
minedraft.prototype.generate = function()
{
	// delay so that status message gets displayed (ugly)
	(function gen(mine){
		config.status = 'generating world, please wait.';
		function exec()
		{
			mine.generateTerrainData();
			mine.generateTerrain();
			config.status = 'world generated.';
		}
		setTimeout(exec, 100);
	})(this);
	
}
/** Store: Perlin noise generator */
minedraft.prototype.perlin 	= null;

/**
 * Generates minedraft#data 3 dimensional array by config#
 * and world rules.
 * @see #config
 */
minedraft.prototype.generateTerrainData = function()
{
	var mult, altitude = 1;
	var dirt_thickness, gravel_thickness, lava_thickness;
	this.data   = [];
	this.perlin = new ImprovedNoise();
	for (var xx = 0; xx < config.chunk_size; xx++)
	{
		this.data[xx] = [];
		for (var zz=0; zz < config.chunk_size; zz++)
		{
			mult      = this.perlin.noise( xx/config.quality, zz/config.quality, config.seed*config.quality );
			altitude  = parseInt(config.terrain_depth/2);
			altitude += parseInt(mult*config.terrain_variation);
			//log(altitude);
			this.data[xx][zz] = [];
			dirt_thickness    = this.randomRange( DIRT_LAYER_THICKNESS );
			gravel_thickness  = this.randomRange( GRAVEL_LAYER_THICKNESS ) ;
			lava_thickness    = this.randomRange( LAVA_LAYER_THICKNESS ) ;
			for (var yy = 0; yy < config.terrain_depth; yy++)
			{
				if( yy == altitude )
				// SURFACE
				{
					if(yy < config.water_level)
					{
						if(yy < (config.water_level-1))
							this.data[xx][zz][yy] = SAND;
						else
							this.data[xx][zz][yy] = DIRT;
					}
					else
						this.data[xx][zz][yy] = GRASS;
				}
				else if( yy < altitude)
				// BELOW SURFACE
				{
					if( yy > altitude - dirt_thickness )
					// DIRT
					{
						this.data[xx][zz][yy] = DIRT;
					}
					else if( yy > altitude - (dirt_thickness + gravel_thickness) )
					// GRAVEL
					{
						this.data[xx][zz][yy] = GRAVEL;
					}
					else if( yy < this.randomRange( CORE_STONE_LAYER_THICKNESS ) )
					// CORE STONE
					{
						this.data[xx][zz][yy] = CORE_STONE;
					}
					else if( yy < (altitude - lava_thickness) )
					// LAVA
					{
						this.data[xx][zz][yy] = LAVA;
					}
					else
					// RAW STONE
					{
						this.data[xx][zz][yy] = RAW_STONE;
					}
				}
				// FLOOD FILL
				else if( yy >= altitude && yy <= config.water_level)
					this.data[xx][zz][yy] = WATER;
				else
					this.data[xx][zz][yy] = AIR;
			};
		};
	};
	
	// render up to 10 trees (may be less pending on amout of solid ground above sea level)
	for (var i=0; i < 10; i++) {
		this.addTreeData(3+parseInt(Math.random()*(config.chunk_size-6)), 3+parseInt(Math.random()*(config.chunk_size-6)) )
	};
}

/**
 * Add a static tree to the specified coordinates.
 * Note: If the coordinates are out of bounds or
 * hitting water, the tree will not render and produce "false".
 * @param x Coordinate
 * @param z Coordinate
 * @return Success
 */
minedraft.prototype.addTreeData = function(x,z)
{
	var y_arr = this.data[x][z],
		alt   = 0;

	// make sure we are on solid ground.
	for (var i=0; i < config.terrain_depth; i++)
		if( y_arr[i] == AIR && y_arr[i-1] == GRASS )
		{
			alt = i;
			break;
		}
	// no solid ground found, skip this tree.
	if(alt==0) return false;
	
	// create stem (6 high) 
	var alt    = i;
	y_arr[i]   = WOOD;
	y_arr[i+1] = WOOD;
	y_arr[i+2] = WOOD;
	y_arr[i+3] = WOOD;
	y_arr[i+4] = WOOD;
	y_arr[i+5] = WOOD;
	
	// create a branch around the stem.
	function branch(world, size, offsetY)
	{
		var tx, tz,
			neg = Math.floor(size/2);
		for (var xx=0; xx < size; xx++)
		{
			for (var zz=0; zz < size; zz++)
			{
				tx = x-neg;
				tz = z-neg;
				log(tx+', ' + tz)
				if(world.data[tx+xx][tz+zz][alt+offsetY] == AIR)
					world.data[tx + xx][tz + zz][alt + offsetY] = LEAVES;
			}
		};
	}
	branch(this, 3,2);
	branch(this, 5,3);
	branch(this, 5,4);
	branch(this, 3,5);
	this.data[x][z][i+6] = LEAVES;
	return true;
}

/** Store: Blocks */
minedraft.prototype.blocks	= [];
/** Store: Terrain */
minedraft.prototype.terrain = null;

/**
 * Generates the Terrain mesh based on mindraft#data array.
 */
minedraft.prototype.generateTerrain = function()
{
	// reset
	var geom = null;
	this.blocks = [];
	
	if( this.terrain )
	// remove terrain if already exist
	{
		this.container.remove(this.terrain);
		this.globalGeometry = new THREE.Geometry();
	}
	
	// define placeholders
	var block, sides, t, altitude = 0,
		px = false,
		nx = false,
		py = true,  // top
		ny = false, // bottom
		pz = false,
		nz = false;
	
	// loop though terrain data and construct geometry.
	for (var xx=0; xx < config.chunk_size; xx++)
	{
		this.blocks[xx] = [];
		for (var zz=0; zz < config.chunk_size; zz++)
		{
			this.blocks[xx][zz] = [];
			for (var yy=0; yy < config.terrain_depth; yy++)
			{
				if( this.data[xx][zz][yy] != AIR )
				// create block if it's not air
				{
					// check if the sides of the block are visible or not.
					px = this.shouldDisplayAgains(this.data[xx][zz][yy], xx+1,zz,yy);
					nx = this.shouldDisplayAgains(this.data[xx][zz][yy], xx-1,zz,yy);
					pz = this.shouldDisplayAgains(this.data[xx][zz][yy], xx,zz+1,yy);
					nz = this.shouldDisplayAgains(this.data[xx][zz][yy], xx,zz-1,yy);
					py = this.shouldDisplayAgains(this.data[xx][zz][yy], xx,zz,yy+1);
					ny = this.shouldDisplayAgains(this.data[xx][zz][yy], xx,zz,yy-1);
					
					if( px||nx||pz||nz||py||ny )
					// if any side is visible, create this geometry
					{
						sides = { px: px, nx: nx, py: py, ny: ny, pz: pz, nz: nz };
						
						// fetch the correct material based on block type
						t                = materials[ this.data[xx][zz][yy] ];
						// create geometry
						geometry         = new THREE.CubeGeometry( BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE, 1, 1, 1, t, sides );
						// create mesh
						block            = new THREE.Mesh( geometry );
						// set the block position based on grid in #data
						block.position.x = xx*BLOCK_SIZE;
						block.position.y = yy*BLOCK_SIZE;
						block.position.z = zz*BLOCK_SIZE;
						
						// save block for future reference
						this.blocks[xx][zz][yy] = block;
						
						// merge this block with the global geometry to boost performance
						THREE.GeometryUtils.merge( this.globalGeometry, block );
					}
				}
			};
		};
	};
	
	// create terrain mesh out of merged block geometry
	this.terrain = new THREE.Mesh( this.globalGeometry, new THREE.MeshFaceMaterial() );
	
	var terrainPosition = new THREE.Vector3(-config.chunk_size*BLOCK_SIZE/2, 0, -config.chunk_size*BLOCK_SIZE/2);
	this.terrain.position.copy( terrainPosition );
	
	// add the terrain to the scene
	this.container.add(this.terrain);
}

/**
 * Fire off a TNT in the camera target direction (ray)
 * This will only be performed if anything is within the
 * cameras crosshair.
 */
minedraft.prototype.fire = function()
{
	// store camera settings
	var pos = this.camera.position.clone();
	var rot = this.camera.rotation.clone();
	
	// remove any tnt currently being fired
	if(this.tnt) this.scene.remove(this.tnt);
	
	// create the TNT block
	var geometry        = new THREE.CubeGeometry( BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE, 1, 1, 1, materials[TNT] );
	this.tnt            = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial() );
	this.tnt.position.x = pos.x;
	this.tnt.position.y = pos.y;
	this.tnt.position.z = pos.z;
	this.tnt.rotation.copy( rot );
	
	// find the camera projection
	var vector = new THREE.Vector3( ( (WIDTH*0.5) / WIDTH ) * 2 - 1, - ( (HEIGHT*0.5) / HEIGHT ) * 2 + 1, 0.5 );
	this.projector.unprojectVector( vector, this.camera );

	// cast a ray to find out if we can hit anything.
	var ray = new THREE.Ray( this.camera.position, vector.subSelf( this.camera.position ).normalize() );
	var hit = ray.intersectObjects([this.terrain]);
	
	if(hit.length)
	// a hit can be made, fire the TNT!
	{
		var r = hit[0].point;
		// tween the TNT block and execute #explode() upon completion.
		var tween = new TWEEN.Tween(this.tnt.position).to({x:r.x,y:r.y,z:r.z}, 500).start().onComplete(this.explode, [ this, r, hit ] );
		this.scene.add(this.tnt);
	}
}

/**
 * Blow up a part of the terrain.
 * @param caller The game reference
 * @param where Vector where to blow up terrain
 * @param list List of affected object (terrain)
 */
minedraft.prototype.explode = function( caller, where, list )
{
	caller.scene.remove(caller.tnt);
	caller.proximity.apply(caller, [ where, list, 5 ]);
}
minedraft.prototype.proximity = function( vector, list, distance )
{
	// normalize vector
	var pos   = vector.clone().divideScalar(BLOCK_SIZE);
		pos.x = this.withinChunk( Math.round(pos.x) );
		pos.y = this.withinChunk( Math.round(pos.y) );
		pos.z = this.withinChunk( Math.round(pos.z) );
	
	// get block that got hit
	var data = this.data[pos.x][pos.z][pos.y];
	while(data == AIR && pos.y > 0)
	{
		pos.y -= 1;
		data = this.data[pos.x][pos.z][pos.y];
	}
	var target = this.blocks[pos.x][pos.z][pos.y];
	if( target )
	{
		this.data[pos.x][pos.z][pos.y] = AIR;
	}
	
	// set affected blocks as AIR
	var n = 10;
	var x,y,z;
	var nx = this.randomRange({min:2,max:3});
	var nz = this.randomRange({min:2,max:3});
	var ny = this.randomRange({min:2,max:3});
	for (var xx=-nx; xx < nx; xx++) {
		for (var zz=-nz; zz < nz; zz++) {
			for (var yy=-ny; yy < ny; yy++) {
				x = this.withinChunk( pos.x+xx );
				z = this.withinChunk( pos.z+zz );
				y = this.withinChunk( pos.y+yy );
				this.data[x][z][y] = AIR;
			}
		}
	}
	
	// recreate the terrain based on new data
	// TODO: Only remove affected faces and add new blocks based
	//       on proximity.
	this.generateTerrain();
}

/**
 * REturns true if the caller is visible towards the block at the
 * specified coordinate.
 * @param callerType Block type
 * @param x coordinate of neighbor
 * @param z coordinate of neighbor
 * @param y coordinate of neighbor
 * @return Visible or not.
 */
minedraft.prototype.shouldDisplayAgains = function(callerType,x,z,y)
{
	var block = this.getBlockTypeAt(x,z,y);
	if(block == NIL) return true;
	if(block == AIR) return true;
	if(block == callerType) return false;
	
	var trans = this.isTransparentBlockByType(block);
	var caller_trans = this.isTransparentBlockByType(callerType);
	if(trans == caller_trans) return false;
	if(caller_trans && !trans) return false;
	if(trans || callerType) return true;
	return false;
}

/**
 * Returns true if the specified block is transparent.
 * This would include AIR, WATER and LEAVES.
 * @param type Block type.
 * @return Transparency
 */
minedraft.prototype.isTransparentBlockByType = function(type)
{
	switch(type)
	{
		case AIR:
		case WATER:
		case LEAVES:
			return true;
	}
	return false;
}

/**
 * Returns true if the specified block is transparent.
 * This would include AIR, WATER and LEAVES.
 * @param x Block coorindate
 * @param z Block coorindate
 * @param y Block coorindate
 * @return Transparency
 */
minedraft.prototype.isTransparentBlock = function(x,z,y)
{
	var bt = this.getBlockTypeAt(x,z,y);
	return bt == AIR || bt == WATER;
}

/**
 * Returns the block type at the specified coordinates
 * @param x Block coorindate
 * @param z Block coorindate
 * @param y Block coorindate
 */
minedraft.prototype.getBlockTypeAt = function(x,z,y)
{
	if(this.data[x] == null) return NIL;
	if(this.data[x][z] == null) return NIL;
	if(this.data[x][z][y] == null) return NIL;
	return this.data[x][z][y];
}

/**
 * Returns true if the single axis value is within chunk size.
 * @param value Single axis coordinate.
 */
minedraft.prototype.withinChunk = function( value )
{
	return Math.max( 0, Math.min( value, config.chunk_size-1 ) );
}

/**
 * Returns an int  between {min,max}.
 * @param Object with min and max values.
 */
minedraft.prototype.randomRange = function( obj )
{
	return parseInt(obj.min + Math.random()*(obj.max-obj.min));
}

/**
 * Render and update single frame.
 */
minedraft.prototype.render = function()
{
	TWEEN.update();
	if( this.terrain )
		this.container.rotation.y += 0.01;
	//this.controls.update( this.clock.getDelta() );
	this.renderer.render( this.scene, this.camera );
}

/**
 * Returns a string represenation of the current object.
 */
minedraft.prototype.toString = function()
{
	return '[minedraft viewport='+this.viewport+']';
}

//-------------------------------
// MATERIALS AND TEXTURES
//-------------------------------

var materials = 
{
	ambient:0xbbbbbb,
	
	tGrassDirt 	: 'assets/textures/minecraft/grass_dirt.png',
	tGrass 		: 'assets/textures/minecraft/grass.png',
	tDirt 		: 'assets/textures/minecraft/dirt.png',
	tWater 		: 'assets/textures/minecraft/water.png',
	tSand 		: 'assets/textures/minecraft/sand.png',
	tWoodUp		: 'assets/textures/minecraft/wood_top.png',
	tWood 		: 'assets/textures/minecraft/wood_side.png',
	tLeaves		: 'assets/textures/minecraft/leaves.png',
	tRawStone	: 'assets/textures/minecraft/raw_stone.png',
	tCoreStone	: 'assets/textures/minecraft/core_stone.png',
	tGravel		: 'assets/textures/minecraft/gravel.png',
	tCobble		: 'assets/textures/minecraft/cobble.png',
	tTNTTop		: 'assets/textures/minecraft/tnt_top.png',
	tTNTBottom	: 'assets/textures/minecraft/tnt_bottom.png',
	tTNTSide	: 'assets/textures/minecraft/tnt_side.png',
	tLava		: 'assets/textures/minecraft/lava.png',
	
	/**
	 * Creates all materials.
	 */
	initialize:function()
	{
		for (var i=0; i < ALL_BLOCK_TYPES.length; i++) {
			materials[ ALL_BLOCK_TYPES[i] ] = materials.getBlockMaterialByType( ALL_BLOCK_TYPES[i] );
		};
	},
	/**
	 * Loads a texture by URL and applied the correct filters.
	 */
	loadTexture:function(url)
	{
		var tx = THREE.ImageUtils.loadTexture(url);
		tx.magFilter = THREE.NearestFilter;
		tx.minFilter = THREE.NearestMipMapFilter;
		return tx;
	},
	/**
	 * Returns the correct material based on block type.
	 */
	getBlockMaterialByType:function(type)
	{
		var top, bottom,
			left, right,
			front, back,
			side, all;
		var materialType = THREE.MeshLambertMaterial;
			
		switch(type)
		{
			case GRASS :
				top 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tGrass )
												});
				bottom 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tDirt )
												});
				side 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tGrassDirt )
												});
				break;
			case DIRT :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tDirt )
												});
				break;
			case WATER :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tWater ),
											transparent: true,
												opacity: 0.8
												});
				break;
			case SAND :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tSand )
												});
				break;
			case WOOD :
				top 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tWoodUp )
												});
				side 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tWood )
												});
				break;
			case LEAVES :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tLeaves ),
											transparent: true
												});
				break;
			case GRAVEL :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tGravel )
												});
				break;
			case COBBLE :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tCobble )
												});
				break;
			case LAVA :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tLava )
												});
				break;
			case CORE_STONE :
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tCoreStone )
												});
				break;
			case TNT :
				top 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tTNTTop )
												});
				bottom 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tTNTBottom )
												});
				side 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tTNTSide )
												});
				break;
			case RAW_STONE :
			default:
				all 	= new materialType({	ambient: materials.ambient, 
													map: materials.loadTexture( materials.tRawStone )
												});
				break;
		}
		if( !!all )
		{
			left = right = front = back = top = bottom = all;
		}
		else 
		{
			if(!bottom && !!top)
			{
				bottom = top;
			}
			if( !!side )
			{
				left = right = front = back = side;
			}
		}
		return [ front, left, top, bottom, back, right ];
	}
}
