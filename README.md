SVG Stacker
===========

A tool for cleaning SVG Files - JavaScript port of Scour.

[http://codedread.com/scour/]()

I needed a library to work with SVG-Stacker, that could rename IDs and keep the
references inside the SVG document structure intact. SVG-Stacker merges different
svg files and needs to make sure that the ids from different files are unique in the
merged version. If found that Scour renames IDs to decrease the file size and keeps
track of referencing elements.

The goal of the port was to bring the power of Scour to the JavaScript world, make it
available as commandline tool and usable as module.

I tried to and keep the ideas and way how Scour cleans SVG files. I translated most of
the processing steps and copied most of the original comments from scour into the new
source code, as they describe the original ideas best. I marked all of these orginial
comments by putting 'Scour:' in the first line an used the markdown syntax for quotes (>). 

- Missing processing steps are marked with an comment '@missing'.
- Changed processing steps are marked with an comment containern '@extened' or '@changed'
- Some functions and variable names are changed to (hopefully) be more descriptive.

You'll find the annotated Source-Code in [docs/index.html]()