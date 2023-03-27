import { Parser } from "binary-parser";
import fs from 'fs'
import util from 'util'

const colourParser = new Parser()
  .uint8("r")
  .uint8("g")
  .uint8("b")
  .uint8("a")

const stringParser = new Parser()
  .int16le("valueLen")
  .string("value", {
    length: "valueLen",
    encoding: "utf8",
  })

const dependencyArrayParser = new Parser()
  .uint32le("dependenciesCount")
  .array("dependencies", {
    length: "dependenciesCount",
    type: new Parser()
      .int16le("nameLen")
      .string("name", {
        length: "nameLen",
        encoding: "utf8",
      }),
  })

// register parsers in advance to allow recursive parsing
const valueParser = Parser.start().namely("valueParser");
const structParser = Parser.start().namely("structParser");
const containerParser = Parser.start().namely("containerParser");
const optionParser = Parser.start().namely("optionParser");
const mapParser = Parser.start().namely("mapParser")

const objectLinkParser = new Parser().namely("objectLinkParser")
  .uint32le("link")

const VALUE_PARSERS = {
  0: new Parser(),
  1: new Parser().int8("value"), // boolean
  2: new Parser().int8("value"),
  3: new Parser().uint8("value"),
  4: new Parser().int16le("value"),
  5: new Parser().uint16le("value"),
  6: new Parser().int32le("value"),
  7: new Parser().uint32le("value"),
  8: new Parser().int64le("value"),
  9: new Parser().uint64le("value"),
  10: new Parser().floatle("value"), // f32
  11: new Parser().array("value", { length: 2, type: new Parser().floatle() }),
  12: new Parser().array("value", { length: 3, type: new Parser().floatle() }),
  13: new Parser().array("value", { length: 4, type: new Parser().floatle() }),
  14: new Parser().array("value", { length: 16, type: new Parser().floatle() }),
  15: colourParser,
  16: stringParser,
  17: new Parser().uint32le("hash"),
  128: "containerParser",
  129: "containerParser",
  130: "structParser",
  131: "structParser", // embedded struct
  132: objectLinkParser,
  133: "optionParser",
  134: "mapParser",
  135: new Parser().int8("value"), // boolean
}
const VALUEARRAY_PARSERS = (lengthVariable) => Object.fromEntries(
  Object.entries(VALUE_PARSERS).map(
    ([k, parser]) => [k, new Parser().array("values", { length: lengthVariable, type: parser })]
  )
)
const UNKNOWN_VAL_PARSER = (type_loc) => {
  if (type_loc == null) {
    return new Parser()
      .seek(function() {
        console.log('Unknown')
        return 0;
      })
  } else {
    return new Parser()
      .seek(type_loc)
      .uint8("type")
      .seek(function() {
        console.log('Unknown', this.type)
        return -1-type_loc
      })
  }
}

optionParser
  .uint8("type")
  .uint8("isSome")
  .choice("", {
    tag: "isSome",
    choices: {
      0: new Parser(),
      1: new Parser()
        .choice("value", {
          tag: "type",
          choices: VALUE_PARSERS,
          defaultChoice: UNKNOWN_VAL_PARSER(-2),
        }),
    },
  })

valueParser  
  .uint8("type")
  .choice("values", {
    tag: "type",
    choices: VALUE_PARSERS,
    defaultChoice: UNKNOWN_VAL_PARSER(-1),
  })

containerParser
  .uint8("type")
  .uint32le("containerSize")
  .saveOffset("containerStartOffset")

  .uint32le("containerLength")
  .choice("", {
    tag: "type",
    choices: VALUEARRAY_PARSERS("containerLength"),
    defaultChoice: UNKNOWN_VAL_PARSER(-9),
  })

  .saveOffset("containerEndOffset")
  .seek(function() {
    const skip = this.containerStartOffset + this.containerSize - this.containerEndOffset
    if (skip != 0) {
      console.log(this.containerStartOffset, this.containerSize, this.containerEndOffset, skip)
      console.log('B Skipping', this.containerStartOffset + this.containerSize - this.containerEndOffset, 'bytes after type', this.type)
    }
    return skip;
  })


structParser
  .uint32le("classHash")
  .uint32le("structSize")
  .saveOffset("structStartOffset")

  .uint16le("propertyCount")
  .array("properties", {
    length: "propertyCount",
    type: new Parser()
      .uint32le("nameHash")
      .nest("value", {
        type: "valueParser"
      })
  })

  .saveOffset("structEndOffset")
  .seek(function() {
    const skip = this.structStartOffset + this.structSize - this.structEndOffset
    if (skip != 0) {
      console.log(this.structStartOffset, this.structSize, this.structEndOffset, skip)
      console.log('STRUCT Skipped', skip, 'bytes')
    }
    return skip;
  })

mapParser
  .uint8("keyType")
  .uint8("valueType")
  .uint32le("mapSize")
  .saveOffset("mapStartOffset")

  .uint32le("mapLength")
  .array("values", {
    length: "mapLength",
    type: new Parser()
      //.seek(function() { console.log('!', this.$parent.keyType, this.$parent.valueType); return 0;})
      .choice("key", {
        tag: "$parent.keyType",
        choices: VALUE_PARSERS,
        defaultChoice: UNKNOWN_VAL_PARSER(null),
      })
      .choice("value", {
        tag: "$parent.valueType",
        choices: VALUE_PARSERS,
        defaultChoice: UNKNOWN_VAL_PARSER(null),
      })   
  })

  .saveOffset("mapEndOffset")
  .seek(function() {
    const skip = this.mapStartOffset + this.mapSize - this.mapEndOffset
    if (skip != 0) {
      console.log(this.mapStartOffset, this.mapSize, this.mapEndOffset, skip)
      console.log('MAP Skipped', skip, 'bytes', this.keyType, this.valueType)
    }
    return skip;
  })


const objectParser = Parser.start()
  .uint32le("objectSize")
  .saveOffset("objectStartOffset")

  .uint32le("pathHash")
  .uint16le("valueCount")
  .array("values", {
    length: "valueCount",
    type: new Parser()
      .uint32le("nameHash")
      .nest("value", {
        type: "valueParser"
      })
  })
  .saveOffset("objectFinishOffset")
  .seek(function() {
    const skip = this.objectStartOffset + this.objectSize - this.objectFinishOffset
    if (skip != 0) {
      console.log(this.objectStartOffset, this.objectSize, this.objectFinishOffset, skip)
      console.log('C Skipping', skip, 'bytes')
    }
    return skip;
  })

const objectArrayParser = new Parser()
  .uint32le("objectCount")
  .array("objectClassHashes", {
    length: "objectCount",
    type: "uint32le",
  })
  .array("objects", {
    length: "objectCount",
    type: objectParser,
  })


const p = new Parser()
  .useContextVars()
  .string("magic", { length: 4 })
  .uint32le("version")
  .nest({
    type: dependencyArrayParser
  })
  .nest({
    type: objectArrayParser
  })


const buf = await fs.promises.readFile('./data/skin16.bin', null)

console.log(util.inspect(p.parse(buf), false, null, false))

