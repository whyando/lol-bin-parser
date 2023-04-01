import { Parser } from "binary-parser";
import fs from 'fs'
import util from 'util'
import assert from 'assert/strict'

const quaternion = new Parser()
    .floatle("x")
    .floatle("y")
    .floatle("z")
    .floatle("w")

const vec3 = new Parser()
    .floatle("x")
    .floatle("y")
    .floatle("z")

const skeleton = new Parser()
    .useContextVars()
    .uint32le("fileSize")
    .uint32le("formatType", { assert: 0x22fd4fc3 } )
    .uint32le("version", { assert: 0x0 })

    .uint16le("flags")
    .uint16le("jointCount")
    .uint32le("influencesCount")
    .int32le("jointsOffset")
    .int32le("jointIndicesOffset")
    .int32le("influencesOffset")
    .int32le("nameOffset")
    .int32le("assetNameOffset")
    .int32le("boneNamesOffset")

    .int32le("reservedOffset1")
    .int32le("reservedOffset2")
    .int32le("reservedOffset3")
    .int32le("reservedOffset4")
    .int32le("reservedOffset5")

    // joints
    .saveOffset("currentOffset")
    .seek(function() {
        assert.equal(this.currentOffset, this.jointsOffset)
        return 0
    })
    .array("joints", {
        length: 'jointCount',
        type: new Parser()
            .uint16le("flags")
            .int16le("id")
            .int16le("parent")
            .int16le("padding")
            .uint32le("nameHash")
            .floatle("radius")
            .nest("localTranslation", { type: vec3 })
            .nest("localScale", { type: vec3 })
            .nest("localRotation", { type: quaternion })
            .nest("inverseBindTranslation", { type: vec3 })
            .nest("inverseBindScale", { type: vec3 })
            .nest("inverseBindRotation", { type: quaternion })
            .int32le("nameOffset")
            .saveOffset("currentOffset")
            .pointer("name", {
                offset: function() {
                    return this.currentOffset + this.nameOffset - 4
                },
                type: new Parser().string("", {
                    encoding: "utf8",
                    zeroTerminated: true,
                }),
            })
    })

    // influences
    .saveOffset("currentOffset")
    .seek(function(){ return this.influencesOffset - this.currentOffset })
    .array("influences", {
        length: 'influencesCount',
        type: "int16le"
    })

    // joint indices
    .saveOffset("currentOffset")
    .seek(function(){ return this.jointIndicesOffset - this.currentOffset })
    .array("jointIndices", {
        length: "jointCount",
        type: new Parser()
            .int16le("id")
            .uint16le("pad", { assert: 0x0 })
            .uint32le("hash")
    })

    // name
    .saveOffset("currentOffset")
    .seek(function(){ return this.nameOffset - this.currentOffset })
    .string("name", {
        encoding: "utf8",
        zeroTerminated: true,
    })

    // asset name
    .saveOffset("currentOffset")
    .seek(function(){ return this.assetNameOffset - this.currentOffset })
    .string("assetName", {
        encoding: "utf8",
        zeroTerminated: true,
    })



const buf = await fs.promises.readFile('./data/irelia_skin16.skl', null)
console.log(buf)
const parsed = skeleton.parse(buf)

console.log(util.inspect(parsed, false, null, false))
