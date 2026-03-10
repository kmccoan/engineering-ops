import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { jiraDomain, jiraUsername, jiraApiToken, projectKeys } from './config.js';
import { writeToCSV } from '../common/csvLogger.js';

const resultsDir = path.join(process.cwd(), 'results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
}

async function fetchComponentsForProject(projectKey) {
    try {
        const response = await axios.get(`https://${jiraDomain}/rest/api/3/project/${projectKey}/components`, {
            auth: { username: jiraUsername, password: jiraApiToken },
        });
        console.log(`Fetched ${response.data.length} components for project ${projectKey}`);
        return response.data.map(component => ({ ...component, projectKey }));
    } catch (error) {
        console.error(`Error fetching components for ${projectKey}:`, error.message);
        throw error;
    }
}

async function processComponents() {
    const allComponents = [];
    for (const projectKey of projectKeys) {
        const components = await fetchComponentsForProject(projectKey);
        allComponents.push(...components);
    }

    const results = allComponents.map(component => ({
        project: component.projectKey,
        name: component.name,
        description: component.description || '',
    }));

    console.log(`\nTotal components found: ${results.length}`);

    const csvFilePath = path.join(resultsDir, 'jira_components.csv');
    const headers = ['project', 'name', 'description'];
    writeToCSV(csvFilePath, headers, results);
    console.log(`Results written to: ${csvFilePath}`);
}

processComponents();
