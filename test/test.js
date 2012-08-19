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
      expect(cheerio(cleanedSVG).find('[inkscape:label]')).to.have.length(0);
    });
  });

  describe('Removal of comments', function() {

    it('should remove all comments', function() {

      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><!-- comment --><svg> \
                  <!-- comment --> \
                  <g style="font-family: Arial;"> \
                    <!-- comment --> \
                  </g> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cleanedSVG).not.to.match(/<!-- comment -->/);
    });

  });

  describe('Style Repair', function() {

    it('should fix remove color definition when fill or stroke refrences an url', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="fill:url(#test) rgb(0,0,0); stroke:url(#test) rgb(0,0,0);" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.equal('fill:url(#test);stroke:url(#test);');
    });

    it('should remove stroke- and fill-styles, when opacity is 0', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="opacity:0;fill:#0000ff;fill-rule:evenodd;stroke:#000000;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.equal('opacity:0;');
    });

    it('should remove stroke- and fill-styles, when stroke or fill is none', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="fill:none;fill-rule:evenodd;stroke:none;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.equal('fill:none;stroke:none;');
    });

    it('should remove stroke- and fill-styles, when stroke- or fill-opacity is 0', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg>\
                    <rect style="fill:#000000;fill-rule:evenodd;fill-opacity:0;stroke:#000000;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:0" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.equal('fill-opacity:0;stroke-opacity:0;');
    });

    it('should remove stroke-styles, when stroke-with is 0', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="stroke:#000000;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;stroke-width:0" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.equal('stroke-width:0;');
    });

    it('should remove text-styles, if element does not contain text', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="font-family:Arial;font-style:bold" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.be(undefined);
    });

    it('should keep text-styles, if element could contain text', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <g style="font-family: Arial;"> \
                    <text>Hello World</text> \
                    <rect width="10" height="10" /> \
                  </g> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('g').attr("style")).to.equal('font-family: Arial;');
    });

    it('should remove styles with vendor prefix', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="-inkscape-font-specification:tbd;" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.be(undefined);
    });

    it('should convert styles to attributes', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                    <rect style="fill:#000000;" /> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('rect').attr("style")).to.be(undefined);
      expect(cheerio.load(cleanedSVG)('rect').attr("fill")).to.equal('#000000');
    });

  });

  describe('Removal of unreferenced elements', function() {

    it('should keep elements that are referenced in style tags', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <style>#r {fill: url(\'#p\');}</style> \
                  <defs><pattern id="p"><rect width="10" height="10" fill="#000000" /></pattern></defs>\
                  <rect id="r" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('pattern').length).to.be.above(0);
    });

    it('should keep elements that are referenced in elements fill attribute', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><pattern id="p"><rect width="10" height="10" fill="#000000" /></pattern></defs>\
                  <rect id="r" fill="url(#p)" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('pattern').length).to.be.above(0);
    });

    it('should remove elements that are not referenced', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><pattern id="p"><rect width="10" height="10" fill="#000000" /></pattern></defs>\
                  <rect id="r" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('pattern')).to.have.length(0);
    });

    it('should keep font definitions', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><font id="not-referenced"></font></defs>\
                  <rect id="r" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);

      expect(cheerio.load(cleanedSVG)('font').length).to.be.above(0);
    });

    it('should keep referenced child elements in groups that are not referenced', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><g id="not-referenced"><pattern id="referenced"><rect width="10" height="10" fill="#000000" /></pattern></g></defs>\
                  <rect id="r" fill="url(#referenced)" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('pattern').length).to.be.above(0);
    });

  });

  describe('Removal of empty elements', function() {

    it('should remove empty groups, defs and metadata', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <metadata></metadata> \
                  <defs id="nested"><g id="empty"></g></defs> \
                  <g></g> \
                  <g>    </g> \
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('g, defs, metadata')).to.have.length(0);
    });

  });

  describe('Removal of unused attributes', function() {

    it('should remove ids that are not referenced', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><g id="not-referenced"><pattern id="referenced"><rect width="10" height="10" fill="#000000" /></pattern></g></defs>\
                  <rect id="r" fill="url(#referenced)" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('g').attr('id')).to.be(undefined);
    });

  });

  describe('Shortening of id', function() {

    it('should shorten ids', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><pattern id="referenced"><rect width="10" height="10" fill="#000000" /></pattern></defs>\
                  <rect id="r" fill="url(#referenced)" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('pattern').attr('id')).to.be('a');
    });
    it('should change values of referencing attributes', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><pattern id="referenced"><circle fill="#000000" /></pattern></defs>\
                  <rect id="r" fill="url(#referenced)" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg);
      expect(cheerio.load(cleanedSVG)('rect').attr('fill')).to.be('url(#a)');
    });
    it('should change values of referencing inline styles', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <defs><pattern id="referenced"><circle fill="#000000" /></pattern> \
                  <pattern id="referenced-twice"><circle fill="#000000" /></pattern></defs>\
                  <rect id="r" style="fill:url(#referenced-twice); stroke:url(#referenced)" width="100" height="100" />\
                  <path style="fill:url(#referenced-twice);" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('rect').attr('style')).to.be('fill:url(#a);stroke:url(#b);');
    });
    it('should change values style tags', function() {
      var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg> \
                  <style>#r{fill:url("#referenced");}</style> \
                  <defs><pattern id="referenced"><circle fill="#000000" /></pattern></defs> \
                  <rect id="r" width="100" height="100" />\
                </svg>';
      var cleanedSVG = SVGCleaner.clean(svg, {styleToAttributes: false});
      expect(cheerio.load(cleanedSVG)('style').text()).to.be('#r{fill:url(#a);}');
    });

  });

});