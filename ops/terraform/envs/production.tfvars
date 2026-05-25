# Non-sensitive vars for the production stack. Wire this in via:
#   terraform apply -var-file=envs/production.tfvars
#
# Two-region default (iad + lhr) so a single-region Fly outage
# doesn't black out the app. Drop one if cost matters more than
# availability in early launch.

environment          = "production"
fly_organization     = "wiffy"
primary_region       = "iad"
regions              = ["iad", "lhr"]
min_machines_running = 2
vm_size              = "shared-cpu-2x"
vm_memory_mb         = 2048
