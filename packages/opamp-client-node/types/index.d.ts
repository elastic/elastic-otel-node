export type OpAMPClientOptions = import('./opamp-client').OpAMPClientOptions;
import { DIAG_CH_SEND_SUCCESS } from "./opamp-client";
import { DIAG_CH_SEND_FAIL } from "./opamp-client";
import { DIAG_CH_SEND_SCHEDULE } from "./opamp-client";
import { USER_AGENT } from "./opamp-client";
import { createOpAMPClient } from "./opamp-client";
import { AgentCapabilities } from "./generated/opamp_pb";
import { RemoteConfigStatuses } from "./generated/opamp_pb";
export { DIAG_CH_SEND_SUCCESS, DIAG_CH_SEND_FAIL, DIAG_CH_SEND_SCHEDULE, USER_AGENT, createOpAMPClient, AgentCapabilities, RemoteConfigStatuses };
