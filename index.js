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

function removeComments() {

  // process on NODE level
  function searchAndRemoveComment(root) {
    _.each(root.children, function(node) {
      if(node.type == 'comment') {
        $(node).remove();
      }
      if(node.type == 'tag') {
        // walk the NODE tree
        _.each(node.children, searchAndRemoveComment);
      }
    });
  }
  searchAndRemoveComment($._root);
}

function clean(svgString, options) {
  
  //root = cheerio(svgString);
  $ = cheerio.load(svgString);

  removeNamespacedElements(namespacePrefixes);
  removeNamespacedAttributes(namespacePrefixes);
  removeComments();
  //var referenced = findReferencedElements();


  //console.log(findElementsWithIdAttribute().size());
  //console.log(referenced.length);
  var svg = $.html(); //.html();
  console.log(svg);
  return svg;
}

function cleanFile(filename, options) {
  return clean(fs.readFileSync(filename, 'utf-8'));
}

//cleanFile('stack.svg');

module.exports = {
    clean: clean
  , cleanFile: cleanFile
}

