output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "oidc_issuer_url" {
  value = module.eks.oidc_provider_url
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}"
}

output "ebs_csi_role_arn" {
  value = module.addons.ebs_csi_role_arn
}

output "lb_controller_role_arn" {
  value = module.addons.lb_controller_role_arn
}
