var extract = require('../')
var fs = require('fs')
var os = require('os')
var path = require('path')
var rimraf = require('rimraf')
var temp = require('temp').track()
var test = require('tape')

var catsZip = path.join(__dirname, 'cats.zip')
var githubZip = path.join(__dirname, 'github.zip')
var subdirZip = path.join(__dirname, 'file-in-subdir-without-subdir-entry.zip')
var symlinkDestZip = path.join(__dirname, 'symlink-dest.zip')
var symlinkZip = path.join(__dirname, 'symlink.zip')

var relativeTarget = './cats'

function mkdtemp (t, suffix, callback) {
  temp.mkdir({prefix: 'extract-zip', suffix: suffix}, function (err, dirPath) {
    t.notOk(err, 'no error when creating temporary directory')
    callback(dirPath)
  })
}

function tempExtract (t, suffix, zipPath, callback) {
  mkdtemp(t, suffix, function (dirPath) {
    extract(zipPath, {dir: dirPath}, function (err) {
      t.notOk(err, 'no error when extracting ' + zipPath)

      callback(dirPath)
    })
  })
}

function relativeExtract (callback) {
  rimraf.sync(relativeTarget)
  extract(catsZip, {dir: relativeTarget}, callback)
  rimraf.sync(relativeTarget)
}

test('files', function (t) {
  t.plan(3)

  tempExtract(t, 'files', catsZip, function (dirPath) {
    fs.exists(path.join(dirPath, 'cats', 'gJqEYBs.jpg'), function (exists) {
      t.ok(exists, 'file created')
    })
  })
})

test('symlinks', function (t) {
  t.plan(5)

  tempExtract(t, 'symlinks', catsZip, function (dirPath) {
    var symlink = path.join(dirPath, 'cats', 'orange_symlink')

    fs.exists(symlink, function (exists) {
      t.ok(exists, 'symlink created')
    })

    fs.lstat(symlink, function (err, stats) {
      t.same(err, null, 'symlink can be stat\'d')
      t.ok(stats.isSymbolicLink(), 'symlink is valid')
    })
  })
})

test('directories', function (t) {
  t.plan(8)

  tempExtract(t, 'directories', catsZip, function (dirPath) {
    var dirWithContent = path.join(dirPath, 'cats', 'orange')
    var dirWithoutContent = path.join(dirPath, 'cats', 'empty')

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
})

test('verify github zip extraction worked', function (t) {
  t.plan(3)

  tempExtract(t, 'verify-extraction', githubZip, function (dirPath) {
    fs.exists(path.join(dirPath, 'extract-zip-master', 'test'), function (exists) {
      t.ok(exists, 'folder created')
    })
  })
})

test('callback called once', function (t) {
  t.plan(4)

  tempExtract(t, 'callback', symlinkZip, function (dirPath) {
    // this triggers an error due to symlink creation
    extract(symlinkZip, {dir: dirPath}, function (err) {
      if (err) t.ok(true, 'error passed')

      t.ok(true, 'callback called')
    })
  })
})

test('relative target directory', function (t) {
  t.plan(2)

  relativeExtract(function (err) {
    t.true(err instanceof Error, 'is native V8 error')
    t.same(err.message, 'Target directory is expected to be absolute', 'has descriptive error message')
  })
})

test('no folder created', function (t) {
  t.plan(2)

  relativeExtract(function (err) {
    t.true(err instanceof Error, 'is native V8 error')
    t.false(fs.existsSync(path.join(__dirname, relativeTarget)), 'file not created')
  })
})

test('symlink destination disallowed', function (t) {
  t.plan(4)

  mkdtemp(t, 'symlink-destination-disallowed', function (dirPath) {
    fs.exists(path.join(dirPath, 'file.txt'), function (exists) {
      t.false(exists, 'file doesn\'t exist at symlink target')

      extract(symlinkDestZip, {dir: dirPath}, function (err) {
        var canonicalTmp = fs.realpathSync(os.tmpdir())

        t.true(err instanceof Error, 'is native V8 error')

        if (err) {
          t.same(err.message, 'Out of bound path "' + canonicalTmp + '" found while processing file symlink-dest/aaa/file.txt', 'has descriptive error message')
        }
      })
    })
  })
})

test('no file created out of bound', function (t) {
  t.plan(7)

  mkdtemp(t, 'out-of-bounds-file', function (dirPath) {
    extract(symlinkDestZip, {dir: dirPath}, function (err) {
      var symlinkDestDir = path.join(dirPath, 'symlink-dest')

      t.true(err instanceof Error, 'is native V8 error')

      fs.exists(symlinkDestDir, function (exists) {
        t.true(exists, 'target folder created')
      })

      fs.exists(path.join(symlinkDestDir, 'aaa'), function (exists) {
        t.true(exists, 'symlink created')
      })

      fs.exists(path.join(symlinkDestDir, 'ccc'), function (exists) {
        t.true(exists, 'parent folder created')
      })

      fs.exists(path.join(symlinkDestDir, 'ccc/file.txt'), function (exists) {
        t.false(exists, 'file not created in original folder')
      })

      fs.exists(path.join(dirPath, 'file.txt'), function (exists) {
        t.false(exists, 'file not created in symlink target')
      })
    })
  })
})

test('files in subdirs where the subdir does not have its own entry is extracted', function (t) {
  t.plan(3)

  tempExtract(t, 'subdir-file', subdirZip, function (dirPath) {
    fs.exists(path.join(dirPath, 'foo', 'bar'), function (exists) {
      t.ok(exists, 'file created')
    })
  })
})
