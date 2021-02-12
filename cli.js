#!/usr/bin/env node

/* eslint-disable no-process-exit */

var extract = require('./')

var args = process.argv.slice(2)
var source = args[0]
var dest = args[1] || process.cwd()
var encodingReg = /^--encoding=*/
var encodingIndex = args.findIndex(entry => encodingReg.test(entry))
var encoding
if (encodingIndex !== -1) {
  encoding = args.splice(encodingIndex, 1)[0].replace(encodingReg, '')
}
if (!source) {
  console.error('Usage: extract-zip foo.zip <targetDirectory> [--encoding=<encoding>]')
  process.exit(1)
}

extract(source, { dir: dest, encoding })
  .catch(function (err) {
    console.error('error!', err)
    process.exit(1)
  })
