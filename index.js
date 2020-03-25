const fs = require('fs')
const path = require('path')
const yauzl = require('yauzl')
const concat = require('concat-stream')
const debug = require('debug')('extract-zip')

function openZip (zipPath, opts, cb) {
  debug('opening', zipPath, 'with opts', opts)

  yauzl.open(zipPath, { lazyEntries: true }, function (err, zipfile) {
    if (err) return cb(err)

    let cancelled = false

    zipfile.on('error', function (err) {
      if (err) {
        cancelled = true
        return cb(err)
      }
    })
    zipfile.readEntry()

    zipfile.on('close', function () {
      if (!cancelled) {
        debug('zip extraction complete')
        cb()
      }
    })

    zipfile.on('entry', function (entry) {
      /* istanbul ignore if */
      if (cancelled) {
        debug('skipping entry', entry.fileName, { cancelled: cancelled })
        return
      }

      debug('zipfile entry', entry.fileName)

      if (entry.fileName.startsWith('__MACOSX/')) {
        zipfile.readEntry()
        return
      }

      const destDir = path.dirname(path.join(opts.dir, entry.fileName))

      fs.mkdir(destDir, { recursive: true }, function (err) {
        /* istanbul ignore if */
        if (err) {
          cancelled = true
          zipfile.close()
          return cb(err)
        }

        fs.realpath(destDir, function (err, canonicalDestDir) {
          /* istanbul ignore if */
          if (err) {
            cancelled = true
            zipfile.close()
            return cb(err)
          }

          const relativeDestDir = path.relative(opts.dir, canonicalDestDir)

          if (relativeDestDir.split(path.sep).indexOf('..') !== -1) {
            cancelled = true
            zipfile.close()
            return cb(new Error('Out of bound path "' + canonicalDestDir + '" found while processing file ' + entry.fileName))
          }

          extractEntry(entry, function (err) {
            // if any extraction fails then abort everything
            if (err) {
              cancelled = true
              zipfile.close()
              return cb(err)
            }
            debug('finished processing', entry.fileName)
            zipfile.readEntry()
          })
        })
      })
    })

    function extractEntry (entry, done) {
      /* istanbul ignore if */
      if (cancelled) {
        debug('skipping entry extraction', entry.fileName, { cancelled: cancelled })
        return setImmediate(done)
      }

      if (opts.onEntry) {
        opts.onEntry(entry, zipfile)
      }

      const dest = path.join(opts.dir, entry.fileName)

      // convert external file attr int into a fs stat mode int
      let mode = (entry.externalFileAttributes >> 16) & 0xFFFF
      // check if it's a symlink or dir (using stat mode constants)
      const IFMT = 61440
      const IFDIR = 16384
      const IFLNK = 40960
      const symlink = (mode & IFMT) === IFLNK
      let isDir = (mode & IFMT) === IFDIR

      // Failsafe, borrowed from jsZip
      if (!isDir && entry.fileName.slice(-1) === '/') {
        isDir = true
      }

      // check for windows weird way of specifying a directory
      // https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
      const madeBy = entry.versionMadeBy >> 8
      if (!isDir) isDir = (madeBy === 0 && entry.externalFileAttributes === 16)

      // if no mode then default to default modes
      if (mode === 0) {
        if (isDir) {
          if (opts.defaultDirMode) mode = parseInt(opts.defaultDirMode, 10)
          if (!mode) mode = 0o755
        } else {
          if (opts.defaultFileMode) mode = parseInt(opts.defaultFileMode, 10)
          if (!mode) mode = 0o644
        }
      }

      debug('extracting entry', { filename: entry.fileName, isDir: isDir, isSymlink: symlink })

      // reverse umask first (~)
      const umask = ~process.umask()
      // & with processes umask to override invalid perms
      const procMode = mode & umask

      // always ensure folders are created
      const destDir = isDir ? dest : path.dirname(dest)

      debug('mkdirp', { dir: destDir })
      fs.mkdir(destDir, { recursive: true }, function (err) {
        /* istanbul ignore if */
        if (err) {
          debug('mkdirp error', destDir, { error: err })
          cancelled = true
          return done(err)
        }

        if (isDir) return done()

        debug('opening read stream', dest)
        zipfile.openReadStream(entry, function (err, readStream) {
          /* istanbul ignore if */
          if (err) {
            debug('openReadStream error', err)
            cancelled = true
            return done(err)
          }

          readStream.on('error', function (err) {
            /* istanbul ignore next */
            console.log('read err', err)
          })

          let writeStream
          if (symlink) {
            writeStream = concat(function (data) {
              const link = data.toString()
              debug('creating symlink', link, dest)
              fs.symlink(link, dest, function (err) {
                if (err) cancelled = true
                done(err)
              })
            })
          } else {
            writeStream = fs.createWriteStream(dest, { mode: procMode })

            writeStream.on('finish', function () {
              done()
            })

            writeStream.on('error', /* istanbul ignore next */ function (err) {
              debug('write error', { error: err })
              cancelled = true
              return done(err)
            })
          }

          readStream.pipe(writeStream)
        })
      })
    }
  })
}

module.exports = function (zipPath, opts, cb) {
  debug('creating target directory', opts.dir)

  if (path.isAbsolute(opts.dir) === false) {
    return cb(new Error('Target directory is expected to be absolute'))
  }

  fs.mkdir(opts.dir, { recursive: true }, function (err) {
    if (err) return cb(err)

    fs.realpath(opts.dir, function (err, canonicalDir) {
      if (err) return cb(err)

      opts.dir = canonicalDir

      openZip(zipPath, opts, cb)
    })
  })
}
