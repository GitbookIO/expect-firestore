/* @flow */
/* eslint-disable no-use-before-define */

export type GoogleCredential = {
    project_id: string,
    client_email: string,
    private_key: string
};

export type Document = {
    key: string,
    fields: {
        [string]: mixed
    },
    collections: FirestoreCollections
};

export type Collection = Document[];

export type Collections = {
    [string]: Collection
};

// Parameters to define the Firebase authentication being used
export type FirestoreAuth = {
    uid?: string
};

// Mock for a function
export type FirestoreMockFunction = {
    function: string,
    args: [{ exact_value: string }],
    result: {
        value: {
            data: any
        }
    }
};

// Input for a test
export type FirestoreTestCase = {
    expectation: 'ALLOW' | 'DENY',
    request: {
        auth: FirestoreAuth,
        path: string,
        method:
            | 'get'
            | 'list'
            | 'create'
            | 'update'
            | 'delete'
            | 'read'
            | 'write'
    },
    resource?: {
        data: ?Object
    },
    functionMocks: FirestoreMockFunction[]
};

// Result of a test.
export type FirestoreTestResult = {
    state: 'SUCCESS' | 'FAILURE',
    debugMessages?: string[]
};

// Summary of tests
export type TestSummary = {
    success: boolean,
    tests: {
        case: FirestoreTestCase,
        result: FirestoreTestResult
    }[]
};
