import test from 'ava';
import { resolve } from 'path';
import { readFileSync, existsSync, unlinkSync } from 'fs';

import { DefaultHost } from '../src/host';

test.beforeEach(t => {
  t.context.host = new DefaultHost();
});

test('DefaultHost#cwd should return the current directory', t => {
  t.is((t.context.host as DefaultHost).cwd(), process.cwd());
});

test('DefaultHost#fileExists should return true for existing file', t => {
  t.true((t.context.host as DefaultHost).fileExists('../../package.json'));
});

test('DefaultHost#fileExists should return false for non-existing file', t => {
  t.false((t.context.host as DefaultHost).fileExists('./package.json'));
});

test('DefaultHost#isFile should return true for file', t => {
  return (t.context.host as DefaultHost).isFile('../../package.json')
    .then(result => {
      t.true(result);
    });
});

test('DefaultHost#isFile should return false for directory', t => {
  return (t.context.host as DefaultHost).isFile('../../node_modules')
    .then(result => {
      t.false(result);
    });
});

test('DefaultHost#isFile should fail for non existing file', t => {
  return (t.context.host as DefaultHost).isFile('../../package.jsno')
    .then(result => {
      t.fail('Exception expected');
    })
    .catch(e => {
      t.truthy(e.message.match(/no such file/));
    });
});

test('DefaultHost#readFile should return the file content', t => {
  const path = '../../package.json';
  return (t.context.host as DefaultHost).readFile(path)
    .then(data => {
      t.deepEqual(data, readFileSync(path).toString());
    });
});

test('DefaultHost#readFile should fail for non existing file', t => {
  const path = '../../package.jsno';
  return (t.context.host as DefaultHost).readFile(path)
    .then(data => {
      t.fail('Exception expected');
    })
    .catch(e => {
      t.truthy(e.message.match(/no such file/));
    });
});

test('DefaultHost#writeFile should dump the content to disk', t => {
  const file = resolve(process.cwd(), 'dump.txt');
  try {
    (t.context.host as DefaultHost).writeFile(file, 'test-data');
    t.is(readFileSync(file).toString(), 'test-data');
  } finally {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }
});
