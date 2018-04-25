/* @flow */
import type { TestSummary, FirestoreTestCase } from './types';

/*
 * Assert and print a human readable error with the result of a test.
 */
function assert(summary: TestSummary): void {
    if (summary.success) {
        return;
    }

    const firstFailing = summary.tests.find(
        ({ result }) => result.state == 'FAILURE'
    );

    if (firstFailing.result.debugMessages) {
        throw new Error(firstFailing.result.debugMessages.join('\n\n'));
    }

    throw new Error(getTestDescription(firstFailing.case));
}

function getTestDescription(test: FirestoreTestInput): string {
    const end = test.expectation == 'ALLOW' ? 'to succeed' : 'to fail';
    return `Expected the ${test.request.method} operation ${end}.`;
}

export default assert;
