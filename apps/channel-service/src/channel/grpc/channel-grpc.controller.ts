import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { ChannelDispatchService } from "../channel-dispatch.service";

interface DispatchRequest {
  channel: string;
  target: string;
  payload_json: string;
}

interface DispatchResponse {
  success: boolean;
  error: string;
}

@Controller()
export class ChannelGrpcController {
  constructor(private readonly channelDispatchService: ChannelDispatchService) {}

  @GrpcMethod("Channel", "Dispatch")
  async dispatch(data: DispatchRequest): Promise<DispatchResponse> {
    const payload = data.payload_json ? JSON.parse(data.payload_json) : null;
    const result = await this.channelDispatchService.dispatch(data.channel, data.target, payload);
    return { success: result.success, error: result.error ?? "" };
  }
}
