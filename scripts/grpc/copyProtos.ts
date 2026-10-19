import fs from 'fs';
import path from 'path';

/**
 * Build step: copies the gRPC proto next to the bundled server
 * (dist/grpc/protos) so server/grpc/server.ts's dist candidate resolves in
 * production. The bundle itself is --packages=external, so .proto files -
 * which are data, not modules - must travel with it.
 *
 * The copy is a manual walk rather than fs.cpSync: recursive cpSync hard-crashes
 * this Windows toolchain (exit 0xC0000374 heap corruption on Node 22.x), which
 * turned `npm run build` into a guaranteed failure after the bundle succeeded.
 * The walk below has the same effect with primitives that are stable here.
 */
const src = path.resolve('server', 'grpc', 'protos');
const dest = path.resolve('dist', 'grpc', 'protos');

function copyDirRecursive(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

copyDirRecursive(src, dest);
console.log('[build] gRPC proto copied to', dest);