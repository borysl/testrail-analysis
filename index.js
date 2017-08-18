global.__base = __dirname + '/';

var TestrailOperation = require(__base + 'testrailOperation');

var fs = require('fs');
var testrailSettings = JSON.parse(fs.readFileSync(__base + 'testrailSettings.json', 'utf8'));
var teamSettings = JSON.parse(fs.readFileSync(__base + 'teamSettings.json', 'utf8'));

const PROJECT_ID = 7;
const AUTOTESTS_ID = 9;
const AVERAGE_TIME = 10;
const UNTESTED_STATUS_ID = 3;

var users = [];
var manual_case_types = [15, 17, 20, 21];
var manual_custom_executiontypes = [1];

var jUrl = `${testrailSettings.jiraSettings.protocol}://${testrailSettings.jiraSettings.url}`;

var testrailOperation = new TestrailOperation(testrailSettings, teamSettings);

function formatTodayDate() {
    var d = new Date();
    var
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function isoDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

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

function extractJiraTask(runName) {
    if (!runName) return null;
    var regEx = /\/([A-Z]{2,9}\-\d+)\-/;
    var analyze = runName.match(regEx);
    return analyze == null ? null : analyze[1];
}

function extractMinutes(timeString) {
    var regEx = /(\d+)([mh])/;
    if (timeString == null) return AVERAGE_TIME;
    var parsed = timeString.match(regEx);
    var minutes = parseInt(parsed[1]);
    if (parsed[2] === 'h') {
        return minutes * 60;
    } else {
        return minutes;
    }
}

function isAutomatedTestCase(test) {
    return manual_case_types.indexOf(test.type_id) == -1 &&
    manual_custom_executiontypes.indexOf(test.custom_executiontype) == -1;
}

function isExecutedManualTest(test) {
    if (isAutomatedTestCase(test)) return false;
    if (test.status_id == UNTESTED_STATUS_ID) return false;
    return true;
}

function extendRunInfo(runInfo, callback) {
    testrailOperation.getTests(runInfo.id, function(tests, err) {
        handleFatal(err, `Can't get results from suite ${runInfo.id}`, 4);
        runInfo.manualTimeSpent = 0;
        tests.filter(isExecutedManualTest).forEach(test => {
            runInfo.manualTimeSpent += extractMinutes(test.estimate);
        });
        callback(runInfo);
    });
}

function convertToDateTime(unixTimestamp) {
    var int = parseInt(unixTimestamp)
    if (int) {
        return isoDate(new Date(int * 1000));
    } else {
        return "not yet";
    }
}


testrailOperation.getUsers(function (userList, err) {
    handleFatal(err, "Can't get users", 2);
    users = userList;

    function getUserName(userId) {
        var selectedUsers = users.filter(_ => _.id == userId);
        return selectedUsers.length == 1 ? selectedUsers[0].name : null;
    }

    testrailOperation.getRuns(function (runs, err) {
        handleFatal(err, `Can't get milestones from project id=${PROJECT_ID}`, 2);

        var manualRuns = runs.filter(_ => _.created_by != AUTOTESTS_ID);
        checkInterruptCondition(manualRuns.length == 0, 'No manual runs found. Exiting.');

        console.log(`Getting statistics from ${manualRuns.length} runs.`);

        var runInfos = [];

        var extendingRunInfos = [];

        manualRuns.forEach(run => {
            var totalTests = run.passed_count + run.blocked_count + run.untested_count + 
            run.retest_count + run.failed_count + run.custom_status1_count + run.custom_status2_count
            + run.custom_status3_count;
        
            if (totalTests > 0) {
                var jiraKey = extractJiraTask(run.name);
                if (!jiraKey) jiraKey = extractJiraTask(run.description);
                
                var runInfo = {
                    id: run.id,
                    suite_id : run.suite_id,
                    name: run.name,
                    link: `=HYPERLINK("${testrailSettings.protocol}://${testrailSettings.url}/index.php?/runs/view/${run.id}", "${run.name}")`,
                    created_on: convertToDateTime(run.created_on),
                    completed_on: convertToDateTime(run.completed_on),
                    created_by: getUserName(run.created_by),
                    tests_count: totalTests,
                    blocked_count: run.blocked_count,
                    failed_count: run.failed_count,
                    untested_count: totalTests - run.blocked_count - run.failed_count - run.passed_count,
                    jiraKey: jiraKey,
                    jiraTask: jiraKey ? `=HYPERLINK("${jUrl}/browse/${jiraKey}", "${jiraKey}")` : ""
                }

                if (run.project_id != PROJECT_ID) {
                    console.log('Wrong project detected');
                    process.exit(10);
                }

                extendingRunInfos.push(new Promise(resolve => {
                    extendRunInfo(runInfo, resolve);
                    runInfos.push(runInfo);
                }));
            }
        });

        Promise.all(extendingRunInfos).then(() => {
            var json2csv = require('json2csv');
            var outputFile = `testRail_${formatTodayDate()}.csv`;
            var csv = json2csv({ data: runInfos, fields: ['id','link','created_on', 'completed_on', 'created_by', 'tests_count', 'blocked_count', 'failed_count', 'untested_count', 'jiraTask', 'manualTimeSpent', 'jiraTimeSpent'  ] });
            fs.writeFileSync(outputFile, csv, { encoding: 'utf-8' });
            console.log(`Stats are saved to ${outputFile}`);
            process.exit(0);
        });
    })
});

