// Plain-JS entry for the Node worker thread: registers the TypeScript loader, then loads the worker.
import { register } from 'tsx/esm/api';

register();
await import('./node-worker.ts');
