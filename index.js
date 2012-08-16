// SVG Cleaner
// ----------

// Cleaning SVG Files - A port of Scour to JavaScript

// About the port
// --

// The goal of the Scour port was to keep the ideas and way how Scour cleans SVG files.
// I translated most of the processing steps and copied most of the original comments
// from scour into the new source code, as they describe the original ideas best.
// I marked all of these orginial comments by putting 'Scour:' in the first line an
// used the markdown syntax for quotes (>). 

// - Missing processing steps are marked with an comment '@missing'.
// - Changed processing steps are marked with an comment containern '@extened' or '@changed'
// - Some functions and variable names are changed to (hopefully) be more descriptive.

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

function addReferencingElement(ids, id, node) {
  var id = id.replace(/#/g, '');
  if(!_(ids).has(id)) {
    ids[id] = [];
  }

  ids[id].push(node);
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
    console.log(node.name);

    if(node.name == 'style') {
      var styles = CSSOM.parse($node.text());
      _(styles.cssRules).each(function(rule) {
        _(referencingProperties).each(function(referencingProperty) {
          if(_(rule.style).has(referencingProperty)) {
            var id = extractReferencedId(rule.style[referencingProperty]);
            if(id) {
              addReferencingElement(ids, id, node);
            }
          }
        });
      });
      return;
    }

    // if xlink:href is set, then grab the id
    var href = $node.attr('xlink:href');
    if(href) {
      addReferencingElement(ids, href, node);
    }

    // now get all style properties
    var styles = parseStyles($node.attr('style'));

    _(referencingProperties).each(function(referencingProperty) {
      var value = $node.attr(referencingProperty);
      if(!_.isUndefined(value)) {
        var id = extractReferencedId(value);
        if(id) {
          addReferencingElement(ids, id, node);
        }
      }
      if(_(styles).has(referencingProperty)) {
        var id = extractReferencedId(styles[referencingProperty]);
        if(id) {
          addReferencingElement(ids, id, node);
        }
      }
    });

  });

  console.log(ids);
  return ids;
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
// `require('scv-clenaer').clean(svg, )`

function clean(svgString, options) {
  var aSVGCleaner = new SVGCleaner(options);
  aSVGCleaner.load(svgString);
  return aSVGCleaner.clean();
}
module.exports.clean = clean;

function cleanFile(filename, options) {
  return clean(fs.readFileSync(filename, 'utf-8'));
}
module.exports.cleanFile = cleanFile;

function SVGCleaner(_options) {
  _(options).extend(defaultOptions, _options);
  return this;
}
module.exports.SVGCleaner = SVGCleaner;

SVGCleaner.prototype.load = function(svgString) {
  this.$ = cheerio.load(svgString, { ignoreWhitespace: true, xmlMode: true });
  this.svg = this.$.html();
}

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

  // scour:
  // > remove unreferenced gradients/patterns outside of defs
  // > and most unreferenced elements inside of defs
  removeUnreferencedElements();

  // scour:
  // > emove empty defs, metadata, g
  // > NOTE: these elements will be removed if they just have whitespace-only text nodes

  // @extended: also removes nested empty elements <defs><g></g></defs>
  var elementWasRemoved = true;
  do {
    elementWasRemoved = false;
    _($('defs, metadata, g')).each(function(node) {
      console.log(node.children);
      if(!node.children.length) {
        $(node).remove();
        elementWasRemoved = true;
      }
    });
  } while(elementWasRemoved);

  removeUnreferencedIDs();

  this.$ = $;
  this.svg = $.html();
  return this.svg;
}

//cleanFile('test/files/simple.svg');
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <metadata></metadata> \
                  <defs><g id="empty"></g><font></font></defs> \
                  <g fill="url(#g)"></g> \
                  <g>    </g> \
                  <g><!-- comment --></g> \
                </svg>';
console.log(clean(svg));
