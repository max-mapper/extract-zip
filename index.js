var fs = require('fs')
var path = require('path')
var async = require('async')
var yauzl = require('yauzl')
var mkdirp = require('mkdirp')
var concat = require('concat-stream')
var debug = require('debug')('extract-zip')

// lolol zips
var MAGIC_SYMLINK_ATTR_1 = 2716663808
var MAGIC_SYMLINK_ATTR_2 = 2716680192

module.exports = function(zipPath, opts, cb) {
  debug('opening', zipPath, 'with opts', opts)
  yauzl.open(zipPath, {autoClose: false}, function(err, zipfile) {
    if (err) return cb(err)
    
    var cancelled = false
    var finished = false
    
    var q = async.queue(extractEntry, 1)
    
    q.drain = function() {
      if (!finished) return
      debug('zip extraction complete')
      cb()
    }
    
    zipfile.on("entry", function(entry) {
      debug('zipfile entry', entry.fileName)
      if (/\/$/.test(entry.fileName)) {
        // directory file names end with '/'
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
      var symlink = false
      
      if (entry.externalFileAttributes === MAGIC_SYMLINK_ATTR_1 || 
          entry.externalFileAttributes === MAGIC_SYMLINK_ATTR_2) {
        symlink = true
      }
      
      var mode = (entry.externalFileAttributes >> 16) & 0xFFFF
      
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
          var writeStream = fs.createWriteStream(dest, {mode: mode})
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
}
