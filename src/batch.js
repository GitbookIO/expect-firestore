/* @flow */

const Batch = {
    set,
    update,
    delete: del
};

type OperationSet = {
    type: 'set',
    document: string,
    value: any
};

type OperationUpdate = {
    type: 'update',
    document: string,
    values: { [string]: any }
};

type OperationDelete = {
    type: 'delete',
    document: string
};

/*
 * Factories to create the operations.
 */
function set(document: string, value: any): OperationSet {
    return {
        type: 'set',
        document,
        value
    };
}

function update(document: string, values: { [string]: any }): OperationUpdate {
    return {
        type: 'update',
        document,
        values
    };
}

function del(document: string): OperationDelete {
    return {
        type: 'delete',
        document
    };
}

export type BatchOperation = OperationSet | OperationUpdate | OperationDelete;
export default Batch;
