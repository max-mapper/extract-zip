const extract = require('../')
const fs = require('fs')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')
const test = require('ava')

const catsZip = path.join(__dirname, 'cats.zip')
const githubZip = path.join(__dirname, 'github.zip')
const subdirZip = path.join(__dirname, 'file-in-subdir-without-subdir-entry.zip')
const symlinkDestZip = path.join(__dirname, 'symlink-dest.zip')
const symlinkZip = path.join(__dirname, 'symlink.zip')
const brokenZip = path.join(__dirname, 'broken.zip')

const relativeTarget = './cats'

function mkdtemp (t, suffix, callback) {
  fs.mkdtemp(path.join(os.tmpdir(), `extract-zip-${suffix}`), function (err, dirPath) {
    t.falsy(err, 'no error when creating temporary directory')
    callback(dirPath)
  })
}

function tempExtract (t, suffix, zipPath, callback) {
  mkdtemp(t, suffix, function (dirPath) {
    extract(zipPath, { dir: dirPath }, function (err) {
      t.falsy(err, 'no error when extracting ' + zipPath)

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

test.cb('files', function (t) {
  tempExtract(t, 'files', catsZip, function (dirPath) {
    exists(t, path.join(dirPath, 'cats', 'gJqEYBs.jpg'), 'file created')
    t.end()
  })
})

test.cb('symlinks', function (t) {
  tempExtract(t, 'symlinks', catsZip, function (dirPath) {
    const symlink = path.join(dirPath, 'cats', 'orange_symlink')

    exists(t, symlink, 'symlink created')

    fs.lstat(symlink, function (err, stats) {
      t.deepEqual(err, null, "symlink can be stat'd")
      t.truthy(stats.isSymbolicLink(), 'symlink is valid')
      fs.readlink(symlink, function (err, linkString) {
        t.deepEqual(err, null, 'symlink itself can be read')
        t.is(linkString, 'orange')
        t.end()
      })
    })
  })
})

test.cb('directories', function (t) {
  tempExtract(t, 'directories', catsZip, function (dirPath) {
    const dirWithContent = path.join(dirPath, 'cats', 'orange')
    const dirWithoutContent = path.join(dirPath, 'cats', 'empty')

    exists(t, dirWithContent, 'directory created')

    fs.readdir(dirWithContent, function (err, files) {
      t.deepEqual(err, null, 'directory can be read')
      t.truthy(files.length > 0, 'directory has files')
    })

    exists(t, dirWithoutContent, 'empty directory created')

    fs.readdir(dirWithoutContent, function (err, files) {
      t.deepEqual(err, null, 'empty directory can be read')
      t.truthy(files.length === 0, 'empty directory has no files')
      t.end()
    })
  })
})

test.cb('verify github zip extraction worked', function (t) {
  tempExtract(t, 'verify-extraction', githubZip, function (dirPath) {
    exists(t, path.join(dirPath, 'extract-zip-master', 'test'), 'folder created')
    t.end()
  })
})

test.cb('opts.onEntry', function (t) {
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
      t.falsy(err)

      t.deepEqual(actualEntries, expectedEntries, 'entries should match')
      t.end()
    })
  })
})

test.cb('callback called once', function (t) {
  tempExtract(t, 'callback', symlinkZip, function (dirPath) {
    // this triggers an error due to symlink creation
    extract(symlinkZip, { dir: dirPath }, function (err) {
      if (err) t.truthy(true, 'error passed')

      t.truthy(true, 'callback called')
      t.end()
    })
  })
})

test.cb('relative target directory', function (t) {
  relativeExtract(function (err) {
    t.truthy(err instanceof Error, 'is native V8 error')
    t.deepEqual(err.message, 'Target directory is expected to be absolute', 'has descriptive error message')
    t.end()
  })
})

test.cb('no folder created', function (t) {
  relativeExtract(function (err) {
    t.truthy(err instanceof Error, 'is native V8 error')
    doesntExist(t, path.join(__dirname, relativeTarget), 'file not created')
    t.end()
  })
})

if (process.platform !== 'win32') {
  test.cb('symlink destination disallowed', function (t) {
    mkdtemp(t, 'symlink-destination-disallowed', function (dirPath) {
      doesntExist(t, path.join(dirPath, 'file.txt'), "file doesn't exist at symlink target")

      extract(symlinkDestZip, { dir: dirPath }, function (err) {
        t.truthy(err instanceof Error, 'is native V8 error')

        if (err) {
          t.regex(err.message, /Out of bound path ".*?" found while processing file symlink-dest\/aaa\/file.txt/, 'has descriptive error message')
        }

        t.end()
      })
    })
  })

  test.cb('no file created out of bound', function (t) {
    mkdtemp(t, 'out-of-bounds-file', function (dirPath) {
      extract(symlinkDestZip, { dir: dirPath }, function (err) {
        const symlinkDestDir = path.join(dirPath, 'symlink-dest')

        t.truthy(err instanceof Error, 'is native V8 error')

        exists(t, symlinkDestDir, 'target folder created')
        exists(t, path.join(symlinkDestDir, 'aaa'), 'symlink created')
        exists(t, path.join(symlinkDestDir, 'ccc'), 'parent folder created')
        doesntExist(t, path.join(symlinkDestDir, 'ccc/file.txt'), 'file not created in original folder')
        doesntExist(t, path.join(dirPath, 'file.txt'), 'file not created in symlink target')
        t.end()
      })
    })
  })
}

test.cb('files in subdirs where the subdir does not have its own entry is extracted', function (t) {
  tempExtract(t, 'subdir-file', subdirZip, function (dirPath) {
    exists(t, path.join(dirPath, 'foo', 'bar'), 'file created')
    t.end()
  })
})

test.cb('extract broken zip', function (t) {
  mkdtemp(t, 'broken-zip', function (dirPath) {
    extract(brokenZip, { dir: dirPath }, function (err) {
      t.truthy(err, 'Error: invalid central directory file header signature: 0x2014b00')
      t.end()
    })
  })
})
