# NOTE: aws_region is a placeholder — confirm the target region with the user
# before running `terraform apply` against real AWS (see plan Risk #2).
aws_region   = "us-east-1"
cluster_name = "ai-notification"
k8s_version  = "1.31"

vpc_cidr           = "10.0.0.0/16"
az_count           = 2
single_nat_gateway = true

node_instance_types = ["t3.medium"]
node_desired_size   = 2
node_min_size       = 1
node_max_size       = 3

enable_irsa_addons = true

tags = {
  Project     = "ai-notification-system"
  Environment = "aws"
  ManagedBy   = "terraform"
}
