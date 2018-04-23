# `expect-firestore`

[![Build Status](https://travis-ci.org/GitbookIO/expect-firestore.svg?branch=master)](https://travis-ci.org/GitbookIO/expect-firestore)

Node module to easily unit tests Firestore rules. It abstract the Firestore Rules testing API to easily mock a dataset.

## Install

```
$ yarn add expect-firestore
```

## Usage

```js
import assert from 'assert';
import * as firestore from 'expect-firestore';

const database = new firestore.Database({
    // Credentials from firebase console
    credential: { project_id: '...', ... },
    // Fake data to test assertions against
    data: {
        // See src/__tests__/fixtures/db.json for an example
        users: [
            {
                key: 'userA',
                fields: {
                    name: 'John Doe'
                },
                collections: {
                    favorites: [
                        ...
                    ]
                }
            },
            ...
        ]
    },
    // Firestore rules
    rules: ''
});

// Authorize the client database
await database.authorize();

// Test a get
const result = await database.canGet({ uid: 'some_user' }, 'users/userA');
firestore.assert(result);
```

## API

#### Global

- `new firestore.Database({ data, credentials, rules })`: Create a database instance to test rules

  ```js
  const database = new firestore.Database({
      credentials: require('credential.json')
  });
  ```
- `firestore.assert(test: TestResult)`: Throw a human readable error if test failed, otherwise do nothing

  ```js
  const result = await database.canGet({}, 'users/userA');
  firestore.assert(result);
  ```

#### `firestore.Database`

- `database.authorize(): Promise<void>`: Prepare the testing environment, it must be called at least once.

Run `get`, `set`, `update` and `commit` tests using:

- `database.canGet(auth: FirestoreAuth, document: string): Promise<TestResult>`
- `database.cannotGet(auth: FirestoreAuth, document: string): Promise<TestResult>`
- `database.canSet(auth: FirestoreAuth, document: string, value: any): Promise<TestResult>`
- `database.cannotSet(auth: FirestoreAuth, document: string, value: any): Promise<TestResult>`
- `database.canUpdate(auth: FirestoreAuth, document: string, values: Object): Promise<TestResult>`
- `database.cannotUpdate(auth: FirestoreAuth, document: string, values: Object): Promise<TestResult>`
- `database.canCommit(auth: FirestoreAuth, batch: BatchOperation[]): Promise<TestResult>`
- `database.cannotUpdate(auth: FirestoreAuth, batch: firestore.BatchOperation[]): Promise<TestResult>`

Control test testing environment using:

- `database.setData(data: FirestoreCollections)`: Update the dataset
- `database.setRules(rules: string)`: Update the rules being tested
- `database.setRulesFromFile(file: string)`: Read the rules from a file

### `firestore.Batch`

- `firestore.Batch.set(document: string, value: any): BatchOperation`
- `firestore.Batch.update(document: string, values: Object): BatchOperation`
- `firestore.Batch.delete(document: string): BatchOperation`
