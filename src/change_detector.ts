import { GetValueType, ValueTypes } from "./type_util";

export enum CHANGE_TYPES {
    UPDATE,
    ADD_KEYS,
    REMOVE_KEYS,
    TYPE_CHANGE,
    LENGTH_CHANGE,
    SET_CHANGE,
    ERR_DEPTH_LIMIT,
    ERR_CIRCULAR_REFERENCE,
}
interface Base_Change {
    path: (string | number)[];
}
interface Change_Update extends Base_Change {
    type: CHANGE_TYPES.UPDATE;
    oldValue: any;
    newValue: any;
    value_type: ValueTypes;
}
interface Change_AddKeys extends Base_Change {
    type: CHANGE_TYPES.ADD_KEYS;
    new_keys: any[];
    value_type: ValueTypes;
}
interface Change_RemoveKeys extends Base_Change {
    type: CHANGE_TYPES.REMOVE_KEYS;
    removed_keys: any[];
    value_type: ValueTypes;
}
interface Change_TypeChange extends Base_Change {
    type: CHANGE_TYPES.TYPE_CHANGE;
    oldValue: any;
    newValue: any;
    old_value_type: ValueTypes;
    new_value_type: ValueTypes;
}
interface Change_LengthChange extends Base_Change {
    type: CHANGE_TYPES.LENGTH_CHANGE;
    oldValue: number;
    newValue: number;
    value_type: ValueTypes;
}
interface Change_SetChange extends Base_Change {
    type: CHANGE_TYPES.SET_CHANGE;
    new_values: any[];
    removed_values: any[];
    value_type: ValueTypes;
}

interface Change_DepthLimit extends Base_Change {
    type: CHANGE_TYPES.ERR_DEPTH_LIMIT;
}
interface Change_CircularReference extends Base_Change {
    type: CHANGE_TYPES.ERR_CIRCULAR_REFERENCE;
    circular_path: (string | number)[];
    value_type: ValueTypes;
}
type Change_Entry = Change_Update | Change_AddKeys | Change_RemoveKeys | Change_TypeChange | Change_LengthChange | Change_SetChange | Change_DepthLimit | Change_CircularReference;



