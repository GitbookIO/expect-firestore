/* @flow */

const Batch = {
    set,
    update,
    delete: del
};

type OperationSet = {
    method: 'set',
    document: string,
    data: any
};

type OperationUpdate = {
    method: 'update',
    document: string,
    data: { [string]: any }
};

type OperationDelete = {
    method: 'delete',
    document: string
};

/*
 * Factories to create the operations.
 */
function set(document: string, data: any): OperationSet {
    return {
        method: 'set',
        document,
        data
    };
}

function update(document: string, data: { [string]: any }): OperationUpdate {
    return {
        method: 'update',
        document,
        data
    };
}

function del(document: string): OperationDelete {
    return {
        method: 'delete',
        document
    };
}

export type BatchOperation = OperationSet | OperationUpdate | OperationDelete;
export default Batch;
