/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { InstrumentationConfig } from '@opentelemetry/instrumentation';

export interface OpenAIInstrumentationConfig extends InstrumentationConfig {
  /**
   * Set to true to enable capture of content data, such as prompt and
   * completion content, tool call function arguments, etc. By default, this is
   * `false` to avoid possible exposure of sensitive data. This can also be set
   * via the `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`
   * environment variable.
   */
  captureMessageContent?: boolean;
}

// Some types for https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace GenAI {
  export type Function = {
    name: string;
    arguments?: any;
  };

  export type ToolCall = {
    id: string;
    type: string;
    function: GenAI.Function;
  };

  export type Message = {
    role?: string;
    content?: any;
    tool_calls?: ToolCall[];
  };

  export type ChoiceEventBody = {
    finish_reason: string;
    index: number;
    message: Message;
  };

  export type SystemMessageEventBody = {
    role?: string;
    content?: any;
  };

  export type UserMessageEventBody = {
    role?: string;
    content?: any;
  };

  export type AssistantMessageEventBody = {
    role?: string;
    content?: any;
    tool_calls?: ToolCall[];
  };

  export type ToolMessageEventBody = {
    role?: string;
    content?: any;
    id: string;
  };
}
