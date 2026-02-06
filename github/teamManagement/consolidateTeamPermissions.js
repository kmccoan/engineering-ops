import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";

/**
 * Permission hierarchy: higher permissions override lower ones
 * admin > maintain > push (write) > triage > pull (read)
 */
const PERMISSION_HIERARCHY = {
    pull: 1,
    triage: 2,
    push: 3,
    maintain: 4,
    admin: 5
};

/**
 * Normalize permissions object to array of permission strings
 * @param {Object} permissions - Permissions object with boolean flags: { admin, maintain, push, triage, pull }
 * @returns {Array<string>} - Array of permission strings that are true
 */
function permissionsObjectToArray(permissions) {
    if (!permissions) {
        return [];
    }
    
    return Object.keys(permissions).filter(key => permissions[key] === true);
}

/**
 * Get the highest permission level from an array of permission strings
 * @param {Array<string>} permissions - Array of permission strings: ['admin', 'push', 'pull']
 * @returns {string|null} - The highest permission level, or null if array is empty or invalid
 */
function getHighestPermission(permissions) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
        return null;
    }
    
    // Find the permission with the highest hierarchy level
    let highest = null;
    let highestLevel = 0;
    
    for (const perm of permissions) {
        const level = PERMISSION_HIERARCHY[perm] || 0;
        if (level > highestLevel) {
            highestLevel = level;
            highest = perm;
        }
    }
    
    return highest;
}

/**
 * Compare two permission levels
 * @param {string} perm1 - First permission
 * @param {string} perm2 - Second permission
 * @returns {number} - Returns 1 if perm1 > perm2, -1 if perm1 < perm2, 0 if equal
 */
function comparePermissions(perm1, perm2) {
    const level1 = PERMISSION_HIERARCHY[perm1] || 0;
    const level2 = PERMISSION_HIERARCHY[perm2] || 0;
    
    if (level1 > level2) return 1;
    if (level1 < level2) return -1;
    return 0;
}

/**
 * Cap a permission at a maximum level
 * If the permission exceeds the cap, return the cap. Otherwise return the original permission.
 * @param {string} permission - The permission to potentially cap
 * @param {string|null} maxPermission - The maximum permission level, or null to disable capping
 * @returns {string} - The capped permission
 */
function capPermission(permission, maxPermission) {
    if (!maxPermission) {
        return permission;
    }
    const permLevel = PERMISSION_HIERARCHY[permission] || 0;
    const capLevel = PERMISSION_HIERARCHY[maxPermission] || 0;
    return permLevel > capLevel ? maxPermission : permission;
}

/**
 * Get all repositories and their permissions for a team
 *
 * API Reference: https://docs.github.com/en/rest/teams/teams#list-team-repositories
 * Response structure:
 * - permissions (object): Object with boolean flags for each permission level
 *   { admin: boolean, maintain: boolean, push: boolean, triage: boolean, pull: boolean }
 * 
 */
async function getTeamRepositories(octokit, org, teamSlug) {
    const repos = [];
    let page = 1;
    const perPage = 100;
    
    try {
        while (true) {
            const response = await octokit.rest.teams.listReposInOrg({
                org: org,
                team_slug: teamSlug,
                per_page: perPage,
                page: page
            });
            
            if (response.data.length === 0) {
                break;
            }
            
            // Each repo object includes permission information via the permissions object
            // See API docs: https://docs.github.com/en/rest/teams/teams#list-team-repositories
            const reposWithPermissions = response.data.map(repo => {
                let permission = null; // No default - skip if we can't determine permission
                
                if (repo.permissions) {
                    // permissions object: { admin: boolean, maintain: boolean, push: boolean, triage: boolean, pull: boolean }
                    const permissionArray = permissionsObjectToArray(repo.permissions);
                    permission = getHighestPermission(permissionArray);
                }
                
                return {
                    full_name: repo.full_name,
                    permission: permission
                };
            });
            
            // Filter out repos without valid permissions and log skipped repos
            const validRepos = reposWithPermissions.filter(repo => {
                if (repo.permission === null) {
                    console.log(`  Skipping ${repo.full_name}: No permission information available`);
                    return false;
                }
                return true;
            });
            
            repos.push(...validRepos);
            
            if (response.data.length < perPage) {
                break;
            }
            
            page++;
        }
    } catch (error) {
        console.error(`Error fetching repositories for team ${teamSlug}:`, error.message);
        if (error.status === 404) {
            console.error(`Team '${teamSlug}' not found in organization '${org}'`);
        }
        throw error;
    }
    
    return repos;
}

