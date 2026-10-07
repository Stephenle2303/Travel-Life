import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';

const textExtensions = new Set(['.md','.txt','.py','.mjs','.js','.cjs','.json','.jsonl','.yaml','.yml','.toml','.csv','.sh','.ps1','.html','.css','.xml']);
export function fileInventory(root) {
  const paths = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, {withFileTypes:true})) {
      if (['__pycache__','.git','node_modules'].includes(entry.name) || entry.name.endsWith('.pyc')) continue;
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in vendored framework: ' + full);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) paths.push(full);
    }
  }
  walk(root);
  return paths.sort().map(path => {
    let bytes = readFileSync(path);
    if (textExtensions.has(extname(path))) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    return { path:relative(root,path).replaceAll('\\','/'), sha256:createHash('sha256').update(bytes).digest('hex') };
  }).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function treeDigest(root) {
  const inventory = fileInventory(root);
  return {files:inventory.length,sha256:createHash('sha256').update(JSON.stringify(inventory)).digest('hex')};
}
