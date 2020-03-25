# extract-zip

Unzip written in pure JavaScript. Extracts a zip into a directory. Available as a library or a command line program.

Uses the [`yauzl`](http://npmjs.org/yauzl) ZIP parser.

[![NPM](https://nodei.co/npm/extract-zip.png?global=true)](https://npm.im/extract-zip)
[![Uses JS Standard Style](https://cdn.jsdelivr.net/gh/standard/standard/badge.svg)](https://github.com/standard/standard)
[![Build Status](https://github.com/maxogden/extract-zip/workflows/CI/badge.svg)](https://github.com/maxogden/extract-zip/actions?query=workflow%3ACI)

## Installation

Get the library:

```
npm install extract-zip --save
```

Install the command line program:

```
npm install extract-zip -g
```

## JS API

```js
var extract = require('extract-zip')
extract(sourcePath, {dir: targetPath}, function (err) {
 // extraction is complete. make sure to handle the err
})
```

### Options

- `dir` - defaults to `process.cwd()`
- `defaultDirMode` - integer - Directory Mode (permissions) will default to `493` (octal `0755` in integer)
- `defaultFileMode` - integer - File Mode (permissions) will default to `420` (octal `0644` in integer)
- `onEntry` - function - if present, will be called with `(entry, zipfile)`, entry is every entry from the zip file forwarded from the `entry` event from yauzl. `zipfile` is the `yauzl` instance

Default modes are only used if no permissions are set in the zip file.

## CLI Usage

```
extract-zip foo.zip <targetDirectory>
```

If not specified, `targetDirectory` will default to `process.cwd()`.
