import { ObjectDiffLogger_stored } from ".";


//const obj = { date: new Date(), long_string: "Some super long message, that's named 'Test message' that has a lot of word's.", string_value: "Old value", number_array: [1, 2, 3, 4], another_array: ["old", "also old"], set: new Set<number | string>([1, 2, 3]), map: new Map([["key1", "value1"], ["key2", "value2"]]), nested: { a: 1, b: { c: "my value" } }, depthLimit: [[[[[[[[[[[1]]]]]]]]]]], self_reference: {} as any, some_function: () => { console.log("Hello World") } }
//ObjectDiffLogger_stored(obj, "test_object")
//obj.date = new Date(obj.date.getTime() + 1000 * 4);
//obj.long_string = "Some super long message, that's named 'Modified message' that has a lot of word's.";
//obj.number_array.push(4);
//obj.another_array[0] = "new";
//obj.set.add("New set value");
//obj.map.set("key2", "new value");
//obj.nested.b.c = "new value";
//obj.self_reference = obj; // self-reference
//obj.some_function = () => { console.log("Hello World - modified") }
//ObjectDiffLogger_stored(obj, "test_object")