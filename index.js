const { setFailed, getInput, setOutput} = require("@actions/core");
const { context } = require("@actions/github");
const { exec } = require("@actions/exec");
const semver = require("semver");

function run() {
    try {
        let prerelease = getInput("prerelease", { required: false });
        let tagprefix = getInput("buildtagprefix", { required: true });
        console.log(`tagprefix is ${tagprefix}`);
        let currentVersionTag = getCurrentTag();
        console.log(`Currrent TAG is ${tagprefix}`);
        if (currentVersionTag) {
            console.log(`Already at version ${currentVersionTag}, skipping...`);
            setOutput("version", currentVersionTag);
            return;
        }

        let nextVersion = getNextVersionTag(tagprefix,{ prerelease });
        console.log(`nextv is ${nextVersion}`);
        setOutput("version", nextVersion);


    } catch (error) {
        setFailed(error.message);
    }
}

run();

function getCurrentTag() {

    exec("git fetch --tags");
    console.log(`CONTEXT SHA ${context.sha}`);
    // First Check if there is already a release tag at the head...
    let currentTags =  execGetOutput(`git tag --points-at ${context.sha}`);

    return currentTags.map(processVersion).filter(Boolean)[0];
}

 function getNextVersionTag( tagprefix , { prerelease }) {
    let allTags = execGetOutput("git tag");

    let previousVersionTags = allTags
        .map(processVersion)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return getNextDateVersion(tagprefix, previousVersionTags);
}

function getNextDateVersion(tagprefix, previousVersionTags) {
    let { year, month, day } = getDateParts();
    let newVersionParts = [`${year}`, `${month}`, `${day}`, 0];

    while (_tagExists(newVersionParts, previousVersionTags)) {
        newVersionParts[3]++;
    }
    let versionnumber = newVersionParts.join(".");
    console.log()

    let outputvar = `${tagprefix}-${versionnumber}`;
    console.log(`outputvar in getnextDateV is ${outputvar}`);
    return outputvar;
}

function _tagExists(tagParts, previousVersionTags) {
    let newTag = tagParts.join(".");

    return previousVersionTags.find((tag) => tag === newTag);
}

function processVersion(version) {
    if (!semver.valid(version)) {
        return false;
    }

    let {
        major,
        minor,
        day,
        version: parsedVersion,
    } = semver.parse(version);

    let { year: currentYear, month: currentMonth, day: currentDay } = getDateParts();

    if (major !== currentYear || minor !== currentMonth || day !== currentDay) {
        return false;
    }

    return parsedVersion;
}

function getDateParts() {
    let date = new Date();
    let year = date.getUTCFullYear().toString().substr(-2) * 1;
    let month = date.getUTCMonth() + 1;
    let day = date.getDate();

    return { year, month, day };
}

function execGetOutput(command) {
    let collectedOutput = [];
    let collectedErrorOutput = [];

    let options = {
        listeners: {
            stdout: (data) => {
                let output = data.toString().split("\n");
                collectedOutput = collectedOutput.concat(output);
            },
            stderr: (data) => {
                let output = data.toString().split("\n");
                collectedErrorOutput = collectedErrorOutput.concat(output);
            },
        },
    };

    try {
        exec(command, [], options);
    } catch (error) {
        throw new Error(collectedErrorOutput);
    }

    return collectedOutput;
}