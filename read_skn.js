import { Parser } from "binary-parser";
import fs from 'fs'
import util from 'util'

const skinnedMeshRange = new Parser()
    .string("material", {
        length: 64,
        stripNull: true,
    })
    .int32le("startVertex")
    .int32le("vertexCount")
    .int32le("startIndex")
    .int32le("indexCount")

const skinnedMesh = new Parser()
    .useContextVars()
    .uint32le("magic", { assert: 0x00112233 } )
    .uint16le("major", { assert: 4 })
    .uint16le("minor")
    .uint32le("rangeCount")
    .array("ranges", {
        length: 'rangeCount',
        type: skinnedMeshRange,
    })
    .uint32le("flags")
    .int32le("indexCount")
    .int32le("vertexCount")
    .uint32le("vertexSize")
    .uint32le("vertexType")
    .array("boundingBox", {
        length: 6,
        type: "floatle",
    })
    .array("boundingSphere", {
        length: 4,
        type: "floatle",
    })
    .saveOffset("bytesRead")

    // PARSE INTO BUFFERS
    .buffer("indexBuffer", {
        length: function() { return this.indexCount * 2 }
    })
    .buffer("vertexBuffer", {
        length: function() { return this.vertexCount * this.vertexSize }
    })
    // PARSE INDICES AND VERTICES
    // .array("indices", {
    //     length: 'indexCount',
    //     type: new Parser().array('', { length: 2, type: 'uint8' }),
    // })
    // .array("vertices", {
    //     length: 'vertexCount',
    //     type: new Parser()
    //         //.seek(function() { console.log(this.$parent.vertexSize); return 0;})
    //         .array('bytes', { length: '$parent.vertexSize', type: 'uint8' }),
    // })
    .array("remainingBytes", {
        type: 'uint8',
        readUntil: 'eof',
    })

const buf = await fs.promises.readFile('./data/irelia_skin16.skn', null)
console.log(buf)
const parsed = skinnedMesh.parse(buf)

console.log(util.inspect(parsed, false, null, false))
console.log(`${parsed.bytesRead} bytes parsed of ${buf.length}`)
console.log(parsed.bytesRead + parsed.indexCount * 2 + parsed.vertexCount * parsed.vertexSize)
