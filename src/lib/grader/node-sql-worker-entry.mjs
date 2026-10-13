// Plain-JS entry for the Node SQL worker thread: registers the TypeScript loader, then loads it.
import { register } from 'tsx/esm/api';

register();
await import('./node-sql-worker.ts');
