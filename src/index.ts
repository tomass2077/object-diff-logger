import { cloneDeep, isNumber, min } from 'lodash'
import { GetValueType, Value_To_String, ValueTypes, ValueTypes_To_String } from './type_util';
import { DiffLogger } from './smart_logger';
import { CHANGE_TYPES, detect_object_changes } from './change_detector';


const debug_object_diff_storage: { [key: string]: { obj: any, timings: ({ [key: string]: DOMHighResTimeStamp }), last_change_time?: DOMHighResTimeStamp } } = {}

export interface ObjectDiffLogger_Config {
    maxDepth?: number; // Maximum depth to check for differences(default is 30)
    path_blacklist?: string[]; // Exclude paths that match these patterns
    path_whitelist?: string[]; // Only include paths that match these patterns
    label_override?: string; // Override label for the diff output
    suppress_circular_reference_warning?: boolean; // Suppress circular reference warnings(default is false)
    suppress_depth_limit_warning?: boolean; // Suppress depth limit warnings(default is false)
    show_debug_info?: boolean; // Show debug information in the console(default is false)
    record_timing_info?: boolean; // Record time since the last value change in some path(default is false)
    length_limit?: number; // Limit the length of string representations in the diff output(default is 45)
}
function FormatPath(path: (string | number)[], remove_prefix = false): string {
    if (remove_prefix) {
        if (path.length === 0) return '';
        const path_s = path.map(p => typeof p === 'number' ? `[${p}]` : `.${p}`).join('')
        if (path_s.startsWith('.')) {
            return path_s.substring(1);
        }
        return path_s;
    }
    if (path.length === 0) return '$';
    return '$' + path.map(p => typeof p === 'number' ? `[${p}]` : `.${p}`).join('');
}