/**
 * Write plan files (human-readable and machine-readable)
 * @param {string} org - GitHub organization name
 * @param {Array<string>} toConsolidateTeams - Source teams
 * @param {string} intoTeam - Target team
 * @param {Map<string, string>} repoPermissions - Filtered permissions to apply
 * @param {string} outputDir - Output directory
 * @param {Map<string, Object>} changes - Change metadata (optional)
 * @param {Object} stats - Statistics about changes (optional)
 */
function writePlanFiles(org, toConsolidateTeams, intoTeam, repoPermissions, outputDir, changes = null, stats = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const planId = `plan-${timestamp}`;
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Machine-readable JSON file
    const jsonFile = path.join(outputDir, `${planId}.json`);
    const planData = {
        planId,
        timestamp: new Date().toISOString(),
        organization: org,
        sourceTeams: toConsolidateTeams,
        targetTeam: intoTeam,
        stats: stats || null,
        changes: Array.from(repoPermissions.entries()).map(([repoFullName, permission]) => {
            const [owner, repo] = repoFullName.split('/');
            const changeInfo = changes ? changes.get(repoFullName) : null;
            return {
                owner,
                repo,
                fullName: repoFullName,
                permission,
                changeType: changeInfo ? changeInfo.changeType : 'unknown',
                existingPermission: changeInfo ? changeInfo.existingPermission : null
            };
        })
    };
    
    fs.writeFileSync(jsonFile, JSON.stringify(planData, null, 2), 'utf8');
    
    // Human-readable text file
    const textFile = path.join(outputDir, `${planId}.txt`);
    let textContent = `GitHub Team Permission Consolidation Plan
${'='.repeat(60)}

Generated: ${new Date().toISOString()}
Organization: ${org}

Source Teams (permissions to consolidate from):
${toConsolidateTeams.map(team => `  - ${team}`).join('\n')}

Target Team (permissions will be granted to):
  ${intoTeam}

${stats ? `Analysis Summary:
  Total repositories analyzed: ${stats.total}
  New repositories: ${stats.new}
  Upgrades: ${stats.upgrade}
  Already have same permission (deduplicated): ${stats.same}
  Skipped (existing permission is higher): ${stats.skipped}

` : ''}${'='.repeat(60)}
CHANGES TO BE APPLIED:
${'='.repeat(60)}

`;
    
    // Group by change type and permission level for better readability
    const byChangeType = {
        new: {},
        upgrade: {}
    };
    
    for (const [repoFullName, permission] of repoPermissions.entries()) {
        const changeInfo = changes ? changes.get(repoFullName) : null;
        const changeType = changeInfo ? changeInfo.changeType : 'unknown';
        
        if (changeType === 'new' || changeType === 'upgrade') {
            if (!byChangeType[changeType][permission]) {
                byChangeType[changeType][permission] = [];
            }
            byChangeType[changeType][permission].push({
                repo: repoFullName,
                existing: changeInfo ? changeInfo.existingPermission : null
            });
        }
    }
    
    // Sort permissions by hierarchy
    const permissionOrder = ['admin', 'maintain', 'push', 'triage', 'pull'];
    
    // New repositories section
    if (stats && stats.new > 0) {
        textContent += `\nNEW REPOSITORIES (${stats.new}):\n`;
        for (const perm of permissionOrder) {
            if (byChangeType.new[perm]) {
                textContent += `\n  ${perm.toUpperCase()} Permission (${byChangeType.new[perm].length} repositories):\n`;
                byChangeType.new[perm].sort((a, b) => a.repo.localeCompare(b.repo)).forEach(({ repo }) => {
                    textContent += `    - ${repo}\n`;
                });
            }
        }
    }
    
    // Upgrades section
    if (stats && stats.upgrade > 0) {
        textContent += `\nUPGRADES (${stats.upgrade}):\n`;
        for (const perm of permissionOrder) {
            if (byChangeType.upgrade[perm]) {
                textContent += `\n  ${perm.toUpperCase()} Permission (${byChangeType.upgrade[perm].length} repositories):\n`;
                byChangeType.upgrade[perm].sort((a, b) => a.repo.localeCompare(b.repo)).forEach(({ repo, existing }) => {
                    textContent += `    - ${repo}: ${existing} -> ${perm}\n`;
                });
            }
        }
    }
    
    // If no changes, show message
    if (repoPermissions.size === 0) {
        textContent += `\nNo changes needed. All repositories already have the required permissions.\n`;
    }
    
    textContent += `\n${'='.repeat(60)}
SUMMARY
${'='.repeat(60)}
Total repositories to be modified: ${repoPermissions.size}

`;
    
    if (stats) {
        textContent += `Change breakdown:
  New: ${stats.new}
  Upgrades: ${stats.upgrade}
  Already correct: ${stats.same}
  Skipped (higher existing): ${stats.skipped}

`;
    }
    
    // Permission breakdown
    const byPermission = {};
    for (const [repoFullName, permission] of repoPermissions.entries()) {
        if (!byPermission[permission]) {
            byPermission[permission] = [];
        }
        byPermission[permission].push(repoFullName);
    }
    
    textContent += `Permission breakdown:\n`;
    for (const perm of permissionOrder) {
        if (byPermission[perm]) {
            textContent += `  ${perm}: ${byPermission[perm].length}\n`;
        }
    }
    
    textContent += `\n${'='.repeat(60)}
TO EXECUTE THESE CHANGES:
${'='.repeat(60)}
Set EXECUTE_PLAN_FILE to "${planId}.json" in config.js and run the script again.
`;
    
    fs.writeFileSync(textFile, textContent, 'utf8');
    
    return { planId, jsonFile, textFile };
}

