import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
for(const x of ['start','build','check']) if(!pkg.scripts[x]) throw new Error(`missing script: ${x}`);
for(const x of ['hono','@hono/node-server','pg']) if(!pkg.dependencies[x]) throw new Error(`missing dependency: ${x}`);
console.log('RoXeT Railway project structure OK');
