/* @flow */
import type { FirestoreTestResult } from './types';

/*
 * Assert and print a human readable error with the result of a test.
 */
function assert(result: FirestoreTestResult): void {
    if (result.state == 'SUCCESS') {
        return;
    }

    console.log(result);

    throw new Error('Failed');
}

export default assert;
