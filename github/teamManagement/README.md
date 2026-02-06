# GitHub Team Management Scripts

This directory contains scripts for managing GitHub team repository permissions.

## Scripts

### 1. `consolidateTeamPermissions.js`

Consolidates repository permissions from multiple teams into a single team. If multiple source teams have different permissions to the same repository, the script grants the higher permission level to the target team.

**Permission hierarchy:** `admin` > `maintain` > `push` (write) > `triage` > `pull` (read)

**Usage:**
```bash
npm install
npm run consolidate-permissions
```

**Workflow:**

1. **Generate Execution Plan** (default mode):
   - Leave `EXECUTE_PLAN_FILE: null` (default)
   - Run the script to generate execution plan files in `output/` directory
   - Two files are created:
     - `plan-{timestamp}.txt` - Human-readable file for security desk review
     - `plan-{timestamp}.json` - Machine-readable file for execution

2. **Review Execution Plan**:
   - Review the `.txt` file to see all changes that will be made
   - Submit the `.txt` file to your security desk for approval

3. **Execute Changes**:
   - After approval, set `EXECUTE_PLAN_FILE: "plan-{timestamp}.json"` in config.js
   - Run the script again to execute the exact changes from the plan file
   - An execution log is generated for audit purposes

**Configuration (in `config.js`):**
- `TO_CONSOLIDATE_TEAMS`: Array of team slugs to consolidate permissions from
- `INTO_TEAM`: Team slug to grant consolidated permissions to
- `PERMISSIONS_TO_CONSOLIDATE`: Optional array of permissions to consolidate (e.g., `["pull", "push"]`). If not provided or empty, all permissions will be consolidated
- `EXECUTE_PLAN_FILE`: Set to a plan JSON filename (e.g., `"plan-2024-01-15T10-30-00-000Z.json"`) to execute changes from a previously generated execution plan. Leave `null` (default) to generate a new plan.

## Setup

1. **Install Node.js version (if using asdf):**
   ```bash
   asdf install
   ```
   This will install the Node.js version specified in `.tool-versions` (22.8.0).

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create configuration file:**
   ```bash
   cp config.example.js config.js
   ```

4. **Configure `config.js`:**
   - Set `GITHUB_TOKEN`: GitHub Personal Access Token (see Required Token Scopes below)
     - Create at: https://github.com/settings/tokens
   - Set `GITHUB_ORG`: Your GitHub organization name
   - Configure script-specific settings as needed

## Required Token Scopes

Your GitHub Personal Access Token must have the following scopes:

### Required Scopes

- **`admin:org`** - To read team repositories and grant/update team repository permissions
- **`repo`** - To access repository information (especially for private repos)

### Creating Your Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Select the following scopes:
   - ✅ `admin:org` (Full control of orgs and teams)
   - ✅ `repo` (Full control of private repositories)
4. Generate the token and copy it immediately (you won't be able to see it again)
5. Store it securely in your `config.js` file

**Important Notes:**
- Your token cannot grant more permissions than your GitHub account has. If you're not an organization owner, the token won't provide admin access even with `admin:org` scope.
- Never commit your token to version control. The `config.js` file is gitignored.
- For fine-grained tokens, grant Organization permissions: "Members" (read/write) and "Administration" (read/write)

## GitHub API Permissions

The scripts use the following GitHub REST API endpoints:

- `GET /orgs/{org}/teams/{team_slug}/repos` - List team repositories
- `PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}` - Add or update team repository permissions

**Permission values:**
- `pull` - Read access
- `push` - Write access (referred to as "write" in GitHub UI)
- `triage` - Triage access
- `maintain` - Maintain access
- `admin` - Admin access

## Libraries

- **@octokit/rest**: Official GitHub REST API client for Node.js
  - Version: ^21.0.2 (latest stable)
  - Documentation: https://octokit.github.io/rest.js/

## Notes

- The scripts handle pagination automatically for large result sets
- Rate limiting is handled by Octokit (respects GitHub API rate limits)
- Errors are logged but the scripts continue processing other teams/repositories where possible
- The consolidate script will upgrade permissions if conflicts exist (e.g., read + write = write)
- Plan files are written to the `output/` directory (which is gitignored)
- Plan files provide an audit trail and can be submitted to security teams for review
- When executing from a plan file, the exact changes from the plan are applied (no recomputation)