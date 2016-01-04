var os = require('os')
var path = require('path')
var rimraf = require('rimraf')
var test = require('tape')
var fs = require('fs')
var extract = require('../')

var sourceA = path.join(__dirname, 'cats.zip')
var targetA = path.join(os.tmpdir(), 'cat-extract-test')
var resultsA = path.join(targetA, 'cats')

var sourceB = path.join(__dirname, 'github.zip')
var targetB = os.tmpdir()
var resultsB = path.join(targetB, 'extract-zip-master')

var sourceC = path.join(__dirname, 'symlink.zip')
var targetC = os.tmpdir()

test('extract cat zip', function (t) {
  rimraf.sync(targetA)

  console.log('extracting to', targetA)

  extract(sourceA, {dir: targetA}, function (err) {
    if (err) throw err
    t.false(err, 'no error')
    t.end()
  })
})

test('files', function (t) {
  t.plan(1)

  fs.exists(path.join(resultsA, 'gJqEYBs.jpg'), function (exists) {
    t.ok(exists, 'file created')
  })
})

test('symlinks', function (t) {
  var symlink = path.join(resultsA, 'orange_symlink')

  t.plan(3)

  fs.exists(symlink, function (exists) {
    t.ok(exists, 'symlink created')
  })

  fs.lstat(symlink, function (err, stats) {
    t.same(err, null, 'symlink can be stat\'d')
    t.ok(stats.isSymbolicLink(), 'symlink is valid')
  })
})

test('directories', function (t) {
  var dirWithContent = path.join(resultsA, 'orange')
  var dirWithoutContent = path.join(resultsA, 'empty')

  t.plan(6)

  fs.exists(dirWithContent, function (exists) {
    t.ok(exists, 'directory created')
  })

  fs.readdir(dirWithContent, function (err, files) {
    t.same(err, null, 'directory can be read')
    t.ok(files.length > 0, 'directory has files')
  })

  fs.exists(dirWithoutContent, function (exists) {
    t.ok(exists, 'empty directory created')
  })

  fs.readdir(dirWithoutContent, function (err, files) {
    t.same(err, null, 'empty directory can be read')
    t.ok(files.length === 0, 'empty directory has no files')
  })
})

test('extract github zip', function (t) {
  rimraf.sync(targetB)

  console.log('extracting to', targetB)

  extract(sourceB, {dir: targetB}, function (err) {
    if (err) throw err
    t.false(err, 'no error')
    t.end()
  })
})

test('verify extraction worked', function (t) {
  fs.exists(path.join(resultsB, 'test'), function (exists) {
    t.ok(exists, 'folder created')
    t.end()
  })
})

test('callback called once', function (t) {
  rimraf.sync(targetC)

  t.plan(2)

  console.log('extracting to', targetC)

  extract(sourceC, {dir: targetC}, function (err) {
    if (err) throw err

    // this triggers an error due to symlink creation
    extract(sourceC, {dir: targetC}, function (err) {
      if (err) t.ok(true, 'error passed')

      t.ok(true, 'callback called')
    })
  })
})
