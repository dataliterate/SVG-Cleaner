// SVG Cleaner
// ----------
// 
// A tool for cleaning SVG Files - (yet partial) port of Scour to JavaScript.
// 
// Visit the original [Scour - an SVG scrubber, http://codedread.com/scour/](http://codedread.com/scour/)
// 
// Scour was created by Jeff Schiller.
// 
// Please note that this is a partial port, which means it is not finsihed at all.
// For thoose who want to clean their SVG files and have them as clean as possible
// as I highly recommend to use the original Scour.py.
// (Please see the list of implemented and missing processing steps below.)
// 
// License
// --
// SVG Cleaner
// Copyright 2012 Michael Schieben
//
// Scour
// Copyright 2010 Jeff Schiller
// Copyright 2010 Louis Simard
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// 
// About the port
// --
//
// I needed a library to work with [SVG-Stacker](http://github.com/preciousforever/SVG-Stacker),
// that could rename IDs and keep the references inside the SVG document structure intact.
// SVG-Stacker merges different svg files and needs to make sure that the ids from different
// files are unique in the merged version. If found that Scour implemented that feature.
// 
// The goal of the port was to bring the power of Scour to the JavaScript world, make it
// available as commandline tool and usable as module for node.js.
// 
// I tried to keep the ideas and way how Scour cleans SVG files. I translated the processing steps
// and copied most of the original comments from scour into the new source code, as they describe
// the original ideas best. I marked all of these orginial comments by putting 'Scour:' in the first
// line an used the markdown syntax for quotes (>). 
// 
// - Missing processing steps are marked with an comment '@missing'.
// - Changed processing steps are marked with an comment containern '@extended' or '@changed'
// - Some functions and variable names are changed to (hopefully) be more descriptive.

// Implemented
// --
// * Removal of namespaced elements and attributes
// * Removal of comments
// * Repairation of styles
// * Removal of unreferenced elements
// * Removal of empty elements
// * Removal of unused attributes
// * Shortening of id attribute values

// Missing
// --
// * remove the xmlns: declarations now
// * ensure namespace for SVG is declared
// * check for redundant SVG namespace declaration
// * convert colors to #RRGGBB format
// * remove <metadata> if the user wants to
// * flattend defs elements into just one defs element
// * removeDuplicateGradientStops();
// * remove gradients that are only referenced by one other gradient
// * remove duplicate gradients
// * createGroupsForCommonAttributes()
// * move common attributes to parent group
// * remove unused attributes from parent
// * moveAttributesToParentGroup
// * remove unnecessary closing point of polygons and scour points
// * scour points of polyline
// * clean path data
// * scour lengths (including coordinates)
// * reducePrecision
// * removeDefaultAttributeValues
// * optimizeTransforms
// * convert rasters references to base64-encoded strings
// * properly size the SVG document

// Original Notes from Scour
// --

// Scour:
// > Notes:
//
// > rubys' path-crunching ideas here: [http://intertwingly.net/code/svgtidy/spec.rb]()
// > (and implemented here: http://intertwingly.net/code/svgtidy/svgtidy.rb )

// > Yet more ideas here: [Inkscape Wiki](http://wiki.inkscape.org/wiki/index.php/Save_Cleaned_SVG)
// >
// > * Process Transformations
// >  * Collapse all group based transformations

// > Even more ideas here: [http://esw.w3.org/topic/SvgTidy]()
// >
// >  * analysis of path elements to see if rect can be used instead? (must also need to look
// >    at rounded corners)

// > Next Up:
// >
// > - why are marker-start, -end not removed from the style attribute?
// > - why are only overflow style properties considered and not attributes?
// > - only remove unreferenced elements if they are not children of a referenced element
// > - add an option to remove ids if they match the Inkscape-style of IDs
// > - investigate point-reducing algorithms
// > - parse transform attribute
// > - if a <g> has only one element in it, collapse the <g> (ensure transform, etc are carried down)

// Implementation
// --

var _ = require('underscore')
  , fs = require('fs')
  , cheerio = require('cheerio')
  , CSSOM = require('cssom')
  , $
  ;

// Namespace Prefixes that should be removed
var namespacePrefixes = ['dc', 'rdf', 'sodipodi', 'cc', 'inkscape'];

// ----------- ----------- ----------- ----------- ----------- -----------
// Sanitize References
// --

