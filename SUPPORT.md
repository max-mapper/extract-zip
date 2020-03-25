## Debugging `extract-zip`

One way to troubleshoot potential problems is to set the `DEBUG` environment variable before
importing / calling `extract-zip`. Setting its value to `extract-zip` will produce debugging
information as a ZIP file is extracted.

We use the [`debug`](https://www.npmjs.com/package/debug#usage) module for this functionality. It
has examples on how to set environment variables if you don't know how.
