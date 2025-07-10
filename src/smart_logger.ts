import { string_changes, ValueTypes, ValueTypes_To_String, Value_To_String } from './type_util';

export class DiffLogger {
    private static readonly styles = {
        DEFAULT: 'color: #888',
        WHITE: 'color: #ffffff',
        LABEL: 'color: #ffffff; font-weight: bold',
        PATH: 'color: #4A90E2; font-weight: bold',
        OLD_VALUE: 'color: #D0021B',
        NEW_VALUE: 'color: #7ED321',
        TYPE: 'color: #888',
        WARNING: 'color: #D0021B; font-weight: bold',
        HEADER: 'color: #888; font-weight: bold'
    } as const;
    private update_cache: Array<{ path: string; oldValue: string; newValue: string; extraInfo: string; timingInfo: string, type: string }> = [];
    private message_cache: { path: string, message: Array<{ style: keyof typeof DiffLogger.styles; message: string }> }[] = [];
    private formatMessage(entries: Array<{ style: keyof typeof DiffLogger.styles; message: string }>, tabs: number = 0): void {
        const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        const styles = entries.map(entry => isBrowser ? DiffLogger.styles[entry.style] : '');
        const messages = entries.map(entry => entry.message).join(isBrowser ? '%c' : '');
        if (isBrowser) {
            console.info(`${"    ".repeat(tabs)}%c${messages}`, ...styles);
        } else {
            // Node.js or non-browser: ignore styles, just print plain text
            const plainMsg = `${"    ".repeat(tabs)}${entries.map(e => e.message).join('')}`;
            if (console.info) {
                console.info(plainMsg);
            } else {
                console.log(plainMsg);
            }
        }
    }

    logAdded(key: string): void {
        this.logBatchUpdates();
        this.formatMessage([
            { style: 'LABEL', message: 'Added: ' },
            { style: 'PATH', message: key }
        ]);
    }

    logWarning(message: string): void {
        this.logBatchUpdates();
        this.formatMessage([
            { style: 'WARNING', message }
        ]);
    }


    logUpdate(path: string, oldValue: string, newValue: string, extraInfo: string, timingInfo: string, type: string): void {
        this.update_cache.push({
            path,
            oldValue,
            newValue,
            extraInfo,
            timingInfo,
            type
        });
    }
    logUpdateDiff(path: string, oldValue: any, newValue: any, extraInfo: string, timingInfo: string, TypeName: ValueTypes, length_limit: number): void {
        const val_type = ValueTypes_To_String(TypeName)

        const oldString = Value_To_String(oldValue, TypeName);
        if (oldString.startsWith('"') && oldString.endsWith('"')) {
            oldValue = oldString.slice(1, -1);
        }

        const newString = Value_To_String(newValue, TypeName);
        if (newString.startsWith('"') && newString.endsWith('"')) {
            newValue = newString.slice(1, -1);
        }
        if (oldString.length < length_limit && newString.length < length_limit) {
            this.update_cache.push({
                path,
                oldValue: oldString,
                newValue: newString,
                extraInfo,
                timingInfo,
                type: val_type
            });
        }
        else {
            this.logBatchUpdates();
            const changes = string_changes(oldString, newString, 6);
            if (changes.length > 8 || changes.findIndex((c) => c.old_value.length > length_limit || c.new_value.length > length_limit) !== -1) {
                this.message_cache.push({
                    path: path, message: [
                        { style: 'TYPE', message: ': ' },
                        { style: 'WHITE', message: `${val_type} change too long` },

                        { style: 'DEFAULT', message: ` (max 8 changes or 35 characters per change)` },
                        { style: 'TYPE', message: `(${val_type})` }
                    ]
                })
            }
            this.message_cache.push({
                path: path, message: [
                    { style: 'TYPE', message: ': ' },
                    { style: 'WHITE', message: `Long ${val_type} diff: ` }
                ]
            })
            for (const change of changes) {
                this.message_cache.push({
                    path: "", message: [
                        { style: 'TYPE', message: ' '.repeat(6) },
                        { style: "OLD_VALUE", message: (change.old_range[0] == 0 ? "" : "...") + change.old_value + (change.old_range[1] == oldString.length ? "" : "...") },
                        { style: 'DEFAULT', message: " -> " },
                        { style: 'NEW_VALUE', message: (change.new_range[0] == 0 ? "" : "...") + change.new_value + (change.new_range[1] == newString.length ? "" : "...") },
                        { style: 'DEFAULT', message: `  (${change.new_range[0]}:${change.new_range[1]})` }
                    ]
                })
            }
        }
    }

    logKeyChange(path: string, action: 'Added' | 'Removed', keys: string[], valueType: string): void {
        this.logBatchUpdates();
        const style = action === 'Added' ? 'NEW_VALUE' : 'OLD_VALUE';
        this.message_cache.push({
            path, message: [
                { style: 'TYPE', message: ': ' },
                { style, message: `${action} keys: ` },
                { style: 'DEFAULT', message: keys.join(', ') },
                { style: 'TYPE', message: ` (${valueType})` }
            ]
        })

    }

    logTypeChange(path: string, oldType: string, newType: string): void {
        this.logBatchUpdates();
        this.message_cache.push({
            path, message: [
                { style: 'TYPE', message: ': ' },
                { style: 'WHITE', message: 'Type changed from ' },
                { style: 'OLD_VALUE', message: `${oldType} ` },
                { style: 'DEFAULT', message: 'to ' },
                { style: 'NEW_VALUE', message: newType }
            ]
        })

    }

