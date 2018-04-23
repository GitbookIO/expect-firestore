/* @flow */
import Path from 'path';
import FS from 'fs';
import google from 'googleapis';
import type {
    GoogleCredential,
    FirestoreCollections,
    FirestoreCollection,
    FirestoreDocument,
    FirestoreTestInput,
    FirestoreTestResult,
    FirestoreAuth
} from './types';

import type { BatchOperation } from './batch';

class Database {
    credential: GoogleCredential;
    collections: FirestoreCollections;
    rules: string;
    client: ?google.firebaserules;

    constructor({
        data,
        credential,
        rules
    }: {
        data?: FirestoreCollections,
        credential: GoogleCredential,
        rules?: string
    }) {
        this.credential = credential;
        this.collections = data || {};
        this.rules = rules || '';
    }

    /*
     * Replace the mock data.
     */
    setData(data: FirestoreCollections) {
        this.collections = data;
    }

    /*
     * Update the rules.
     */
    setRules(rules: string) {
        this.rules = rules;
    }

    /*
     * Read the rules from a file.
     */
    setRulesFromFile(rulesFile: string) {
        const content = FS.readFileSync(rulesFile, 'utf8');
        this.setRules(content);
    }

    /*
     * Get all documents in a collection.
     */
    getCollection(collectionPath: string): FirestoreCollection {
        const collectionName = Path.basename(collectionPath);
        const docPath = Path.dirname(collectionPath);

        const doc = this.getDocument(docPath);

        if (doc) {
            const { collections } = doc;
            return collections[collectionName] || [];
        }

        return [];
    }

    /*
     * Get the value of a document (fields and collection).
     */
    getDocument(docPath: string): ?FirestoreDocument {
        const docId = Path.basename(docPath);
        const collectionPath = Path.dirname(docPath);

        const collection = this.getCollection(collectionPath);
        return collection.find(doc => doc.key == docId);
    }

    /*
     * Test if a document exists in the local database.
     */
    hasDocument(docPath: string): boolean {
        return !!this.getDocument(docPath);
    }

    /*
     * List all documents in the database.
     */
    getDocuments(
        collections: FirestoreCollections = this.collections,
        parentPath: string = ''
    ): { path: string, doc: FirestoreDocument }[] {
        return Object.keys(collections).reduce((result, collectionName) => {
            const collectionPath = Path.join(parentPath, collectionName);

            const docs = collections[collectionName].reduce((_docs, doc) => {
                const docPath = Path.join(collectionPath, doc.key);
                const children = this.getDocuments(doc.collections, docPath);

                return [
                    {
                        path: docPath,
                        doc
                    }
                ]
                    .concat(_docs)
                    .concat(children);
            }, []);

            return result.concat(docs);
        }, []);
    }

    /*
     * Create the mocks for the API to represent the dataset.
     */
    createMockFunctions() {
        const documents = this.getDocuments();

        return documents.reduce(
            (functions, { path, doc }) =>
                functions.concat([
                    {
                        function: 'get',
                        args: [{ exact_value: createDocumentPath(path) }],
                        result: {
                            value: {
                                data: doc ? doc.fields : null
                            }
                        }
                    },
                    {
                        function: 'exists',
                        args: [{ exact_value: createDocumentPath(path) }],
                        result: {
                            value: {
                                data: !!doc
                            }
                        }
                    }
                ]),
            []
        );
    }

    /*
     * Authorize the API client.
     */
    async authorize(): Promise<void> {
        const { credential } = this;

        const jwtClient = new google.auth.JWT(
            credential.client_email,
            null,
            credential.private_key,
            ['https://www.googleapis.com/auth/firebase'], // an array of auth scopes
            null
        );

        return new Promise((resolve, reject) => {
            jwtClient.authorize((error, tokens) => {
                if (error) {
                    reject(error);
                } else {
                    this.client = google.firebaserules({
                        version: 'v1',
                        auth: jwtClient
                    });

                    resolve();
                }
            });
        });
    }

    /*
     * Test an assertion against the current rules and dataset.
     */
    async testRules(test: FirestoreTestInput): Promise<FirestoreTestResult> {
        const functionMocks = this.createMockFunctions();

        return new Promise((resolve, reject) => {
            const params = {
                name: `projects/${this.credential.project_id}`,
                resource: {
                    source: {
                        files: [
                            {
                                name: 'firestore.rules',
                                content: this.rules
                            }
                        ]
                    },
                    testSuite: {
                        testCases: [
                            {
                                ...test,
                                functionMocks
                            }
                        ]
                    }
                }
            };

            if (!this.client) {
                throw new Error(
                    'API client not authorized yet, call database.authorize() first'
                );
            }

            this.client.projects.test(params, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.testResults[0]);
                }
            });
        });
    }

    /*
     * Utilities for assertions.
     */

    async canGet(
        auth: FirestoreAuth,
        path: string
    ): Promise<FirestoreTestResult> {
        return this.testRules(createGetTest(true, auth, path));
    }

    async cannotGet(
        auth: FirestoreAuth,
        path: string
    ): Promise<FirestoreTestResult> {
        return this.testRules(createGetTest(false, auth, path));
    }

    async canSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<FirestoreTestResult> {
        return this.testRules(createSetTest(true, auth, path, data));
    }

    async cannotSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<FirestoreTestResult> {
        return this.testRules(createSetTest(false, auth, path, data));
    }

    async canUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<FirestoreTestResult> {
        return this.testRules(createUpdateTest(true, auth, path, data));
    }

    async cannotUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<FirestoreTestResult> {
        return this.testRules(createUpdateTest(false, auth, path, data));
    }

    async canCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<FirestoreTestResult> {
        return this.testRules(createCommitTest(true, auth, batch));
    }

    async cannotCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<FirestoreTestResult> {
        return this.testRules(createCommitTest(false, auth, batch));
    }
}

function createDocumentPath(path: string): string {
    return `/databases/(default)/documents/${path}`;
}

function createGetTest(
    allow: boolean,
    auth: FirestoreAuth,
    path: string
): FirestoreTestInput {
    const request = {
        auth,
        path: createDocumentPath(path),
        method: 'get'
    };
    return {
        expectation: allow ? 'ALLOW' : 'DENY',
        request
    };
}

function createSetTest(
    allow: boolean,
    auth: FirestoreAuth,
    path: string,
    data: Object
): FirestoreTestInput {
    const request = {
        auth,
        path: createDocumentPath(path),
        method: 'create'
    };
    const resource = {
        data
    };
    return {
        expectation: allow ? 'ALLOW' : 'DENY',
        request,
        resource
    };
}

function createUpdateTest(
    allow: boolean,
    auth: FirestoreAuth,
    path: string,
    data: Object
): FirestoreTestInput {
    const request = {
        auth,
        path: createDocumentPath(path),
        method: 'update'
    };
    const resource = {
        data
    };
    return {
        expectation: allow ? 'ALLOW' : 'DENY',
        request,
        resource
    };
}

function createCommitTest(
    allow: boolean,
    auth: FirestoreAuth,
    batch: BatchOperation[]
): FirestoreTestInput {
    throw new Error('not yet supported');
}

export default Database;
