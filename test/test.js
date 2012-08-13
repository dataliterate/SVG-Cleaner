var _ = require('underscore')
  , fs = require('fs')
  , expect = require('expect.js')
  , cheerio = require('cheerio')
  , SVGCleaner = require('../')
  ;

describe('SVGCleaner', function() {

  var simpleSvg = fs.readFileSync('test/files/simple.svg', 'utf-8');
  
  before(function() {

  });

  describe('Removal of Namespaced Elements', function() {

    it('should be tested against a file that contains a namespaced element', function() {
      expect(cheerio(simpleSvg).find('#base')[0].name).to.eql('sodipodi:namedview');
    });

    it('should remove namespace elements', function() {
      var cleanedSVG = SVGCleaner.clean(simpleSvg);
      expect(cheerio(cleanedSVG).find('sodipodi:namedview')).to.have.length(0);
    });

  });

  describe('Removal of namespaced Attributes', function() {

    it('should be tested against a file that contains a namespaced attributes', function() {
      expect(cheerio(simpleSvg).find('[inkscape:label]').length).to.be.above(0);
    });

    it('should remove namespace attributes', function() {
      var cleanedSVG = SVGCleaner.clean(simpleSvg);
      console.log(cleanedSVG);
      expect(cheerio(cleanedSVG).find('[inkscape:label]')).to.have.length(0);
    });
  });

  describe('Removal of comments', function() {

    function containsComment(node) {
      var hasComment = false;
      _.each(node.children, function(node) {
        hasComment = hasComment || (node.type == 'comment');
        if(node.type == 'tag') {
          // walk the NODE tree
          _.each(node.children, function(child) {
            hasComment = hasComment || containsComment(child);
          });
        }
      });
      return hasComment;
    }

    it('should be tested against a file that contains a comment', function() {
      expect(containsComment(cheerio.load(simpleSvg)._root)).to.be(true);
    });

    it('should remove all comments', function() {
      var cleanedSVG = SVGCleaner.clean(simpleSvg);
      expect(containsComment(cheerio.load(cleanedSVG)._root)).to.be(false);
    });

  });
});