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

// avoids a dependency on @opentelemetry/core for hrTime utilities
import { performance } from 'perf_hooks';

import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Attributes, Context, Histogram, Span } from '@opentelemetry/api';
import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
} from '@opentelemetry/instrumentation';
import type { InstrumentationModuleDefinition } from '@opentelemetry/instrumentation';
import { SeverityNumber } from '@opentelemetry/api-logs';

import {
  ATTR_EVENT_NAME,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_REQUEST_ENCODING_FORMATS,
  ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY,
  ATTR_GEN_AI_REQUEST_TOP_P,
  ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
  ATTR_GEN_AI_RESPONSE_ID,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_SYSTEM,
  ATTR_GEN_AI_TOKEN_TYPE,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  EVENT_GEN_AI_ASSISTANT_MESSAGE,
  EVENT_GEN_AI_CHOICE,
  EVENT_GEN_AI_SYSTEM_MESSAGE,
  EVENT_GEN_AI_TOOL_MESSAGE,
  EVENT_GEN_AI_USER_MESSAGE,
  METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
  METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
} from './semconv';
import { PACKAGE_NAME, PACKAGE_VERSION } from './version';
import { getEnvBool, getAttrsFromBaseURL } from './utils';
import { OpenAIInstrumentationConfig } from './types';
import {
  GenAIMessage,
  GenAIChoiceEventBody,
  GenAISystemMessageEventBody,
  GenAIUserMessageEventBody,
  GenAIAssistantMessageEventBody,
  GenAIToolMessageEventBody,
} from './internal-types';

// Use `DEBUG=elastic-opentelemetry-instrumentation-openai ...` for debug output.
// Or use `node --env-file ./dev.env ...` in this repo.
import Debug from 'debug';
const debug = Debug('elastic-opentelemetry-instrumentation-openai');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(debug as any).inspectOpts = { depth: 50, colors: true };

export class OpenAIInstrumentation extends InstrumentationBase<OpenAIInstrumentationConfig> {
  private _genaiClientOperationDuration!: Histogram;
  private _genaiClientTokenUsage!: Histogram;

  constructor(config = {}) {
    super(PACKAGE_NAME, PACKAGE_VERSION, config);

    // Possible environment variable overrides for config.
    const cfg = this.getConfig();
    const envCC = getEnvBool(
      'OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT',
      this._diag
    );
    if (envCC !== undefined) {
      cfg.captureMessageContent = envCC;
    }
  }

  // Override InstrumentationAbtract.setConfig so we can normalize config.
  override setConfig(config: OpenAIInstrumentationConfig = {}) {
    const { captureMessageContent, ...validConfig } = config;
    (validConfig as OpenAIInstrumentationConfig).captureMessageContent =
      !!captureMessageContent;
    super.setConfig(validConfig);
  }

  protected init() {
    const defn: InstrumentationModuleDefinition =
      new InstrumentationNodeModuleDefinition(
        'openai',
        ['>=4.19.0 <6'],
        (modExports, modVer) => {
          debug(
            'instrument openai@%s (isESM=%s), config=%o',
            modVer,
            modExports[Symbol.toStringTag] === 'Module',
            this.getConfig()
          );
          this._wrap(
            modExports.OpenAI.Chat.Completions.prototype,
            'create',
            this._getPatchedChatCompletionsCreate()
          );
          this._wrap(
            modExports.OpenAI.Embeddings.prototype,
            'create',
            this._getPatchedEmbeddingsCreate()
          );

          return modExports;
        }
      );
    // Allow instrumentation to work on prereleases, e.g. 5.0.0-alpha.0.
    defn.includePrerelease = true;
    return [defn];
  }

