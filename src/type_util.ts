import diff from 'fast-diff';
export enum ValueTypes {
    // Primitives
    STRING,
    NUMBER,
    BOOLEAN,

    // Special values
    NULL,
    UNDEFINED,

    // Functions and symbols
    FUNCTION,
    SYMBOL,
    BIGINT,

    // Built-in objects
    ARRAY,
    SET,
    MAP,
    DATE,
    REGEXP,
    ERROR,
    PROMISE,
    WEAKSET,
    WEAKMAP,
    ARRAYBUFFER,
    TYPED_ARRAY,
    DATAVIEW,

    // Web APIs
    URL,
    BLOB,
    FILE,
    FORMDATA,

    // DOM objects
    HTMLELEMENT,
    NODE,
    EVENT,

    //Unknown object type
    OBJECT,

}

export function ValueTypes_To_String(type: ValueTypes): string {
    switch (type) {
        case ValueTypes.STRING: return 'String';
        case ValueTypes.NUMBER: return 'Number';
        case ValueTypes.BOOLEAN: return 'Boolean';
        case ValueTypes.NULL: return 'Null';
        case ValueTypes.UNDEFINED: return 'Undefined';
        case ValueTypes.FUNCTION: return 'Function';
        case ValueTypes.SYMBOL: return 'Symbol';
        case ValueTypes.BIGINT: return 'BigInt';
        case ValueTypes.ARRAY: return 'Array';
        case ValueTypes.SET: return 'Set';
        case ValueTypes.MAP: return 'Map';
        case ValueTypes.DATE: return 'Date';
        case ValueTypes.REGEXP: return 'RegExp';
        case ValueTypes.ERROR: return 'Error';
        case ValueTypes.PROMISE: return 'Promise';
        case ValueTypes.WEAKSET: return 'WeakSet';
        case ValueTypes.WEAKMAP: return 'WeakMap';
        case ValueTypes.ARRAYBUFFER: return 'ArrayBuffer';
        case ValueTypes.TYPED_ARRAY: return 'TypedArray';
        case ValueTypes.DATAVIEW: return 'DataView';
        case ValueTypes.URL: return 'URL';
        case ValueTypes.BLOB: return 'Blob';
        case ValueTypes.FILE: return 'File';
        case ValueTypes.FORMDATA: return 'FormData';
        case ValueTypes.HTMLELEMENT: return 'HTMLElement';
        case ValueTypes.NODE: return 'Node';
        case ValueTypes.EVENT: return 'Event';
        case ValueTypes.OBJECT: return 'Object';
        default:
            return `Type${type}`;
    }
}
/*
var good = 'Good dog';
var bad = 'Bad dog';

var result = diff(good, bad);
// [[-1, "Goo"], [1, "Ba"], [0, "d dog"]]

// Respect suggested edit location (cursor position), added in v1.1
diff('aaa', 'aaaa', 1)
// [[0, "a"], [1, "a"], [0, "aa"]]

// For convenience
diff.INSERT === 1;
diff.EQUAL === 0;
diff.DELETE === -1;
 */
