# WebGL World Generator

## Synopsis
The goal was to create a game in an infinite world where you could mine and craft blocks (see minecraft as reference). After a few hours of generating blocks it stood clear that the technology was just to weak to handle the amount of blocks as they are, rendered one by one. The generator ended up merging the visible blocks into a single mesh to keep the performance up. This is about 2,5 days worth of creative work and optimizations.

##Future
Next steps include making the TNT explosions work on larger worlds given the fact that the Perlin-noise is stitch-able and more than one chunk can be generated as neighboring chunk keeping the single chunk regeneration to a minimum at each change of block removal. That would for example construct a 64×64 block scene as 4x (32×32) chunks of data. Having the functionality to remove blocks without reduced performance would proof that the game is doable within the browser sandbox.

##Technologies
WebGL, HTML5

##Libraries
jQuery, Three.js, dat.GUI