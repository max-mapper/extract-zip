import { Entry, ZipFile } from 'yauzl';
import * as extract from '.';

const zip = '/path/to/zip';
const dir = '/path/to/dir';
const defaultFileMode = 0o600;

let options: extract.Options = {
  dir,
};
options = {
  dir,
  encoding: 'shift-jis',
  defaultDirMode: 0o700,
  defaultFileMode,
  onEntry: (entry: Entry, zipfile: ZipFile): void => {
    console.log(entry);
    console.log(zipfile);
  }
};

try {
  await extract(zip, options);
  console.log('done');
} catch (err) {
  console.error(err);
}
