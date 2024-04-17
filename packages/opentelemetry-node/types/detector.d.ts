declare class ElasticDistroDetector {
    detect(): Resource;
}
import { Resource } from "@opentelemetry/resources/build/src/Resource";
export const distroDetectorSync: ElasticDistroDetector;
export {};
