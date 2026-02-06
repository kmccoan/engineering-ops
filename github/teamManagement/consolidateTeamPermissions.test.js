import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
    PERMISSION_HIERARCHY,
    permissionsObjectToArray,
    getHighestPermission,
    comparePermissions,
    capPermission,
    getTeamRepositories,
    collectRepoPermissions,
    analyzeAgainstExistingPermissions,
    executeFromPlanFile
} from "./consolidateTeamPermissions.js";

// ─── Helpers ─────────────────────────────────────────────────────────

function makeApiRepo(name, permissions) {
    return {
        full_name: `org/${name}`,
        permissions
    };
}

function mockOctokit(pages) {
    let callCount = 0;
    return {
        rest: {
            teams: {
                listReposInOrg: mock.fn(async () => {
                    const data = pages[callCount] || [];
                    callCount++;
                    return { data };
                }),
                addOrUpdateRepoPermissionsInOrg: mock.fn(async () => {})
            }
        }
    };
}

function mockOctokitForTeams(teamRepos) {
    return {
        rest: {
            teams: {
                listReposInOrg: mock.fn(async ({ team_slug }) => {
                    const data = teamRepos[team_slug] || [];
                    return { data };
                }),
                addOrUpdateRepoPermissionsInOrg: mock.fn(async () => {})
            }
        }
    };
}

// ─── permissionsObjectToArray ────────────────────────────────────────

describe("permissionsObjectToArray", () => {
    it("returns empty array for null/undefined", () => {
        assert.deepEqual(permissionsObjectToArray(null), []);
        assert.deepEqual(permissionsObjectToArray(undefined), []);
    });

    it("returns only keys that are true", () => {
        const result = permissionsObjectToArray({
            admin: false, maintain: false, push: true, triage: false, pull: true
        });
        assert.deepEqual(result.sort(), ["pull", "push"]);
    });

    it("returns all keys when all true", () => {
        const result = permissionsObjectToArray({
            admin: true, maintain: true, push: true, triage: true, pull: true
        });
        assert.equal(result.length, 5);
    });

    it("returns empty array when all false", () => {
        assert.deepEqual(permissionsObjectToArray({
            admin: false, maintain: false, push: false, triage: false, pull: false
        }), []);
    });
});

// ─── getHighestPermission ────────────────────────────────────────────

describe("getHighestPermission", () => {
    it("returns null for empty array", () => {
        assert.equal(getHighestPermission([]), null);
    });

    it("returns null for non-array", () => {
        assert.equal(getHighestPermission(null), null);
        assert.equal(getHighestPermission("admin"), null);
    });

    it("returns single permission", () => {
        assert.equal(getHighestPermission(["push"]), "push");
    });

    it("returns admin as highest", () => {
        assert.equal(getHighestPermission(["pull", "push", "admin"]), "admin");
    });

    it("returns maintain over push", () => {
        assert.equal(getHighestPermission(["push", "maintain"]), "maintain");
    });

    it("returns triage over pull", () => {
        assert.equal(getHighestPermission(["pull", "triage"]), "triage");
    });
});

// ─── comparePermissions ──────────────────────────────────────────────

describe("comparePermissions", () => {
    it("returns 1 when first is higher", () => {
        assert.equal(comparePermissions("admin", "push"), 1);
    });

    it("returns -1 when first is lower", () => {
        assert.equal(comparePermissions("pull", "admin"), -1);
    });

    it("returns 0 when equal", () => {
        assert.equal(comparePermissions("push", "push"), 0);
    });

    it("handles unknown permissions as 0", () => {
        assert.equal(comparePermissions("unknown", "pull"), -1);
        assert.equal(comparePermissions("pull", "unknown"), 1);
        assert.equal(comparePermissions("unknown", "unknown"), 0);
    });
});

// ─── capPermission ───────────────────────────────────────────────────

describe("capPermission", () => {
    it("returns original when cap is null", () => {
        assert.equal(capPermission("admin", null), "admin");
    });

    it("caps admin down to push", () => {
        assert.equal(capPermission("admin", "push"), "push");
    });

    it("caps maintain down to push", () => {
        assert.equal(capPermission("maintain", "push"), "push");
    });

    it("leaves push unchanged when cap is push", () => {
        assert.equal(capPermission("push", "push"), "push");
    });

    it("leaves pull unchanged when cap is push", () => {
        assert.equal(capPermission("pull", "push"), "pull");
    });

    it("leaves triage unchanged when cap is push", () => {
        assert.equal(capPermission("triage", "push"), "triage");
    });

    it("caps admin down to triage", () => {
        assert.equal(capPermission("admin", "triage"), "triage");
    });
});

// ─── getTeamRepositories ─────────────────────────────────────────────

