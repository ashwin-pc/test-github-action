const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    // Get the pull request title
    const title = github.context.payload.pull_request.title;
    console.log(`The pull request title is: ${title}`);

    // get the repos changelog file
    const changelog = await github.repos.getContents({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      path: "CHANGELOG.md",
    });

    // update the changelog file with a changelog entry
    const newChangelog = changelog.data + " - " + title;
    await github.repos.createOrUpdateFile({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      path: "CHANGELOG.md",
      message: "Update changelog",
      content: Buffer.from(newChangelog).toString("base64"),
      sha: changelog.data.sha,
    });

    // create a commit with the updated changelog
    const commit = await github.git.createCommit({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      message: "Update changelog",
      tree: github.context.payload.pull_request.head.sha,
      parents: [github.context.payload.pull_request.head.sha],
    });

    // update the pull request with the new commit
    await github.git.updateRef({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      ref: "heads/" + github.context.payload.pull_request.head.ref,
      sha: commit.data.sha,
    });

    // `who-to-greet` input defined in action metadata file
    // const nameToGreet = core.getInput('who-to-greet');
    // console.log(`Hello ${nameToGreet}!`);
    // const time = (new Date()).toTimeString();
    // core.setOutput("time", time);
    // // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
