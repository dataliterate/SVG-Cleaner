var _ = require('underscore')
  , fs = require('fs')
  , cheerio = require('cheerio')
  , $
  , root
  ;

// Setup
// ----------

// Namespace Prefixes that should be removed
var namespacePrefixes = ['dc', 'rdf', 'sodipodi', 'cc', 'inkscape'];

// Style-Properties and Element-Attributes that might contain an id, a reference to another object
var referencingProperties = ['fill', 'stroke', 'filter', 'clip-path', 'mask',  'marker-start', 'marker-end', 'marker-mid'];

function findElementsWithIdAttribute() {
  return $('*[id]');
}


function findReferencedElements() {

  var referenced = _($('*')).filter(function(node) {
    var $node = $(node);
    console.log(node.name);

    // else if xlink:href is set, then grab the id
    var href = $node.attr('xlink:href');
    if(href) {
      return true;
    }

    // now get all style properties
    var inlineStyle = $node.attr('style');
    var styles = [];

    if(!_.isUndefined(inlineStyle)) {
      var styleRules = inlineStyle.split(';');
      _(styleRules).each(function(style) {
        var keyValue = style.split(':');
        if(keyValue.length == 2) {
          styles.push(style.split(':'));
        }
      });
    }
    _(referencingProperties).each(function(referencingProperty) {
      var value = $node.attr(referencingProperty);
      if(!_.isUndefined(value)) {
        styles.push([referencingProperty, $node.attr(referencingProperty)]);
      }
    });

    _(styles).each(function(style) {
      if(style[1].indexOf('url') !== -1) {
        return true;
      }
    });

    return false;
  });

  return referenced;
}

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
var i = 0;
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

  // I've seen this enough to know that I need to correct it:
  // fill: url(#linearGradient4918) rgb(0, 0, 0);
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

  // remove all text styles, if node does not contain text
  if(!mayContainTextNode(node[0])) {
    styles = removeStyleProperties(styles, STYLE_PROPERTIES['text']);
  }

  // remove style with vendor prefixes
  var stylesWithVendorPrefixes = _(styles).keys().filter(function(key) {
    return _(VENDOR_PREFIXES).any(function(prefix) {
      return (key.indexOf(prefix) == 0);
    });
  });
  styles = removeStyleProperties(styles, stylesWithVendorPrefixes);

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

function styleValue(string) {
  return parseFloat(string.replace(/[^-\d\.]/g, ''));
}

function removeStyleProperties(styles, properties) {
  _(styles).each(function(value, key) {
    if(_(properties).include(key)) {
      delete styles[key]
    }
  });
  return styles;
}

function parseStyles(inlineStyles) {
  // now get all style properties

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


var options = {
  styleToAttributes: true
}

// INTERFACE
function clean(svgString, options) {
  
  var aSVGCleaner = new SVGCleaner(options);
  aSVGCleaner.load(svgString);
  aSVGCleaner.clean();
  return aSVGCleaner.svg;

}

function cleanFile(filename, options) {
  return clean(fs.readFileSync(filename, 'utf-8'));
}

var defaultOptions = {
  styleToAttributes: true
}
var options = {};

function SVGCleaner(_options) {
  _(options).extend(defaultOptions, _options);
  return this;
}

SVGCleaner.prototype.load = function(svgString) {
  this.$ = cheerio.load(svgString, { ignoreWhitespace: true, xmlMode: true });
  this.svg = this.$.html();
}

SVGCleaner.prototype.clean = function() {
  $ = this.$;
  removeNamespacedElements(namespacePrefixes);
  removeNamespacedAttributes(namespacePrefixes);
  removeComments();
  repairStyles();
  this.$ = $;
  this.svg = $.html();
}

//cleanFile('test/files/simple.svg');
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="fill:#000000;" /> \
                </svg>';
console.log(clean(svg));

module.exports = {
    clean: clean // Static
  , cleanFile: cleanFile // Static
  , SVGCleaner: SVGCleaner
}

