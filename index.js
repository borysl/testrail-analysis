var __base = __dirname + '/';

var fs = require('fs');
var testrailSettings = JSON.parse(fs.readFileSync(__base + 'testrailSettings.json', 'utf8'));
var teamSettings = JSON.parse(fs.readFileSync(__base + 'teamSettings.json', 'utf8'));

var JiraOperation = require(__base + 'jiraOperation');
var jiraSettings = testrailSettings.jiraSettings;
jiraSettings.login = testrailSettings.login;
jiraSettings.password = testrailSettings.password;
var jiraOperation = new JiraOperation(jiraSettings);

const PROJECT_ID = teamSettings.project_id;
const AUTOTESTS_ID = teamSettings.auto_tests_id;
const AVERAGE_TIME = teamSettings.average_manual_test_execution_time;
const UNTESTED_STATUS_ID = teamSettings.untested_status_id;

var users = [];
var manual_case_types = teamSettings.manual_case_types;
var manual_custom_executiontypes = teamSettings.manual_custom_executiontypes;

var jUrl = `${testrailSettings.jiraSettings.protocol}://${testrailSettings.jiraSettings.url}`;

var Testrail = require('testrail-api');

var testrail = new Testrail({
    host: `${testrailSettings.protocol}://${testrailSettings.url}`,
    user: testrailSettings.login,
    password: testrailSettings.password
});

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

function extractJiraTask(runName) {
    if (!runName) return null;
    var regEx = /\/([A-Z]{2,9}-\d+)-/;
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
    testrail.getTests(runInfo.Id, function(err, tests) {
        handleFatal(err, `Can't get results from suite ${runInfo.Id}`, 4);
        runInfo['Manual Time Spent (min)'] = 0;
        tests.filter(isExecutedManualTest).forEach(test => {
            runInfo['Manual Time Spent (min)'] += extractMinutes(test.estimate);
        });
        callback(runInfo);
    });
}

function convertToDateTime(unixTimestamp) {
    var int = parseInt(unixTimestamp);
    if (int) {
        return isoDate(new Date(int * 1000));
    } else {
        return 'not yet';
    }
}


testrail.getUsers(function(err, userList) {
    handleFatal(err, "Can't get users", 2);
    users = userList;

    function getUserEmail(userId) {
        var selectedUsers = users.filter(_ => _.id == userId);
        return selectedUsers.length == 1 ? selectedUsers[0].email.toLowerCase() : null;
    }

    testrail.getRuns(PROJECT_ID, function(err, runs) {
        handleFatal(err, `Can't get runs from project id=${PROJECT_ID}`, 2);

        var manualRuns = runs.filter(_ => _.created_by != AUTOTESTS_ID);
        checkInterruptCondition(manualRuns.length == 0, 'No manual runs found. Exiting.');

        console.log(`Getting statistics from ${manualRuns.length} runs.`);

        var runInfos = [];

        var extendingRunInfos = [];

        manualRuns.forEach(run => {
            var totalTests = run.passed_count + run.blocked_count + run.untested_count +
                run.retest_count + run.failed_count + run.custom_status1_count + run.custom_status2_count +
                run.custom_status3_count;

            if (totalTests > 0) {
                var jiraKey = extractJiraTask(run.name);
                if (!jiraKey) jiraKey = extractJiraTask(run.description);

                var runInfo = {
                    Id: run.id,
                    suite_id: run.suite_id,
                    name: run.name,
                    Link: `=HYPERLINK("${testrailSettings.protocol}://${testrailSettings.url}/index.php?/runs/view/${run.id}", "${run.name}")`,
                    'Created On': convertToDateTime(run.created_on),
                    'Completed On': convertToDateTime(run.completed_on),
                    'Created By': getUserEmail(run.created_by),
                    'Tests Count': totalTests,
                    'Blocked': run.blocked_count,
                    'Failed': run.failed_count,
                    'Untested': totalTests - run.blocked_count - run.failed_count - run.passed_count,
                    jiraKey: jiraKey,
                    'JIRA': jiraKey ? `=HYPERLINK("${jUrl}/browse/${jiraKey}", "${jiraKey}")` : ""
                };

                if (run.project_id != PROJECT_ID) {
                    console.log('Wrong project detected');
                    process.exit(10);
                }

                extendingRunInfos.push(new Promise(resolve => {
                    extendRunInfo(runInfo, resolve);
                    runInfos.push(runInfo);
                }));


                if (jiraKey) {
                    extendingRunInfos.push(new Promise(resolve => {
                        jiraOperation.getTimesheet(jiraKey, function(worklog) {
                            var totalHours = 0;
                            var worklogNotes = '';
                            worklog.filter(_ => _.authorEmail === runInfo['Created By']).forEach(function(worklog) {
                                totalHours += worklog.spent;
                                worklogNotes += `${worklog.spent/60}h: ${worklog.comment}`;
                            });
                            runInfo['JIRA Time Spent (min)'] = totalHours;
                            runInfo['JIRA worklog notes'] = worklogNotes;
                            resolve();
                        });
                    }));
                }
            }
        });

        Promise.all(extendingRunInfos).then(() => {
            var json2csv = require('json2csv');
            var outputFile = `testRail_${formatTodayDate()}.csv`;
            var csv = json2csv({
                data: runInfos,
                fields: ['Id', 'Link', 'Created On', 'Completed On', 'Created By', 'Tests Count', 'Blocked',
                    'Failed', 'Untested', 'JIRA', 'Manual Time Spent (min)', 'JIRA Time Spent (min)', 'JIRA worklog notes'
                ]
            });
            fs.writeFileSync(outputFile, csv, {
                encoding: 'utf-8'
            });
            console.log(`Stats are saved to ${outputFile}`);
            process.exit(0);
        });
    });
});