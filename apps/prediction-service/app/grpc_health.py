import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from app.config import GRPC_PORT


async def start_grpc_health_server() -> grpc.aio.Server:
    server = grpc.aio.server()
    servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(servicer, server)
    await servicer.set("", health_pb2.HealthCheckResponse.SERVING)

    server.add_insecure_port(f"0.0.0.0:{GRPC_PORT}")
    await server.start()
    return server
