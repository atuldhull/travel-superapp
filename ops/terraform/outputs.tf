# Outputs of the Fly stack ([N3]).

output "app_name" {
  description = "Fly app name (matches `fly status --app <this>`)."
  value       = fly_app.api.name
}

output "app_id" {
  description = "Fly app ID. Used by the deploy workflow for OIDC scoping."
  value       = fly_app.api.id
}

output "ipv4_address" {
  description = "Shared v4 IP allocated to the app."
  value       = fly_ip.api_v4.address
}

output "ipv6_address" {
  description = "Dedicated v6 IP allocated to the app."
  value       = fly_ip.api_v6.address
}

output "machine_ids" {
  description = "IDs of the always-warm machines (length = min_machines)."
  value       = [for m in fly_machine.api : m.id]
}

output "apply_marker" {
  description = "Synthetic random ID re-emitted every apply; surfaces as `tf_apply_id` label."
  value       = random_id.apply_marker.hex
  sensitive   = false
}