    logLengthChange(path: string, oldLength: number, newLength: number, valueType: string): void {
        this.logBatchUpdates();
        this.message_cache.push({
            path, message: [
                { style: 'TYPE', message: ': ' },
                { style: 'WHITE', message: 'Length changed from ' },
                { style: 'OLD_VALUE', message: `${oldLength} ` },
                { style: 'DEFAULT', message: 'to ' },
                { style: 'NEW_VALUE', message: `${newLength}` },
                { style: 'TYPE', message: ` (${valueType})` }
            ]
        })

    }

    logSetChange(path: string, removedValues: any[], addedValues: any[], valueType: string): void {
        this.logBatchUpdates();
        this.message_cache.push({
            path, message: [
                { style: 'TYPE', message: ': ' },
                { style: 'WHITE', message: 'Set changed.' },
                { style: 'OLD_VALUE', message: ' | Removed values: ' },
                { style: 'DEFAULT', message: removedValues.join(', ') },
                { style: 'NEW_VALUE', message: ' | Added values: ' },
                { style: 'DEFAULT', message: addedValues.join(', ') },
                { style: 'TYPE', message: ` (${valueType})` }
            ]
        })

    }

    logError(path: string, type: 'depth' | 'circular', circularPath?: string, valueType?: string): void {
        this.logBatchUpdates();
        if (type === 'depth') {
            this.message_cache.push({
                path, message: [
                    { style: 'TYPE', message: ': ' },
                    { style: 'WHITE', message: 'Depth limit reached' }
                ]
            })

        } else if (type === 'circular' && circularPath && valueType) {
            this.message_cache.push({
                path, message: [
                    { style: 'TYPE', message: ': ' },
                    { style: 'WHITE', message: 'Circular reference detected' },
                    { style: 'WHITE', message: ' at path ' },
                    { style: 'PATH', message: circularPath },
                    { style: 'TYPE', message: ` (${valueType})` }
                ]
            })
        }
    }

    logUnknown(path: string, change: any): void {
        this.logBatchUpdates();
        this.message_cache.push({
            path, message: [
                { style: 'TYPE', message: ': ' },
                { style: 'WHITE', message: `Unknown change: ${change}` }
            ]
        })

    }

    // Batch update logging with automatic formatting
    private logBatchUpdates(): void {
        if (this.update_cache.length === 0) return;

        const oldLen = Math.max(...this.update_cache.map(u => u.oldValue.length));
        const newLen = Math.max(...this.update_cache.map(u => u.newValue.length));
        const extraLen = Math.max(...this.update_cache.map(u => u.extraInfo.length));

        const pad = (str: string, len: number, center: boolean = false): string => {
            if (center) {
                const padding = len - str.length;
                const left = Math.floor(padding / 2);
                const right = Math.ceil(padding / 2);
                return ' '.repeat(left) + str + ' '.repeat(right);
            }
            return str + ' '.repeat(len - str.length);
        };

        this.update_cache.forEach(update => {
            this.message_cache.push({
                path: update.path, message: [
                    { style: 'TYPE', message: ': ' },
                    { style: 'OLD_VALUE', message: `|${pad(update.oldValue, oldLen, true)}|` },
                    { style: 'DEFAULT', message: ' -> ' },
                    { style: 'NEW_VALUE', message: `|${pad(update.newValue, newLen, true)}|` },
                    { style: 'NEW_VALUE', message: pad(update.extraInfo, extraLen) },
                    { style: 'DEFAULT', message: '   ' + update.timingInfo },
                    { style: 'TYPE', message: `(${update.type})` }
                ]
            })

        });
        this.update_cache = []; // Clear the cache after logging
    }

    flushMessages(title: string, startTime: DOMHighResTimeStamp, show_debug_info: boolean) {//return the number of messages flushed
        this.logBatchUpdates(); // Ensure any pending updates are logged first
        if (this.message_cache.length === 0) return 0;
        const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        if (isBrowser && console.group) {
            console.group(`%c[DIFF] %c${title} %cChanged:`, DiffLogger.styles.HEADER, DiffLogger.styles.WHITE, DiffLogger.styles.HEADER);
        } else {
            console.log(`[DIFF] ${title} Changed:`);
        }
        const message_count = this.message_cache.length;

        const MaxPath = Math.max(...this.message_cache.map(m => m.path.length));
        this.message_cache.forEach(entry => {
            this.formatMessage([{ style: 'PATH' as any, message: entry.path.padEnd(MaxPath) }].concat(entry.message), 1);
        });
        this.message_cache = [];
        const endTime = Date.now();
        const duration = (endTime - startTime).toFixed(2);
        if (show_debug_info) {
            if (isBrowser) {
                console.info(`    %cTotal changes: ${message_count} | Duration: ${duration} ms`, DiffLogger.styles.HEADER);
            } else {
                console.info(`    Total changes: ${message_count} | Duration: ${duration} ms`);
            }
            //Log the caller
            const stack = new Error().stack;
            if (!stack) return;
            const lines = stack.split('\n');
            // lines[0] is "Error", lines[1] is this function, lines[2] is parent, lines[3] is grandparent
            if (lines.length > 3) {
                if (isBrowser) {
                    console.log("   ", lines[3].trim().split(' ')[1]); // Log the grandparent function name
                } else {
                    console.log("   ", lines[3].trim());
                }
            }
        }
        if (isBrowser && console.groupEnd) {
            console.groupEnd();
        }
        return message_count;
    }
}