/**
 * Execute changes from a plan file
 */
async function executeFromPlanFile(octokit, org, planFile) {
    const planData = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    
    console.log(`\n🚀 EXECUTING CHANGES FROM PLAN FILE`);
    console.log(`Plan ID: ${planData.planId}`);
    console.log(`Generated: ${planData.timestamp}`);
    console.log(`Target Team: ${planData.targetTeam}`);
    console.log(`Total Changes: ${planData.changes.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // // For testing: only process the first change
    // const changesToProcess = planData.changes.slice(0, 1);
    // console.log(`⚠️  TEST MODE: Processing only 1 change (out of ${planData.changes.length} total)\n`);
    
    for (const change of planData.changes) {
        try {
            await octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
                org: org,
                team_slug: planData.targetTeam,
                owner: change.owner,
                repo: change.repo,
                permission: change.permission
            });
            
            console.log(`  ✓ ${change.fullName}: ${change.permission}`);
            successCount++;
        } catch (error) {
            console.error(`  ✗ ${change.fullName}: ${error.message}`);
            errors.push({ repo: change.fullName, error: error.message });
            errorCount++;
        }
    }
    
    console.log(`\n=== Execution Summary ===`);
    console.log(`Successfully granted permissions: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
        console.log(`\nErrors encountered:`);
        errors.forEach(({ repo, error }) => {
            console.log(`  ${repo}: ${error}`);
        });
    }
    
    // Write execution log
    const outputDir = path.dirname(planFile);
    const executionLogFile = path.join(outputDir, `execution-${planData.planId}.txt`);
    const executionLog = `GitHub Team Permission Consolidation - Execution Log
${'='.repeat(60)}

Plan ID: ${planData.planId}
Executed: ${new Date().toISOString()}
Organization: ${org}
Target Team: ${planData.targetTeam}

Execution Results:
  Successfully granted: ${successCount}
  Errors: ${errorCount}

${errors.length > 0 ? `Errors:\n${errors.map(e => `  - ${e.repo}: ${e.error}`).join('\n')}\n` : ''}
${'='.repeat(60)}
`;
    
    fs.writeFileSync(executionLogFile, executionLog, 'utf8');
    console.log(`\nExecution log written to: ${executionLogFile}`);
}

