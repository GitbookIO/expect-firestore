# `expect-firestore`

Node module to easily unit tests Firestore rules. It abstract the Firestore Rules testing API to easily mock a dataset.

## Install

```
$ yarn add expect-firestore
```

## Usage

### As a module

```js
import assert from 'assert';
import { Database } from 'expect-firestore';

const database = new Database({
    // Credentials from firebase console
    credential: { project_id: '...', ... },
    // Fake data to test against
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
const result = await database.testRules({
    expectation: 'ALLOW',
    request: {
        path: '/databases/(default)/documents/users/userA',
        method: 'get'
    }
});

assert.equal(result.state, 'SUCCESS')
```

### With jest / jasmine

This module is designed to easily be integrated into jest or jasmine. See below for using it as a normal module.

```js
import fs from 'fs';
import * as firestore from 'expect-firestore';

const CREDENTIAL = fs.readFileSync('credential.json', { encoding: 'utf8' });
const RULES = fs.readFileSync('firestore.rules', { encoding: 'utf8' });

beforeAll(async () => {
    await firestore.authorize(CREDENTIAL);

    // setData and setRules can be called as many time as wanted
    firestore.setRules(RULES);
    firestore.setData({
        ...
    })
});

it('should allow everyone to read an user profile', async () => {
    expect(await firestore.canGet({}, 'users/userA')).toBe(true);
});

```
