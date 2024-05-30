declare class ElasticDistroDetector {
    detect(): Resource;
}
import { Resource } from "@opentelemetry/resources";
export const distroDetectorSync: ElasticDistroDetector;
export {};
