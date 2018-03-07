/* @flow */
/* eslint-disable no-use-before-define */

export type GoogleCredential = {
    project_id: string,
    client_email: string,
    private_key: string
};

export type FirestoreDocument = {
    key: string,
    fields: {
        [string]: mixed
    },
    collections: FirestoreCollections
};

export type FirestoreCollection = FirestoreDocument[];

export type FirestoreCollections = {
    [string]: FirestoreCollection
};

// Parameters to define the Firebase authentication being used
export type FirestoreAuth = {
    uid?: string
};

// Request in a test (for GETs)
export type FirestoreRequest = {
    auth: FirestoreAuth,
    path: string,
    method: 'get' | 'list' | 'create' | 'update' | 'delete' | 'read' | 'write'
};

// Resource for a test (for write)
export type FirestoreResource = {
    data: Object
};

// Input for a test
export type FirestoreTestInput = {
    expectation: 'ALLOW' | 'DENY',
    request: FirestoreRequest,
    resource?: FirestoreResource
};

// Result of a test.
export type FirestoreTestResult = {
    state: 'SUCCESS' | 'FAILURE'
};
