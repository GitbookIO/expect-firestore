/* @flow */
import type { FirestoreTestResult, FirestoreTestInput } from './types';

/*
 * Assert and print a human readable error with the result of a test.
 */
function assert(result: FirestoreTestResult): void {
    if (result.state == 'SUCCESS') {
        return;
    }

    if (result.debugMessages) {
        throw new Error(result.debugMessages.join('\n\n'));
    }

    throw new Error(getTestDescription(result.test));
}

function getTestDescription(test: FirestoreTestInput): string {
    const end = test.expectation == 'ALLOW' ? 'to succeed' : 'to fail';
    return `Expected the ${test.request.method} operation ${end}.`;
}

export default assert;
