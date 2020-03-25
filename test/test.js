const extract = require('../')
const fs = require('fs')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')
const test = require('tape')

const catsZip = path.join(__dirname, 'cats.zip')
const githubZip = path.join(__dirname, 'github.zip')
const subdirZip = path.join(__dirname, 'file-in-subdir-without-subdir-entry.zip')
const symlinkDestZip = path.join(__dirname, 'symlink-dest.zip')
const symlinkZip = path.join(__dirname, 'symlink.zip')
const brokenZip = path.join(__dirname, 'broken.zip')

const relativeTarget = './cats'

function mkdtemp (t, suffix, callback) {
  fs.mkdtemp(path.join(os.tmpdir(), `extract-zip-${suffix}`), function (err, dirPath) {
    t.notOk(err, 'no error when creating temporary directory')
    callback(dirPath)
  })
}

function tempExtract (t, suffix, zipPath, callback) {
  mkdtemp(t, suffix, function (dirPath) {
    extract(zipPath, { dir: dirPath }, function (err) {
      t.notOk(err, 'no error when extracting ' + zipPath)

      callback(dirPath)
    })
  })
}

function relativeExtract (callback) {
  rimraf.sync(relativeTarget)
  extract(catsZip, { dir: relativeTarget }, callback)
  rimraf.sync(relativeTarget)
}

function exists (t, pathToCheck, message) {
  const exists = fs.existsSync(pathToCheck)
  t.true(exists, message)
}

function doesntExist (t, pathToCheck, message) {
  const exists = fs.existsSync(pathToCheck)
  t.false(exists, message)
}

test('files', function (t) {
  t.plan(3)

  tempExtract(t, 'files', catsZip, function (dirPath) {
    exists(t, path.join(dirPath, 'cats', 'gJqEYBs.jpg'), 'file created')
  })
})

test('symlinks', function (t) {
  t.plan(7)

  tempExtract(t, 'symlinks', catsZip, function (dirPath) {
    const symlink = path.join(dirPath, 'cats', 'orange_symlink')

    exists(t, symlink, 'symlink created')

    fs.lstat(symlink, function (err, stats) {
      t.same(err, null, "symlink can be stat'd")
      t.ok(stats.isSymbolicLink(), 'symlink is valid')
      fs.readlink(symlink, function (err, linkString) {
        t.same(err, null, 'symlink itself can be read')
        t.equal(linkString, 'orange')
      })
    })
  })
})

test('directories', function (t) {
  t.plan(8)

  tempExtract(t, 'directories', catsZip, function (dirPath) {
    const dirWithContent = path.join(dirPath, 'cats', 'orange')
    const dirWithoutContent = path.join(dirPath, 'cats', 'empty')

    exists(t, dirWithContent, 'directory created')

    fs.readdir(dirWithContent, function (err, files) {
      t.same(err, null, 'directory can be read')
      t.ok(files.length > 0, 'directory has files')
    })

    exists(t, dirWithoutContent, 'empty directory created')

    fs.readdir(dirWithoutContent, function (err, files) {
      t.same(err, null, 'empty directory can be read')
      t.ok(files.length === 0, 'empty directory has no files')
    })
  })
})

test('verify github zip extraction worked', function (t) {
  t.plan(3)

  tempExtract(t, 'verify-extraction', githubZip, function (dirPath) {
    exists(t, path.join(dirPath, 'extract-zip-master', 'test'), 'folder created')
  })
})

test('opts.onEntry', function (t) {
  t.plan(3)

  mkdtemp(t, 'onEntry', function (dirPath) {
    const actualEntries = []
    const expectedEntries = [
      'symlink/',
      'symlink/foo.txt',
      'symlink/foo_symlink.txt'
    ]
    const onEntry = function (entry) {
      actualEntries.push(entry.fileName)
    }
    extract(symlinkZip, { dir: dirPath, onEntry }, function (err) {
      t.notOk(err)

      t.same(actualEntries, expectedEntries, 'entries should match')
    })
  })
})

test('callback called once', function (t) {
  t.plan(4)

  tempExtract(t, 'callback', symlinkZip, function (dirPath) {
    // this triggers an error due to symlink creation
    extract(symlinkZip, { dir: dirPath }, function (err) {
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
    doesntExist(t, path.join(__dirname, relativeTarget), 'file not created')
  })
})

if (process.platform !== 'win32') {
  test('symlink destination disallowed', function (t) {
    t.plan(4)

    mkdtemp(t, 'symlink-destination-disallowed', function (dirPath) {
      doesntExist(t, path.join(dirPath, 'file.txt'), "file doesn't exist at symlink target")

      extract(symlinkDestZip, { dir: dirPath }, function (err) {
        t.true(err instanceof Error, 'is native V8 error')

        if (err) {
          t.match(err.message, /Out of bound path ".*?" found while processing file symlink-dest\/aaa\/file.txt/, 'has descriptive error message')
        }
      })
    })
  })

  test('no file created out of bound', function (t) {
    t.plan(7)

    mkdtemp(t, 'out-of-bounds-file', function (dirPath) {
      extract(symlinkDestZip, { dir: dirPath }, function (err) {
        const symlinkDestDir = path.join(dirPath, 'symlink-dest')

        t.true(err instanceof Error, 'is native V8 error')

        exists(t, symlinkDestDir, 'target folder created')
        exists(t, path.join(symlinkDestDir, 'aaa'), 'symlink created')
        exists(t, path.join(symlinkDestDir, 'ccc'), 'parent folder created')
        doesntExist(t, path.join(symlinkDestDir, 'ccc/file.txt'), 'file not created in original folder')
        doesntExist(t, path.join(dirPath, 'file.txt'), 'file not created in symlink target')
      })
    })
  })
}

test('files in subdirs where the subdir does not have its own entry is extracted', function (t) {
  t.plan(3)

  tempExtract(t, 'subdir-file', subdirZip, function (dirPath) {
    exists(t, path.join(dirPath, 'foo', 'bar'), 'file created')
  })
})

test('extract broken zip', function (t) {
  t.plan(2)

  mkdtemp(t, 'broken-zip', function (dirPath) {
    extract(brokenZip, { dir: dirPath }, function (err) {
      t.ok(err, 'Error: invalid central directory file header signature: 0x2014b00')
    })
  })
})
