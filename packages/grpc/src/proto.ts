import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export const PROTO_DIR = path.resolve(__dirname, "..", "proto");

export type LoadProtoOptions = protoLoader.Options;

export const defaultLoaderOptions: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export function loadProto(protoFileName: string, options: LoadProtoOptions = {}): grpc.GrpcObject {
  const protoPath = path.join(PROTO_DIR, protoFileName);
  const packageDefinition = protoLoader.loadSync(protoPath, {
    ...defaultLoaderOptions,
    ...options,
  });
  return grpc.loadPackageDefinition(packageDefinition);
}

export { grpc };
