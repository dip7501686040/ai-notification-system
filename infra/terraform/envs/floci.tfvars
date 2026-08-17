aws_region   = "us-east-1"
cluster_name = "ai-notification-floci"
k8s_version  = "1.31"

vpc_cidr           = "10.0.0.0/16"
az_count           = 2
single_nat_gateway = true

node_instance_types = ["t3.medium"]
node_desired_size   = 1
node_min_size       = 1
node_max_size       = 1

# Floci's EKS control-plane emulation doesn't provide a resolvable OIDC
# issuer, so the IRSA trust chain (aws_iam_openid_connect_provider's TLS
# cert lookup) can't be validated locally — keep addons off for this pass.
enable_irsa_addons = false

tags = {
  Project     = "ai-notification-system"
  Environment = "floci"
  ManagedBy   = "terraform"
}
