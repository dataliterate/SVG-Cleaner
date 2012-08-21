test:
	@./node_modules/mocha/bin/mocha --reporter dot test/test.js

visualtest:
	@./node_modules/mocha/bin/mocha --reporter dot test/visual.js

.PHONY: test