export function detect_object_changes(obj_OLD: any, obj_NEW: any, path: (string | number)[], visited: Map<object, (string | number)[]> = new Map(), depth: number = 0, maxDepth: number = 10): Change_Entry[] {
    // Prevent infinite recursion from depth
    if (depth > maxDepth) {
        return [{ path, type: CHANGE_TYPES.ERR_DEPTH_LIMIT }];
    }
    // Prevent infinite recursion from circular references
    const TypeOf_OLD = GetValueType(obj_OLD);
    const TypeOf_NEW = GetValueType(obj_NEW);

    const errors: Change_Entry[] = []
    if (TypeOf_OLD !== TypeOf_NEW) {
        errors.push({ path, type: CHANGE_TYPES.TYPE_CHANGE, oldValue: obj_OLD, newValue: obj_NEW, old_value_type: TypeOf_OLD, new_value_type: TypeOf_NEW });
    }

    const needsCircularCheck = [
        ValueTypes.OBJECT, ValueTypes.ARRAY, ValueTypes.MAP, ValueTypes.SET,
        ValueTypes.HTMLELEMENT, ValueTypes.NODE, ValueTypes.ERROR
    ].includes(TypeOf_NEW);

    if (needsCircularCheck && obj_NEW !== null) {
        const existingPath = visited.get(obj_NEW);

        if (existingPath !== undefined)
            errors.push({ path, type: CHANGE_TYPES.ERR_CIRCULAR_REFERENCE, circular_path: existingPath, value_type: TypeOf_NEW });

        else
            visited.set(obj_NEW, [...path]);
    }
    if (errors.length > 0) {
        return errors
    }

    // If both are the same type, we can proceed with the diff
    /**
     * These are just a===b checks, so we can skip them
      case ValueTypes.NULL:
        case ValueTypes.UNDEFINED:
      case ValueTypes.STRING:
        case ValueTypes.NUMBER:
        case ValueTypes.BOOLEAN:
 
        case ValueTypes.PROMISE:
        case ValueTypes.WEAKSET:
        case ValueTypes.WEAKMAP:
 
        case ValueTypes.NODE:
        case ValueTypes.EVENT:
 
 
        //These need better handling:
        case ValueTypes.FUNCTION:
        case ValueTypes.SYMBOL:
        case ValueTypes.BIGINT:
            case ValueTypes.HTMLELEMENT:
     */
    const SimpleUpdate: Change_Entry = { path, type: CHANGE_TYPES.UPDATE, oldValue: obj_OLD, newValue: obj_NEW, value_type: TypeOf_OLD }
    switch (TypeOf_OLD) {

        case ValueTypes.ARRAY: {

            if (obj_OLD.length !== obj_NEW.length)
                return [{ path, type: CHANGE_TYPES.LENGTH_CHANGE, oldValue: obj_OLD.length, newValue: obj_NEW.length, value_type: TypeOf_OLD }];

            let entries: Change_Entry[] = [];
            for (let i = 0; i < Math.min(obj_OLD.length, obj_NEW.length); i++) {
                entries = entries.concat(detect_object_changes(obj_OLD[i], obj_NEW[i], [...path, i], visited, depth + 1, maxDepth));
            }
            return entries;
        }
        case ValueTypes.SET: {

            const missingInB = Array.from(obj_OLD).filter(item => !obj_NEW.has(item));
            const missingInA = Array.from(obj_NEW).filter(item => !obj_OLD.has(item));
            if (missingInB.length > 0 || missingInA.length > 0) {
                return ([{
                    path,
                    type: CHANGE_TYPES.SET_CHANGE,
                    new_values: missingInA,
                    removed_values: missingInB,
                    value_type: TypeOf_OLD
                }]);
            }
            return [];
        }
        case ValueTypes.MAP: {

            const keys_A: string[] = Array.from(obj_OLD.keys());
            const keys_B: string[] = Array.from(obj_NEW.keys());
            const keys_common = keys_A.filter(key => keys_B.includes(key));
            const keys_removed = keys_A.filter(key => !keys_B.includes(key));
            const keys_added = keys_B.filter(key => !keys_A.includes(key));
            const entries: Change_Entry[] = [];

            if (keys_removed.length > 0)
                entries.push({ path, type: CHANGE_TYPES.REMOVE_KEYS, removed_keys: keys_removed, value_type: TypeOf_OLD });
            if (keys_added.length > 0)
                entries.push({ path, type: CHANGE_TYPES.ADD_KEYS, new_keys: keys_added, value_type: TypeOf_NEW });

            for (const key of keys_common) {
                const valueA = obj_OLD.get(key);
                const valueB = obj_NEW.get(key);
                const entry = detect_object_changes(valueA, valueB, [...path, key], visited, depth + 1, maxDepth);
                if (entry.length > 0) {
                    entries.push(...entry);
                }
            }
            return entries;
        }
        case ValueTypes.DATE: {
            // Compare dates by their time value
            if (obj_OLD.getTime() !== obj_NEW.getTime()) {
                return [SimpleUpdate];
            }
            return [];
        }
        case ValueTypes.REGEXP: {
            // Compare regex patterns and flags
            if (obj_OLD.source !== obj_NEW.source || obj_OLD.flags !== obj_NEW.flags) {
                return [SimpleUpdate];
            }
            return [];
        }
        case ValueTypes.ERROR: {
            // Compare error messages and names
            if (obj_OLD.message !== obj_NEW.message || obj_OLD.name !== obj_NEW.name) {
                return [SimpleUpdate];
            }
            return [];
        }

        case ValueTypes.ARRAYBUFFER: {
            const bufferA = obj_OLD as ArrayBuffer;
            const bufferB = obj_NEW as ArrayBuffer;

            if (bufferA.byteLength !== bufferB.byteLength) {
                return [{ path, type: CHANGE_TYPES.LENGTH_CHANGE, oldValue: bufferA.byteLength, newValue: bufferB.byteLength, value_type: TypeOf_OLD }];
            }

            // Compare byte contents
            const viewA = new Uint8Array(bufferA);
            const viewB = new Uint8Array(bufferB);

            for (let i = 0; i < viewA.length; i++) {
                if (viewA[i] !== viewB[i]) {
                    return [SimpleUpdate];
                }
            }
            return [];
        }
        case ValueTypes.TYPED_ARRAY: {
            if (obj_OLD.length !== obj_NEW.length) {
                return [{ path, type: CHANGE_TYPES.LENGTH_CHANGE, oldValue: obj_OLD.length, newValue: obj_NEW.length, value_type: TypeOf_OLD }];
            }

            // Compare element-wise
            for (let i = 0; i < obj_OLD.length; i++) {
                if (obj_OLD[i] !== obj_NEW[i]) {
                    return [SimpleUpdate];
                }
            }
            return [];
        }
        case ValueTypes.DATAVIEW: {
            const viewA = obj_OLD as DataView;
            const viewB = obj_NEW as DataView;

            if (viewA.byteLength !== viewB.byteLength) {
                return [{ path, type: CHANGE_TYPES.LENGTH_CHANGE, oldValue: viewA.byteLength, newValue: viewB.byteLength, value_type: TypeOf_OLD }];
            }

            // Compare byte contents
            for (let i = 0; i < viewA.byteLength; i++) {
                if (viewA.getUint8(i) !== viewB.getUint8(i)) {
                    return [SimpleUpdate];
                }
            }
            return [];
        }
        case ValueTypes.URL: {
            // Compare URL strings
            if (obj_OLD.toString() !== obj_NEW.toString()) {
                return [SimpleUpdate];
            }
            return [];
        }
        case ValueTypes.BLOB: {

            if (obj_OLD.size !== obj_NEW.size || obj_OLD.type !== obj_NEW.type)
                return [SimpleUpdate];
            return [];
        }
        case ValueTypes.FILE: {
            const fileA = obj_OLD as File;
            const fileB = obj_NEW as File;

            if (fileA.type !== fileB.type || fileA.name !== fileB.name || fileA.lastModified !== fileB.lastModified || fileA.size !== fileB.size) {
                return [SimpleUpdate];
            }
            return [];
        }
        case ValueTypes.FORMDATA: {
            const formDataA = obj_OLD as FormData;
            const formDataB = obj_NEW as FormData;
            const entriesA = Array.from(formDataA.entries());
            const entriesB = Array.from(formDataB.entries());
            entriesA.sort((a, b) => a[0].localeCompare(b[0]));
            entriesB.sort((a, b) => a[0].localeCompare(b[0]));

            // Get keys for comparison
            const keys_A = entriesA.map(entry => entry[0]);
            const keys_B = entriesB.map(entry => entry[0]);
            const keys_common = keys_A.filter(key => keys_B.includes(key));
            const keys_removed = keys_A.filter(key => !keys_B.includes(key));
            const keys_added = keys_B.filter(key => !keys_A.includes(key));
            const entries: Change_Entry[] = [];
            if (keys_removed.length > 0) {
                entries.push({ path, type: CHANGE_TYPES.REMOVE_KEYS, removed_keys: keys_removed, value_type: TypeOf_OLD });
            }
            if (keys_added.length > 0) {
                entries.push({ path, type: CHANGE_TYPES.ADD_KEYS, new_keys: keys_added, value_type: TypeOf_NEW });
            }
            // Check common keys
            for (const key of keys_common) {
                const valueA = formDataA.get(key);
                const valueB = formDataB.get(key);
                const entry = detect_object_changes(valueA, valueB, [...path, key], visited, depth + 1, maxDepth);
                if (entry.length > 0) {
                    entries.push(...entry);
                }
            }
            return entries;
        }


        case ValueTypes.OBJECT: {
            // Handle plain objects

            const keys_A = Object.keys(obj_OLD);
            const keys_B = Object.keys(obj_NEW);
            const keys_common = keys_A.filter(key => keys_B.includes(key));
            const keys_removed = keys_A.filter(key => !keys_B.includes(key));
            const keys_added = keys_B.filter(key => !keys_A.includes(key));
            const entries: Change_Entry[] = [];
            if (keys_removed.length > 0) {
                entries.push({ path, type: CHANGE_TYPES.REMOVE_KEYS, removed_keys: keys_removed, value_type: TypeOf_OLD });
            }
            if (keys_added.length > 0) {
                entries.push({ path, type: CHANGE_TYPES.ADD_KEYS, new_keys: keys_added, value_type: TypeOf_NEW });
            }
            // Check common keys
            for (const key of keys_common) {
                const valueA = obj_OLD[key];
                const valueB = obj_NEW[key];
                const entry = detect_object_changes(valueA, valueB, [...path, key], visited, depth + 1, maxDepth);
                if (entry.length > 0) {
                    entries.push(...entry);
                }
            }
            return entries;
        }
        default: {
            // For any other type, we can just compare references
            if (obj_OLD !== obj_NEW) {
                return [SimpleUpdate];
            }
            return [];
        }
    }
}

