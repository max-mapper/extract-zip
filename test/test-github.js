var os = require('os')
var path = require('path')
var rimraf = require('rimraf')
var test = require('tape')
var fs = require('fs')
var extract = require('../')

var source = path.join(__dirname, 'github.zip')
var target = os.tmpdir()
var results = path.join(target, 'extract-zip-master')

rimraf.sync(target)

console.log('extracting to', target)

extract(source, {dir: target}, function (err) {
  if (err) throw err

  test('files', function (t) {
    t.plan(1)

    fs.exists(path.join(results, 'test'), function (exists) {
      t.ok(exists, 'folder created')
    })
  })
})
