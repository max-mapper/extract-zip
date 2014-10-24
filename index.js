var fs = require('fs')
var path = require('path')
var async = require('async')
var yauzl = require('yauzl')
var mkdirp = require('mkdirp')
var concat = require('concat-stream')
var debug = require('debug')('extract-zip')
var when = require("when")

module.exports = function(zipPath, opts, callback) {
  debug('opening', zipPath, 'with opts', opts)
  var deferred = defer();
  var cb = deferred.resolve;
  function end(err) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(err);
    }
    return callback(err)
  }

  yauzl.open(zipPath, {autoClose: false}, function(err, zipfile) {
    if (err) return end(err)

    var cancelled = false
    var finished = false

    var q = async.queue(extractEntry, 1)

    q.drain = function() {
      if (!finished) return
      debug('zip extraction complete')
      end()
    }

    zipfile.on("entry", function(entry) {
      debug('zipfile entry', entry.fileName)

      if (/\/$/.test(entry.fileName)) {
        // directory file names end with '/'
        return
      }

      if (/^__MACOSX\//.test(entry.fileName)) {
        // dir name starts with __MACOSX/
        return
      }

      q.push(entry, function(err) {
        debug('finished processing', entry.fileName, {err: err})
      })
    })

    zipfile.on('end', function() {
      finished = true
    })

    function extractEntry(entry, done) {
      if (cancelled) {
        debug('skipping entry', entry.fileName, {cancelled: cancelled})
        return setImmediate(done)
      } else {
        debug('extracting entry', entry.fileName)
      }

      var dest = path.join(opts.dir, entry.fileName)
      var destDir = path.dirname(dest)

      // convert external file attr int into a fs stat mode int
      var mode = (entry.externalFileAttributes >> 16) & 0xFFFF
      // check if it's a symlink or dir (using stat mode constants)
      var IFMT = 61440
      var IFDIR = 16384
      var IFLNK = 40960
      var symlink = (mode & IFMT) === IFLNK
      var isDir = (mode & IFMT) === IFDIR

      // if no mode then default to readable
      if (mode === 0) {
        if (isDir) mode = 0555
        else mode = 0444
      }

      // reverse umask first (~)
      var umask = ~process.umask()
      // & with processes umask to override invalid perms
      var procMode = mode & umask

      zipfile.openReadStream(entry, function(err, readStream) {
        if (err) {
          debug('openReadStream error', err)
          cancelled = true
          return done(err)
        }

        readStream.on('error', function(err) {
          console.log('read err', err)
        })

        mkdirp(destDir, function(err) {
          if (err) {
            debug('mkdirp error', destDir, {error: err})
            cancelled = true
            return done(err)
          }

          if (symlink) writeSymlink()
          else writeStream()
        })

        function writeStream() {
          var writeStream = fs.createWriteStream(dest, {mode: procMode})
          readStream.pipe(writeStream)
          writeStream.on('finish', function() {
            done()
          })
          writeStream.on('error', function(err) {
            debug('write error', {error: err})
            cancelled = true
            return done(err)
          })
        }

        // AFAICT the content of the symlink file itself is the symlink target filename string
        function writeSymlink() {
          readStream.pipe(concat(function(data) {
            var link = data.toString()
            debug('creating symlink', link, dest)
            fs.symlink(link, dest, function(err) {
              if (err) cancelled = true
              done(err)
            })
          }))
        }

      })
    }

  })

  return deferred.promise
}
