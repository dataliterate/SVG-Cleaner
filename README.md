SVG Cleaner
===========

A tool for cleaning SVG Files - partial port of Scour to JavaScript.

Visit the original [Scour - an SVG scrubber, http://codedread.com/scour/](http://codedread.com/scour/)

Scour was created by Jeff Schiller.

Please note that this is a partial port, which means it is not finsihed at all.
For thoose who want to clean their SVG files and have them as clean as possible
as I highly recommend to use the original Scour.py.
(Please see the list of implemented and missing processing steps below.)

Alternatives
-----------

*Recommended!* Be sure to check out [SVGO, a Nodejs-based tool for optimizing SVG vector graphics files.](https://github.com/svg/svgo)

Installation & Usage
-----------

As Command Line Tool
```
npm install svg-cleaner -g
svg-cleaner INPUT_FILE OUTPUT_FILE
```

As module - simple interface:
```js
var cleanedSvgString = require('svg-cleaner').clean(svgString);
```

```js
require('svg-cleaner').cleanFile(srcFilename, targetFilename);
```

As module - chainable interface
```js
var SVGCleaner = require('svg-cleaner');
var mySVGCleaner = SVGCleaner.createCleaner();
mySVGCleaner.load(svgString)
  .shortenIDs()
  .removeComments()
  .svgString();

var svgStringWithShortIDAndWithoutComments = mySVGCleaner.svgString();
```

Background
--
I needed a library to work with [SVG-Stacker](http://github.com/preciousforever/SVG-Stacker),
that could rename IDs and keep the references inside the SVG document structure intact.
SVG-Stacker merges different svg files and needs to make sure that the ids from different
files are unique in the merged version. I found that Scour implemented that feature.

The goal of the port was to bring the power of Scour to the JavaScript world, make it
available as commandline tool and usable as module for node.js.

I tried to keep the ideas and way how Scour cleans SVG files. I translated the processing steps
and copied most of the original comments from scour into the new source code, as they describe
the original ideas best. I marked all of these orginial comments by putting 'Scour:' in the first
line and used the markdown syntax for quotes (>) to indent the original comment. 

- Missing processing steps are marked with an comment '@missing'.
- Changed processing steps are marked with an comment containern '@extended' or '@changed'
- Some functions and variable names are changed to (hopefully) be more descriptive.

Please see the [annotated JavaScript Source-Code](http://preciousforever.github.com/SVG-Cleaner/docs/svg-cleaner.html).

Tests
--
Tests are based on [mocha](http://visionmedia.github.com/mocha/), run `make test`.

Visual tests are based on [phantomjs](http://phantomjs.org/). The idea is to render and rasterize
both, the original SVG file and cleaned version of that SVG file to compare the rasterized results
to ensure they are visualy identical.
Make sure you have installed phantomjs, then run `make visualtest`.

API
--
```js
SVGCleaner.createCleaner();
// creates SVG Cleaner instance

SVGCleaner.load(svgString);
// loads an SVG String

SVGCleaner.readFileSync(srcFilename);
// loads an SVG file

SVGCleaner.clean();
// performs all processing steps

SVGCleaner.svgString();
// returns SVG as String

SVGCleaner.writeFileSync(targetFilename);
// writes SVG to file
```

It makes sense to use clean(), as processing steps need to be performend in a specific order. To make
use of single processing steps, you can call these steps directly.
See description below:

Implemented processing steps
--
* Removal of namespaced elements

  ```
  removeNSElements(namespacesToRemove);
  ```
  
  `namespacesToRemove`: array of namespace prefixes, e.g.: ['dc', 'rdf', 'sodipodi', 'cc', 'inkscape']
* Removal of namespaced attributes

  ```
  removeNSAttributes(namespacesToRemove);
  ```

  `namespacesToRemove`: array of namespace prefixes
* Removal of comments
  ```
  removeComments();
  ```
* Repairation of styles
  ```
  repairStyles();
  ```
* Removal of unreferenced elements
  ```
  removeUnreferencedElements();
  ```
* Removal of empty elements
* Shortening of id attribute values
  ```
  shortenIDs(startNumber)
  ```
  `startNumber`: default: 1, optional
  Shortens the IDs, spreadsheet-style, i.e. from a to z, then from aa to az, ba to bz, etc., until zz.
* Removal of unreferenced id attributes
  ```
  removeUnreferencedIDs()
  ```

Missing
--
Processing steps in scour, that are not implemented yet:

* remove the xmlns: declarations now
* ensure namespace for SVG is declared
* check for redundant SVG namespace declaration
* convert colors to #RRGGBB format
* remove <metadata> if the user wants to
* flattend defs elements into just one defs element
* removeDuplicateGradientStops();
* remove gradients that are only referenced by one other gradient
* remove duplicate gradients
* createGroupsForCommonAttributes()
* move common attributes to parent group
* remove unused attributes from parent
* moveAttributesToParentGroup
* remove unnecessary closing point of polygons and scour points
* scour points of polyline
* clean path data
* scour lengths (including coordinates)
* reducePrecision
* removeDefaultAttributeValues
* optimizeTransforms
* convert rasters references to base64-encoded strings
* properly size the SVG document

License
--
SVG-Cleaner is released under the same license as Scour:

[Apache License Version 2.0](SVG-Cleaner/blob/master/LICENSE)
