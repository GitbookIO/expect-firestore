/* @flow */
import Database from './database';
import type {
    GoogleCredential,
    FirestoreCollections,
    FirestoreAuth
} from './types';

let database: ?Database = null;

/*
 * Set credentials for the database.
 */
async function authorize(credential: GoogleCredential): Promise<void> {
    database = new Database({
        rules: database ? database.rules : '',
        data: database ? database.collections : {},
        credential
    });

    await database.authorize();
}

/*
 * Set the data/collection.
 */
function setData(data: FirestoreCollections) {
    if (!database) {
        throw new Error('Call authorize before calling setData');
    }

    database.collections = data;
}

/*
 * Set the rules
 */
function setRules(rules: string) {
    if (!database) {
        throw new Error('Call authorize before calling setRules');
    }

    database.rules = rules;
}

/*
 * Get the database instance.
 */
function getDatabase(): ?Database {
    return database;
}

/*
 * Return the database instance or throw an error.
 */
function assertDatabase(): Database {
    if (!database) {
        throw new Error('Database not initialized yet');
    }

    return database;
}

/*
 * Assertions
 */

async function canGet(auth: FirestoreAuth, path: string): Promise<boolean> {
    return assertDatabase().canGet(auth, path);
}

async function cannotGet(auth: FirestoreAuth, path: string): Promise<boolean> {
    return assertDatabase().cannotGet(auth, path);
}

async function canSet(
    auth: FirestoreAuth,
    path: string,
    data: Object
): Promise<boolean> {
    return assertDatabase().canSet(auth, path, data);
}

async function cannotSet(
    auth: FirestoreAuth,
    path: string,
    data: Object
): Promise<boolean> {
    return assertDatabase().cannotSet(auth, path, data);
}

export {
    authorize,
    setData,
    setRules,
    getDatabase,
    assertDatabase,
    canGet,
    cannotGet,
    canSet,
    cannotSet
};
