export interface DispatchResult {
  success: boolean;
  error?: string;
}

export interface ChannelConnector {
  dispatch(target: string, payload: unknown): Promise<DispatchResult>;
}
