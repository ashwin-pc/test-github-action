const core = require("@actions/core");
const github = require("@actions/github");

// Function to extract changelog entries from the PR description
function extractChangelogEntries(prDescription) {
  const changelogSection = prDescription.match(/## Changelog([\s\S]*?)##/);
  if (changelogSection) {
    const entries = changelogSection[1]
      .trim()
      .split("\n")
      .map((entry) => entry.trim());
    return entries;
  }
  return [];
}

// Define a mapping between the prefixes and section titles
const prefixToSectionTitle = {
  fix: "Bug Fixes",
  feat: "Features",
  unknown: "Uncategorized",
  // Add more mappings if needed
};

function convertString(str, id, link) {
  const prefixes = Object.keys(prefixToSectionTitle); // add other possible values as needed
  const prefixeRegex = prefixes.join("|");
  const regex = new RegExp(`-\\s(${prefixeRegex}):(.*)`);
  const match = str.match(regex);
  if (match) {
    const [, prefix, text] = match;
    return [`- ${text} ([#${id}](${link}))`, prefix];
  }
  return [str, "unknown"];
}

async function run() {
  try {
    // Read input parameters
    const token = process.env.INPUT_TOKEN;
    const changelogPath = process.env.INPUT_CHANGELOG_PATH;

    // Set up Octokit with the provided token
    const octokit = github.getOctokit(token);

    // Get context data
    const context = github.context;
    const { owner, repo } = context.repo;
    const pullRequestNumber = context.payload.pull_request.number;
    console.log(
      `Updating changelog for PR #${pullRequestNumber}... by ${owner} in ${repo}`
    );

    // Get the content of the changelog file
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: changelogPath,
    });

    // Get the pull request details
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const prDescription = pullRequest.body || "";

    // Decode the content and add a new line
    const changelogContent = Buffer.from(fileData.content, "base64").toString();

    // Extract the changelog entries from the PR description
    const entries = extractChangelogEntries(prDescription);

    console.log(`Found ${entries.length} changelog entries.`);

    // If there are no entries, add a new entry with the PR title
    if (entries.length === 0) {
      entries.push(`- unknown: ${context.payload.pull_request.title}`);
    }

    // Update the changelog with the new entries
    let updatedChangelogContent = changelogContent;
    for (const entry of entries) {
      const [entryText, prefix] = convertString(
        entry,
        pullRequestNumber,
        context.payload.pull_request.html_url
      );

      const sectionTitle = prefixToSectionTitle[prefix[1].toLowerCase()];
      const regex = new RegExp(
        `(## \\[Unreleased\\][\\s\\S]*?### ${sectionTitle}(?:[\\s\\S]*?))(\\n[^#]|$)`,
        "i"
      );
      updatedChangelogContent = updatedChangelogContent.replace(
        regex,
        `$1\n${entryText}\n$2`
      );
    }

    const newChangelogContent = `${changelogContent}\n- PR #${pullRequestNumber}: ${context.payload.pull_request.title}`;

    // Update the changelog file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: changelogPath,
      message: `Update CHANGELOG.md for PR #${pullRequestNumber}`,
      content: Buffer.from(newChangelogContent).toString("base64"),
      sha: fileData.sha,
      branch: context.payload.pull_request.head.ref,
    });

    console.log("Changelog file updated successfully.");
  } catch (error) {
    console.trace(`Error updating changelog: ${error}`);
    process.exit(1);
  }
}

run();