// Scour:
// Removes the unreferenced ID attributes.
function removeUnreferencedIDs() {
  var identifiedElements = $('[id]');
  var referencedIDs = findReferencedElements();
  _(identifiedElements).each(function(node) {
      var $node = $(node);
      var id = $node.attr('id');
      if(!_(referencedIDs).has(id)) {
        $node.removeAttr('id');
      };
  });
}

// Style-Properties and Element-Attributes that might contain an id, a reference to another object
var referencingProperties = ['fill', 'stroke', 'filter', 'clip-path', 'mask',  'marker-start', 'marker-end', 'marker-mid'];

var REFERENCE_TYPE = {
  STYLE_TAG: 0,
  XLINK: 1,
  STYLE_ATTRIBUTE: 2,
  ATTRIBUTE: 4
};
function addReferencingElement(ids, id, referenceType, node, additionalInfo) {
  var id = id.replace(/#/g, '');
  if(!_(ids).has(id)) {
    ids[id] = [];
  }

  if(_(additionalInfo).isUndefined()) {
    additionalInfo = [];
  }
  ids[id].push([referenceType, node, additionalInfo]);
  return ids;
}

// extracts #id out of CSS url('#id')
function extractReferencedId(value) {
  var v = value.replace(/[\s]/g, '');
  if(v.indexOf('url') !== 0) {
    return false;
  }
  return value.replace(/[\s]/g, '').slice(4, -1).replace(/["']/g, '');
}

// replaced #fromid in CSS url('#fromid') to url('#toid')
function replaceReferencedId(value, idFrom, idTo) {
  var re = new RegExp('url\\([\'"]?#' + idFrom + '[\'"]?\\)', 'g');
  return value.replace(re, "url(#" + idTo + ")");

}

// Scour:
// > Returns the number of times an ID is referenced as well as all elements
// > that reference it.  node is the node at which to start the search.  The
// > return value is a map which has the id as key and each value is an array
// > where the first value is a count and the second value is a list of nodes
// > that referenced it.

function findReferencedElements() {

  var ids = {};

  _($('*')).each(function(node) {
    var $node = $(node);

    if(node.name == 'style') {
      var styles = CSSOM.parse($node.text());
      _(styles.cssRules).each(function(rule) {
        _(referencingProperties).each(function(referencingProperty) {
          if(_(rule.style).has(referencingProperty)) {
            var id = extractReferencedId(rule.style[referencingProperty]);
            if(id) {
              addReferencingElement(ids, id, REFERENCE_TYPE.STYLE_TAG, node);
            }
          }
        });
      });
      return;
    }

    // if xlink:href is set, then grab the id
    var href = $node.attr('xlink:href');
    if(href && (href.indexOf('data:') !== 0)) {
      addReferencingElement(ids, href, REFERENCE_TYPE.XLINK, node);
    }

    // now get all style properties
    var styles = parseStyles($node.attr('style'));

    _(referencingProperties).each(function(referencingProperty) {
      // first check attributes
      var value = $node.attr(referencingProperty);
      if(!_.isUndefined(value)) {
        var id = extractReferencedId(value);
        if(id) {
          addReferencingElement(ids, id, REFERENCE_TYPE.ATTRIBUTE, node, referencingProperty);
        }
      }
      // then inline styles
      if(_(styles).has(referencingProperty)) {
        var id = extractReferencedId(styles[referencingProperty]);
        if(id) {
          addReferencingElement(ids, id, REFERENCE_TYPE.STYLE_ATTRIBUTE, node);
        }
      }
    });

  });

  return ids;
}

// scour:
// > Shortens ID names used in the document. ID names referenced the most often are assigned the
// > shortest ID names.
// @missing scour:
// > If the list unprotectedElements is provided, only IDs from this list will be shortened.
function shortenIDs(startNumber) {
  if(_.isUndefined(startNumber)) {
    startNumber = 1;
  }
  var $identifiedElements = $('[id]');
  var referencedIDs = findReferencedElements();

  // scour:
  // > Make idList (list of idnames) sorted by reference count
  // > descending, so the highest reference count is first.
  // > First check that there's actually a defining element for the current ID name.
  // > (Cyn: I've seen documents with #id references but no element with that ID!)

  var idList = _(_(referencedIDs).keys()).filter(function(id) {
    return ($identifiedElements.find('#' + id).length > 0);
  });
  idList = _(idList).sortBy(function(id) {
    return referencedIDs[id].length;
  }).reverse();

  _(idList).each(function(id) {
    var shortendID = intToID(startNumber++);

    // scour:
    // > First make sure that *this* element isn't already using
    // > the ID name we want to give it.
    if(id == shortendID) {
      return;
    }
    // scour:
    // > Then, skip ahead if the new ID is already in identifiedElement
    while($identifiedElements.find('#' + shortendID).length > 0) {
      shortendID = intToID(startNumber++);
    }
    // scour:
    // > Then go rename it.
    renameID(id, shortendID, $identifiedElements, referencedIDs);
    
  });

}

// scour:
// > Returns the ID name for the given ID number, spreadsheet-style, i.e. from a to z,
// > then from aa to az, ba to bz, etc., until zz.
function intToID(num) {
  var idName = '';
  while (num > 0) {
    num--;
    idName = String.fromCharCode((num % 26) + 'a'.charCodeAt(0)) + idName;
    num = Math.floor(num / 26)
  }
  return idName;
}

// scour:
// > Changes the ID name from idFrom to idTo, on the declaring element
// > as well as all references in the document doc.
// > 
// > Updates identifiedElements and referencedIDs.
// > Does not handle the case where idTo is already the ID name
// > of another element in doc.
function renameID(idFrom, idTo, $identifiedElements, referencedIDs) {


  var $definingNode = $identifiedElements.find('#' + idFrom);
  $definingNode.attr('id', idTo);
  var referringNodes = referencedIDs[idFrom];

  _(referringNodes).each(function(referenceTypeNodeAndAdditionalInfos) {
    var property = referenceTypeNodeAndAdditionalInfos[0];
    var node = $(referenceTypeNodeAndAdditionalInfos[1]);
    switch(property) {
      case REFERENCE_TYPE.STYLE_TAG:
        node.text(replaceReferencedId(node.text(), idFrom, idTo));
        break;
      case REFERENCE_TYPE.XLINK:
        node.attr('xlink:href', '#' + idTo);
        break;
      case REFERENCE_TYPE.STYLE_ATTRIBUTE:
        node.attr('style', replaceReferencedId(node.attr('style'), idFrom, idTo));
        break;
      case REFERENCE_TYPE.ATTRIBUTE:
        var attributeName = referenceTypeNodeAndAdditionalInfos[2];
        node.attr(attributeName, replaceReferencedId(node.attr(attributeName), idFrom, idTo));
        break;
      default:
        // unkonw reference_type
    }

  });

}

// scour:
// > removes all unreferenced elements except for `<svg>, <font>, <metadata>, <title>, and <desc>`.
// > Also vacuums the defs of any non-referenced renderable elements.
function removeUnreferencedElements() {

  var referencedIDs = findReferencedElements();

  var alwaysKeepTags = ['font', 'style', 'metadata', 'script', 'title', 'desc'];
  function removeUnreferencedElementsInTag(node) {
    _($(node).children()).each(function(node) {
      
      // scour:
      // > we only remove if it is not one of our tags we always keep (see above)
      if(_(alwaysKeepTags).indexOf(node.name) !== -1) {
        return;
      }
      var $node = $(node);
      var id = $node.attr('id');
      if(!_(referencedIDs).has(id)) {
        if(node.name == 'g') {
          // scour:
          // > we only inspect the children of a group in a defs if the group
          // > is not referenced anywhere else
          removeUnreferencedElementsInTag(node);
        } else {
          $(node).remove();
        }
      }
    });
  }
  // scour:
  // > Remove most unreferenced elements inside defs
  _($('defs')).each(removeUnreferencedElementsInTag);

  // scour:
  // > Remove certain unreferenced elements outside of defs
  var identifiedElements = $('* > linearGradient[id], * > radialGradient[id], * > pattern[id]');
  
  _(identifiedElements).each(function(node) {
    var id = $(node).attr('id');
    if(!_(referencedIDs).has(id)) {
      $(node).remove();
    }
  });

}

// scour:
// > remove empty defs, metadata, g
// > NOTE: these elements will be removed if they just have whitespace-only text nodes
// @extended: also removes nested empty elements <defs><g></g></defs>
function removeEmptyContainers() {
  var elementWasRemoved = true;
  do {
    elementWasRemoved = false;
    _($('defs, metadata, g')).each(function(node) {
      if(!node.children.length) {
        $(node).remove();
        elementWasRemoved = true;
      }
    });
  } while(elementWasRemoved);
}

// ----------- ----------- ----------- ----------- ----------- -----------

// Namspace
// --
function removeNamespacedElements(namespacesToRemove) {

  var namespacedElements = _($('*')).filter(function(node) {
    
    var $node = $(node)[0];
    if($node.type !== 'tag') {
      return false;
    }

    var namespaceTagName = $node.name.split(':');
    if(namespaceTagName.length < 2) {
      return false;
    }

    if(_.indexOf(namespacesToRemove, namespaceTagName[0]) === -1) {
      return false;
    }

    return true;
  });

  $(namespacedElements).remove();

}

function removeNamespacedAttributes(namespacesToRemove) {

  $('*').each(function(ix, node) {
    _.each(node.attribs, function(value, key) {
      var namespaceAtrributeName = key.split(':');
      if(namespaceAtrributeName.length < 2) {
        return;
      }
      if(_.indexOf(namespacesToRemove, namespaceAtrributeName[0]) !== -1) {
        $(node).removeAttr(key);
      }
    });
  });

}

// ----------- ----------- ----------- ----------- ----------- -----------

// Comments
// --
function removeComments() {

  var commentNodes = [];

  // process on NODE level
  function searchForComment(node) {
    if(node.type == 'comment') {
      commentNodes.push(node);
    }
    if(!_(node.children).isUndefined()) {
      _.each(node.children, searchForComment);
    }
  }
  searchForComment($._root);
  _.each(commentNodes, function(node) {
    $(node).remove();
  });
}

// ----------- ----------- ----------- ----------- ----------- -----------

// Repair Style
// --
function mayContainTextNode(node) {

  var result = true;

  var elementsThatDontContainText = ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'path', 'image', 'stop'];
  var elementsThatCouldContainText = ['g', 'clipPath', 'marker', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'symbol'];

  if(node.type == 'comment') {
    result = false;
  }
  else if(_(elementsThatDontContainText).include(node.name)) {
    result = false;
  }
  else if(_(elementsThatCouldContainText).include(node.name)) {
    result = false;
    if(!_(node.children).isUndefined() && node.children.length) {
      result = _(node.children).any(mayContainTextNode);
    }
  }

  return result;

}

// returns a float without the unit
function styleValue(string) {
  return parseFloat(string.replace(/[^-\d\.]/g, ''));
}

// removes properties, by a given list of keys
function removeStyleProperties(styles, properties) {
  _(styles).each(function(value, key) {
    if(_(properties).include(key)) {
      delete styles[key]
    }
  });
  return styles;
}

// a simple CSS parser, returns object with {property: value}
function parseStyles(inlineStyles) {
  var styles = {};

  if(_.isUndefined(inlineStyles)) {
    return styles;
  }
  var styleRules = inlineStyles.split(';');
  _(styleRules).each(function(style) {
    var keyValue = style.split(':');
    if(keyValue.length == 2) {
      styles[keyValue[0].replace(/[\s]/g, '')] = keyValue[1];
    }
  });
  return styles;
}

function renderStyles(styles) {
  // 
  if(!_(styles).size()) {
    return '';
  }

  var inlineStyles = '';
  _.each(styles, function(property, value) {
    inlineStyles += value + ':' + property + ';';
  });
  return inlineStyles;
}

function repairStyles() {
  $('*').each(function(ix, node) {
    repairStyle($(node));
  });
}

function repairStyle(node) {

  var $node = node;

  var styles = parseStyles($node.attr('style'));

  if(!_(styles).size()) {
    return;
  }

  // scour:
  // > I've seen this enough to know that I need to correct it:
  // > `fill: url(#linearGradient4918) rgb(0, 0, 0);`
  _.each(['fill', 'stroke'], function(property) {
    if(!_(styles).has(property)) {
      return;
    }
    var chunk = styles[property].split(') ');
    if (chunk.length == 2 && chunk[0].substr(0, 5) == 'url(#' || chunk[0].substr(0, 6) == 'url("#' || chunk[0].substr(0, 6) == "url('#" && chunk[1] == 'rgb(0, 0, 0)') {
      styles[property] = chunk[0] + ')'
    }
  });

  var STYLE_PROPERTIES = [];
  STYLE_PROPERTIES['stroke'] = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-opacity', 'stroke-miterlimit', 'stroke-linecap', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity'];
  STYLE_PROPERTIES['fill'] = ['fill', 'fill-opacity', 'fill-rule'];
  STYLE_PROPERTIES['text'] = [ 'font-family', 'font-size', 'font-stretch', 'font-size-adjust', 'font-style', 'font-variant', 'font-weight', 'letter-spacing', 'line-height', 'kerning', 'text-align', 'text-anchor', 'text-decoration', 'text-rendering', 'unicode-bidi', 'word-spacing', 'writing-mode'];

  var VENDOR_PREFIXES = ['-inkscape'];

  var SVG_ATTRIBUTES = ['clip-rule', 'display', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'font-family', 'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight', 'line-height', 'marker', 'marker-end', 'marker-mid', 'marker-start', 'opacity', 'overflow', 'stop-color', 'stop-opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'visibility'];

  if(_(styles).has('opacity')) {
    var opacity = parseFloat(styles['opacity']);
    if(opacity != 0.0) {
      return;
    }
    // if opacity='0' then all fill and stroke properties are useless, remove them
    styles = removeStyleProperties(styles, _.union(STYLE_PROPERTIES['stroke'], STYLE_PROPERTIES['fill']));

  }
  
  // if stroke:none, then remove all stroke-related properties (stroke-width, etc)
  if(_(styles).has('stroke') && styles['stroke'] == 'none') {
    _(STYLE_PROPERTIES['stroke']).without('stroke');
    styles = removeStyleProperties(styles, _(STYLE_PROPERTIES['stroke']).without('stroke'));
  }

  // if fill:none, then remove all fill-related properties (fill-rule, etc)
  if(_(styles).has('fill') && styles['fill'] == 'none') {
    styles = removeStyleProperties(styles, _(STYLE_PROPERTIES['fill']).without('fill'));
  }

  if(_(styles).has('fill-opacity') && parseFloat(styles['fill-opacity']) == 0.0) {
    styles = removeStyleProperties(styles, _(STYLE_PROPERTIES['fill']).without('fill-opacity'));
  }

  if(_(styles).has('stroke-opacity') && parseFloat(styles['stroke-opacity']) == 0.0) {
    styles = removeStyleProperties(styles, _(STYLE_PROPERTIES['stroke']).without('stroke-opacity'));
  }

  if(_(styles).has('stroke-width') && styleValue(styles['stroke-width']) == 0.0) {
    styles = removeStyleProperties(styles, _(STYLE_PROPERTIES['stroke']).without('stroke-width'));
  }

  // scour:
  // > remove font properties for non-text elements
  // > I've actually observed this in real SVG content

  // removes all text styles, if node does not contain text
  if(!mayContainTextNode(node[0])) {
    styles = removeStyleProperties(styles, STYLE_PROPERTIES['text']);
  }

  // changed: removed style properties with a vendor prefix, like
  // `-inkscape-font-specification`
  var stylesWithVendorPrefixes = _(styles).keys().filter(function(key) {
    return _(VENDOR_PREFIXES).any(function(prefix) {
      return (key.indexOf(prefix) == 0);
    });
  });
  styles = removeStyleProperties(styles, stylesWithVendorPrefixes);

  // @missing: scour also cleans overflow property
  //
  // scour:
  // > overflow specified on element other than svg, marker, pattern
  // > it is a marker, pattern or svg
  // > as long as this node is not the document <svg>, then only
  // > remove overflow='hidden'.  See 
  // > http://www.w3.org/TR/2010/WD-SVG11-20100622/masking.html#OverflowProperty

  // scour:
  // > now if any of the properties match known SVG attributes we prefer attributes 
  // > over style so emit them and remove them from the style map
  if(options.styleToAttributes) {
    _(styles).each(function(value, key) {
      if(!_(SVG_ATTRIBUTES).include(key)) {
        return;
      }
      $(node).attr(key, value);
      delete styles[key];
    });
  }
  $node.attr('style', renderStyles(styles));

}

// ----------- ----------- ----------- ----------- ----------- -----------

// Interface
// --

var defaultOptions = {
  styleToAttributes: true
}
var options = {};

// scour:
// > this is the main method
// > input is a string representation of the input XML
// > returns a string representation of the output XML

// Main processing steps are implemented in SVGCleaner.prototype.clean()

// This method is to provide a simple interface so one could call
// `var cleanedSvgString = require('svg-cleaner').clean(svgString, options)`

function clean(svgString, options) {
  var aSVGCleaner = new SVGCleaner(options);
  aSVGCleaner.load(svgString);
  return aSVGCleaner.clean().svgString();
}
module.exports.clean = clean;

// simple interface
// `var cleanedSvgString = require('svg-cleaner').cleanFile(srcFilename, targetFilename, options)`

function cleanFileSync(srcFilename, targetFilename, options) {

  return new SVGCleaner(options)
    .readFileSync(srcFilename)
    .writeFileSync(targetFilename)
    .svgString()
    ;

}
module.exports.cleanFile = cleanFileSync;

function SVGCleaner(_options) {
  _(options).extend(defaultOptions, _options);
  this.$ = cheerio;
  return this;
}
module.exports.createCleaner = SVGCleaner;

SVGCleaner.prototype.load = function(svgString) {
  this.$ = cheerio.load(svgString, { ignoreWhitespace: true, xmlMode: true });
  return this;
}

SVGCleaner.prototype.readFileSync = function(srcFilename) {
  return this.load(fs.readFileSync(srcFilename, 'utf-8'));
}

SVGCleaner.prototype.writeFileSync = function(targetFilename) {
  fs.writeFileSync(targetFilename, this.svgString(), 'utf-8');
  return this;
}

SVGCleaner.prototype.svgString = function() {
  return this.$.html();
}

// chainable interface, to perform specific processing steps on an svg object
// `var svgStringWithShortIDs = new require('svg-cleaner').SVGCleaner().load(svgString).shortenIDs().svgString();`
var exposed = {
  'shortenIDs': shortenIDs,
  'removeComments': removeComments,
  'repairStyles': repairStyles,
  'removeNSElements': removeNamespacedElements,
  'removeNSAttributes': removeNamespacedAttributes,
  'removeUnreferencedElements': removeUnreferencedElements,
  'removeEmptyContainers': removeEmptyContainers,
  'removeUnreferencedIDs': removeUnreferencedIDs
};

_(exposed).each(function(f, name) {
  SVGCleaner.prototype[name] = function() {
    $ = this.$;
    f.call();
    this.$ = $;
    return this;
  }
});

// ----------- ----------- ----------- ----------- ----------- -----------

// Processing Steps
// --
SVGCleaner.prototype.clean = function() {
  $ = this.$;
  removeNamespacedElements(namespacePrefixes);
  removeNamespacedAttributes(namespacePrefixes);

  // @missing remove the xmlns: declarations now

  // @missing ensure namespace for SVG is declared

  // @missing check for redundant SVG namespace declaration

  removeComments();

  // scour:
  // > repair style (remove unnecessary style properties and change them into XML attributes)
  repairStyles();

  // @missing convert colors to #RRGGBB format

  // @missing remove <metadata> if the user wants to

  // @missing scour:
  // > flattend defs elements into just one defs element
  // flattenDefs()

  // scour:
  // > remove unreferenced gradients/patterns outside of defs
  // > and most unreferenced elements inside of defs
  removeUnreferencedElements();

  // scour:
  // > remove empty defs, metadata, g
  // > NOTE: these elements will be removed if they just have whitespace-only text nodes
  removeEmptyContainers();

  removeUnreferencedIDs();

  // @missing:
  // removeDuplicateGradientStops();

  // @missing scour:
  // > remove gradients that are only referenced by one other gradient
  // collapseSinglyReferencedGradients();

  // @missing scour:
  // > remove duplicate gradients
  // removeDuplicateGradients(doc)

  // @missing scour: 
  // > create `<g>` elements if there are runs of elements with the same attributes.
  // > this MUST be before moveCommonAttributesToParentGroup.
  // createGroupsForCommonAttributes()

  // @missing scour:
  // > move common attributes to parent group
  // > NOTE: the if the <svg> element's immediate children
  // > all have the same value for an attribute, it must not
  // > get moved to the <svg> element. The <svg> element
  // > doesn't accept fill=, stroke= etc.!

  // @missing scour:
  // > remove unused attributes from parent

  // @missing scour:
  // > Collapse groups LAST, because we've created groups. If done before
  // > moveAttributesToParentGroup, empty `<g>`'s may remain.

  // @missing scour:
  // > remove unnecessary closing point of polygons and scour points

  // @missing scour:
  // > scour points of polyline

  // @missing scour:
  // > clean path data

  // scour:
  // > shorten ID names as much as possible
  shortenIDs();

  // @missing scour:
  // > scour lengths (including coordinates)
  
  // @missing scour:
  // > more length scouring in this function
  // numBytesSavedInLengths = reducePrecision(doc.documentElement)
  
  // @missing scour:
  // > remove default values of attributes
  // numAttrsRemoved += removeDefaultAttributeValues(doc.documentElement, options) 
  
  // @missing scour:
  // > reduce the length of transformation attributes
  // numBytesSavedInTransforms = optimizeTransforms(doc.documentElement, options)
  
  // @missing scour:
  // > convert rasters references to base64-encoded strings

  // @missing scour:
  // properly size the SVG document (ideally width/height should be 100% with a viewBox)

  this.$ = $;
  return this;
}