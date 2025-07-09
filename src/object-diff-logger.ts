import { cloneDeep } from 'lodash'
import { GetValueType, Value_To_String, ValueTypes, ValueTypes_To_String } from './type_util';
import { DiffLogger } from './smart_logger';
import { CHANGE_TYPES, detect_object_changes } from './change_detector';


const debug_object_diff_storage: { [key: string]: { obj: any, timings: ({ [key: string]: DOMHighResTimeStamp }), last_change_time?: DOMHighResTimeStamp } } = {}

interface logDeepObjectDiff_Config {
    maxDepth?: number; // Maximum depth to check for differences
    path_blacklist?: string[]; // Exclude paths that match these patterns
    path_whitelist?: string[]; // Only include paths that match these patterns
    label_override?: string; // Override label for the diff output
    suppress_circular_reference_warning?: boolean; // Suppress circular reference warnings
    suppress_depth_limit_warning?: boolean; // Suppress depth limit warnings
    show_debug_info?: boolean; // Show debug information in the console
    record_timing_info?: boolean; // Record time since the last value change in some path
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

function path_checker(pattern: string, path: (string | number)[]): boolean {
    pattern = pattern.trim()
    const formatted_path = FormatPath(path, true);
    if (pattern === formatted_path) return true; // If the path is exactly the same as the pattern, accept it
    if (pattern === '*') return true; // If the pattern is '*', accept any path
    if (pattern.endsWith('*') && formatted_path.startsWith(pattern.slice(0, -1))) return true;

    //split using regex at [n] or []
    const split_at_indexes_pattern = pattern.split(/(\[\d+\]|\[\])/).filter(p => p !== '');
    const split_at_indexes_path = formatted_path.split(/(\[\d+\]|\[\])/).filter(p => p !== '');
    if ((pattern.endsWith("*") && split_at_indexes_pattern.length < split_at_indexes_path.length) || split_at_indexes_path.length === split_at_indexes_path.length) {
        if (split_at_indexes_pattern.length === 0 || split_at_indexes_path.length === 0) return false; // If either pattern or path is empty, return false

        if (pattern.endsWith("*")) {
            split_at_indexes_pattern[split_at_indexes_pattern.length - 1] = split_at_indexes_pattern[split_at_indexes_pattern.length - 1].slice(0, -1); // Remove the trailing '*' from the pattern
        }
        const min_length = Math.min(split_at_indexes_pattern.length, split_at_indexes_path.length);
        for (let i = 0; i < min_length; i++) {
            const pattern_part = split_at_indexes_pattern[i].trim();
            const path_part = split_at_indexes_path[i].trim();
            if (pattern_part === path_part) continue; // If the parts are equal, continue
            //if pattern_part === "[]" and path_part is [n]. btw regex that 
            if (pattern_part === "[]" && path_part.startsWith("[") && path_part.endsWith("]")) {
                continue; // If the pattern part is "[]" and the path part is an index, continue
            }
            return false; // If any part does not match, return false
        }
        return true; // If all parts match, return true
    }
    return false
}
//function test_pattern_checker(expected: boolean, pattern: string, path: (string | number)[]) {
//    if (path_checker(pattern, path) !== expected) {
//        console.error(`ERRR: Pattern check failed for pattern "${pattern}" and path "${FormatPath(path)}". Expected ${expected}, but got ${!expected}.`);
//    }
//    else {
//        console.log(`      Pattern check passed for pattern "${pattern}" and path "${FormatPath(path)}".`);
//    }
//}

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

function logDeepObjectDiff_Stored(value: any, key: string, config?: logDeepObjectDiff_Config): boolean {
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
function logDeepObjectDiff_Clear_Storage() {
    for (const key in debug_object_diff_storage) {
        delete debug_object_diff_storage[key];
    }
}

function logDeepObjectDiff(old_value: any, new_value: any, label: string, config?: logDeepObjectDiff_Config) {
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


export default logDeepObjectDiff;

export {
    logDeepObjectDiff_Stored,
    logDeepObjectDiff_Config,
    logDeepObjectDiff_Clear_Storage,
};

