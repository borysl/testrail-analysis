global.__base = __dirname + '/';

var TestrailOperation = require(__base + 'testrailOperation');

var fs = require('fs');
var testrailSettings = JSON.parse(fs.readFileSync(__base + 'testrailSettings.json', 'utf8'));
var teamSettings = JSON.parse(fs.readFileSync(__base + 'teamSettings.json', 'utf8'));

var testrailOperation = new TestrailOperation(testrailSettings, teamSettings);

function handleFatal(err, message, code) {
    if (err) {
        console.log(err);
        console.log(`Fatal: ${message}`);
        process.exit(code);
    }
}   

function checkInterruptCondition(condition, message) {
    if (condition) {
        console.log(message);
        process.exit(0);
    }
}

// https://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
function uniq(a) {
    return a.sort().filter(function(item, pos, ary) {
        return !pos || item != ary[pos - 1];
    })
}

testrailOperation.getMilestones(function (milestones, err) {
    handleFatal(err, "Can't get milestones", 2);

    checkInterruptCondition(milestones.length == 0, 'No milestones found. Exiting');

    console.log(`Getting statistics from ${milestones.length} milestones`);

    var suiteIds = [];
    var allCases = [];

    var requestRuns = milestones.map(milestone => {
        return new Promise((resolve) => {
            testrailOperation.getRuns(milestone.id, function(runs, err) {
                handleFatal(err, `Can't get runs from milestone ${milestone.id}`, 3);
                milestone.runs = runs;
                milestone.suiteIds = uniq(runs.map(_ => _.suite_id));
                suiteIds = suiteIds.concat(milestone.suiteIds);
                resolve();
            });
        });
    });

    Promise.all(requestRuns).then((resolve) => {
        suiteIds = uniq(suiteIds);
        var requestTests = suiteIds.map(suiteId => {
            return new Promise((resolve) => {
                testrailOperation.getCases(suiteId, function (tests, err) {
                    handleFatal(err, `Can't get tests from suite ${suiteId}`, 4);
                    allCases = allCases.concat(tests);
                    resolve();
                });;
            });
        });
        
        Promise.all(requestTests).then((resolveSuites) => {
            console.log(`Milestones: ${milestones.length}`);
            console.log(`Suites: ${suiteIds.length}`);
            console.log(`Cases: ${allCases.length}`);
            process.exit(0);
        });
    });
})