describe("getTeamRepositories", () => {
    it("maps admin permissions correctly", async () => {
        const octokit = mockOctokit([
            [makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true })]
        ]);
        const repos = await getTeamRepositories(octokit, "org", "team1");
        assert.equal(repos.length, 1);
        assert.equal(repos[0].permission, "admin");
    });

    it("maps push permissions correctly", async () => {
        const octokit = mockOctokit([
            [makeApiRepo("repo1", { admin: false, maintain: false, push: true, triage: true, pull: true })]
        ]);
        const repos = await getTeamRepositories(octokit, "org", "team1");
        assert.equal(repos[0].permission, "push");
    });

    it("skips repos with no permissions object (null permission)", async () => {
        const octokit = mockOctokit([
            [{ full_name: "org/repo1" }]
        ]);
        const repos = await getTeamRepositories(octokit, "org", "team1");
        assert.equal(repos.length, 0);
    });

    it("skips repos where all permissions are false", async () => {
        const octokit = mockOctokit([
            [makeApiRepo("repo1", { admin: false, maintain: false, push: false, triage: false, pull: false })]
        ]);
        const repos = await getTeamRepositories(octokit, "org", "team1");
        assert.equal(repos.length, 0);
    });

    it("paginates through multiple pages", async () => {
        const page1 = Array.from({ length: 100 }, (_, i) =>
            makeApiRepo(`repo${i}`, { admin: false, maintain: false, push: false, triage: false, pull: true })
        );
        const page2 = [makeApiRepo("repo100", { admin: false, maintain: false, push: true, triage: true, pull: true })];
        const octokit = mockOctokit([page1, page2]);
        const repos = await getTeamRepositories(octokit, "org", "team1");
        assert.equal(repos.length, 101);
    });

    it("throws on API error", async () => {
        const octokit = {
            rest: { teams: { listReposInOrg: mock.fn(async () => { throw Object.assign(new Error("Not Found"), { status: 404 }); }) } }
        };
        await assert.rejects(
            () => getTeamRepositories(octokit, "org", "bad-team"),
            { status: 404 }
        );
    });
});

// ─── collectRepoPermissions ──────────────────────────────────────────

describe("collectRepoPermissions", () => {
    it("throws when permissionsToConsolidate is empty", async () => {
        await assert.rejects(
            () => collectRepoPermissions({}, "org", ["team1"], []),
            { message: /non-empty array/ }
        );
    });

    it("collects permissions from a single team", async () => {
        const octokit = mockOctokitForTeams({
            team1: [
                makeApiRepo("repo1", { admin: false, maintain: false, push: true, triage: true, pull: true }),
                makeApiRepo("repo2", { admin: false, maintain: false, push: false, triage: false, pull: true })
            ]
        });
        const result = await collectRepoPermissions(octokit, "org", ["team1"], ["push", "pull"]);
        assert.equal(result.size, 2);
        assert.equal(result.get("org/repo1"), "push");
        assert.equal(result.get("org/repo2"), "pull");
    });

    it("filters out permissions not in the filter list", async () => {
        const octokit = mockOctokitForTeams({
            team1: [
                makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true }),
                makeApiRepo("repo2", { admin: false, maintain: false, push: true, triage: true, pull: true })
            ]
        });
        const result = await collectRepoPermissions(octokit, "org", ["team1"], ["push"]);
        assert.equal(result.size, 1);
        assert.equal(result.get("org/repo2"), "push");
    });

    it("takes highest permission when same repo appears in multiple teams", async () => {
        const octokit = mockOctokitForTeams({
            team1: [makeApiRepo("repo1", { admin: false, maintain: false, push: false, triage: false, pull: true })],
            team2: [makeApiRepo("repo1", { admin: false, maintain: false, push: true, triage: true, pull: true })]
        });
        const result = await collectRepoPermissions(octokit, "org", ["team1", "team2"], ["pull", "push"]);
        assert.equal(result.get("org/repo1"), "push");
    });

    it("caps permissions when maxPermissionToGive is set", async () => {
        const octokit = mockOctokitForTeams({
            team1: [
                makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true }),
                makeApiRepo("repo2", { admin: false, maintain: false, push: true, triage: true, pull: true }),
                makeApiRepo("repo3", { admin: false, maintain: false, push: false, triage: false, pull: true })
            ]
        });
        const result = await collectRepoPermissions(
            octokit, "org", ["team1"],
            ["admin", "push", "pull"],
            "push"
        );
        assert.equal(result.get("org/repo1"), "push"); // admin capped to push
        assert.equal(result.get("org/repo2"), "push"); // push stays push
        assert.equal(result.get("org/repo3"), "pull"); // pull stays pull
    });

    it("caps then takes highest across teams", async () => {
        const octokit = mockOctokitForTeams({
            team1: [makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true })],
            team2: [makeApiRepo("repo1", { admin: false, maintain: false, push: false, triage: false, pull: true })]
        });
        const result = await collectRepoPermissions(
            octokit, "org", ["team1", "team2"],
            ["admin", "pull"],
            "push"
        );
        // team1 has admin -> capped to push, team2 has pull -> stays pull
        // highest of (push, pull) = push
        assert.equal(result.get("org/repo1"), "push");
    });

    it("no cap when maxPermissionToGive is null", async () => {
        const octokit = mockOctokitForTeams({
            team1: [makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true })]
        });
        const result = await collectRepoPermissions(
            octokit, "org", ["team1"],
            ["admin"],
            null
        );
        assert.equal(result.get("org/repo1"), "admin");
    });
});

