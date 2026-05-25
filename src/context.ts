import { AsyncLocalStorage } from 'node:async_hooks';

export const usernameStorage = new AsyncLocalStorage<string>();
