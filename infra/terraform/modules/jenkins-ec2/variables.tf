variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "admin_cidr" {
  description = "CIDR allowed to reach SSH (22) and the Jenkins UI (8080). No safe default for AWS — set consciously."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