type string_change = { old_value: string, new_value: string, new_range: [number, number], old_range: [number, number] };
export function string_changes(old_value: string, new_value: string, context_max: number): string_change[] {
    //For exmaple in "this super string is very long" vs "this super sentance is not long"
    //with context_max = 5
    //should return sometihng like: ["uper string  is v", "uper sentance is n"], ["g is very long", "e is not long"]
    let changes = diff(old_value, new_value, undefined, true);
    const result: string_change[] = [];
    let cur_old_pos = 0;
    let cur_new_pos = 0;
    if (changes.length < 2) {
        return [{ old_value: old_value, new_value: new_value, new_range: [0, new_value.length], old_range: [0, old_value.length] }];
    }
    let remover: string | undefined = undefined
    let adder: string | undefined = undefined
    for (const change of changes) {
        const [type, value] = change;

        if (type === diff.INSERT) {
            if (adder !== undefined) {
                console.warn("string_changes: adder is not undefined, this should not happen");
            }
            adder = value;
            cur_new_pos += value.length;
        } else if (type === diff.DELETE) {
            if (remover !== undefined) {
                console.warn("string_changes: remover is not undefined, this should not happen");
            }
            remover = value;
            cur_old_pos += value.length;
        } else if (type === diff.EQUAL) {
            // Equal text
            const equal_length = value.length;
            if (remover !== undefined || adder !== undefined) {
                const old_str = old_value.substring(Math.max(0, cur_old_pos - (remover ? remover.length : 0) - context_max), Math.min(old_value.length, cur_old_pos + context_max));
                const new_str = new_value.substring(Math.max(0, cur_new_pos - (adder ? adder.length : 0) - context_max), Math.min(new_value.length, cur_new_pos + context_max));

                result.push({
                    old_value: old_str,
                    new_value: new_str,
                    new_range: [Math.max(0, cur_new_pos - (adder ? adder.length : 0) - context_max), Math.min(new_value.length, cur_new_pos + context_max)],
                    old_range: [Math.max(0, cur_old_pos - (remover ? remover.length : 0) - context_max), Math.min(old_value.length, cur_old_pos + context_max)]
                });
                remover = undefined; // Reset after processing
                adder = undefined; // Reset after processing
            }
            cur_old_pos += equal_length;
            cur_new_pos += equal_length;

        }

    }
    if (remover !== undefined || adder !== undefined) {
        const old_str = old_value.substring(Math.max(0, cur_old_pos - (remover ? remover.length : 0) - context_max), Math.min(old_value.length, cur_old_pos + context_max));
        const new_str = new_value.substring(Math.max(0, cur_new_pos - (adder ? adder.length : 0) - context_max), Math.min(new_value.length, cur_new_pos + context_max));

        result.push({
            old_value: old_str,
            new_value: new_str,
            new_range: [Math.max(0, cur_new_pos - (adder ? adder.length : 0) - context_max), Math.min(new_value.length, cur_new_pos + context_max)],
            old_range: [Math.max(0, cur_old_pos - (remover ? remover.length : 0) - context_max), Math.min(old_value.length, cur_old_pos + context_max)]
        });
        remover = undefined; // Reset after processing
        adder = undefined; // Reset after processing
    }

    return result;

}


export function Value_To_String(value: any, type: ValueTypes): string {
    //rn just placeholders for every type

    switch (type) {
        case ValueTypes.STRING: { return '"' + value + '"'; };//should implement something similar to git diff
        case ValueTypes.NUMBER: { return value.toString(); };
        case ValueTypes.BOOLEAN: { return value ? "true" : "false"; }
        case ValueTypes.NULL: { return "null"; }
        case ValueTypes.UNDEFINED: { return "undefined"; }
        case ValueTypes.FUNCTION: {
            return value.name + (value.name.length > 0 ? " " : "") + value.toString().replace("\n", " ").replace(/\s+/g, ' ').trim();
        }
        case ValueTypes.SYMBOL: { return value.toString(); }
        case ValueTypes.BIGINT: { return value.toString() + "n"; }
        case ValueTypes.ARRAY: { return `[Array(${value.length})]`; } // Should have been parsed by DebugValueDiff_handler
        case ValueTypes.SET: { return `[Set(${value.size})]`; } // Should have been parsed by DebugValueDiff_handler
        case ValueTypes.MAP: { return `[Map(${value.size})]`; } // Should have been parsed by DebugValueDiff_handler
        case ValueTypes.DATE: { return (value as Date).toLocaleString(); }
        case ValueTypes.REGEXP: { return value.toString(); }
        case ValueTypes.ERROR: { return `[${value.name || "Error"}: ${value.message}]`; }
        case ValueTypes.PROMISE: { return "[Promise]"; }
        case ValueTypes.WEAKSET: { return "[WeakSet]"; }
        case ValueTypes.WEAKMAP: { return "[WeakMap]"; }
        case ValueTypes.ARRAYBUFFER: { return `[ArrayBuffer(${value.byteLength} bytes)]`; }
        case ValueTypes.TYPED_ARRAY: { return `[${value.constructor.name}(${value.length})]`; }
        case ValueTypes.DATAVIEW: { return `[DataView(${value.byteLength} bytes)]`; }
        case ValueTypes.URL: { return value.toString(); }
        case ValueTypes.BLOB: { return `[Blob(${value?.size} bytes, ${value?.type || "unknown"})]`; }
        case ValueTypes.FILE: { return `[File(${value.name || "unnamed"}, ${value.size} bytes)]`; }
        case ValueTypes.FORMDATA: { return `[Formdata(${Array(value.keys()).length})]`; } // Should have been parsed by DebugValueDiff_handler
        case ValueTypes.HTMLELEMENT: { return "[HTMLElement]"; }//needs further processing
        case ValueTypes.NODE: { return "[Node]"; }
        case ValueTypes.EVENT: { return `[Event${value?.type ? ": " + value.type : ""}]`; }
        case ValueTypes.OBJECT: { return "[Object]"; }
        default: { return `[Unknown: ${type}]`; }


    }
}

