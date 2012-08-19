var _ = require('underscore')
  , fs = require('fs')
  , path = require('path')
  , child = require('child_process')
  , crypto = require('crypto')
  , expect = require('expect.js')
  , SVGCleaner = require('../')
  ;

function rasterizeWithPhantom(srcFilename, targetFilename, cb) {
	var ps = child.spawn('phantomjs', ['./test/rasterize.js', 'file://' + path.resolve(srcFilename), targetFilename]);
	ps.stdout.on('data', function(data) {
      console.log("phantom stdout: " + data);
    });
    ps.stderr.on('data', function(data) {
      console.warn("phantom stderr: " + data);
    });
    ps.on('exit', function() {
    	cb();
    });
}

function getMD5Sum(filename, cb) {
	var md5sum = crypto.createHash('md5');
	var s = fs.ReadStream(filename);
	s.on('data', function(d) {
  		md5sum.update(d);
	});
	s.on('end', function() {
  		var d = md5sum.digest('hex');
  		cb(d);
	});
}

function cleanRasterCompareSvgFile(svgBeforeCleanFilename, done) {

	var svgAfterCleanFilename = svgBeforeCleanFilename + '.cleaned.svg';
	var rasterBeforeCleanFilename = svgBeforeCleanFilename + '.rastered.png';
	var rasterAfterCleanFilename = svgAfterCleanFilename +  '.rastered.png';

	SVGCleaner.cleanFile(svgBeforeCleanFilename, svgAfterCleanFilename);

	function cleanup() {
		return;
		fs.unlinkSync(svgAfterCleanFilename);
		fs.unlinkSync(rasterBeforeCleanFilename);
		fs.unlinkSync(rasterAfterCleanFilename);
	}

	var whenBothRastered = _.after(2, function() {

	  	// read both files and compare them
	  	getMD5Sum(rasterBeforeCleanFilename, function(hashBeforeClean) {
	  		getMD5Sum(rasterAfterCleanFilename, function(hashAfterClean) {
	  			cleanup();
	  			if(hashBeforeClean == hashAfterClean) {
	  				done();
	  			} else {
	  				done(new Error(
	  					svgBeforeCleanFilename + ":\n"
	  					+ "Cleaned and rastered version does not equel original and rastered version \n"
	  					 + rasterBeforeCleanFilename + ' != ' + rasterAfterCleanFilename));
	  			}
	  		});
	  	});
	  });

	  rasterizeWithPhantom(svgBeforeCleanFilename, rasterBeforeCleanFilename, whenBothRastered);
	  rasterizeWithPhantom(svgAfterCleanFilename, rasterAfterCleanFilename, whenBothRastered);

}
 describe('SVGCleaner Visual Results', function() {

	it('should be the same before and after clean', function(done) {

		var files = [
			'acid'
			, 'adobe'
			, 'cascading-default-attribute-removal'
			//, 'cdata'
			, 'color-formats'
			, 'comments'
			, 'fill-none'
		];
		var allDone = _.after(files.length, function() {
			done();
		});
		var i = 0;
		function nextFile() {
			cleanRasterCompareSvgFile('./test/files/' + files[i] + '.svg', function(err) {
				if(err) throw err;
				allDone();
				i++;
				if(i < files.length) {
					nextFile();
				}
			});
		}
		nextFile();
	});
});