  // This is a 'protected' method on class `InstrumentationAbstract`.
  override _updateMetricInstruments() {
    this._genaiClientOperationDuration = this.meter.createHistogram(
      METRIC_GEN_AI_CLIENT_OPERATION_DURATION,
      {
        description: 'GenAI operation duration',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24,
            20.48, 40.96, 81.92,
          ],
        },
      }
    );
    this._genaiClientTokenUsage = this.meter.createHistogram(
      METRIC_GEN_AI_CLIENT_TOKEN_USAGE,
      {
        description: 'Measures number of input and output tokens used',
        unit: '{token}',
        advice: {
          explicitBucketBoundaries: [
            1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576,
            4194304, 16777216, 67108864,
          ],
        },
      }
    );
  }

  _getPatchedChatCompletionsCreate() {
    const self = this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original: (...args: unknown[]) => any) => {
      // https://platform.openai.com/docs/api-reference/chat/create
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function patchedCreate(this: any, ...args: unknown[]) {
        if (!self.isEnabled) {
          return original.apply(this, args);
        }

        debug('OpenAI.Chat.Completions.create args: %O', args);
        /** type ChatCompletionCreateParamsStreaming */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = args[0] as any;
        const config = self.getConfig();
        const startNow = performance.now();

        let startInfo;
        try {
          startInfo = self._startChatCompletionsSpan(
            params,
            config,
            this?._client?.baseURL
          );
        } catch (err) {
          self._diag.error('unexpected error starting span:', err);
          return original.apply(this, args);
        }
        const { span, ctx, commonAttrs } = startInfo;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiPromise: Promise<any> = context.with(ctx, () =>
          original.apply(this, args)
        );

        // Streaming.
        if (params && params.stream) {
          // When streaming, `apiPromise` resolves to `import('openai/streaming').Stream`,
          // an async iterable (i.e. has a `Symbol.asyncIterator` method). We
          // want to wrap that iteration to gather telemetry. Instead of wrapping
          // `Symbol.asyncIterator`, which would be nice, we wrap the `iterator`
          // method because it is used internally by `Stream#tee()`.
          return apiPromise.then(stream => {
            self._wrap(stream, 'iterator', origIterator => {
              return () => {
                return self._onChatCompletionsStreamIterator(
                  origIterator(),
                  span,
                  startNow,
                  config,
                  commonAttrs,
                  ctx
                );
              };
            });
            return stream;
          });
        }

        // Non-streaming.
        apiPromise
          .then(result => {
            self._onChatCompletionsCreateResult(
              span,
              startNow,
              commonAttrs,
              result,
              config,
              ctx
            );
          })
          .catch(
            self._createAPIPromiseRejectionHandler(startNow, span, commonAttrs)
          );

        return apiPromise;
      };
    };
  }

  /**
   * Start a span for this chat-completion API call. This also emits log events
   * as appropriate for the request params.
   *
   * @param {import('openai').OpenAI.ChatCompletionCreateParams} params
   */
  _startChatCompletionsSpan(
    params: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    config: OpenAIInstrumentationConfig,
    baseURL: string | undefined
  ) {
    // Attributes common to span, metrics, log events.
    const commonAttrs: Attributes = {
      [ATTR_GEN_AI_OPERATION_NAME]: 'chat',
      [ATTR_GEN_AI_REQUEST_MODEL]: params.model,
      [ATTR_GEN_AI_SYSTEM]: 'openai',
    };
    Object.assign(commonAttrs, getAttrsFromBaseURL(baseURL, this._diag));

    // Span attributes.
    const attrs: Attributes = {
      ...commonAttrs,
    };
    if (params.frequency_penalty != null) {
      attrs[ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY] = params.frequency_penalty;
    }
    if (params.max_completion_tokens != null) {
      attrs[ATTR_GEN_AI_REQUEST_MAX_TOKENS] = params.max_completion_tokens;
    } else if (params.max_tokens != null) {
      // `max_tokens` is deprecated in favour of `max_completion_tokens`.
      attrs[ATTR_GEN_AI_REQUEST_MAX_TOKENS] = params.max_tokens;
    }
    if (params.presence_penalty != null) {
      attrs[ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY] = params.presence_penalty;
    }
    if (params.top_p != null) {
      attrs[ATTR_GEN_AI_REQUEST_TOP_P] = params.top_p;
    }

    const span: Span = this.tracer.startSpan(
      `${attrs[ATTR_GEN_AI_OPERATION_NAME]} ${attrs[ATTR_GEN_AI_REQUEST_MODEL]}`,
      {
        kind: SpanKind.CLIENT,
        attributes: attrs,
      }
    );
    const ctx: Context = trace.setSpan(context.active(), span);

    // Capture prompts as log events.
    const timestamp = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params.messages.forEach((msg: any) => {
      // `msg` is Array<import('openai/resources/chat/completions').ChatCompletionMessageParam>
      let body;
      switch (msg.role) {
        case 'system':
          if (config.captureMessageContent) {
            this.logger.emit({
              timestamp,
              context: ctx,
              severityNumber: SeverityNumber.INFO,
              attributes: {
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_SYSTEM_MESSAGE,
                [ATTR_GEN_AI_SYSTEM]: 'openai',
              },
              body: {
                role: msg.role,
                content: msg.content,
              } as GenAISystemMessageEventBody,
            });
          }
          break;
        case 'user':
          if (config.captureMessageContent) {
            this.logger.emit({
              timestamp,
              context: ctx,
              severityNumber: SeverityNumber.INFO,
              attributes: {
                [ATTR_EVENT_NAME]: EVENT_GEN_AI_USER_MESSAGE,
                [ATTR_GEN_AI_SYSTEM]: 'openai',
              },
              body: {
                role: msg.role,
                content: msg.content,
              } as GenAIUserMessageEventBody,
            });
          }
          break;
        case 'assistant':
          if (config.captureMessageContent) {
            body = {
              content: msg.content,
              tool_calls: msg.tool_calls,
            } as GenAIAssistantMessageEventBody;
          } else {
            body = {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tool_calls: msg.tool_calls.map((tc: any) => {
                return {
                  id: tc.id,
                  type: tc.type,
                  function: { name: tc.function.name },
                };
              }),
            } as GenAIAssistantMessageEventBody;
          }
          this.logger.emit({
            timestamp,
            context: ctx,
            severityNumber: SeverityNumber.INFO,
            attributes: {
              [ATTR_EVENT_NAME]: EVENT_GEN_AI_ASSISTANT_MESSAGE,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
            },
            body,
          });
          break;
        case 'tool':
          if (config.captureMessageContent) {
            body = {
              content: msg.content,
              id: msg.tool_call_id,
            } as GenAIToolMessageEventBody;
          } else {
            body = {
              id: msg.tool_call_id,
            } as GenAIToolMessageEventBody;
          }
          this.logger.emit({
            timestamp,
            context: ctx,
            severityNumber: SeverityNumber.INFO,
            attributes: {
              [ATTR_EVENT_NAME]: EVENT_GEN_AI_TOOL_MESSAGE,
              [ATTR_GEN_AI_SYSTEM]: 'openai',
            },
            body,
          });
          break;
        default:
          debug(
            `unknown message role in OpenAI.Chat.Completions.create: ${msg.role}`
          );
      }
    });

    return { span, ctx, commonAttrs };
  }

  /**
   * This wraps an instance of a `openai/streaming.Stream.iterator()`, an
   * async iterator. It should yield the chunks unchanged, and gather telemetry
   * data from those chunks, then end the span.
   *
   * @param {OpenAIInstrumentationConfig} config
   */
  async *_onChatCompletionsStreamIterator(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamIter: AsyncIterator<any>,
    span: Span,
    startNow: number,
    config: OpenAIInstrumentationConfig,
    commonAttrs: Attributes,
    ctx: Context
  ) {
    let id;
    let model;
    let role;
    let finishReason;
    const contentParts = [];
    const toolCalls = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of streamIter as any) {
      yield chunk;

      // Gather telemetry from this chunk.
      debug('OpenAI.Chat.Completions.create stream chunk: %O', chunk);
      if (config.captureMessageContent) {
        const contentPart = chunk.choices[0]?.delta?.content;
        if (contentPart) {
          contentParts.push(contentPart);
        }
      }
      // Assume delta.tool_calls, if exists, is an array of length 1.
      const toolCallPart = chunk.choices[0]?.delta?.tool_calls?.[0];
      if (toolCallPart) {
        if (toolCallPart.id) {
          // First chunk in a tool call.
          toolCalls.push({
            id: toolCallPart.id,
            type: toolCallPart.type,
            function: {
              name: toolCallPart.function?.name,
              arguments: toolCallPart.function?.arguments ?? '',
            },
          });
        } else if (toolCalls.length > 0) {
          // A tool call chunk with more of the `function.arguments`.
          toolCalls[toolCalls.length - 1].function.arguments +=
            toolCallPart.function?.arguments ?? '';
        }
      }
      if (!id && chunk.id) {
        id = chunk.id;
        span.setAttribute(ATTR_GEN_AI_RESPONSE_ID, id);
      }
      if (!model && chunk.model) {
        model = chunk.model;
        span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, model);
      }
      if (!role) {
        role = chunk.choices[0]?.delta?.role;
      }
      if (!finishReason) {
        finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason) {
          span.setAttribute(ATTR_GEN_AI_RESPONSE_FINISH_REASONS, [
            finishReason,
          ]);
        }
      }
      if (chunk.usage) {
        // A final usage chunk if `stream_options.include_usage: true`.
        span.setAttribute(
          ATTR_GEN_AI_USAGE_INPUT_TOKENS,
          chunk.usage.prompt_tokens
        );
        span.setAttribute(
          ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
          chunk.usage.completion_tokens
        );
        this._genaiClientTokenUsage.record(chunk.usage.prompt_tokens, {
          ...commonAttrs,
          [ATTR_GEN_AI_RESPONSE_MODEL]: model,
          [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
        });
        this._genaiClientTokenUsage.record(chunk.usage.completion_tokens, {
          ...commonAttrs,
          [ATTR_GEN_AI_RESPONSE_MODEL]: model,
          [ATTR_GEN_AI_TOKEN_TYPE]: 'output',
        });
      }
    }

    // Capture choices as log events.
    const message: Partial<GenAIMessage> = { role };
    if (config.captureMessageContent && contentParts.length > 0) {
      message.content = contentParts.join('');
    }
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
      if (!config.captureMessageContent) {
        toolCalls.forEach(tc => {
          delete tc.function?.arguments;
        });
      }
    }
    this.logger.emit({
      timestamp: Date.now(),
      context: ctx,
      severityNumber: SeverityNumber.INFO,
      attributes: {
        [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
        [ATTR_GEN_AI_SYSTEM]: 'openai',
      },
      body: {
        finish_reason: finishReason,
        index: 0,
        message,
      } as GenAIChoiceEventBody,
    });

    this._genaiClientOperationDuration.record(
      (performance.now() - startNow) / 1000,
      {
        ...commonAttrs,
        [ATTR_GEN_AI_RESPONSE_MODEL]: model,
      }
    );

    span.end();
  }

  /**
   * @param {import('openai').OpenAI.ChatCompletion} result
   * @param {OpenAIInstrumentationConfig} config
   */
  _onChatCompletionsCreateResult(
    span: Span,
    startNow: number,
    commonAttrs: Attributes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any,
    config: OpenAIInstrumentationConfig,
    ctx: Context
  ) {
    debug('OpenAI.Chat.Completions.create result: %O', result);
    try {
      span.setAttribute(
        ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.choices.map((c: any) => c.finish_reason)
      );
      span.setAttribute(ATTR_GEN_AI_RESPONSE_ID, result.id);
      span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, result.model);
      span.setAttribute(
        ATTR_GEN_AI_USAGE_INPUT_TOKENS,
        result.usage.prompt_tokens
      );
      span.setAttribute(
        ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
        result.usage.completion_tokens
      );

      // Capture choices as log events.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.choices.forEach((choice: any) => {
        let message: Partial<GenAIMessage>;
        if (config.captureMessageContent) {
          // TODO: telemetry diff with streaming case: content=null, no 'role: assistant', 'tool calls (enableCaptureContent=true)' test case
          message = { content: choice.message.content };
          if (choice.message.tool_calls) {
            message.tool_calls = choice.message.tool_calls;
          }
        } else {
          message = {};
          if (choice.tool_calls) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message.tool_calls = choice.message.tool_calls.map((tc: any) => {
              return {
                id: tc.id,
                type: tc.type,
                function: { name: tc.function.name },
              };
            });
          }
        }
        this.logger.emit({
          timestamp: Date.now(),
          context: ctx,
          severityNumber: SeverityNumber.INFO,
          attributes: {
            [ATTR_EVENT_NAME]: EVENT_GEN_AI_CHOICE,
            [ATTR_GEN_AI_SYSTEM]: 'openai',
          },
          body: {
            finish_reason: choice.finish_reason,
            index: choice.index,
            message,
          } as GenAIChoiceEventBody,
        });
      });

      this._genaiClientOperationDuration.record(
        (performance.now() - startNow) / 1000,
        {
          ...commonAttrs,
          [ATTR_GEN_AI_RESPONSE_MODEL]: result.model,
        }
      );

      this._genaiClientTokenUsage.record(result.usage.prompt_tokens, {
        ...commonAttrs,
        [ATTR_GEN_AI_RESPONSE_MODEL]: result.model,
        [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
      });

      this._genaiClientTokenUsage.record(result.usage.completion_tokens, {
        ...commonAttrs,
        [ATTR_GEN_AI_RESPONSE_MODEL]: result.model,
        [ATTR_GEN_AI_TOKEN_TYPE]: 'output',
      });
    } catch (err) {
      this._diag.error(
        'unexpected error getting telemetry from chat result:',
        err
      );
    }
    span.end();
  }

  _createAPIPromiseRejectionHandler(
    startNow: number,
    span: Span,
    commonAttrs: Attributes
  ) {
    return (err: Error) => {
      debug('OpenAI APIPromise rejection: %O', err);

      // https://github.com/openai/openai-node/blob/master/src/error.ts
      // The most reliable low cardinality string for errors seems to be
      // the class name. See also:
      // https://platform.openai.com/docs/guides/error-codes
      const errorType = err?.constructor?.name;

      this._genaiClientOperationDuration.record(
        (performance.now() - startNow) / 1000,
        {
          ...commonAttrs,
          'error.type': errorType,
        }
      );

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });

      span.setAttribute('error.type', errorType);
      span.end();
    };
  }

  _getPatchedEmbeddingsCreate() {
    const self = this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original: any) => {
      // https://platform.openai.com/docs/api-reference/embeddings/create
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function patchedCreate(this: any, ...args: unknown[]) {
        if (!self.isEnabled) {
          return original.apply(this, args);
        }

        debug('OpenAI.Chat.Embeddings.create args: %O', args);
        const params = args[0];
        const startNow = performance.now();

        let startInfo;
        try {
          startInfo = self._startEmbeddingsSpan(params, this?._client?.baseURL);
        } catch (err) {
          self._diag.error('unexpected error starting span:', err);
          return original.apply(this, args);
        }
        const { span, ctx, commonAttrs } = startInfo;

        /** @type {import('openai/core').APIPromise} */
        const apiPromise = context.with(ctx, () => original.apply(this, args));

        apiPromise
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((result: any) => {
            self._onEmbeddingsCreateResult(span, startNow, commonAttrs, result);
          })
          .catch(
            self._createAPIPromiseRejectionHandler(startNow, span, commonAttrs)
          );

        return apiPromise;
      };
    };
  }

  /**
   * Start a span for this chat-completion API call. This also emits log events
   * as appropriate for the request params.
   *
   * @param {OpenAIInstrumentationConfig} config
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _startEmbeddingsSpan(params: any, baseURL: string | undefined) {
    // Attributes common to span, metrics, log events.
    const commonAttrs: Attributes = {
      [ATTR_GEN_AI_OPERATION_NAME]: 'embeddings',
      [ATTR_GEN_AI_REQUEST_MODEL]: params.model,
      [ATTR_GEN_AI_SYSTEM]: 'openai',
    };
    Object.assign(commonAttrs, getAttrsFromBaseURL(baseURL, this._diag));

    // Span attributes.
    const attrs: Attributes = {
      ...commonAttrs,
    };
    if (params.encoding_format != null) {
      attrs[ATTR_GEN_AI_REQUEST_ENCODING_FORMATS] = [params.encoding_format];
    }

    const span = this.tracer.startSpan(
      `${attrs[ATTR_GEN_AI_OPERATION_NAME]} ${attrs[ATTR_GEN_AI_REQUEST_MODEL]}`,
      {
        kind: SpanKind.CLIENT,
        attributes: attrs,
      }
    );
    const ctx = trace.setSpan(context.active(), span);

    return { span, ctx, commonAttrs };
  }

  /**
   * @param {import('openai').OpenAI.CreateEmbeddingResponse} result
   */
  _onEmbeddingsCreateResult(
    span: Span,
    startNow: number,
    commonAttrs: Attributes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any
  ) {
    debug('OpenAI.Embeddings.create result: %O', result);
    try {
      span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, result.model);

      this._genaiClientOperationDuration.record(
        (performance.now() - startNow) / 1000,
        {
          ...commonAttrs,
          [ATTR_GEN_AI_RESPONSE_MODEL]: result.model,
        }
      );

      span.setAttribute(
        ATTR_GEN_AI_USAGE_INPUT_TOKENS,
        result.usage.prompt_tokens
      );
      this._genaiClientTokenUsage.record(result.usage.prompt_tokens, {
        ...commonAttrs,
        [ATTR_GEN_AI_RESPONSE_MODEL]: result.model,
        [ATTR_GEN_AI_TOKEN_TYPE]: 'input',
      });
    } catch (err) {
      this._diag.error(
        'unexpected error getting telemetry from embeddings result:',
        err
      );
    }
    span.end();
  }
}
