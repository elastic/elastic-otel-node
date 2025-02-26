/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Some types for https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events

import { AnyValue } from '@opentelemetry/api-logs';

export type GenAIFunction = {
  name: string;
  arguments?: AnyValue;
};

export type GenAIToolCall = {
  id: string;
  type: string;
  function: GenAIFunction;
};

export type GenAIMessage = {
  role?: string;
  content?: AnyValue;
  tool_calls?: GenAIToolCall[];
};

export type GenAIChoiceEventBody = {
  finish_reason: string;
  index: number;
  message: GenAIMessage;
};

export type GenAISystemMessageEventBody = {
  role?: string;
  content?: AnyValue;
};

export type GenAIUserMessageEventBody = {
  role?: string;
  content?: AnyValue;
};

export type GenAIAssistantMessageEventBody = {
  role?: string;
  content?: AnyValue;
  tool_calls?: GenAIToolCall[];
};

export type GenAIToolMessageEventBody = {
  role?: string;
  content?: AnyValue;
  id: string;
};