export function GetValueType(obj: any): ValueTypes {
    if (obj === null) return ValueTypes.NULL;
    if (obj === undefined) return ValueTypes.UNDEFINED;

    const type = typeof obj;

    // Handle primitives first (most common cases)
    if (type !== 'object') {
        switch (type) {
            case 'string': return ValueTypes.STRING;
            case 'number': return ValueTypes.NUMBER;
            case 'boolean': return ValueTypes.BOOLEAN;
            case 'function': return ValueTypes.FUNCTION;
            case 'symbol': return ValueTypes.SYMBOL;
            case 'bigint': return ValueTypes.BIGINT;
        }
    }

    // Now handle objects - use fastest checks first
    if (Array.isArray(obj)) return ValueTypes.ARRAY;

    // Use constructor checks for built-ins (faster than instanceof for known types)
    const constructor = obj.constructor;

    // Most common built-ins first
    if (constructor === Object) return ValueTypes.OBJECT;
    if (constructor === Date) return ValueTypes.DATE;
    if (constructor === RegExp) return ValueTypes.REGEXP;
    if (constructor === Error) return ValueTypes.ERROR;

    // Collections
    if (constructor === Set) return ValueTypes.SET;
    if (constructor === Map) return ValueTypes.MAP;
    if (constructor === WeakSet) return ValueTypes.WEAKSET;
    if (constructor === WeakMap) return ValueTypes.WEAKMAP;

    // Binary data - check typed arrays first as they're more common
    if (ArrayBuffer.isView(obj)) return ValueTypes.TYPED_ARRAY;
    if (constructor === ArrayBuffer) return ValueTypes.ARRAYBUFFER;
    if (constructor === DataView) return ValueTypes.DATAVIEW;

    // Promise
    if (constructor === Promise) return ValueTypes.PROMISE;

    // Web APIs - only in browser and less common, so check last
    if (typeof window !== 'undefined') {
        // Constructor checks are faster than instanceof
        if (constructor === URL) return ValueTypes.URL;
        if (constructor === File) return ValueTypes.FILE;
        if (constructor === Blob) return ValueTypes.BLOB;
        if (constructor === FormData) return ValueTypes.FORMDATA;

        // DOM - most expensive checks last
        if (obj instanceof HTMLElement) return ValueTypes.HTMLELEMENT;
        if (obj instanceof Node) return ValueTypes.NODE;
        if (obj instanceof Event) return ValueTypes.EVENT;
    }

    // Fallback for plain objects and unknown types
    return ValueTypes.OBJECT;
}