// ─── analyzeAgainstExistingPermissions ───────────────────────────────

describe("analyzeAgainstExistingPermissions", () => {
    it("marks repos not in target team as new", async () => {
        const octokit = mockOctokitForTeams({ "target-team": [] });
        const consolidated = new Map([["org/repo1", "push"]]);
        const result = await analyzeAgainstExistingPermissions(octokit, "org", "target-team", consolidated);
        assert.equal(result.stats.new, 1);
        assert.equal(result.filteredPermissions.get("org/repo1"), "push");
        assert.equal(result.changes.get("org/repo1").changeType, "new");
    });

    it("marks repos with higher consolidated permission as upgrade", async () => {
        const octokit = mockOctokitForTeams({
            "target-team": [makeApiRepo("repo1", { admin: false, maintain: false, push: false, triage: false, pull: true })]
        });
        const consolidated = new Map([["org/repo1", "push"]]);
        const result = await analyzeAgainstExistingPermissions(octokit, "org", "target-team", consolidated);
        assert.equal(result.stats.upgrade, 1);
        assert.equal(result.filteredPermissions.get("org/repo1"), "push");
        assert.equal(result.changes.get("org/repo1").changeType, "upgrade");
        assert.equal(result.changes.get("org/repo1").existingPermission, "pull");
    });

    it("skips repos where existing permission is higher (no downgrade)", async () => {
        const octokit = mockOctokitForTeams({
            "target-team": [makeApiRepo("repo1", { admin: true, maintain: true, push: true, triage: true, pull: true })]
        });
        const consolidated = new Map([["org/repo1", "pull"]]);
        const result = await analyzeAgainstExistingPermissions(octokit, "org", "target-team", consolidated);
        assert.equal(result.stats.skipped, 1);
        assert.equal(result.filteredPermissions.has("org/repo1"), false);
    });

    it("deduplicates repos where permission is the same", async () => {
        const octokit = mockOctokitForTeams({
            "target-team": [makeApiRepo("repo1", { admin: false, maintain: false, push: true, triage: true, pull: true })]
        });
        const consolidated = new Map([["org/repo1", "push"]]);
        const result = await analyzeAgainstExistingPermissions(octokit, "org", "target-team", consolidated);
        assert.equal(result.stats.same, 1);
        assert.equal(result.filteredPermissions.has("org/repo1"), false);
    });

    it("handles mixed scenarios correctly", async () => {
        const octokit = mockOctokitForTeams({
            "target-team": [
                makeApiRepo("existing-higher", { admin: true, maintain: true, push: true, triage: true, pull: true }),
                makeApiRepo("existing-same", { admin: false, maintain: false, push: true, triage: true, pull: true }),
                makeApiRepo("existing-lower", { admin: false, maintain: false, push: false, triage: false, pull: true })
            ]
        });
        const consolidated = new Map([
            ["org/existing-higher", "pull"],
            ["org/existing-same", "push"],
            ["org/existing-lower", "push"],
            ["org/brand-new", "pull"]
        ]);
        const result = await analyzeAgainstExistingPermissions(octokit, "org", "target-team", consolidated);
        assert.equal(result.stats.skipped, 1);
        assert.equal(result.stats.same, 1);
        assert.equal(result.stats.upgrade, 1);
        assert.equal(result.stats.new, 1);
        assert.equal(result.stats.total, 4);
        assert.equal(result.filteredPermissions.size, 2); // upgrade + new
    });
});

// ─── executeFromPlanFile ─────────────────────────────────────────────