/**
 * Collect and consolidate repository permissions from multiple teams
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - GitHub organization name
 * @param {Array<string>} toConsolidateTeams - Array of team slugs to collect permissions from
 * @param {Array<string>} permissionsToConsolidate - Required filter for specific permissions
 * @param {string|null} maxPermissionToGive - Maximum permission level to grant, or null to disable capping
 * @returns {Promise<Map<string, string>>} Map of repo_full_name -> highest_permission
 */
async function collectRepoPermissions(octokit, org, toConsolidateTeams, permissionsToConsolidate, maxPermissionToGive = null) {
    if (!permissionsToConsolidate || !Array.isArray(permissionsToConsolidate) || permissionsToConsolidate.length === 0) {
        throw new Error("permissionsToConsolidate must be a non-empty array");
    }
    
    console.log(`Collecting permissions from teams: ${toConsolidateTeams.join(', ')}`);
    console.log(`Filtering for permissions: ${permissionsToConsolidate.join(', ')}`);
    if (maxPermissionToGive) {
        console.log(`Maximum permission to give: ${maxPermissionToGive}`);
    }
    console.log();
    
    const repoPermissions = new Map(); // Map<repo_full_name, highest_permission>
    
    for (const teamSlug of toConsolidateTeams) {
        console.log(`Fetching repositories for team: ${teamSlug}`);
        try {
            const repos = await getTeamRepositories(octokit, org, teamSlug);
            console.log(`  Found ${repos.length} repositories for team ${teamSlug}`);
            
            for (const repo of repos) {
                // Filter by permissionsToConsolidate
                if (!permissionsToConsolidate.includes(repo.permission)) {
                    continue; // Skip this repo if permission not in filter list
                }

                // Cap the permission at the maximum level
                const cappedPermission = capPermission(repo.permission, maxPermissionToGive);
                if (cappedPermission !== repo.permission) {
                    console.log(`  Capped ${repo.full_name}: ${repo.permission} -> ${cappedPermission}`);
                }

                const currentPermission = repoPermissions.get(repo.full_name);
                if (currentPermission) {
                    const higherPermission = getHighestPermission([currentPermission, cappedPermission]);
                    repoPermissions.set(repo.full_name, higherPermission);
                    if (higherPermission !== currentPermission) {
                        console.log(`  Upgrading ${repo.full_name}: ${currentPermission} -> ${higherPermission}`);
                    }
                } else {
                    repoPermissions.set(repo.full_name, cappedPermission);
                }
            }
        } catch (error) {
            console.error(`Failed to process team ${teamSlug}:`, error.message);
            throw error;
        }
    }
    
    console.log(`\nTotal unique repositories: ${repoPermissions.size}`);
    return repoPermissions;
}

/**
 * Analyze and filter consolidated permissions against existing team permissions
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - GitHub organization name
 * @param {string} intoTeam - Team slug to analyze
 * @param {Map<string, string>} consolidatedPermissions - Map of repo_full_name -> permission to consolidate
 * @returns {Object} Object with filtered permissions and change metadata
 */
