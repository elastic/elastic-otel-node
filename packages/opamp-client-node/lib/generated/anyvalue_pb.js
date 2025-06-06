// Copyright 2019, OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is copied and modified from https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto
// Modifications:
//  - Removal of unneeded InstrumentationLibrary and StringKeyValue messages.
//  - Change of go_package to reference a package in this repo.
//  - Removal of gogoproto usage.

// @generated by protoc-gen-es v2.2.5 with parameter "target=js+dts,js_import_style=legacy_commonjs"
// @generated from file anyvalue.proto (package opamp.proto, syntax proto3)
/* eslint-disable */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const { fileDesc, messageDesc } = require("@bufbuild/protobuf/codegenv1");

/**
 * Describes the file anyvalue.proto.
 */
const file_anyvalue = /*@__PURE__*/
  fileDesc("Cg5hbnl2YWx1ZS5wcm90bxILb3BhbXAucHJvdG8i6AEKCEFueVZhbHVlEhYKDHN0cmluZ192YWx1ZRgBIAEoCUgAEhQKCmJvb2xfdmFsdWUYAiABKAhIABITCglpbnRfdmFsdWUYAyABKANIABIWCgxkb3VibGVfdmFsdWUYBCABKAFIABIuCgthcnJheV92YWx1ZRgFIAEoCzIXLm9wYW1wLnByb3RvLkFycmF5VmFsdWVIABIxCgxrdmxpc3RfdmFsdWUYBiABKAsyGS5vcGFtcC5wcm90by5LZXlWYWx1ZUxpc3RIABIVCgtieXRlc192YWx1ZRgHIAEoDEgAQgcKBXZhbHVlIjMKCkFycmF5VmFsdWUSJQoGdmFsdWVzGAEgAygLMhUub3BhbXAucHJvdG8uQW55VmFsdWUiNQoMS2V5VmFsdWVMaXN0EiUKBnZhbHVlcxgBIAMoCzIVLm9wYW1wLnByb3RvLktleVZhbHVlIj0KCEtleVZhbHVlEgsKA2tleRgBIAEoCRIkCgV2YWx1ZRgCIAEoCzIVLm9wYW1wLnByb3RvLkFueVZhbHVlQi5aLGdpdGh1Yi5jb20vb3Blbi10ZWxlbWV0cnkvb3BhbXAtZ28vcHJvdG9idWZzYgZwcm90bzM");

/**
 * Describes the message opamp.proto.AnyValue.
 * Use `create(AnyValueSchema)` to create a new message.
 */
const AnyValueSchema = /*@__PURE__*/
  messageDesc(file_anyvalue, 0);

/**
 * Describes the message opamp.proto.ArrayValue.
 * Use `create(ArrayValueSchema)` to create a new message.
 */
const ArrayValueSchema = /*@__PURE__*/
  messageDesc(file_anyvalue, 1);

/**
 * Describes the message opamp.proto.KeyValueList.
 * Use `create(KeyValueListSchema)` to create a new message.
 */
const KeyValueListSchema = /*@__PURE__*/
  messageDesc(file_anyvalue, 2);

/**
 * Describes the message opamp.proto.KeyValue.
 * Use `create(KeyValueSchema)` to create a new message.
 */
const KeyValueSchema = /*@__PURE__*/
  messageDesc(file_anyvalue, 3);


exports.file_anyvalue = file_anyvalue;
exports.AnyValueSchema = AnyValueSchema;
exports.ArrayValueSchema = ArrayValueSchema;
exports.KeyValueListSchema = KeyValueListSchema;
exports.KeyValueSchema = KeyValueSchema;
