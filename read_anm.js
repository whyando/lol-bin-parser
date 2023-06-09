import { Parser } from "binary-parser";
import fs from 'fs'
import util from 'util'

const animationParser = new Parser()
    .useContextVars()
    .string("magic", {
        length: 8, assert: 'r3d2anmd',
    })
    .uint32le("version", {assert: 5})
    .uint32le("resourceSize")
    .uint32le("formatToken")
    .uint32le("version")
    .uint32le("flags")

    .int32le("trackCount")
    .int32le("frameCount")
    .floatle("frameDuration")

    .int32le("jointNameHashesOffset")
    .int32le("assetNameOffset")
    .int32le("timeOffset")
    .int32le("vectorPaletteOffset")
    .int32le("quatPaletteOffset")
    .int32le("framesOffset")

    .saveOffset("bytesRead")
    .seek(function() {
        return (12 + this.vectorPaletteOffset) - this.bytesRead;
    })
    .buffer("vectorPaletteBuffer", {
        length: function() {
            this.numVectorPalette = (this.quatPaletteOffset - this.vectorPaletteOffset) / 12;
            return this.quatPaletteOffset - this.vectorPaletteOffset;
        }
    })

    .saveOffset("bytesRead")
    .seek(function() {
        return (12 + this.quatPaletteOffset) - this.bytesRead;
    })
    .buffer("quatPaletteBuffer", {
        length: function() {
            this.numQuadPalette = (this.jointNameHashesOffset - this.quatPaletteOffset) / 6;
            return this.jointNameHashesOffset - this.quatPaletteOffset;
        }
    })

    .saveOffset("bytesRead")
    .seek(function() {
        return (12 + this.jointNameHashesOffset) - this.bytesRead;
    })
    .buffer("jointNameHashesBuffer", {
        length: function() {
            this.numJointNameHashes = (this.framesOffset - this.jointNameHashesOffset) / 4;
            return this.framesOffset - this.jointNameHashesOffset;
        }
    })

    .saveOffset("bytesRead")
    .seek(function() {
        return (12 + this.framesOffset) - this.bytesRead;
    })
    .buffer("framesBuffer", {
        length: function() { return 6 * this.frameCount * this.trackCount; }
    })

    .saveOffset("bytesRead")
    .array("remainingBytes", {
        type: 'uint8',
        readUntil: 'eof',
    })

const buf = await fs.promises.readFile('./data/petchibiashe_base_idle.chibi_ashe_base.anm', null)
console.log(buf)
const parsed = animationParser.parse(buf)

console.log(util.inspect(parsed, false, null, false))
