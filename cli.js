#!/usr/bin/env node

/* eslint-disable n/no-process-exit */

const extract = require('./')

const args = process.argv.slice(2)
const source = args[0]
const dest = args[1] || process.cwd()
if (!source) {
  console.error('Usage: extract-zip foo.zip <targetDirectory>')
  process.exit(1)
}

extract(source, { dir: dest })
  .catch(function (err) {
    console.error('error!', err)
    process.exit(1)
  })