async function analyzeAgainstExistingPermissions(octokit, org, intoTeam, consolidatedPermissions) {
    console.log(`\nAnalyzing existing permissions for team: ${intoTeam}`);
    
    // Get existing permissions for intoTeam
    const existingRepos = await getTeamRepositories(octokit, org, intoTeam);
    const existingPermissions = new Map();
    
    for (const repo of existingRepos) {
        if (repo.permission) {
            existingPermissions.set(repo.full_name, repo.permission);
        }
    }
    
    console.log(`  Found ${existingPermissions.size} repositories with existing permissions`);
    
    // Analyze changes
    const changes = new Map(); // Map<repo_full_name, { permission, changeType, existingPermission }>
    let skippedCount = 0;
    let upgradeCount = 0;
    let newCount = 0;
    let sameCount = 0;
    
    for (const [repoFullName, consolidatedPermission] of consolidatedPermissions.entries()) {
        const existingPermission = existingPermissions.get(repoFullName);
        
        if (!existingPermission) {
            // New repository - add it
            changes.set(repoFullName, {
                permission: consolidatedPermission,
                changeType: 'new',
                existingPermission: null
            });
            newCount++;
        } else {
            const comparison = comparePermissions(consolidatedPermission, existingPermission);
            
            if (comparison > 0) {
                // Upgrade - consolidated permission is higher
                changes.set(repoFullName, {
                    permission: consolidatedPermission,
                    changeType: 'upgrade',
                    existingPermission: existingPermission
                });
                upgradeCount++;
                console.log(`  Upgrade: ${repoFullName}: ${existingPermission} -> ${consolidatedPermission}`);
            } else if (comparison < 0) {
                // Skip - existing permission is higher, don't downgrade
                skippedCount++;
                console.log(`  Skipped: ${repoFullName}: existing ${existingPermission} is higher than ${consolidatedPermission}`);
            } else {
                // Same permission - deduplicate, don't add to changes
                sameCount++;
            }
        }
    }
    
    console.log(`\nChange Summary:`);
    console.log(`  New repositories: ${newCount}`);
    console.log(`  Upgrades: ${upgradeCount}`);
    console.log(`  Already have same permission: ${sameCount}`);
    console.log(`  Skipped (existing higher): ${skippedCount}`);
    
    // Create filtered permissions map (only repos that need changes)
    const filteredPermissions = new Map();
    for (const [repoFullName, change] of changes.entries()) {
        filteredPermissions.set(repoFullName, change.permission);
    }
    
    return {
        filteredPermissions,
        changes,
        stats: {
            new: newCount,
            upgrade: upgradeCount,
            same: sameCount,
            skipped: skippedCount,
            total: consolidatedPermissions.size
        }
    };
}

/**
 * Generate an execution plan for consolidating team permissions
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - GitHub organization name
 * @param {Array<string>} toConsolidateTeams - Array of team slugs to consolidate permissions from
 * @param {string} intoTeam - Team slug to grant consolidated permissions to
 * @param {Array<string>} permissionsToConsolidate - Required filter for specific permissions
 * @param {string|null} maxPermissionToGive - Maximum permission level to grant, or null to disable capping
 */
async function planConsolidation(octokit, org, toConsolidateTeams, intoTeam, permissionsToConsolidate, maxPermissionToGive = null) {
    console.log(`🔍 PLAN MODE - Generating execution plan\n`);
    console.log(`Target team: ${intoTeam}`);

    const repoPermissions = await collectRepoPermissions(octokit, org, toConsolidateTeams, permissionsToConsolidate, maxPermissionToGive);
    
    // Analyze against existing permissions and filter
    const analysis = await analyzeAgainstExistingPermissions(octokit, org, intoTeam, repoPermissions);
    
    console.log(`\n📋 PLAN MODE - Generating execution plan files...`);
    console.log(`Repositories to modify: ${analysis.filteredPermissions.size} (out of ${repoPermissions.size} total)`);
    
    // Write plan files with change metadata
    const outputDir = path.join(process.cwd(), 'output');
    const { planId, jsonFile, textFile } = writePlanFiles(
        org,
        toConsolidateTeams,
        intoTeam,
        analysis.filteredPermissions,
        outputDir,
        analysis.changes,
        analysis.stats
    );
    
    console.log(`\nPlan files generated:`);
    console.log(`  Human-readable: ${textFile}`);
    console.log(`  Machine-readable: ${jsonFile}`);
    console.log(`\n📋 Review the plan file, then set EXECUTE_PLAN_FILE to "${planId}.json" in config.js to execute.`);
}

/**
 * Execute consolidation of team permissions directly (without a plan file)
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - GitHub organization name
 * @param {Array<string>} toConsolidateTeams - Array of team slugs to consolidate permissions from
 * @param {string} intoTeam - Team slug to grant consolidated permissions to
 * @param {Array<string>} permissionsToConsolidate - Required filter for specific permissions
 * @param {string|null} maxPermissionToGive - Maximum permission level to grant, or null to disable capping
 */
