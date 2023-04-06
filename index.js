const core = require("@actions/core");
const github = require("@actions/github");

// Define the prefixes that can be used in the changelog entries
const PREFIXES = [
  "feat",
  "fix",
  "perf",
  "docs",
  "refactor",
  "test",
  "build",
  "unknown",
];

// Function to extract changelog entries from the PR description
function extractChangelogEntries(prDescription) {
  const changelogSection = prDescription.match(
    /## Changelog\s*([\s\S]*?)(?:\n##|$)/
  );
  if (changelogSection) {
    const entries = changelogSection[0]
      .replace(/## Changelog\s*/, "")
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((entry) => entry.trim());
    return entries;
  }
  return [];
}

function convertString(str, id, link) {
  const prefixeRegex = PREFIXES.join("|");
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
    const changesetPath = process.env.INPUT_CHANGESET_PATH;

    // Set up Octokit with the provided token
    const octokit = github.getOctokit(token);

    // Get context data
    const context = github.context;
    const { owner, repo } = context.repo;
    const pullRequestNumber = context.payload.pull_request.number;
    console.log(
      `Adding chnageset for PR #${pullRequestNumber}... by ${owner} in ${repo}`
    );

    // Get the pull request details
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    // Extract the changelog entries from the PR description
    const prDescription = pullRequest.body || "";
    const entries = extractChangelogEntries(prDescription);

    console.log(`Found ${entries.length} changelog entries.`);

    // If there are no entries, add a new entry with the PR title
    if (entries.length === 0) {
      entries.push(`- unknown: ${context.payload.pull_request.title}`);
    }

    // Create a new changeset file and populate it with the new entries in the following format:
    // <prefix
    // - <entry> ([#<PR number>](<PR link>))
    // - <entry> ([#<PR number>](<PR link>))
    // - <entry> ([#<PR number>](<PR link>))
    // <prefix>
    // - <entry> ([#<PR number>](<PR link>))
    // - <entry> ([#<PR number>](<PR link>))
    // - <entry> ([#<PR number>](<PR link>))
    // ...
    const entryMap = entries
      .map((entry) =>
        convertString(entry, pullRequestNumber, pullRequest.html_url)
      )
      .reduce((acc, [entry, prefix]) => {
        if (!acc[prefix]) {
          acc[prefix] = [];
        }
        acc[prefix].push(entry);
        return acc;
      }, {});

    const changesetContent = Object.entries(entryMap)
      .map(([prefix, entries]) => {
        return `${prefix}\n${entries.join("\n")}`;
      })
      .join("\n\n");

    // Add the changeset file to the repo
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `${changesetPath}//${pullRequestNumber}.md`,
      message: `Add changeset for PR #${pullRequestNumber}`,
      content: Buffer.from(changesetContent).toString("base64"),
      branch: context.payload.pull_request.head.ref,
    });

    console.log("Changeset file added successfully.");
  } catch (error) {
    console.trace(`Error adding changeset: ${error}`);
    process.exit(1);
  }
}

run();
