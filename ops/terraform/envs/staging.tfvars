# Non-sensitive vars for the staging stack. Wire this in via:
#   terraform apply -var-file=envs/staging.tfvars
#
# Sensitive vars (DATABASE_URL, secrets, etc.) come from Doppler at
# CI-apply time — never check those into git.

environment          = "staging"
fly_organization     = "wiffy" # update if Fly org name differs
primary_region       = "iad"
regions              = ["iad"]
min_machines_running = 1
vm_size              = "shared-cpu-1x"
vm_memory_mb         = 1024
