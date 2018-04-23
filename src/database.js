/* @flow */
import Path from 'path';
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
        data: FirestoreCollections,
        credential: GoogleCredential,
        rules: string
    }) {
        this.credential = credential;
        this.collections = data;
        this.rules = rules;
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

    async canGet(auth: FirestoreAuth, path: string): Promise<boolean> {
        const result = await this.testRules(createGetTest(true, auth, path));

        return result.state == 'SUCCESS';
    }

    async cannotGet(auth: FirestoreAuth, path: string): Promise<boolean> {
        const result = await this.testRules(createGetTest(false, auth, path));

        return result.state == 'SUCCESS';
    }

    async canSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<boolean> {
        const result = await this.testRules(
            createSetTest(true, auth, path, data)
        );

        return result.state == 'SUCCESS';
    }

    async cannotSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<boolean> {
        const result = await this.testRules(
            createSetTest(false, auth, path, data)
        );

        return result.state == 'SUCCESS';
    }

    async canUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<boolean> {
        const result = await this.testRules(
            createUpdateTest(true, auth, path, data)
        );

        return result.state == 'SUCCESS';
    }

    async cannotUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<boolean> {
        const result = await this.testRules(
            createUpdateTest(false, auth, path, data)
        );

        return result.state == 'SUCCESS';
    }

    async canCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<boolean> {
        const result = await this.testRules(
            createCommitTest(true, auth, batch)
        );

        return result.state == 'SUCCESS';
    }

    async cannotCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<boolean> {
        const result = await this.testRules(
            createCommitTest(false, auth, batch)
        );

        return result.state == 'SUCCESS';
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