async function executeConsolidation(octokit, org, toConsolidateTeams, intoTeam, permissionsToConsolidate, maxPermissionToGive = null) {
    console.log(`Granting consolidated permissions to team: ${intoTeam}`);

    const repoPermissions = await collectRepoPermissions(octokit, org, toConsolidateTeams, permissionsToConsolidate, maxPermissionToGive);
    
    console.log(`\nGranting permissions to team: ${intoTeam}`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const [repoFullName, permission] of repoPermissions.entries()) {
        const [owner, repo] = repoFullName.split('/');
        
        try {
            await octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
                org: org,
                team_slug: intoTeam,
                owner: owner,
                repo: repo,
                permission: permission
            });
            
            console.log(`  ✓ ${repoFullName}: ${permission}`);
            successCount++;
        } catch (error) {
            console.error(`  ✗ ${repoFullName}: ${error.message}`);
            errors.push({ repo: repoFullName, error: error.message });
            errorCount++;
        }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Successfully granted permissions: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
        console.log(`\nErrors encountered:`);
        errors.forEach(({ repo, error }) => {
            console.log(`  ${repo}: ${error}`);
        });
    }
}

/**
 * Main execution
 */
async function main() {
    if (!config.GITHUB_TOKEN) {
        console.error("Error: GITHUB_TOKEN not set in config.js");
        process.exit(1);
    }
    
    if (!config.GITHUB_ORG) {
        console.error("Error: GITHUB_ORG not set in config.js");
        process.exit(1);
    }
    
    const octokit = new Octokit({
        auth: config.GITHUB_TOKEN
    });
    
    try {
        // Check if executing from a plan file
        if (config.EXECUTE_PLAN_FILE) {
            const outputDir = path.join(process.cwd(), 'output');
            const planFile = path.join(outputDir, config.EXECUTE_PLAN_FILE);
            
            if (!fs.existsSync(planFile)) {
                console.error(`Error: Plan file not found: ${planFile}`);
                console.error(`Make sure the plan file exists in the output/ directory.`);
                process.exit(1);
            }
            
            await executeFromPlanFile(octokit, config.GITHUB_ORG, planFile);
        } else {
            // Generate a new plan (default safe behavior)
            // Validate required config
            if (!config.TO_CONSOLIDATE_TEAMS || !Array.isArray(config.TO_CONSOLIDATE_TEAMS) || config.TO_CONSOLIDATE_TEAMS.length === 0) {
                console.error("Error: TO_CONSOLIDATE_TEAMS must be a non-empty array in config.js");
                process.exit(1);
            }
            
            if (!config.INTO_TEAM) {
                console.error("Error: INTO_TEAM not set in config.js");
                process.exit(1);
            }
            
            if (!config.PERMISSIONS_TO_CONSOLIDATE || !Array.isArray(config.PERMISSIONS_TO_CONSOLIDATE) || config.PERMISSIONS_TO_CONSOLIDATE.length === 0) {
                console.error("Error: PERMISSIONS_TO_CONSOLIDATE must be a non-empty array in config.js");
                process.exit(1);
            }
            
            // Always generate a plan when EXECUTE_PLAN_FILE is not set (safer default)
            await planConsolidation(
                octokit,
                config.GITHUB_ORG,
                config.TO_CONSOLIDATE_TEAMS,
                config.INTO_TEAM,
                config.PERMISSIONS_TO_CONSOLIDATE,
                config.MAX_PERMISSION_TO_GIVE || null
            );
        }
    } catch (error) {
        console.error("\nFatal error:", error.message);
        process.exit(1);
    }
}

// Only run main() when executed directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export {
    PERMISSION_HIERARCHY,
    permissionsObjectToArray,
    getHighestPermission,
    comparePermissions,
    capPermission,
    getTeamRepositories,
    collectRepoPermissions,
    analyzeAgainstExistingPermissions,
    executeFromPlanFile
};
