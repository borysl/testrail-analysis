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
    var allSubmilestones = [];
    var allRuns = [];

    var requestSubmilestones = milestones.map(milestone => {
        return new Promise((resolve) => {
            testrailOperation.getSubmilestones(milestone.id, function(submilestones, err) {
                handleFatal(err, `Can't get submilestones from milestone ${milestone.id}`, 3);
                milestone.submilestones = submilestones;
                allSubmilestones = allSubmilestones.concat(submilestones);
                resolve();
            });
        });
    });    

    Promise.all(requestSubmilestones).then((resolveSubmilestones) => {
        var requestRuns = allSubmilestones.map(submilestone => {
            return new Promise((resolve) => {
                testrailOperation.getRuns(submilestone.id, function(runs, err) {
                    handleFatal(err, `Can't get runs from submilestone ${submilestone.id}`, 3);
                    submilestone.runs = runs;
                    submilestone.suiteIds = uniq(runs.map(_ => _.suite_id));
                    suiteIds = suiteIds.concat(submilestone.suiteIds);
                    allRuns = allRuns.concat(runs);
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
                console.log(`Runs: ${allRuns.length}`);
                console.log(`Cases: ${allCases.length}`);
                milestones.forEach(milestone => {
                    console.log(`Project: ${milestone.name}(${milestone.id})`);
                    milestone.submilestones.forEach(submilestone => {
                        var passed_count = 0;
                        var blocked_count = 0;
                        var untested_count = 0;
                        var retest_count = 0;
                        var failed_count = 0;
                        submilestone.runs.forEach(run => {
                            passed_count += run.passed_count;
                            blocked_count += run.blocked_count;
                            untested_count += run.untested_count;
                            retest_count += run.retest_count;
                            failed_count += run.failed_count;
                        });

                        console.log(`   Submilestone: ${submilestone.name}(${submilestone.id})`);
                        console.log(`      Description: ${submilestone.description}`);
                        console.log(`      Runs: ${submilestone.runs.length}`);
                        console.log(`      passed_count: ${passed_count}`);
                        console.log(`      blocked_count: ${blocked_count}`);
                        console.log(`      untested_count: ${untested_count}`);
                        console.log(`      retest_count: ${retest_count}`);
                        console.log(`      failed_count: ${failed_count}`);
                    });
                });
                process.exit(0);
            });
        });

    });

})