function path_checker(pattern: string, path_list: (string | number)[]): boolean {
    pattern = pattern.trim()
    if (pattern.startsWith('$'))
        pattern = pattern.substring(1);
    if (pattern.startsWith('.'))
        pattern = pattern.substring(1);

    const formatted_path = FormatPath(path_list, true);
    if (pattern === formatted_path) return true; // If the path is exactly the same as the pattern, accept it
    if (pattern === '*') return true; // If the pattern is '*', accept any path

    const parts = pattern.split(/(\*\*|\*|\[\])/).filter(part => part !== '');
    let processed_parts = "";
    let i = -1;
    for (const part of parts) {
        i++;
        const is_index_skip = part === '[]';
        const is_long_wildcard = part === '**';
        const is_wildcard = part === '*';
        if (!is_index_skip && !is_wildcard && !is_long_wildcard) {
            processed_parts += part;
            if (!formatted_path.startsWith(processed_parts))
                return false; // If the path does not start with the processed parts, reject it
            continue; // If the path starts with the processed parts, continue to the next part
        }
        if (formatted_path.startsWith(part)) {
            processed_parts += part;
            continue;
        }
        if (is_index_skip && formatted_path.startsWith(processed_parts + '[')) {
            //check if the next part of the formatted path starts with [n]
            const next_part = formatted_path.substring(processed_parts.length + 1);
            const next_index = next_part.indexOf(']');
            if (next_index !== -1) {
                //index
                const index_part = next_part.substring(0, next_index);
                //check if its a number
                if (index_part.length > 0 && isNumber(parseInt(index_part))) {
                    //the cutout
                    const cutout = formatted_path.substring(processed_parts.length, processed_parts.length + next_index + 2);
                    processed_parts += cutout; // Add the index part to the processed parts
                    continue
                }
            }
        }
        if (is_long_wildcard) {
            const next_part = formatted_path.substring(processed_parts.length);
            if (i === parts.length - 1) {
                return true; // If we are at the last part and it is a wildcard, accept it
            }

            let next_elem = parts[i + 1];
            if (next_elem === '[]') {
                const next_brace = next_part.indexOf('[');
                if (next_brace !== -1) {
                    //if the next part is a bracket, skip to the next part
                    processed_parts += next_part.substring(0, next_brace);
                    continue;
                }
            }
            else {
                const next_index = next_part.indexOf(next_elem);
                if (next_index !== -1) {
                    //if the next part is a string, skip to the next part
                    processed_parts += next_part.substring(0, next_index);
                    continue;
                }
            }
        }
        if (is_wildcard) {
            const next_part = formatted_path.substring(processed_parts.length).split(/(\[|\.)/)[0];
            //split at the next backet or dot
            if (next_part.length > 0) {
                processed_parts += next_part; // Add the next part to the processed parts
                continue; // Continue to the next part
            }
        }
        // If we reach here, it means the path does not match the pattern
        return false;

    }
    if (processed_parts === formatted_path) {
        return true; // If the processed parts match the formatted path, accept it
    }
    return false
}
//function test_pattern_checker(expected: boolean, pattern: string, path: string) {
//    if (path_checker(pattern, [path]) !== expected) {
//        console.error(`ERRR: Pattern check failed for pattern "${pattern}" and path "${FormatPath([path])}". Expected ${expected}, but got ${!expected}.`);
//    }
//    else {
//        console.log(`      Pattern check passed for pattern "${pattern}" and path "${FormatPath([path])}".`);
//    }
//}
//test_pattern_checker(true, '$', '');
//test_pattern_checker(true, '$.a', 'a');
//test_pattern_checker(true, '$.a.b', 'a.b');
//test_pattern_checker(true, '$.a.*.c', 'a.b.c');
//test_pattern_checker(true, '$.a.**.c', 'a.b.c');
//test_pattern_checker(true, '$.a.**.d', 'a.b.c.d');
//test_pattern_checker(false, '$.a.*.d', 'a.b.c.d');
//test_pattern_checker(true, '$.a.*', 'a.b');
//test_pattern_checker(true, '$.a.**', 'a.b.c');
//test_pattern_checker(true, '$.**.d', 'a.b.c.d');
//test_pattern_checker(true, '**.d', 'a.b.c.d');
////some false statements
//test_pattern_checker(false, '$.a.b.c', 'a.b');
//test_pattern_checker(false, '$.a.b.c', 'a.b.c.d');
//test_pattern_checker(false, '$.a.b[].c', 'a.b.c');
//test_pattern_checker(false, '$.a.b[]c', 'a.b.c');
//test_pattern_checker(true, '$.a.b[]c', 'a.b[]c');
//test_pattern_checker(true, '$.a.b[]c', 'a.b[2]c');
//test_pattern_checker(true, '$.a.b[]c', 'a.b[55]c');
//test_pattern_checker(true, '$.a.b[55]c', 'a.b[55]c');



function ChangeInfo(old_v: any, new_v: any, type: ValueTypes): string {
    if (type == ValueTypes.DATE) {
        const decimalPlaces = 1; // Number of decimal places for milliseconds
        const time_old = old_v as Date
        const time_new = new_v as Date
        const diffMs = time_new.getTime() - time_old.getTime();
        if (diffMs === 0) return "";

        const absMs = Math.abs(diffMs);
        let diffString = "";
        if (absMs >= 24 * 60 * 60 * 1000) {
            const days = absMs / (24 * 60 * 60 * 1000);
            diffString = `${days.toFixed(decimalPlaces)} day${days !== 1 ? "s" : ""}`;
        } else if (absMs >= 60 * 60 * 1000) {
            const hours = absMs / (60 * 60 * 1000);
            diffString = `${hours.toFixed(decimalPlaces)} hour${hours !== 1 ? "s" : ""}`;
        } else if (absMs >= 60 * 1000) {
            const minutes = absMs / (60 * 1000);
            diffString = `${minutes.toFixed(decimalPlaces)} minute${minutes !== 1 ? "s" : ""}`;
        } else if (absMs >= 1000) {
            const seconds = absMs / 1000;
            diffString = `${seconds.toFixed(decimalPlaces)} second${seconds !== 1 ? "s" : ""}`;
        } else {
            diffString = `${absMs} ms`;
        }

        return ` (Δ${diffMs > 0 ? "+" : "-"}${diffString})`;
    }
    return ""
}

export function ObjectDiffLogger_stored(value: any, key: string, config?: ObjectDiffLogger_Config): boolean {
    const logger = new DiffLogger();
    const t0 = Date.now();
    if (config === undefined) config = {}

    if (!(key in debug_object_diff_storage)) {
        logger.logAdded(FormatPath([key]));
        debug_object_diff_storage[key] = { obj: cloneDeep(value), timings: {}, last_change_time: undefined };
        return true; // New key, no previous value to compare
    }

    const oldValue = debug_object_diff_storage[key].obj;
    const changes = detect_object_changes(oldValue, value, [], new Map<object, (string | number)[]>(), 0, config.maxDepth === undefined ? 30 : config.maxDepth);
    debug_object_diff_storage[key].obj = cloneDeep(value)

    if (changes.length > 0) {



        const timing = config.record_timing_info ? debug_object_diff_storage[key].timings : {};


        for (const change of changes) {
            const pathString = FormatPath(change.path);

            if (config.path_blacklist && config.path_blacklist.some(p => path_checker(p, change.path))) {
                continue;
            }
            if (config.path_whitelist && !config.path_whitelist.some(p => path_checker(p, change.path))) {
                continue;
            }

            switch (change.type) {
                case CHANGE_TYPES.UPDATE:
                    let timingInfo = "";
                    if (config.record_timing_info) {

                        if (!(pathString in timing)) {
                            timing[pathString] = t0;
                        } else {
                            const timeSinceLastChange = t0 - timing[pathString];
                            timingInfo = ` (Δ${timeSinceLastChange.toFixed(2)} ms)`;
                            timing[pathString] = t0; // Update the last change time
                        }
                    }
                    if (change.value_type === ValueTypes.STRING || change.value_type === ValueTypes.FUNCTION) {
                        logger.logUpdateDiff(pathString,
                            change.oldValue,
                            change.newValue,
                            ChangeInfo(change.oldValue, change.newValue, change.value_type),
                            timingInfo,
                            change.value_type,
                            config.length_limit || 45);
                    }
                    else
                        logger.logUpdate(pathString,
                            Value_To_String(change.oldValue, change.value_type),
                            Value_To_String(change.newValue, change.value_type),
                            ChangeInfo(change.oldValue, change.newValue, change.value_type),
                            timingInfo,
                            ValueTypes_To_String(change.value_type));

                    break;

                case CHANGE_TYPES.ADD_KEYS:
                    const addedKeys = config.path_blacklist ? change.new_keys.filter(k => {
                        const path_arr = [...change.path, k]
                        const pathString = FormatPath(path_arr);
                        return !config.path_blacklist!.some(p => path_checker(p, path_arr))
                    }) : change.new_keys;
                    if (addedKeys.length > 0) {
                        logger.logKeyChange(pathString, 'Added', addedKeys, ValueTypes_To_String(change.value_type));
                    }
                    break;

                case CHANGE_TYPES.REMOVE_KEYS:
                    const removedKeys = config.path_blacklist ? change.removed_keys.filter(k => {
                        const path_arr = [...change.path, k]
                        const pathString = FormatPath(path_arr);
                        return !config.path_blacklist!.some(p => path_checker(p, path_arr))
                    }) : change.removed_keys;
                    if (removedKeys.length > 0) {
                        logger.logKeyChange(pathString, 'Removed', removedKeys, ValueTypes_To_String(change.value_type));
                    }
                    break;

                case CHANGE_TYPES.TYPE_CHANGE:
                    logger.logTypeChange(pathString, ValueTypes_To_String(change.old_value_type), ValueTypes_To_String(change.new_value_type));
                    break;

                case CHANGE_TYPES.LENGTH_CHANGE:
                    logger.logLengthChange(pathString, change.oldValue, change.newValue, ValueTypes_To_String(change.value_type));
                    break;

                case CHANGE_TYPES.SET_CHANGE:
                    logger.logSetChange(pathString, change.removed_values, change.new_values, ValueTypes_To_String(change.value_type));
                    break;

                case CHANGE_TYPES.ERR_DEPTH_LIMIT:
                    if (!config.suppress_depth_limit_warning) {
                        logger.logError(pathString, 'depth');
                    }
                    break;

                case CHANGE_TYPES.ERR_CIRCULAR_REFERENCE:
                    if (!config.suppress_circular_reference_warning) {
                        logger.logError(pathString, 'circular', FormatPath(change.circular_path), ValueTypes_To_String(change.value_type));
                    }
                    break;

                default:
                    logger.logUnknown(pathString, change);
                    break;
            }
        }
        if (config.record_timing_info) {
            debug_object_diff_storage[key].timings = timing;
        }
        return (logger.flushMessages(config.label_override || key, t0, !!config.show_debug_info) !== 0);

    }
    return false;
}
export function ObjectDiffLogger_clearStorage() {
    for (const key in debug_object_diff_storage) {
        delete debug_object_diff_storage[key];
    }
}

export function ObjectDiffLogger(old_value: any, new_value: any, label: string, config?: ObjectDiffLogger_Config) {
    const logger = new DiffLogger();
    const t0 = Date.now();
    if (config === undefined) config = {}

    const changes = detect_object_changes(old_value, new_value, [], new Map<object, (string | number)[]>(), 0, config.maxDepth === undefined ? 30 : config.maxDepth);

    if (changes.length > 0) {

        for (const change of changes) {
            const pathString = FormatPath(change.path);

            if (config.path_blacklist && config.path_blacklist.some(p => path_checker(p, change.path))) {
                continue;
            }
            if (config.path_whitelist && !config.path_whitelist.some(p => path_checker(p, change.path))) {
                continue;
            }

            switch (change.type) {
                case CHANGE_TYPES.UPDATE:
                    logger.logUpdate(pathString,
                        Value_To_String(change.oldValue, change.value_type),
                        Value_To_String(change.newValue, change.value_type),
                        ChangeInfo(change.oldValue, change.newValue, change.value_type),
                        "",//no timing info for single diff
                        ValueTypes_To_String(change.value_type));

                    break;

                case CHANGE_TYPES.ADD_KEYS:
                    const addedKeys = config.path_blacklist ? change.new_keys.filter(k => {
                        const path_arr = [...change.path, k]
                        return !config.path_blacklist!.some(p => path_checker(p, path_arr))
                    }) : change.new_keys;
                    if (addedKeys.length > 0) {
                        logger.logKeyChange(pathString, 'Added', addedKeys, ValueTypes_To_String(change.value_type));
                    }
                    break;

                case CHANGE_TYPES.REMOVE_KEYS:
                    const removedKeys = config.path_blacklist ? change.removed_keys.filter(k => {
                        const path_arr = [...change.path, k]
                        return !config.path_blacklist!.some(p => path_checker(p, path_arr))
                    }) : change.removed_keys;
                    if (removedKeys.length > 0) {
                        logger.logKeyChange(pathString, 'Removed', removedKeys, ValueTypes_To_String(change.value_type));
                    }
                    break;

                case CHANGE_TYPES.TYPE_CHANGE:
                    logger.logTypeChange(pathString, ValueTypes_To_String(change.old_value_type), ValueTypes_To_String(change.new_value_type));
                    break;

                case CHANGE_TYPES.LENGTH_CHANGE:
                    logger.logLengthChange(pathString, change.oldValue, change.newValue, ValueTypes_To_String(change.value_type));
                    break;

                case CHANGE_TYPES.SET_CHANGE:
                    logger.logSetChange(pathString, change.removed_values, change.new_values, ValueTypes_To_String(change.value_type));
                    break;

                case CHANGE_TYPES.ERR_DEPTH_LIMIT:
                    if (!config.suppress_depth_limit_warning) {
                        logger.logError(pathString, 'depth');
                    }
                    break;

                case CHANGE_TYPES.ERR_CIRCULAR_REFERENCE:
                    if (!config.suppress_circular_reference_warning) {
                        logger.logError(pathString, 'circular', FormatPath(change.circular_path), ValueTypes_To_String(change.value_type));
                    }
                    break;

                default:
                    logger.logUnknown(pathString, change);
                    break;
            }
        }

        return (logger.flushMessages(config.label_override || label, t0, !!config.show_debug_info) !== 0);

    }
    return false;
}