describe("executeFromPlanFile", () => {
    const scratchDir = path.join(
        "/private/tmp/claude-501/-Users-kiramccoan-mediafly-engineering-ops-github-teamManagement",
        "test-output"
    );

    beforeEach(() => {
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(scratchDir)) {
            fs.rmSync(scratchDir, { recursive: true, force: true });
        }
    });

    it("calls API for each change in plan file", async () => {
        const planData = {
            planId: "plan-test",
            timestamp: "2026-01-01T00:00:00.000Z",
            organization: "org",
            targetTeam: "target-team",
            changes: [
                { owner: "org", repo: "repo1", fullName: "org/repo1", permission: "push" },
                { owner: "org", repo: "repo2", fullName: "org/repo2", permission: "pull" }
            ]
        };
        const planFile = path.join(scratchDir, "plan-test.json");
        fs.writeFileSync(planFile, JSON.stringify(planData), "utf8");

        const addOrUpdate = mock.fn(async () => {});
        const octokit = { rest: { teams: { addOrUpdateRepoPermissionsInOrg: addOrUpdate } } };

        await executeFromPlanFile(octokit, "org", planFile);

        assert.equal(addOrUpdate.mock.calls.length, 2);
        assert.equal(addOrUpdate.mock.calls[0].arguments[0].repo, "repo1");
        assert.equal(addOrUpdate.mock.calls[0].arguments[0].permission, "push");
        assert.equal(addOrUpdate.mock.calls[1].arguments[0].repo, "repo2");
        assert.equal(addOrUpdate.mock.calls[1].arguments[0].permission, "pull");
    });

    it("writes execution log file", async () => {
        const planData = {
            planId: "plan-log-test",
            timestamp: "2026-01-01T00:00:00.000Z",
            organization: "org",
            targetTeam: "target-team",
            changes: [
                { owner: "org", repo: "repo1", fullName: "org/repo1", permission: "push" }
            ]
        };
        const planFile = path.join(scratchDir, "plan-log-test.json");
        fs.writeFileSync(planFile, JSON.stringify(planData), "utf8");

        const octokit = { rest: { teams: { addOrUpdateRepoPermissionsInOrg: mock.fn(async () => {}) } } };
        await executeFromPlanFile(octokit, "org", planFile);

        const logFile = path.join(scratchDir, "execution-plan-log-test.txt");
        assert.ok(fs.existsSync(logFile));
        const logContent = fs.readFileSync(logFile, "utf8");
        assert.ok(logContent.includes("Successfully granted: 1"));
        assert.ok(logContent.includes("Errors: 0"));
    });

    it("continues on API errors and logs them", async () => {
        const planData = {
            planId: "plan-error-test",
            timestamp: "2026-01-01T00:00:00.000Z",
            organization: "org",
            targetTeam: "target-team",
            changes: [
                { owner: "org", repo: "repo1", fullName: "org/repo1", permission: "push" },
                { owner: "org", repo: "repo2", fullName: "org/repo2", permission: "pull" }
            ]
        };
        const planFile = path.join(scratchDir, "plan-error-test.json");
        fs.writeFileSync(planFile, JSON.stringify(planData), "utf8");

        let callCount = 0;
        const octokit = {
            rest: {
                teams: {
                    addOrUpdateRepoPermissionsInOrg: mock.fn(async () => {
                        callCount++;
                        if (callCount === 1) throw new Error("Forbidden");
                    })
                }
            }
        };

        await executeFromPlanFile(octokit, "org", planFile);

        const logFile = path.join(scratchDir, "execution-plan-error-test.txt");
        const logContent = fs.readFileSync(logFile, "utf8");
        assert.ok(logContent.includes("Successfully granted: 1"));
        assert.ok(logContent.includes("Errors: 1"));
    });

    it("uses correct team_slug from plan file", async () => {
        const planData = {
            planId: "plan-slug-test",
            timestamp: "2026-01-01T00:00:00.000Z",
            organization: "org",
            targetTeam: "my-special-team",
            changes: [
                { owner: "org", repo: "repo1", fullName: "org/repo1", permission: "push" }
            ]
        };
        const planFile = path.join(scratchDir, "plan-slug-test.json");
        fs.writeFileSync(planFile, JSON.stringify(planData), "utf8");

        const addOrUpdate = mock.fn(async () => {});
        const octokit = { rest: { teams: { addOrUpdateRepoPermissionsInOrg: addOrUpdate } } };

        await executeFromPlanFile(octokit, "org", planFile);

        assert.equal(addOrUpdate.mock.calls[0].arguments[0].team_slug, "my-special-team");
    });
});

// ─── PERMISSION_HIERARCHY ────────────────────────────────────────────

describe("PERMISSION_HIERARCHY", () => {
    it("has correct ordering", () => {
        assert.ok(PERMISSION_HIERARCHY.admin > PERMISSION_HIERARCHY.maintain);
        assert.ok(PERMISSION_HIERARCHY.maintain > PERMISSION_HIERARCHY.push);
        assert.ok(PERMISSION_HIERARCHY.push > PERMISSION_HIERARCHY.triage);
        assert.ok(PERMISSION_HIERARCHY.triage > PERMISSION_HIERARCHY.pull);
    });
});
