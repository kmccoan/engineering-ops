export default {
    // GitHub Personal Access Token with appropriate permissions
    // Required scopes:
    //   - admin:org (Full control of orgs and teams - required for reading/managing team permissions)
    //   - repo (Full control of private repositories - required for accessing repo information)
    // Create at: https://github.com/settings/tokens
    // See README.md for detailed scope requirements
    GITHUB_TOKEN: "<your-github-token>",
    
    // GitHub organization name
    GITHUB_ORG: "<your-org-name>",
    
    // For consolidateTeamPermissions.js:
    // Teams to consolidate permissions from
    // Use team SLUGS (URL-friendly names), not numeric IDs
    // Example: If team name is "Engineering Team", the slug is typically "engineering-team"
    // Find team slugs at: https://github.com/orgs/{org}/teams/{team-slug}
    TO_CONSOLIDATE_TEAMS: ["team1", "team2", "team3"],
    
    // Team to grant consolidated permissions to
    // Use team SLUG (URL-friendly name), not numeric ID
    // Example: If team name is "Consolidated Team", the slug is typically "consolidated-team"
    INTO_TEAM: "consolidated-team",
    
    // Optional: Only consolidate these permissions
    // Valid options (from GitHub REST API):
    //   - "pull": Read-only access. Can pull/clone, but cannot push or administer
    //   - "triage": Triage access. Can read/clone and manage issues/pull requests without write access to code
    //   - "push": Read and write access. Can pull and push, but cannot administer
    //   - "maintain": Maintain access. Can manage repository without access to sensitive or destructive actions
    //   - "admin": Full administrative access. Complete control including managing permissions and settings
    // If not provided or empty array, all permissions will be consolidated
    // Example: ["pull", "push"] - only consolidate read and write permissions
    PERMISSIONS_TO_CONSOLIDATE: ["pull", "push"],

    // Optional: Maximum permission level to grant on the target (INTO_TEAM) side
    // Any permission from the source teams that exceeds this cap will be downgraded to this level.
    // Permissions at or below this level are unchanged.
    // Valid options: "pull", "triage", "push", "maintain", "admin"
    // Example: "push" - admin/maintain from source teams become push, but pull/triage stay as-is
    // Set to null to disable capping (grant exact permissions from source teams)
    MAX_PERMISSION_TO_GIVE: null,
    
    // Execute from plan file: Set to the plan JSON filename (e.g., "plan-2024-01-15T10-30-00-000Z.json")
    // to execute changes from a previously generated execution plan
    // If null or undefined, the script will generate a new execution plan (default safe behavior)
    // This allows you to review changes before executing and provides an audit trail
    // Example: EXECUTE_PLAN_FILE: "plan-2024-01-15T10-30-00-000Z.json"
    // Leave null to generate a new plan
    EXECUTE_PLAN_FILE: null
}
