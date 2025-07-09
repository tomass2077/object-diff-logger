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
export function Value_To_String(value: any, type: ValueTypes, max_length: number = 35): string {
    //rn just placeholders for every type

    switch (type) {
        case ValueTypes.STRING: { return '"' + value + '"'; };//should implement something similar to git diff
        case ValueTypes.NUMBER: { return value.toString(); };
        case ValueTypes.BOOLEAN: { return value ? "true" : "false"; }
        case ValueTypes.NULL: { return "null"; }
        case ValueTypes.UNDEFINED: { return "undefined"; }
        case ValueTypes.FUNCTION: {

            let str: string = value.toString().replace("\n", " ").replace(/\s+/g, ' ').trim() //nemove newlines
            if (str.length > max_length) {
                const cut_length = Math.floor(max_length / 2);
                str = str.substring(0, cut_length) + " ... " + str.substring(str.length - cut_length, str.length);
            }

            return value.name + (value.name.length > 0 ? " " : "") + str;
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