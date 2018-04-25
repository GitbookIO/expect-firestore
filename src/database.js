/* @flow */
import Path from 'path';
import FS from 'fs';
import google from 'googleapis';
import set from 'object-set';
import type {
    GoogleCredential,
    Collections,
    Collection,
    Document,
    FirestoreTestCase,
    FirestoreMockFunction,
    FirestoreAuth,
    TestSummary
} from './types';

import Batch, { type BatchOperation } from './batch';

class Database {
    credential: GoogleCredential;
    collections: Collections;
    rules: string;
    client: ?google.firebaserules;

    constructor({
        data,
        credential,
        rules
    }: {
        data?: Collections,
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
    setData(data: Collections) {
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
    getCollection(collectionPath: string): Collection {
        const collectionName = Path.basename(collectionPath);
        const docPath = Path.dirname(collectionPath);

        if (docPath == '.') {
            const { collections } = this;
            return collections[collectionName] || [];
        }

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
    getDocument(docPath: string): ?Document {
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
        collections: Collections = this.collections,
        parentPath: string = ''
    ): { path: string, doc: Document }[] {
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
     * Authorize the API client.
     */
    async authorize(): Promise<void> {
        const { credential } = this;

        if (this.client) {
            return;
        }

        const jwtClient = new google.auth.JWT(
            credential.client_email,
            null,
            credential.private_key,
            ['https://www.googleapis.com/auth/firebase'], // an array of auth scopes
            null
        );

        await new Promise((resolve, reject) => {
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
    async testRules(testCases: FirestoreTestCase[]): Promise<TestSummary> {
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
                        testCases
                    }
                }
            };

            if (!this.client) {
                throw new Error(
                    'API client not authorized yet, call database.authorize() first'
                );
            }

            this.client.projects.test(params, (error, json) => {
                if (error) {
                    reject(error);
                } else {
                    // There are some syntax error in the rules
                    if (json.issues) {
                        const message = json.issues
                            .map(
                                issue =>
                                    `Line ${
                                        issue.sourcePosition.line
                                    }, column ${issue.sourcePosition.column}: ${
                                        issue.description
                                    }`
                            )
                            .join('\n\n');

                        throw new Error(message);
                    }

                    const { testResults } = json;
                    let success = true;

                    const tests = testResults.map((result, i) => {
                        success = result.state == 'SUCCESS' && success;
                        return {
                            case: testCases[i],
                            result
                        };
                    });

                    resolve({
                        success,
                        tests
                    });
                }
            });
        });
    }

    /*
     * Utilities for assertions.
     */

    async canGet(auth: FirestoreAuth, path: string): Promise<TestSummary> {
        return this.testRules([this.createGetTest(true, auth, path)]);
    }

    async cannotGet(auth: FirestoreAuth, path: string): Promise<TestSummary> {
        return this.testRules([this.createGetTest(false, auth, path)]);
    }

    async canCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<TestSummary> {
        return this.testRules(this.createCommitTest(true, auth, batch));
    }

    async cannotCommit(
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): Promise<TestSummary> {
        return this.testRules(this.createCommitTest(false, auth, batch));
    }

    async canSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<TestSummary> {
        return this.canCommit(auth, [Batch.set(path, data)]);
    }

    async cannotSet(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<TestSummary> {
        return this.cannotCommit(auth, [Batch.set(path, data)]);
    }

    async canUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<TestSummary> {
        return this.canCommit(auth, [Batch.update(path, data)]);
    }

    async cannotUpdate(
        auth: FirestoreAuth,
        path: string,
        data: Object
    ): Promise<TestSummary> {
        return this.cannotCommit(auth, [Batch.update(path, data)]);
    }

    /*
     * Factories for tests
     */
    createGetTest(
        allow: boolean,
        auth: FirestoreAuth,
        path: string
    ): FirestoreTestCase {
        const functionMocks = this.createMockFunctions();
        const doc = this.getDocument(path);
        const request = {
            auth,
            path: createDocumentPath(path),
            method: 'get'
        };

        return {
            expectation: allow ? 'ALLOW' : 'DENY',
            request,
            resource: { data: doc ? doc.fields : null },
            functionMocks
        };
    }

    /*
     * Create a test for a commit with multiple updates.
     */
    createCommitTest(
        allow: boolean,
        auth: FirestoreAuth,
        batch: BatchOperation[]
    ): FirestoreTestCase[] {
        const expectation = allow ? 'ALLOW' : 'DENY';
        const baseFunctionMocks = this.createMockFunctions();
        const afterFunctionMocks = this.createBatchAfterFunctionMocks(batch);

        const functionMocks = [...baseFunctionMocks, ...afterFunctionMocks];

        return batch.map(operation => {
            const doc = this.getDocument(operation.document);

            let method = operation.method;
            if (operation.method == 'set') {
                method = doc ? 'update' : 'create';
            }

            const request = {
                auth,
                path: createDocumentPath(operation.document),
                method
            };
            const resource = {
                data: operation.data || null
            };

            return {
                expectation,
                request,
                resource,
                functionMocks
            };
        });
    }

    /*
     * Create the mocks for the API to represent the dataset.
     */
    createMockFunctions(): FirestoreMockFunction[] {
        const documents = this.getDocuments();
        const defaults = [
            {
                function: 'get',
                args: [{ anyValue: {} }],
                result: {
                    value: null
                }
            },
            {
                function: 'getAfter',
                args: [{ anyValue: {} }],
                result: {
                    value: null
                }
            },
            {
                function: 'exists',
                args: [{ anyValue: {} }],
                result: {
                    value: false
                }
            }
        ];

        const docMocks = documents.reduce(
            (functions, { path, doc }) =>
                functions.concat([
                    createFunctionMock(
                        'get',
                        createDocumentPath(path),
                        doc ? { data: doc.fields } : null
                    ),
                    createFunctionMock(
                        'exists',
                        createDocumentPath(path),
                        !!doc
                    )
                ]),
            []
        );

        return defaults.concat(docMocks);
    }

    /*
     * Create the mock for the getAfter functions.
     */
    createBatchAfterFunctionMocks(
        batch: BatchOperation[]
    ): FirestoreMockFunction[] {
        return batch.map(operation => {
            const doc = this.getDocument(operation.document);
            let after = doc ? doc.fields : null;

            if (operation.method == 'set') {
                after = operation.data;
            } else if (operation.method == 'delete') {
                after = null;
            } else if (operation.method == 'update') {
                after = after || {};
                Object.keys(operation.data).forEach(key => {
                    set(after, key, operation.data[key]);
                });
            }

            return createFunctionMock(
                'getAfter',
                createDocumentPath(operation.document),
                after ? { data: after } : null
            );
        });
    }
}

function createDocumentPath(path: string): string {
    return `/databases/(default)/documents/${path}`;
}

function createFunctionMock(
    functionName: string,
    arg: string,
    value: any
): FirestoreMockFunction {
    return {
        function: functionName,
        args: [{ exact_value: arg }],
        result: {
            value
        }
    };
}

export default Database;
