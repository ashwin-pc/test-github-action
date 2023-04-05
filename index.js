const core = require("@actions/core");
const github = require("@actions/github");

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

    // Get the content of the changelog file
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: changelogPath,
    });

    // Decode the content and add a new line
    const changelogContent = Buffer.from(fileData.content, "base64").toString();
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
    console.error(`Error updating changelog: ${error}`);
    process.exit(1);
  }
}

run();
