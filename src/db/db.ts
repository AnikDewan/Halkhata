import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// Open SQLite database and enable change listener for useLiveQuery reactivity
export const expoDb = openDatabaseSync('halkhata.db', { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
